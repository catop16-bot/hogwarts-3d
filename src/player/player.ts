import * as THREE from 'three';
import { heightAt, groundAt, WATER, STAMPS } from '../world/heightfield';
import { U } from '../core/globals';
import type { CameraRig } from '../camera/controls';
import type { Landmark } from '../landmarks/data';
import { FLOOR } from '../castle/interiors';
import { CollisionWorld } from './collision';
import { Character, type MoveMode } from './character';

const R = 0.32; // 膠囊半徑
const HEIGHT = 1.72;
const STEP = 0.55; // 可以直接跨上去的高度
const GRAVITY = 20;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _push = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _target = new THREE.Vector3();

/** 各地標的降落點 [x, z, 大約的高度]；沒列出的地標會降落在它旁邊的空地 */
const SPAWNS: Record<string, [number, number, number?]> = {
  greatHall: [-84, 108, FLOOR + 1],
  entrance: [-89, 78, FLOOR + 1],
  viaductCourtyard: [-150, 73, 72],
  viaduct: [-392, 72, 72],
  grandStaircase: [-44, 64, FLOOR + 1],
  quad: [22, 42, 72],
  clockTower: [176, -48, 72],
  clockCourtyard: [190, -48, 72],
  woodenBridge: [212, -48.2, 72],
  quidditch: [STAMPS.pitch.x, STAMPS.pitch.z],
  stoneCircle: [STAMPS.stoneCircle.x - 6, STAMPS.stoneCircle.z + 4],
  hagrid: [STAMPS.hagrid.x - 14, STAMPS.hagrid.z - 12],
  hogsmeade: [STAMPS.hogsmeade.x + 6, STAMPS.hogsmeade.z + 4],
  station: [STAMPS.station.x + 4, STAMPS.station.z + 14],
  boathouse: [STAMPS.boathouse.x + 14, STAMPS.boathouse.z + 2],
  willow: [STAMPS.willow.x + 22, STAMPS.willow.z + 10],
};

/** 第三人稱角色：移動、碰撞、騎掃帚、游泳，以及跟隨鏡頭 */
const _side = new THREE.Vector3();
const _orig = new THREE.Vector3();
const RAYS: [number, number][] = [[0, 0], [0.32, 0.22], [-0.32, 0.22], [0.32, -0.22], [-0.32, -0.22]];

export class Player {
  readonly character = new Character();
  readonly pos = new THREE.Vector3(-160, 70.3, 72);
  readonly vel = new THREE.Vector3();
  mode: MoveMode = 'walk';
  active = false;
  grounded = false;
  house = 0;
  /** 獨立的室內場景裡不能騎掃帚 */
  noFly = false;
  /** 在室內：鏡頭拉近，免得一直撞牆 */
  indoor = false;
  onChange?: () => void;

  private yaw = Math.PI / 2;
  private camYaw = -Math.PI / 2;
  private camPitch = 0.22;
  private camDist = 5.2;
  private curDist = 5.2;
  private keys = new Set<string>();
  private dragging = false;
  private bank = 0;
  private wasSwimming = false;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
    private world: CollisionWorld,
    private rig: CameraRig,
  ) {
    this.character.root.visible = false;
    const saved = parseInt(localStorage.getItem('hogwarts.house') || '0');
    this.setHouse(Number.isFinite(saved) ? saved : 0);
    window.addEventListener('keydown', (e) => {
      if (!this.active || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      this.dragging = true;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointerup', () => (this.dragging = false));
    dom.addEventListener('pointercancel', () => (this.dragging = false));
    dom.addEventListener('pointermove', (e) => {
      if (!this.active || !this.dragging) return;
      this.camYaw -= e.movementX * 0.0042;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.0036, -0.55, 1.35);
    });
    dom.addEventListener(
      'wheel',
      (e) => {
        if (!this.active) return;
        this.camDist = THREE.MathUtils.clamp(this.camDist * (e.deltaY < 0 ? 0.88 : 1.14), 1.6, 16);
        e.preventDefault();
      },
      { passive: false },
    );
  }

  /** 角色面向（0 = +Z） */
  get heading() {
    return this.yaw;
  }

  setHouse(i: number) {
    this.house = ((i % 4) + 4) % 4;
    this.character.setHouse(this.house);
    localStorage.setItem('hogwarts.house', String(this.house));
    this.onChange?.();
  }

  /** 找出 (x,z) 上可以站的高度 */
  private standAt(x: number, z: number, yHint?: number) {
    const terrain = Math.max(heightAt(x, z), WATER - 0.5);
    if (yHint != null) {
      const f = this.world.floorBelow(x, yHint + 2, z, 12);
      return Math.max(f ?? -1e9, terrain);
    }
    const f = this.world.floorBelow(x, terrain + 400, z, 400);
    return Math.max(f ?? -1e9, terrain);
  }

  /** 進入漫遊模式；可以指定落腳處 */
  enter(x?: number, z?: number, yHint?: number, face?: number) {
    if (x != null && z != null) {
      this.pos.set(x, this.standAt(x, z, yHint) + 0.05, z);
      this.vel.set(0, 0, 0);
      if (face != null) {
        this.yaw = face;
        this.camYaw = face + Math.PI;
      }
    } else if (!this.active && this.pos.y < this.standAt(this.pos.x, this.pos.z, this.pos.y) - 0.5) {
      this.pos.y = this.standAt(this.pos.x, this.pos.z);
    }
    this.mode = 'walk';
    this.curDist = Math.min(this.camDist, 3);
    this.active = true;
    this.character.root.visible = true;
    this.keys.clear();
    this.rig.setMode('walk');
    this.onChange?.();
  }

  /** 降落在某個地標旁 */
  enterAt(l: Landmark) {
    const s = SPAWNS[l.id];
    if (s) {
      const face = Math.atan2(l.pos[0] - s[0], l.pos[2] - s[1]);
      this.enter(s[0], s[1], s[2], l.id === 'greatHall' ? -Math.PI / 2 : l.id === 'entrance' ? Math.PI / 2 : face);
      return;
    }
    // 沿著建議觀看方向退到地標外側
    const d = l.radius * 0.95 + 10;
    const x = l.pos[0] + Math.sin(l.az) * d;
    const z = l.pos[2] + Math.cos(l.az) * d;
    this.enter(x, z, undefined, l.az + Math.PI);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.character.root.visible = false;
    this.keys.clear();
    this.rig.flyTo(_target.copy(this.pos).setY(this.pos.y + 4), 22, this.camYaw, 0.5);
    this.onChange?.();
  }

  /** 模式被別處切走（例如按了導覽）時收尾 */
  deactivate() {
    this.active = false;
    this.character.root.visible = false;
    this.keys.clear();
  }

  toggleLumos() {
    if (!this.active) return;
    this.character.setLumos(!this.character.lumos);
    this.onChange?.();
  }

  toggleBroom() {
    if (!this.active) return true;
    if (this.mode === 'broom') {
      this.mode = 'walk';
    } else if (this.noFly) {
      return false;
    } else {
      this.mode = 'broom';
      this.vel.y = Math.max(this.vel.y, 3.5);
      this.grounded = false;
    }
    this.onChange?.();
    return true;
  }

  private has(...codes: string[]) {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  update(dt: number) {
    if (!this.active) return;
    const f = (this.has('KeyW', 'ArrowUp') ? 1 : 0) - (this.has('KeyS', 'ArrowDown') ? 1 : 0);
    const r = (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
    const sprint = this.has('ShiftLeft', 'ShiftRight');
    // 不拖曳時，橫向移動會讓鏡頭慢慢轉到角色身後
    if (!this.dragging && r !== 0 && f >= 0) this.camYaw -= r * (this.mode === 'broom' ? 1.1 : 0.75) * dt;
    // 往前走時，鏡頭慢慢繞回角色身後（拖曳視角時不干擾）
    if (!this.dragging && f > 0 && this.mode !== 'broom') {
      const hsNow = Math.hypot(this.vel.x, this.vel.z);
      if (hsNow > 1) {
        const want = this.yaw + Math.PI;
        const d = Math.atan2(Math.sin(want - this.camYaw), Math.cos(want - this.camYaw));
        this.camYaw += d * Math.min(1, dt * (this.indoor ? 1.6 : 0.9));
      }
    }
    const sy = Math.sin(this.camYaw);
    const cy = Math.cos(this.camYaw);
    const speedNow = Math.hypot(this.vel.x, this.vel.z, this.mode === 'broom' ? this.vel.y : 0);
    const steps = THREE.MathUtils.clamp(Math.ceil(Math.max(dt * 90, (speedNow * dt) / 0.22)), 1, 14);
    const h = dt / steps;
    let swimming = false;

    for (let i = 0; i < steps; i++) {
      const p = this.pos;
      const v = this.vel;
      if (this.mode === 'broom') {
        // ---- 飛行：朝鏡頭看的方向前進
        const pitch = THREE.MathUtils.clamp(-(this.camPitch - 0.22) * 1.15, -1.1, 1.1);
        const cp = Math.cos(pitch);
        const sp = sprint ? 58 : 24;
        let wx = (-sy * cp * f + cy * r * 0.6) * sp;
        let wz = (-cy * cp * f - sy * r * 0.6) * sp;
        let wy = Math.sin(pitch) * f * sp + ((this.has('Space') ? 1 : 0) - (this.has('KeyC', 'ControlLeft') ? 1 : 0)) * 12;
        const k = 1 - Math.exp(-h * 2.6);
        v.x += (wx - v.x) * k;
        v.y += (wy - v.y) * k;
        v.z += (wz - v.z) * k;
        p.addScaledVector(v, h);
        _a.set(p.x, p.y + 0.45, p.z);
        _b.set(p.x, p.y + 1.35, p.z);
        this.world.resolveCapsule(_a, _b, 0.42, _push);
        p.add(_push);
        if (_push.lengthSq() > 1e-8) {
          // 撞到東西：去掉朝向障礙物的速度分量
          const n = _dir.copy(_push).normalize();
          const vn = v.dot(n);
          if (vn < 0) v.addScaledVector(n, -vn);
        }
        const floor = groundAt(p.x, p.z) + 0.35;
        if (p.y < floor) {
          p.y = floor;
          if (v.y < 0) v.y = 0;
        }
        if (p.y > 900) p.y = 900;
        this.grounded = false;
      } else {
        // ---- 步行
        const sp = this.wasSwimming ? 2.4 : sprint ? 8.6 : 4.6;
        const len = Math.hypot(f, r) || 1;
        const wx = ((-sy * f + cy * r) / len) * sp;
        const wz = ((-cy * f - sy * r) / len) * sp;
        const k = 1 - Math.exp(-h * (this.grounded || this.wasSwimming ? 12 : 2.5));
        v.x += (wx - v.x) * k;
        v.z += (wz - v.z) * k;
        v.y -= GRAVITY * h;
        if (this.grounded && this.has('Space')) {
          v.y = 7;
          this.grounded = false;
        }
        const ox = p.x;
        const oz = p.z;
        p.x += v.x * h;
        p.z += v.z * h;
        p.y += v.y * h;
        // 牆：膠囊從跨步高度往上算，矮台階不會擋路
        _a.set(p.x, p.y + STEP + R, p.z);
        _b.set(p.x, p.y + HEIGHT - R, p.z);
        this.world.resolveCapsule(_a, _b, R, _push);
        p.x += _push.x;
        p.z += _push.z;
        if (_push.y < -1e-4 && v.y > 0) v.y = 0; // 撞到天花板
        // 地形太陡就上不去
        const hd = Math.hypot(p.x - ox, p.z - oz);
        if (hd > 1e-5) {
          const ax = ox + ((p.x - ox) / hd) * 0.45;
          const az = oz + ((p.z - oz) / hd) * 0.45;
          const h0 = heightAt(ox, oz);
          if (p.y - h0 < 0.3 && heightAt(ax, az) - h0 > 0.45 * 1.7) {
            p.x = ox;
            p.z = oz;
            v.x *= 0.5;
            v.z *= 0.5;
          }
        }
        // 地板：地形、冰面、建築的樓板取最高者
        let floor = heightAt(p.x, p.z);
        let water = false;
        if (floor < WATER) {
          if (U.uIce.value > 0.55) floor = WATER + 0.03;
          else if (floor < WATER - 1.3) {
            floor = WATER - 0.5;
            water = true;
          }
        }
        const drop = this.grounded ? 0.5 : Math.max(0.05, -v.y * h + 0.02);
        const mf = this.world.floorBelow(p.x, p.y + STEP + 0.05, p.z, STEP + 0.05 + drop);
        if (mf != null && mf > floor) {
          floor = mf;
          water = false;
        }
        if (v.y <= 0 && (p.y <= floor + 0.001 || (this.grounded && p.y - floor < 0.5))) {
          // 貼地：上下台階時稍微平滑
          p.y = p.y < floor ? Math.min(floor, p.y + Math.max(0.02, 9 * h)) : Math.max(floor, p.y - 6 * h);
          if (floor - p.y > STEP) p.y = floor;
          v.y = 0;
          this.grounded = true;
        } else {
          this.grounded = false;
        }
        swimming = water && p.y <= floor + 0.3;
      }
    }
    this.wasSwimming = swimming;

    // ---- 角色朝向與動作
    const hs = Math.hypot(this.vel.x, this.vel.z);
    let turn = 0;
    if (this.mode === 'broom') {
      const want = hs > 1.5 ? Math.atan2(this.vel.x, this.vel.z) : this.camYaw + Math.PI;
      turn = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
      this.yaw += turn * Math.min(1, dt * 5);
      this.bank += (THREE.MathUtils.clamp(-turn * 1.4, -0.7, 0.7) - this.bank) * Math.min(1, dt * 4);
    } else if (hs > 0.4 && (f !== 0 || r !== 0)) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      turn = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
      this.yaw += turn * Math.min(1, dt * 11);
    }
    const ch = this.character;
    ch.root.position.copy(this.pos);
    ch.root.rotation.y = this.yaw;
    ch.animate(dt, { speed: hs, vy: this.vel.y, grounded: this.grounded, mode: swimming ? 'swim' : this.mode, bank: this.bank, turn: dt > 0 ? (turn * Math.min(1, dt * 11)) / dt : 0 });

    this.updateCamera(dt);
  }

  private updateCamera(dt: number) {
    const cam = this.camera;
    const cp = Math.cos(this.camPitch);
    _dir.set(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
    const flying = this.mode === 'broom';
    _target.set(this.pos.x, this.pos.y + (flying ? 1.25 : 1.5), this.pos.z);
    const want = this.indoor && !flying ? Math.min(this.camDist, 3.6) : this.camDist * (flying ? 1.35 : 1);
    let limit = want;
    // 除了正中央，再往四個角各打一條射線，鏡頭邊緣才不會鑽進牆裡
    _side.set(_dir.z, 0, -_dir.x).normalize();
    for (const [sx, sy] of RAYS) {
      _orig.copy(_target).addScaledVector(_side, sx).setY(_target.y + sy);
      const hit = this.world.rayDistance(_orig, _dir, want + 0.4);
      if (hit != null) limit = Math.min(limit, hit - 0.3);
    }
    // 別讓鏡頭鑽進地形
    for (let i = 1; i <= 6; i++) {
      const d = (want * i) / 6;
      if (d > limit) break;
      const x = _target.x + _dir.x * d;
      const z = _target.z + _dir.z * d;
      if (_target.y + _dir.y * d < groundAt(x, z) + 0.35) {
        limit = Math.max(0.4, d - want / 6);
        break;
      }
    }
    limit = Math.max(0.35, limit);
    if (limit < this.curDist) this.curDist = limit;
    else this.curDist += (limit - this.curDist) * Math.min(1, dt * 5);
    cam.position.copy(_target).addScaledVector(_dir, this.curDist);
    const g = groundAt(cam.position.x, cam.position.z) + 0.3;
    if (cam.position.y < g) cam.position.y = g;
    cam.lookAt(_target);
    cam.updateMatrixWorld();
    this.character.root.visible = this.curDist > 0.8;
    this.rig.focus.copy(this.pos);
    this.rig.viewDist = flying ? 260 : 140;
  }
}
