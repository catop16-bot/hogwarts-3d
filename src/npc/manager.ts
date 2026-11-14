import * as THREE from 'three';
import { SCENES, PORTALS, SPOTS, ANCHORS, type SceneDef, type Spot } from '../castle/scenes/registry';
import type { SceneManager } from '../castle/scenes/manager';
import type { CollisionWorld } from '../player/collision';
import type { TimeSystem } from '../environment/timeSystem';
import { heightAt, WATER, STAMPS } from '../world/heightfield';
import { U } from '../core/globals';
import { QUIDDITCH_NPC, quidditchFlight } from '../fx/events';
import { ROSTER, type NpcDef } from './roster';
import { timeCtx, COMMON_ROOMS, DORMS, type Clip, type Slot, type TimeCtx } from './schedule';
import { PLACES, CIRCLES } from './places';
import { createBody, type NpcBody } from './model';

const SIT = new Set<Clip>(['sit', 'sit_talk', 'sit_read']);
const STANDING_TALK = new Set<Clip>(['idle', 'hands_back', 'arms_crossed', 'read', 'teach', 'stir', 'wave', 'talk']);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const PITCH = new THREE.Vector3(STAMPS.pitch.x, heightAt(STAMPS.pitch.x, STAMPS.pitch.z), STAMPS.pitch.z);
/** 'fly:3' → 3：沿魁地奇路線飛的編號 */
const flyIndex = (at?: string) => (at?.startsWith('fly:') ? parseInt(at.slice(4)) : -1);

interface Target {
  pos: THREE.Vector3;
  face: number;
  pose: Clip;
  /** 來回巡走的另一端 */
  patrol?: THREE.Vector3;
}

export class Npc {
  slot: Slot | null = null;
  key = '';
  scene: SceneDef | null = null;
  target: Target | null = null;
  body: NpcBody | null = null;
  loading = false;
  shown = false;
  /** 時段一換、玩家又在同一個場景：從門口走進來 */
  arrive = false;
  /** 走出門之後才隱藏 */
  leaving = false;
  readonly pos = new THREE.Vector3();
  yaw = 0;
  path: THREE.Vector3[] = [];
  patrolLeg = 0;
  talkUntil = 0;
  line = 0;
  /** 降頻更新時累積的時間 */
  acc = 0;
  /** 路人學生：這個時段的場景已經沒有空位，不出現 */
  noRoom = false;
  private reserved: string | null = null;
  constructor(readonly def: NpcDef, readonly index: number) {}

  reserve(key: string | null) {
    if (this.reserved) RESERVED.delete(this.reserved);
    this.reserved = key;
    if (key) RESERVED.set(key, this.def.id);
  }
}

const RESERVED = new Map<string, string>();

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const sceneById = new Map<string, SceneDef>();
function sceneOf(id?: string) {
  if (!id) return null;
  if (!sceneById.size) for (const s of SCENES) sceneById.set(s.id, s);
  return sceneById.get(id) ?? null;
}

export interface TalkResult {
  name: string;
  title: string;
  line: string;
}

/** 管理所有 NPC：依時刻表決定位置，只為玩家附近或同一個場景的人建立模型 */
export class NpcManager {
  readonly group = new THREE.Group();
  readonly npcs: Npc[];
  ctx: TimeCtx;
  private acc = 1;
  private frame = 0;
  private warned = new Set<string>();
  private byId = new Map<string, Npc>();

  constructor(
    private scenes: SceneManager,
    private world: CollisionWorld,
    private time: TimeSystem,
  ) {
    this.group.name = 'npcs';
    this.npcs = ROSTER.map((d, i) => new Npc(d, i));
    for (const n of this.npcs) this.byId.set(n.def.id, n);
    this.ctx = timeCtx(time);
  }

  /** 每幀呼叫：cam 是鏡頭位置，player 是玩家位置（沒有在走路時為 null） */
  update(dt: number, cam: THREE.Vector3, player: THREE.Vector3 | null) {
    this.frame++;
    this.acc += dt;
    const fast = this.time.speed >= 600;
    if (this.acc > 0.5) {
      this.acc = 0;
      this.ctx = timeCtx(this.time);
      for (const n of this.npcs) this.schedule(n, fast);
    }
    const active = this.scenes.active;
    const focus = player ?? cam;
    for (const n of this.npcs) {
      // 跟著某人的寵物：場景隨主人變
      const lead = this.leader(n);
      if (lead) n.scene = lead.scene;
      const want = !!n.slot && !n.noRoom && (lead ? lead.shown && !!lead.body && !lead.leaving : this.visible(n, active, cam));
      if (want && !n.shown && !n.leaving) this.show(n, active);
      else if (!want && n.shown && !n.leaving) this.hide(n);
      if (!n.shown || !n.body) continue;
      this.move(n, dt, fast);
      const d = n.pos.distanceTo(focus);
      this.face(n, dt, player, d);
      // 遠處的人降頻更新動畫：12 公尺內每幀、30 公尺內每 3 幀、更遠每 6 幀；路人再慢一倍
      const every = (d < 12 ? 1 : d < 30 ? 3 : 6) * (n.def.crowd && d >= 12 ? 2 : 1);
      n.acc += dt;
      if (this.frame % every === n.index % every) {
        n.body.update(n.acc);
        n.acc = 0;
      }
      // 影子只畫近處的具名角色
      n.body.setShadow(!n.def.crowd && !n.def.ghost && d < 25);
      if (player && !SIT.has(n.body.pose) && n.body.pose !== 'sleep' && n.body.pose !== 'fly' && !n.def.ghost) this.push(n, player);
    }
  }

  private leader(n: Npc) {
    const at = n.slot?.at;
    return at?.startsWith('follow:') ? (this.byId.get(at.slice(7)) ?? null) : null;
  }

  /** 走路用的動作：幽靈與皮皮鬼是飄過去的 */
  private walkClip(n: Npc): Clip {
    return n.def.ghost || n.def.hover ? 'float' : 'walk';
  }

  // ---------------------------------------------------------------- 時刻表
  private schedule(n: Npc, fast: boolean) {
    const slot = n.def.routine(this.ctx);
    const key = slot ? `${slot.scene ?? ''}|${slot.at}|${slot.pose ?? ''}` : '';
    if (key === n.key) {
      n.slot = slot;
      return;
    }
    const prevScene = n.scene;
    const oldFly = flyIndex(n.slot?.at);
    if (oldFly >= 0) QUIDDITCH_NPC.delete(oldFly);
    const fly = flyIndex(slot?.at);
    if (fly >= 0 && slot?.tag === 'event') QUIDDITCH_NPC.add(fly);
    n.key = key;
    n.slot = slot;
    n.scene = sceneOf(slot?.scene);
    if (slot?.scene && !n.scene && !this.warned.has(slot.scene)) {
      this.warned.add(slot.scene);
      console.warn(`NPC：找不到場景 ${slot.scene}`);
    }
    n.reserve(null);
    n.target = null;
    n.noRoom = false;
    if (!slot) {
      if (n.shown) this.leave(n, fast);
      return;
    }
    const active = this.scenes.active;
    if (n.shown && !fast) {
      // 同一區：直接走過去；換到別處：先走到門口再消失
      const same = n.scene === prevScene || (!!n.scene && !!prevScene && !!n.scene.zone && n.scene.zone === prevScene.zone);
      if (same || this.visible(n, active, n.pos)) {
        this.scenes.ensure(n.scene);
        n.target = this.resolve(n);
        n.path = n.target ? [n.target.pos.clone()] : [];
        if (n.target) n.body?.play(this.walkClip(n), 0.3);
      } else this.leave(n, fast);
    } else if (n.shown) {
      this.hide(n);
    } else {
      n.arrive = !fast && !!n.scene && n.scene === active;
    }
  }

  private visible(n: Npc, active: SceneDef | null, cam: THREE.Vector3) {
    const s = n.scene;
    if (s) {
      if (active && (s === active || (!!s.zone && s.zone === active.zone))) return true;
      if (s.pocket || active?.pocket) return false;
      return s.box.distanceToPoint(cam) < 45;
    }
    if (active?.pocket || !n.slot) return false;
    const p = this.outXZ(n);
    const far = n.slot.at.startsWith('fly:') || n.slot.at.startsWith('pitch.') ? 260 : 160;
    return p ? Math.hypot(p[0] - cam.x, p[1] - cam.z) < far : false;
  }

  private outXZ(n: Npc): [number, number] | null {
    if (n.target) return [n.target.pos.x, n.target.pos.z];
    const at = n.slot?.at ?? '';
    if (at.startsWith('fly:')) return [PITCH.x, PITCH.z];
    const anc = ANCHORS.get(at);
    if (anc) return [anc.pos[0], anc.pos[2]];
    if (!at.startsWith('out:')) return null;
    const p = PLACES[at.slice(4)];
    return p ? [p.x, p.z] : null;
  }

  // ---------------------------------------------------------------- 出現與消失
  private show(n: Npc, active: SceneDef | null) {
    if (!n.body) {
      if (n.loading) return;
      n.loading = true;
      createBody(n.def.model, { ghost: n.def.ghost, stride: n.def.stride })
        .then((b) => {
          n.body = b;
          b.root.rotation.order = 'YXZ';
        })
        .catch((e) => console.warn(`NPC 模型載入失敗：${n.def.model}`, e))
        .finally(() => (n.loading = false));
      return;
    }
    // 路人等具名角色先挑好位子
    if (n.def.crowd && n.scene && this.npcs.some((o) => !o.def.crowd && o.scene === n.scene && o.slot && !o.shown && (o.loading || !o.body))) return;
    this.scenes.ensure(n.scene);
    n.target ??= this.resolve(n);
    const t = n.target;
    if (!t) return;
    const door = n.arrive && n.scene === active ? this.nearestDoor(n.scene!, t.pos) : null;
    n.arrive = false;
    if (door) {
      n.pos.copy(door);
      n.path = [t.pos.clone()];
      n.body.play(this.walkClip(n), 0);
      n.yaw = Math.atan2(t.pos.x - door.x, t.pos.z - door.z);
    } else {
      n.pos.copy(t.pos);
      n.path = [];
      n.yaw = t.face;
      n.body.play(t.pose, 0);
    }
    n.shown = true;
    this.place(n);
    this.group.add(n.body.root);
  }

  private hide(n: Npc) {
    n.shown = false;
    n.leaving = false;
    n.path = [];
    n.body?.root.removeFromParent();
  }

  private leave(n: Npc, fast: boolean) {
    const s = this.sceneAtNpc(n);
    const door = !fast && s ? this.nearestDoor(s, n.pos) : null;
    if (!door || !n.body) return this.hide(n);
    n.leaving = true;
    n.path = [door];
    n.body.play(this.walkClip(n), 0.3);
  }

  private sceneAtNpc(n: Npc) {
    return this.scenes.sceneAt(_w.copy(n.pos).setY(n.pos.y + 0.5));
  }

  private nearestDoor(s: SceneDef, from: THREE.Vector3) {
    let best: THREE.Vector3 | null = null;
    let bd = Infinity;
    for (const p of PORTALS) {
      _v.set(p.pos[0], p.pos[1] + 0.5, p.pos[2]);
      if (!s.box.containsPoint(_v)) continue;
      const d = _v.distanceToSquared(from);
      if (d < bd) {
        bd = d;
        best = new THREE.Vector3(p.pos[0], p.pos[1], p.pos[2]);
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- 位置
  private resolve(n: Npc): Target | null {
    const slot = n.slot!;
    const s = n.scene;
    const at = slot.at;
    const pose = (k: Clip) => slot.pose ?? k;
    if (at.startsWith('fly:')) return { pos: PITCH.clone().setY(PITCH.y + 12), face: 0, pose: 'broom' };
    if (at.startsWith('follow:')) {
      const lead = this.leader(n);
      if (!lead?.shown) return null;
      return { pos: this.followGoal(n, lead), face: lead.yaw, pose: pose('idle') };
    }
    if (at.startsWith('circle:')) {
      const c = CIRCLES[at.slice(7)];
      return c ? { pos: new THREE.Vector3(c.cx, (s ? s.spawn[1] : this.ground(c.cx, c.cz)) + c.y, c.cz), face: 0, pose: 'fly' } : null;
    }
    if (!s && ANCHORS.has(at)) {
      const anc = ANCHORS.get(at)!;
      return { pos: new THREE.Vector3(...anc.pos), face: anc.face, pose: pose('idle') };
    }
    if (at.startsWith('out:')) {
      const p = PLACES[at.slice(4)];
      if (!p) return null;
      let x = p.x;
      let z = p.z;
      let face = p.face;
      if (p.ring?.cluster) {
        // 依學院分成小圈：每一圈的中心排在大圓上，圈裡的人面向圈心
        const same = this.npcs.filter((o) => o.slot?.at === at);
        // 同學院、每四個人一圈
        const key = (o: Npc) => {
          const h = o.def.house ?? 9;
          return `${h}:${Math.floor(same.filter((q) => (q.def.house ?? 9) === h).indexOf(o) / 4)}`;
        };
        const keys = same.map(key);
        const groups = [...new Set(keys)];
        const mine = key(n);
        const g = groups.indexOf(mine);
        const mates = same.filter((_, j) => keys[j] === mine);
        const i = mates.indexOf(n);
        const ga = p.ring.from + ((p.ring.to - p.ring.from) * (g + 0.5)) / groups.length;
        const gx = p.ring.cx + Math.sin(ga) * p.ring.r;
        const gz = p.ring.cz + Math.cos(ga) * p.ring.r;
        const r = 0.75 + 0.18 * mates.length;
        const a = (i / mates.length) * Math.PI * 2 + ga;
        x = gx + Math.sin(a) * r;
        z = gz + Math.cos(a) * r;
        face = a + Math.PI;
      } else if (p.ring) {
        // 同一個地點的人排成面向中心的半圓
        const same = this.npcs.filter((o) => o.slot?.at === at);
        const i = same.indexOf(n);
        const k = same.length > 1 ? i / (same.length - 1) : 0.5;
        const a = p.ring.from + (p.ring.to - p.ring.from) * (p.ring.to - p.ring.from >= Math.PI * 1.99 ? i / Math.max(1, same.length) : k);
        x = p.ring.cx + Math.sin(a) * p.ring.r;
        z = p.ring.cz + Math.cos(a) * p.ring.r;
        face = a + Math.PI;
      }
      return { pos: new THREE.Vector3(x, this.ground(x, z), z), face, pose: pose('idle') };
    }
    if (!s) return null;
    const anc = ANCHORS.get(at);
    if (anc) {
      return { pos: new THREE.Vector3(...anc.pos), face: anc.face, pose: pose(anc.kind === 'seat' ? 'sit' : anc.kind === 'bed' ? 'sleep' : 'idle') };
    }
    if (at === 'seat' || at === 'bed' || at === 'board' || at === 'work' || at === 'perch') {
      const spot = this.pickSpot(n, s, at);
      if (spot) {
        const p = new THREE.Vector3(...spot.pos);
        if (at === 'board' || at === 'work') p.y = this.floor(p.x, p.y + 0.3, p.z) ?? p.y;
        return { pos: p, face: spot.face, pose: pose(at === 'seat' ? 'sit' : at === 'bed' ? 'sleep' : at === 'board' ? 'teach' : 'idle') };
      }
      if (at === 'perch') {
        // 沒有棲架：站在場景裡
        return this.stand(n, s, 'idle');
      }
      // 位置滿了：路人學生就不出現；具名角色改站在場景裡
      if (n.def.crowd) {
        n.noRoom = true;
        return null;
      }
      return this.stand(n, s, slot.pose && SIT.has(slot.pose) ? 'idle' : (slot.pose ?? 'idle'));
    }
    if (at === 'patrol') {
      const t = this.stand(n, s, 'walk');
      const [a, b] = this.axisPoints(s);
      t.pos.copy(a);
      t.patrol = b;
      t.pose = 'walk';
      return t;
    }
    return this.stand(n, s, pose('idle'));
  }

  private pickSpot(n: Npc, s: SceneDef, kind: Spot['kind']): Spot | null {
    const list = SPOTS.filter((p) => p.kind === kind && s.box.containsPoint(_v.set(p.pos[0], p.pos[1] + 0.1, p.pos[2])));
    if (!list.length) return null;
    // 學生依學院從同一個位置往後找，同學院的人會坐在一起
    const start = hash(n.def.kind === 'student' ? `${s.id}:${n.def.house}` : n.def.id) % list.length;
    for (let i = 0; i < list.length; i++) {
      const sp = list[(start + i) % list.length];
      const key = `${s.id}:${kind}:${sp.pos.join(',')}`;
      const who = RESERVED.get(key);
      if (!who || who === n.def.id) {
        n.reserve(key);
        return sp;
      }
    }
    return null;
  }

  /** 場景裡的空地：從入口往裡走幾步，再依人錯開；踩到家具（比地板高）就換一個點 */
  private stand(n: Npc, s: SceneDef, pose: Clip): Target {
    const [sx, sy, sz, sf] = s.spawn;
    const b = s.box;
    let best: THREE.Vector3 | null = null;
    let face = sf;
    for (let k = 0; k < 10; k++) {
      const h = hash(`${n.def.id}${s.id}${k}`);
      const fwd = 2 + (h % 7) * 0.7;
      const side = (((h >> 4) % 9) - 4) * 0.8;
      const x = THREE.MathUtils.clamp(sx + Math.sin(sf) * fwd + Math.cos(sf) * side, b.min.x + 0.8, b.max.x - 0.8);
      const z = THREE.MathUtils.clamp(sz + Math.cos(sf) * fwd - Math.sin(sf) * side, b.min.z + 0.8, b.max.z - 0.8);
      const y = this.floor(x, sy + 1.5, z);
      if (y == null || Math.abs(y - sy) > 0.35) continue;
      // 別跟已經站好的人疊在一起
      if (this.npcs.some((o) => o !== n && o.target && o.target.pos.distanceToSquared(_v.set(x, y, z)) < 0.8)) continue;
      best = new THREE.Vector3(x, y, z);
      face = sf + ((h >> 8) % 5 - 2) * 0.5;
      break;
    }
    best ??= new THREE.Vector3(sx + Math.sin(sf) * 1.5, sy, sz + Math.cos(sf) * 1.5);
    return { pos: best, face, pose };
  }

  /** 場景長軸上的兩端（巡夜用） */
  private axisPoints(s: SceneDef): [THREE.Vector3, THREE.Vector3] {
    const b = s.box;
    const c = b.getCenter(new THREE.Vector3());
    const sz = b.getSize(new THREE.Vector3());
    const y0 = s.spawn[1];
    const a = new THREE.Vector3();
    const e = new THREE.Vector3();
    if (sz.x > sz.z) {
      a.set(b.min.x + sz.x * 0.18, y0, c.z);
      e.set(b.max.x - sz.x * 0.18, y0, c.z);
    } else {
      a.set(c.x, y0, b.min.z + sz.z * 0.18);
      e.set(c.x, y0, b.max.z - sz.z * 0.18);
    }
    a.y = this.floor(a.x, y0 + 1.5, a.z) ?? y0;
    e.y = this.floor(e.x, y0 + 1.5, e.z) ?? y0;
    return [a, e];
  }

  private floor(x: number, yTop: number, z: number) {
    return this.world.floorBelow(x, yTop, z, 4);
  }

  /** 戶外的地面：只找地形附近的平台（庭院、步道），不會站到屋頂上 */
  private ground(x: number, z: number) {
    const terrain = Math.max(heightAt(x, z), WATER - 0.5);
    const f = this.world.floorBelow(x, terrain + 4.5, z, 9);
    return Math.max(f ?? -1e9, terrain);
  }

  /** 跟隨的位置：主人斜後方 */
  private followGoal(n: Npc, lead: Npc) {
    // 主人越高大，跟得越開（海格與牙牙）
    const k = THREE.MathUtils.clamp((lead.body?.height ?? 1.8) / 1.8, 0.6, 1.8);
    const side = (hash(n.def.id) % 2 ? 1 : -1) * 0.55 * k;
    const back = -0.7 * k;
    const c = Math.cos(lead.yaw);
    const sn = Math.sin(lead.yaw);
    const x = lead.pos.x + side * c + back * sn;
    const z = lead.pos.z - side * sn + back * c;
    const y = lead.scene || this.sceneAtNpc(lead) ? (this.floor(x, lead.pos.y + 0.6, z) ?? lead.pos.y) : this.ground(x, z);
    return new THREE.Vector3(x, y, z);
  }

  /** 依姿勢把模型放到位置上：坐著時臀部落在座位上；幽靈離地飄著 */
  private place(n: Npc) {
    const b = n.body!;
    const sit = SIT.has(b.pose) && n.def.kind !== 'animal';
    b.root.position.set(n.pos.x, n.pos.y - (sit ? 0.41 * b.scale : 0) + (n.def.hover ?? 0), n.pos.z);
    b.root.rotation.y = n.yaw;
  }

  // ---------------------------------------------------------------- 移動
  private move(n: Npc, dt: number, fast: boolean) {
    const b = n.body!;
    const t = n.target;
    const fi = flyIndex(n.slot?.at);
    if (fi >= 0) {
      // 騎掃帚沿著魁地奇的路線飛；練球時飛低一點
      n.yaw = quidditchFlight(fi, U.uTime.value, PITCH, n.pos);
      if (n.slot?.tag !== 'event') n.pos.y -= 5;
      n.path = [];
      if (b.pose !== 'broom') b.play('broom', 0.2);
      b.setBroom(true);
      b.root.position.copy(n.pos);
      b.root.rotation.y = n.yaw;
      return;
    }
    b.setBroom(false);
    const at = n.slot?.at ?? '';
    if (at.startsWith('circle:')) {
      // 在場景上空繞圈飛（早上送信的貓頭鷹）
      const c = CIRCLES[at.slice(7)];
      const base = n.scene ? n.scene.spawn[1] : this.ground(c.cx, c.cz);
      const a = U.uTime.value * 0.45 + n.index * 1.9;
      const r = c.r * (0.7 + 0.3 * Math.sin(n.index * 2.3));
      n.pos.set(c.cx + Math.sin(a) * r, base + c.y + Math.sin(a * 2.1 + n.index) * 1.2, c.cz + Math.cos(a) * r);
      n.yaw = a + Math.PI / 2;
      if (b.pose !== 'fly') b.play('fly', 0.2);
      b.root.position.copy(n.pos);
      b.root.rotation.y = n.yaw;
      return;
    }
    const lead = this.leader(n);
    if (lead) {
      if (!lead.shown) return;
      const goal = this.followGoal(n, lead);
      const dx = goal.x - n.pos.x;
      const dz = goal.z - n.pos.z;
      const d = Math.hypot(dx, dz);
      const rest = n.slot?.pose ?? 'idle';
      if (d > 8 || fast) n.pos.copy(goal);
      else if (d > 0.35) {
        const step = Math.min(d, Math.max(n.def.speed ?? 1.4, d * 1.5) * dt);
        n.pos.x += (dx / d) * step;
        n.pos.z += (dz / d) * step;
        n.pos.y += (goal.y - n.pos.y) * Math.min(1, dt * 10);
        n.yaw = turnToward(n.yaw, Math.atan2(dx, dz), dt * 8);
        if (b.pose !== 'walk') b.play('walk', 0.2);
        b.stride(step);
      } else {
        n.yaw = turnToward(n.yaw, lead.yaw, dt * 3);
        if (b.pose === 'walk') b.play(SIT.has(lead.body?.pose ?? 'idle') ? (rest === 'idle' ? 'lie' : rest) : 'idle', 0.4);
      }
      this.place(n);
      return;
    }
    if (!n.path.length && t?.patrol) {
      // 巡夜：在兩端之間來回
      n.patrolLeg ^= 1;
      n.path = [n.patrolLeg ? t.patrol.clone() : t.pos.clone()];
      b.play(this.walkClip(n), 0.4);
    }
    if (n.path.length) {
      const goal = n.path[0];
      const dx = goal.x - n.pos.x;
      const dz = goal.z - n.pos.z;
      const d = Math.hypot(dx, dz);
      const step = (fast ? 40 : (n.def.speed ?? 1.25 * b.scale)) * dt;
      if (d <= step || d < 0.05) {
        n.pos.copy(goal);
        n.path.shift();
        if (!n.path.length) {
          if (n.leaving) return this.hide(n);
          if (t && !t.patrol) {
            b.play(t.pose, 0.35);
          }
        }
      } else {
        n.pos.x += (dx / d) * step;
        n.pos.z += (dz / d) * step;
        const target = Math.atan2(dx, dz);
        n.yaw = turnToward(n.yaw, target, dt * 6);
        const fy = n.scene || this.sceneAtNpc(n) ? this.floor(n.pos.x, n.pos.y + 1.2, n.pos.z) : this.ground(n.pos.x, n.pos.z);
        if (fy != null) n.pos.y += (fy - n.pos.y) * Math.min(1, dt * 10);
        b.stride(step);
      }
    }
    this.place(n);
  }

  /** 說話時轉向玩家：站著的人整個轉過來，坐著的只轉頭 */
  private face(n: Npc, dt: number, player: THREE.Vector3 | null, d: number) {
    const b = n.body!;
    const talking = performance.now() < n.talkUntil && !!player;
    let look = 0;
    if (player && d < 4 && !n.path.length && b.pose !== 'sleep') {
      const want = Math.atan2(player.x - n.pos.x, player.z - n.pos.z);
      const diff = wrap(want - n.yaw);
      if (talking && !SIT.has(b.pose) && !n.target?.patrol) {
        n.yaw = turnToward(n.yaw, want, dt * 4);
        b.root.rotation.y = n.yaw;
        if (STANDING_TALK.has(b.pose) && b.pose !== 'talk') b.play('talk', 0.3);
      } else if (Math.abs(diff) < 1.6) look = THREE.MathUtils.clamp(diff, -1.1, 1.1);
    }
    if (!talking && b.pose === 'talk' && n.target && n.target.pose !== 'talk' && !n.path.length) {
      b.play(n.target.pose, 0.5);
      n.yaw = n.target.face;
    }
    b.look = look;
  }

  /** 玩家撞到站著的 NPC 時被推開 */
  private push(n: Npc, p: THREE.Vector3) {
    const r = n.def.kind === 'animal' ? 0.15 + n.body!.height * 0.22 : 0.42 * n.body!.scale + 0.3;
    const dx = p.x - n.pos.x;
    const dz = p.z - n.pos.z;
    const d = Math.hypot(dx, dz);
    if (d >= r || d < 1e-4 || Math.abs(p.y - n.pos.y) > 1.6) return;
    p.x = n.pos.x + (dx / d) * r;
    p.z = n.pos.z + (dz / d) * r;
  }

  // ---------------------------------------------------------------- 對話
  nearest(p: THREE.Vector3, max = 2.6): Npc | null {
    let best: Npc | null = null;
    let bd = max * max;
    for (const n of this.npcs) {
      if (!n.shown || n.leaving || !n.body || flyIndex(n.slot?.at) >= 0 || n.slot?.at.startsWith('circle:')) continue;
      if (Math.abs(p.y - n.pos.y) > 2.2) continue;
      const d = (p.x - n.pos.x) ** 2 + (p.z - n.pos.z) ** 2;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  distanceTo(n: Npc, p: THREE.Vector3) {
    return Math.hypot(p.x - n.pos.x, p.z - n.pos.z);
  }

  talk(n: Npc, house: number): TalkResult {
    const c = this.ctx;
    const here = this.scenes.active?.id;
    const home = here === COMMON_ROOMS[house] || here === DORMS[house];
    const late = n.def.kind === 'staff' ? c.hour >= 21 || c.hour < 6.5 : c.hour >= 21.5 || c.hour < 6.5;
    const curfew = late && !home && (n.def.kind === 'staff' || n.def.kind === 'student');
    const lines = n.def.lines({ slot: n.slot!, c, house, curfew });
    const line = lines[n.line % lines.length];
    n.line++;
    n.talkUntil = performance.now() + 6000;
    return { name: n.def.name, title: n.def.title, line };
  }

  /** 人物清單用：某人此刻在哪裡，以及前往的落腳點（x, y, z, 面向）；不在城堡時 to 為 null */
  locate(n: Npc, depth = 0): { where: string; to: [number, number, number, number] | null } {
    const slot = n.slot ?? n.def.routine(this.ctx);
    if (!slot) return { where: '不在城堡裡', to: null };
    const at = slot.at;
    const lead = this.leader(n);
    if (lead && depth < 3) return this.locate(lead, depth + 1);
    const out = (name: string, x: number, z: number): { where: string; to: [number, number, number, number] } => {
      const y = this.ground(x, z);
      return { where: name, to: [x, y, z, 0] };
    };
    if (at.startsWith('fly:') || at.startsWith('pitch.')) return out('魁地奇球場', PLACES.pitch.x, PLACES.pitch.z - 6);
    if (at.startsWith('out:')) {
      const p = PLACES[at.slice(4)];
      if (p) {
        // 落在那個地點旁邊幾步，面向那裡
        const x = p.x + Math.sin(p.face) * 3;
        const z = p.z + Math.cos(p.face) * 3;
        const r = out(p.name, x, z);
        r.to![3] = p.face + Math.PI;
        return r;
      }
    }
    const s = sceneOf(slot.scene);
    if (s) return { where: s.name || '城堡裡', to: [...s.spawn] as [number, number, number, number] };
    return { where: '城堡裡', to: null };
  }

  /** 除錯用：某人此刻的安排 */
  where(id: string) {
    const n = this.npcs.find((o) => o.def.id === id);
    return n ? { slot: n.slot, shown: n.shown, pos: n.pos.toArray(), scene: n.scene?.id } : null;
  }
}

function wrap(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function turnToward(cur: number, want: number, k: number) {
  return cur + wrap(want - cur) * Math.min(1, k);
}
