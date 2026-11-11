import * as THREE from 'three';
import { Builder, col, mat4 } from '../kit';
import { getMaterials } from '../materials';
import { PL } from '../../world/heightfield';
import { room, pane, torch, GOLD, IRON, FIRE, DARKWOOD, MARBLE, IWARM } from '../interiors';
import {
  At, roundRoom, door, bookshelf, table, chair, armchair, sofa, fireplace, chandelier, portrait, bed, blackboard, studentDesk,
  potionShelf, roundTable, deskLamp, STEEL, WHITE, BLACK, GREENLAMP,
} from './kit';
import { registerScene, link, box3, pocketOrigin, PORTALS, SIGNS, SCENES, type DoorEnd, type SceneLight } from './registry';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const BLUE = col(0.05, 0.1, 0.42);
const BRONZE = col(0.5, 0.3, 0.12);
const NIGHT = col(0.015, 0.025, 0.11);
const RED = col(0.5, 0.035, 0.04);

/** 圓塔塔底的門：a 是方位角（0 朝 +Z），門面向塔外 */
export const roundDoor = (cx: number, cz: number, r: number, a: number, name: string): DoorEnd => ({
  pos: [cx + Math.sin(a) * (r * 1.1 + 0.1), PL, cz + Math.cos(a) * (r * 1.1 + 0.1)],
  face: a,
  name,
});

/** 第 6 批：城堡各塔與附屬建築的入口（castle.ts 依這些位置畫門廊） */
export const TOWER_DOORS = {
  gryffindor: roundDoor(128, 96, 11, Math.PI, '葛來分多塔'),
  ravenclawAnnex: roundDoor(-155, -55, 5.2, -Math.PI / 2, '雷文克勞塔'),
  ravenclawWing: { pos: [-143 + Math.sin(0.72) * 6.46, PL, -68 + Math.cos(0.72) * 6.46], face: 0.72, name: '雷文克勞塔' } as DoorEnd,
  dada: roundDoor(77, -4, 11.5, Math.PI, '黑魔法防禦術塔'),
  gargoyle: roundDoor(-98, 16, 9.5, 0, '校長室塔'),
  staffRoom: { pos: [-74, PL, 16 + 7.46], face: 0, name: '城堡西側' } as DoorEnd,
  astronomyNorth: { pos: [-118, PL, -108.7], face: Math.PI, name: '天文塔' } as DoorEnd,
  astronomyAnnex: roundDoor(-94, -78, 6.5, Math.PI / 2, '天文塔'),
  divinationAnnex: roundDoor(73, -116, 4.6, 0, '北塔'),
  mugglesWing: { pos: [152 - 6.96, PL, -20], face: -Math.PI / 2, name: '鐘樓庭院' } as DoorEnd,
  hospitalTower: roundDoor(152, 66, 7, 0, '醫院廂房'),
  hospitalWing: { pos: [118, PL, 42 + 5.96], face: 0, name: '城堡東側' } as DoorEnd,
};

/** 只有單向的傳送門：塔裡的門通往已經有入口的場景 */
export function oneWay(from: DoorEnd, sceneId: string, label: string) {
  const s = SCENES.find((x) => x.id === sceneId);
  if (!s) return;
  const pos: [number, number, number] = [from.pos[0] + Math.sin(from.face) * 1.9, from.pos[1], from.pos[2] + Math.cos(from.face) * 1.9];
  PORTALS.push({ pos, label, to: s.spawn });
  SIGNS.push({ text: label, pos: [from.pos[0] + Math.sin(from.face) * 0.12, from.pos[1] + 3.75, from.pos[2] + Math.cos(from.face) * 0.12], ry: from.face });
}

/** 螺旋梯走到頂端時的方位角 */
function spiralEnd(rIn: number, rOut: number, a0: number, top: number) {
  return a0 + Math.round(top / 0.22) * (0.62 / ((rIn + rOut) / 2));
}

/** 沿著圓牆盤旋的石階 */
function spiral(b: Builder, cx: number, cy: number, cz: number, rIn: number, rOut: number, a0: number, top: number, tint: THREE.Color, key: 'istone' | 'iwood' = 'istone') {
  const n = Math.round(top / 0.22);
  const da = 0.62 / ((rIn + rOut) / 2);
  for (let i = 0; i < n; i++) {
    const a = a0 + i * da;
    const yy = cy + (i + 1) * 0.22;
    new At(b, cx + Math.sin(a) * ((rIn + rOut) / 2), yy - 0.35, cz + Math.cos(a) * ((rIn + rOut) / 2), a).box(key, 0.7, 0.35, rOut - rIn, 0, 0, 0, tint);
  }
  return a0 + n * da;
}

export interface ChamberDef {
  k: number;
  id: string;
  name: string;
  intro: string;
  /** 圓形房間給 r；長方形給 w、d */
  r?: number;
  w?: number;
  d?: number;
  h: number;
  tint?: THREE.Color;
  lights: (o: [number, number, number]) => SceneLight[];
  ambient?: number;
  outside?: DoorEnd;
  /** 入口在房間的哪裡（預設南牆正中）：回傳門的位置與朝內的方向 */
  entry?: (o: [number, number, number]) => { x: number; z: number; face: number };
  fill: (b: Builder, o: [number, number, number], ring: (a: number, d: number, yy?: number) => At) => void;
  extraHeight?: number;
  zone?: string;
  /** 進場時離門多遠、轉頭多少（預設 2.6 公尺、面向房間） */
  spawnDist?: number;
  spawnTurn?: number;
}

/** 建一個延遲生成的口袋房間，回傳它的入口（DoorEnd） */
export function chamber(c: ChamberDef): DoorEnd {
  const o = pocketOrigin(c.k);
  const [ox, oy, oz] = o;
  const round = c.r != null;
  const hw = round ? c.r! : c.w! / 2;
  const hd = round ? c.r! : c.d! / 2;
  const e = c.entry ? c.entry(o) : { x: ox, z: oz + hd - (round ? 0.05 : 0), face: Math.PI };
  const end: DoorEnd = { pos: [e.x, oy, e.z], face: e.face, name: c.name };
  registerScene({
    id: c.id,
    name: c.name,
    intro: c.intro,
    box: box3(ox - hw - 0.5, oy - 1, oz - hd - 0.5, ox + hw + 0.5, oy + c.h + (c.extraHeight ?? (round ? c.r! * 0.6 : 0)), oz + hd + 0.5),
    lights: c.lights(o),
    spawn: [e.x + Math.sin(e.face) * (c.spawnDist ?? 2.6), oy, e.z + Math.cos(e.face) * (c.spawnDist ?? 2.6), e.face + (c.spawnTurn ?? 0)],
    pocket: true,
    zone: c.zone,
    ambient: c.ambient ?? 0.35,
    build: () => {
      const b = new Builder(760 + c.k);
      const tint = c.tint ?? IWARM;
      if (round) roundRoom(b, ox, oy, oz, c.r!, c.h, tint, c.r! * 0.6);
      else room(b, { x0: ox - hw, x1: ox + hw, z0: oz - hd, z1: oz + hd, y: oy, h: c.h, t: 0.3, shell: false, ceil: c.h, itint: tint });
      door(new At(b, e.x, oy, e.z, e.face), 1.7, 2.9);
      const ring = (a: number, d: number, yy = 0) => new At(b, ox + Math.sin(a) * d, oy + yy, oz + Math.cos(a) * d, a + Math.PI);
      c.fill(b, o, ring);
      return b.build(c.id, getMaterials());
    },
  });
  if (c.outside) link(c.outside, end);
  return end;
}

export const warm = (p: [number, number, number], i = 120, d = 18, color = 0xffc890): SceneLight => ({ pos: p, intensity: i, dist: d, color });

export function buildTowerPockets() {
  // ================================================================ 葛來分多塔的樓梯間
  {
    const k = 27;
    const [ox, oy, oz] = pocketOrigin(k);
    const r = 6.5;
    const top = 10;
    const A = spiralEnd(r - 2.0, r - 0.1, 0.5, top) + 0.75;
    const fat: DoorEnd = { pos: [ox + Math.sin(A) * (r - 0.05), oy + top, oz + Math.cos(A) * (r - 0.05)], face: A + Math.PI, name: '胖女士' };
    chamber({
      k,
      id: 'gryffindorStairs',
      name: '葛來分多塔的樓梯間',
      intro: '塔底一路盤旋而上的石階，牆上掛滿畫像。最上面就是穿粉紅色絲綢衣裳的胖女士，記得先說通關密語。',
      r,
      h: top + 4.5,
      tint: col(1.2, 1.0, 0.86),
      outside: TOWER_DOORS.gryffindor,
      lights: () => [warm([ox, oy + 3, oz], 90, 16), warm([ox, oy + top + 2, oz], 110, 16)],
      fill: (b, _o, ring) => {
        const end = spiral(b, ox, oy, oz, r - 2.0, r - 0.1, 0.5, top, MARBLE);
        // 頂端的平台
        for (let i = 0; i < 12; i++) {
          const a = end - 0.1 + (i / 11) * 1.7;
          new At(b, ox + Math.sin(a) * (r - 1.2), oy + top - 0.35, oz + Math.cos(a) * (r - 1.2), a).box('istone', 1.2, 0.35, 2.4, 0, 0, 0, MARBLE);
        }
        // 胖女士的畫像（門）
        const p = new At(b, fat.pos[0], oy + top, fat.pos[2], fat.face);
        p.box('iplain', 2.0, 3.2, 0.12, 0, 0, 0.06, GOLD);
        p.box('iplain', 1.7, 2.9, 0.06, 0, 0.15, 0.13, col(0.12, 0.06, 0.08));
        p.cyl('iplain', 0.35, 0.65, 1.4, 0, 0.35, 0.18, 10, col(0.95, 0.55, 0.65));
        p.sphere('iplain', 0.38, 0, 1.95, 0.2, col(0.95, 0.55, 0.65), 0.9, 8);
        p.sphere('iplain', 0.2, 0, 2.5, 0.22, col(0.85, 0.65, 0.5), 1.1, 8);
        p.sphere('iplain', 0.22, 0, 2.65, 0.18, col(0.35, 0.22, 0.12), 0.8, 8);
        // 一路上的畫像與火把
        for (let i = 0; i < 12; i++) {
          const a = 0.8 + i * 0.52;
          portrait(ring(a, r - 0.05, 1.4 + i * 0.75), 0.8 + (i % 3) * 0.2, 1.0 + (i % 2) * 0.3);
          if (i % 3 === 1) torch(b, ox + Math.sin(a + 0.25) * r, oy + 2.6 + i * 0.75, oz + Math.cos(a + 0.25) * r, a + 0.25 + Math.PI);
        }
        b.box('iplain', 2.2, 0.02, 3, ox, oy, oz + 2.5, 0, RED);
      },
    });
    oneWay(fat, 'gryffindorCommon', '葛來分多交誼廳');
  }

  // ================================================================ 雷文克勞閱覽室（副塔）
  chamber({
    k: 28,
    id: 'ravenclawReading',
    name: '雷文克勞閱覽室',
    intro: '副塔裡安靜的閱覽室。中央的天象儀慢慢轉著，書架上全是雷文克勞學生捐的藏書。',
    r: 6,
    h: 5.5,
    tint: col(1.05, 1.08, 1.18),
    outside: TOWER_DOORS.ravenclawAnnex,
    ambient: 0.5,
    lights: ([x, y, z]) => [warm([x, y + 4.2, z], 120, 16, 0xe6ecff), warm([x, y + 1.2, z], 50, 6, 0xffe0a0)],
    fill: (b, [x, y, z], ring) => {
      for (const a of [1.0, 1.8, 2.6, 3.4, 4.2, 5.0]) bookshelf(ring(a, 5.55), 2.6, 4.2, false, col(0.6, 0.62, 0.7));
      // 天象儀：發光的太陽與一圈圈的行星
      b.cyl('iplain', 0.5, 0.7, 0.9, x, y, z, 10, BRONZE);
      b.sphere('iglow', 0.32, x, y + 1.6, z, col(3.5, 2.6, 0.9), 1, 12);
      for (let i = 0; i < 6; i++) {
        const rr = 0.8 + i * 0.42;
        const a = i * 1.7;
        b.rod('iplain', V(x, y + 1.6, z), V(x + Math.sin(a) * rr, y + 1.6 + (i % 2) * 0.1, z + Math.cos(a) * rr), 0.012, GOLD, 4);
        b.sphere('iplain', 0.07 + (i % 3) * 0.05, x + Math.sin(a) * rr, y + 1.6 + (i % 2) * 0.1, z + Math.cos(a) * rr, [col(0.6, 0.4, 0.3), col(0.3, 0.45, 0.8), col(0.8, 0.5, 0.25), col(0.75, 0.7, 0.55)][i % 4], 1, 8);
        b.add('iplain', new THREE.TorusGeometry(rr, 0.006, 3, 40).rotateX(Math.PI / 2), mat4(x, y + 1.6, z), BRONZE);
      }
      for (const a of [0.5, -0.5]) {
        const t = ring(a, 3.6);
        table(t, 1.6, 0.8);
        deskLamp(t.at(0.5, 0.76, 0));
        chair(t.at(0, 0, -0.75));
        t.box('iplain', 0.4, 0.06, 0.3, -0.3, 0.76, 0, BLUE, 0.3);
      }
      b.cyl('iplain', 3.2, 3.2, 0.02, x, y, z, 30, BLUE);
      b.cyl('iplain', 2.9, 2.9, 0.025, x, y, z, 30, NIGHT);
    },
  });

  // ================================================================ 古代魔文教室（雷文克勞塔旁的廂房）
  chamber({
    k: 29,
    id: 'runes',
    name: '古代魔文教室',
    intro: '牆上刻滿符文，桌上攤著魔文字典與一塊塊刻字的石板。妙麗最喜歡的選修課。',
    w: 15,
    d: 11,
    h: 6,
    tint: col(1.05, 1.05, 1.1),
    outside: TOWER_DOORS.ravenclawWing,
    lights: ([x, y, z]) => [warm([x, y + 4.5, z], 170, 22)],
    fill: (b, [x, y, z]) => {
      blackboard(new At(b, x, y + 1.4, z - 5.5), 5, 2);
      // 刻在牆上的符文帶
      const rng = b.rng;
      for (const [px, pz, ry, len] of [[x, z - 5.48, 0, 14], [x - 7.48, z, Math.PI / 2, 10], [x + 7.48, z, -Math.PI / 2, 10]] as const) {
        const p = new At(b, px, y + 4.2, pz, ry);
        p.box('iplain', len, 0.6, 0.03, 0, 0, 0.01, col(0.55, 0.5, 0.42));
        for (let i = 0; i < len * 2.5; i++) {
          const lx = -len / 2 + 0.2 + i * 0.4;
          p.box('iplain', 0.03, 0.4, 0.02, lx, 0.1, 0.03, col(0.2, 0.15, 0.1));
          p.geo('iplain', new THREE.BoxGeometry(0.2, 0.03, 0.02), lx + 0.05, 0.2 + rng() * 0.2, 0.03, col(0.2, 0.15, 0.1), 0, 0, (rng() - 0.5) * 1.6);
        }
      }
      const desk = new At(b, x - 4, y, z - 3.6);
      table(desk, 2.4, 1.1);
      chair(desk.at(0, 0, -0.9));
      for (let i = 0; i < 4; i++) desk.box('iplain', 0.3, 0.06, 0.2, -0.8 + i * 0.4, 0.76, 0.1, col(0.5, 0.5, 0.48), i * 0.4);
      for (let r = 0; r < 2; r++) for (const lx of [-3.5, 0, 3.5]) {
        const p = new At(b, x + lx, y, z - 0.8 + r * 2.3, Math.PI);
        studentDesk(p, 2.2);
        p.box('iplain', 0.5, 0.12, 0.35, -0.4, 0.82, 0.1, col(0.35, 0.2, 0.12));
        p.box('iplain', 0.24, 0.04, 0.18, 0.4, 0.82, 0.1, col(0.55, 0.53, 0.5));
      }
      bookshelf(new At(b, x + 5.2, y, z - 5.2), 3.6, 3.6);
      for (const pz of [-2, 2]) pane(b, 1.6, 3.4, x - 7.49, y + 1.8, z + pz, Math.PI / 2);
    },
  });

  // ================================================================ 黑魔法防禦術教授的辦公室（接第 2 批教室講台旁的樓梯）
  {
    const [cx, cy, cz] = pocketOrigin(6);
    const classDoor: DoorEnd = { pos: [cx - 5, cy + 3.45, cz - 11.5], face: 0, name: '黑魔法防禦術教室' };
    chamber({
      k: 30,
      id: 'dadaOffice',
      name: '黑魔法防禦術教授的辦公室',
      intro: '講台樓梯上去的辦公室。窺鏡裡晃著模糊的人影，牆角那個衣櫃一直在抖，最好別打開。',
      w: 9,
      d: 8,
      h: 4.6,
      tint: col(0.95, 0.92, 0.9),
      outside: classDoor,
      lights: ([x, y, z]) => [warm([x, y + 3.6, z], 80, 14), warm([x - 2, y + 1.4, z - 2.6], 40, 6, 0xff9a50)],
      fill: (b, [x, y, z]) => {
        const desk = new At(b, x - 1.5, y, z - 2.6);
        table(desk, 2.2, 1.0, 0.8);
        chair(desk.at(0, 0, -0.8));
        // 窺探器：桌上一個會轉的玻璃陀螺
        desk.cyl('iplain', 0.08, 0.02, 0.18, 0.6, 0.8, 0.1, 8, col(0.6, 0.7, 0.75));
        desk.sphere('iglow', 0.03, 0.6, 1.0, 0.1, col(1.5, 0.3, 0.2));
        desk.box('iplain', 0.4, 0.05, 0.3, -0.4, 0.8, 0, col(0.3, 0.2, 0.12));
        // 窺鏡
        {
          const m = new At(b, x + 4.48, y + 1.0, z - 1.5, -Math.PI / 2);
          m.box('iplain', 1.3, 1.9, 0.08, 0, 0, 0.04, col(0.2, 0.18, 0.15));
          m.box('iplain', 1.1, 1.7, 0.02, 0, 0.1, 0.09, col(0.12, 0.13, 0.15));
          for (let i = 0; i < 3; i++) m.sphere('iplain', 0.12, -0.3 + i * 0.3, 1.0 + (i % 2) * 0.2, 0.1, col(0.3, 0.3, 0.32), 2, 6);
        }
        // 關著幻形怪的衣櫃（微微歪著）
        {
          const w = new At(b, x - 3.7, y, z + 1.5, Math.PI / 2 + 0.06);
          w.box('iwood', 1.6, 2.5, 0.8, 0, 0, 0, col(0.25, 0.18, 0.14));
          for (const s of [-1, 1]) w.box('iplain', 0.7, 2.1, 0.03, s * 0.37, 0.2, 0.41, col(0.3, 0.22, 0.17));
          w.sphere('iplain', 0.04, 0.08, 1.3, 0.44, GOLD);
        }
        // 水缸裡的滾帶落
        {
          const t = new At(b, x + 2.6, y, z + 2.8, Math.PI);
          t.box('iwood', 1.6, 0.8, 0.8, 0, 0, 0, DARKWOOD);
          t.box('iplain', 1.5, 0.9, 0.7, 0, 0.8, 0, col(0.12, 0.3, 0.26));
          t.sphere('iplain', 0.14, 0.2, 1.2, 0, col(0.2, 0.45, 0.25), 1.2, 7);
          for (let i = 0; i < 4; i++) t.box('iplain', 0.02, 0.3, 0.02, 0.1 + i * 0.06, 1.0, 0.05, col(0.2, 0.45, 0.25), i * 0.5);
        }
        bookshelf(new At(b, x + 2, y, z - 3.7), 3, 3.4);
        pane(b, 1.4, 2.4, x, y + 1.6, z + 3.99, Math.PI);
        b.box('iplain', 3, 0.02, 2.4, x - 0.5, y, z, 0, col(0.3, 0.08, 0.06));
      },
    });
  }

  // ================================================================ 決鬥練習室（黑魔法防禦術塔塔底）
  chamber({
    k: 31,
    id: 'duelling',
    name: '決鬥社練習室',
    intro: '洛哈教授辦決鬥社的地方：中央一條長長的決鬥台，兩旁是看台與練習用的木頭人。',
    w: 16,
    d: 26,
    h: 9,
    tint: col(0.95, 0.95, 1.0),
    outside: TOWER_DOORS.dada,
    ambient: 0.45,
    lights: ([x, y, z]) => [warm([x, y + 6.5, z - 6], 180, 26, 0xe8ecff), warm([x, y + 6.5, z + 6], 180, 26, 0xe8ecff)],
    fill: (b, [x, y, z]) => {
      // 決鬥台
      b.box('iwood', 3, 1.0, 16, x, y, z - 1, 0, DARKWOOD);
      b.box('iplain', 2.4, 0.03, 15.4, x, y + 1.0, z - 1, 0, col(0.35, 0.08, 0.1));
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.box('iwood', 1.4, 0.33, 0.6, x, y + i * 0.33, z - 1 + s * (8 + 0.3 + (2 - i) * 0.6), 0, DARKWOOD);
      // 兩側的看台
      for (const s of [-1, 1]) {
        for (let t = 0; t < 3; t++) b.box('iwood', 1.4, 0.45 * (t + 1), 18, x + s * (5 + t * 1.3), y, z - 1, 0, col(0.6, 0.5, 0.42));
        for (let i = 0; i < 4; i++) {
          const p = new At(b, x + s * 7.95, y + 3, z - 9 + i * 6, (-s * Math.PI) / 2);
          p.box('iplain', 1.2, 3.4, 0.04, 0, 0, 0, [RED, col(0.85, 0.6, 0.06), BLUE, col(0.03, 0.24, 0.09)][i]);
        }
      }
      // 練習用的木頭人
      for (let i = 0; i < 3; i++) {
        const p = new At(b, x + [-3.4, 3.4, -3.4][i], y, z + [10.2, 10.2, 11.6][i]);
        p.cyl('iwood', 0.08, 0.1, 1.2, 0, 0, 0, 6, DARKWOOD);
        p.cyl('iwood', 0.25, 0.22, 0.8, 0, 1.2, 0, 8, col(0.7, 0.55, 0.38));
        p.sphere('iplain', 0.2, 0, 2.2, 0, col(0.7, 0.55, 0.38), 1, 8);
        p.box('iplain', 0.8, 0.08, 0.08, 0, 1.75, 0, col(0.7, 0.55, 0.38));
        p.geo('iplain', new THREE.TorusGeometry(0.16, 0.03, 4, 12), 0, 1.6, 0.24, RED);
      }
      for (const pz of [-8, 0, 8]) for (const s of [-1, 1]) pane(b, 1.8, 4.5, x + s * 7.99, y + 3.6, z + pz + 3, (-s * Math.PI) / 2);
      for (const pz of [-6, 6]) chandelier(b, x, y + 6.5, z + pz, 1.6, 12, 2.4);
    },
  });

  // ================================================================ 校長室塔：石像鬼後面的螺旋梯
  {
    const k = 33;
    const [ox, oy, oz] = pocketOrigin(k);
    const r = 3.8;
    const top = 9;
    const A = spiralEnd(0.7, r - 0.05, 0.6, top) + 0.7;
    const office: DoorEnd = { pos: [ox + Math.sin(A) * (r - 0.05), oy + top, oz + Math.cos(A) * (r - 0.05)], face: A + Math.PI, name: '校長室' };
    chamber({
      k,
      id: 'gargoyleStair',
      spawnDist: 1.6,
      spawnTurn: -1.1,
      name: '石像鬼後面的螺旋梯',
      intro: '對石像鬼說出通關密語，它就會跳開，露出一道像電扶梯一樣自己往上轉的螺旋石階。',
      r,
      h: top + 4,
      tint: col(1.15, 1.02, 0.88),
      outside: TOWER_DOORS.gargoyle,
      lights: () => [warm([ox, oy + 3, oz], 70, 12), warm([ox, oy + top + 1.5, oz], 90, 12)],
      fill: (b, _o, ring) => {
        // 中央的石柱與盤旋的石階
        b.cyl('istone', 0.7, 0.7, top + 1, ox, oy, oz, 12, MARBLE);
        const end = spiral(b, ox, oy, oz, 0.7, r - 0.05, 0.6, top, MARBLE);
        for (let i = 0; i < 9; i++) {
          const a = end - 0.1 + (i / 8) * 1.5;
          new At(b, ox + Math.sin(a) * ((r + 0.7) / 2), oy + top - 0.35, oz + Math.cos(a) * ((r + 0.7) / 2), a).box('istone', 1.0, 0.35, r - 0.75, 0, 0, 0, MARBLE);
        }
        // 頂端的橡木門與獅鷲門環
        const p = new At(b, office.pos[0], oy + top, office.pos[2], office.face);
        p.sphere('iplain', 0.12, 0, 1.6, 0.22, GOLD, 1.1, 8);
        p.geo('iplain', new THREE.TorusGeometry(0.14, 0.03, 5, 12), 0, 1.38, 0.24, GOLD);
        for (const s of [-1, 1]) p.geo('iplain', new THREE.ConeGeometry(0.06, 0.25, 4), s * 0.14, 1.72, 0.2, GOLD, 0, 0, s * 0.6);
        door(p, 1.6, 2.7);
        // 塔底守門的石像鬼
        const g = ring(-0.75, r - 0.9);
        const ST = col(0.6, 0.6, 0.62);
        g.box('istone', 1.0, 0.6, 1.0, 0, 0, 0, ST);
        g.sphere('iplain', 0.38, 0, 1.0, 0, ST, 1.2, 8);
        g.sphere('iplain', 0.25, 0, 1.6, 0.15, ST, 1, 8);
        for (const s of [-1, 1]) {
          g.geo('iplain', new THREE.ConeGeometry(0.08, 0.3, 4), s * 0.15, 1.85, 0.12, ST, 0, 0, s * 0.4);
          g.geo('iplain', new THREE.ConeGeometry(0.35, 0.9, 3), s * 0.45, 1.3, -0.2, ST, 0, -0.5, s * 1.1);
        }
      },
    });
    oneWay(office, 'headmasterOffice', '校長室');
  }

  // ================================================================ 教職員休息室
  chamber({
    k: 32,
    id: 'staffRoom',
    name: '教職員休息室',
    intro: '老師們開會、喝茶的地方。長桌兩旁是不成套的舊椅子，角落的衣櫃有一陣子關過一隻幻形怪。',
    w: 16,
    d: 11,
    h: 5.5,
    tint: col(1.12, 1.02, 0.9),
    outside: TOWER_DOORS.staffRoom,
    lights: ([x, y, z]) => [warm([x + 2, y + 4.2, z], 140, 20), warm([x - 5.5, y + 1.4, z - 4], 70, 10, 0xff8a40)],
    fill: (b, [x, y, z]) => {
      fireplace(new At(b, x - 5.5, y, z - 5.5), 2.4);
      armchair(new At(b, x - 6.3, y, z - 2.8, 2.6), col(0.35, 0.12, 0.1));
      armchair(new At(b, x - 4.5, y, z - 2.6, -2.8), col(0.15, 0.2, 0.3));
      // 長桌與不成套的椅子
      const t = new At(b, x + 2, y, z);
      table(t, 6, 1.4, 0.78);
      const C = [col(0.6, 0.45, 0.3), col(0.4, 0.28, 0.2), col(0.75, 0.6, 0.45), DARKWOOD];
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) chair(t.at(-2.4 + i * 1.2, 0, s * 1.05, s > 0 ? Math.PI : 0), C[(i + (s > 0 ? 1 : 0)) % 4]);
      for (let i = 0; i < 6; i++) {
        t.cyl('iplain', 0.06, 0.05, 0.09, -2.2 + i * 0.9, 0.78, (i % 2) * 0.4 - 0.2, 8, WHITE);
        t.box('iplain', 0.35, 0.02, 0.25, -1.8 + i * 0.9, 0.78, 0.25, col(0.85, 0.8, 0.65), i);
      }
      t.sphere('iplain', 0.18, 0, 0.98, 0, WHITE, 0.9, 8);
      // 舊衣櫃
      {
        const w = new At(b, x + 7.6, y, z + 3.5, -Math.PI / 2);
        w.box('iwood', 1.5, 2.4, 0.7, 0, 0, 0, col(0.3, 0.2, 0.15));
        for (const s of [-1, 1]) w.box('iplain', 0.66, 2.0, 0.03, s * 0.36, 0.2, 0.36, col(0.35, 0.25, 0.18));
      }
      // 老師們的信件格
      {
        const p = new At(b, x + 3, y + 1.2, z - 5.48);
        p.box('iwood', 3.6, 1.6, 0.4, 0, 0, 0.2, DARKWOOD);
        for (let i = 0; i < 8; i++) for (let k = 0; k < 4; k++) {
          p.box('iplain', 0.4, 0.36, 0.02, -1.58 + i * 0.45, 0.06 + k * 0.38, 0.41, col(0.12, 0.08, 0.06));
          if ((i + k) % 3 === 0) p.box('iplain', 0.3, 0.2, 0.02, -1.58 + i * 0.45, 0.1 + k * 0.38, 0.42, col(0.9, 0.85, 0.7));
        }
      }
      for (const px of [-3, 0, 4.5]) portrait(new At(b, x + px, y + 2.6, z + 5.49, Math.PI), 1.0, 1.3);
      for (const pz of [-2.5, 2.5]) pane(b, 1.6, 3.2, x + 7.99, y + 1.6, z + pz - 1.2, -Math.PI / 2);
      b.box('iplain', 5, 0.02, 3.4, x - 4.5, y, z - 3, 0, col(0.35, 0.12, 0.1));
    },
  });

  // ================================================================ 天文塔：星圖室
  chamber({
    k: 34,
    id: 'starCharts',
    name: '天文塔星圖室',
    intro: '天文塔中段的儀器室：牆上掛著巨幅星圖，架上收著望遠鏡，學生在這裡畫星盤、寫觀測報告。',
    w: 16,
    d: 16,
    h: 7,
    tint: col(0.95, 0.97, 1.05),
    outside: TOWER_DOORS.astronomyNorth,
    ambient: 0.4,
    lights: ([x, y, z]) => [warm([x, y + 5.2, z], 170, 22, 0xe6ecff)],
    fill: (b, [x, y, z]) => {
      const rng = b.rng;
      // 三面牆的星圖
      for (const [px, pz, ry] of [[x, z - 7.98, 0], [x - 7.98, z, Math.PI / 2], [x + 7.98, z, -Math.PI / 2]] as const) {
        const p = new At(b, px, y + 1.4, pz, ry);
        p.box('iplain', 6, 4, 0.04, 0, 0, 0.02, NIGHT);
        p.box('iplain', 6.3, 0.15, 0.06, 0, 4, 0.03, GOLD);
        for (let i = 0; i < 70; i++) p.box('iglow', 0.05, 0.05, 0.02, (rng() - 0.5) * 5.6, 0.2 + rng() * 3.6, 0.05, col(1.6, 1.6, 1.8));
        p.geo('iplain', new THREE.TorusGeometry(1.4, 0.02, 4, 40), 0, 2, 0.05, GOLD);
        for (let k = 0; k < 6; k++) p.geo('iplain', new THREE.BoxGeometry(0.01, 2.8, 0.01), 0, 2, 0.05, GOLD, 0, 0, (k * Math.PI) / 6);
      }
      // 中央的大渾天儀
      b.cyl('iplain', 0.4, 0.6, 1.0, x, y, z, 10, BRONZE);
      for (let k = 0; k < 4; k++) b.add('iplain', new THREE.TorusGeometry(1.2, 0.04, 5, 32), mat4(x, y + 2.3, z, k * 0.8, k * 0.6, 0), GOLD);
      b.sphere('iplain', 0.3, x, y + 2.3, z, col(0.2, 0.35, 0.6), 1, 12);
      // 繪圖桌
      for (const [px, pz] of [[-4, 3.5], [0, 4.5], [4, 3.5]]) {
        const t = new At(b, x + px, y, z + pz, Math.PI);
        table(t, 2.2, 1.1, 0.85);
        t.box('iplain', 1.4, 0.01, 0.8, 0, 0.85, 0, NIGHT);
        t.cyl('iplain', 0.3, 0.3, 0.01, 0, 0.86, 0, 20, col(0.85, 0.8, 0.65));
        chair(t.at(0, 0, -0.9));
        deskLamp(t.at(0.8, 0.85, 0.3));
      }
      // 靠牆的望遠鏡架
      for (let i = 0; i < 8; i++) {
        const p = new At(b, x + 7.2, y, z + 3 + i * 0.5, -Math.PI / 2);
        p.geo('iplain', new THREE.CylinderGeometry(0.05, 0.08, 1.4, 8), 0, 1.0, 0, BRONZE, 0, 0.15);
      }
      b.box('iwood', 0.6, 0.15, 4.4, x + 7.4, y + 0.3, z + 4.75, 0, DARKWOOD);
      chandelier(b, x, y + 5.3, z, 1.8, 14, 1.6);
    },
  });

  // ================================================================ 天文學教授的宿舍（副塔）
  chamber({
    k: 35,
    id: 'astronomyQuarters',
    name: '天文學教授的宿舍',
    intro: '辛尼區教授住的小圓塔：窗邊一架望遠鏡對著天空，桌上攤著畫到一半的星圖。',
    r: 5.6,
    h: 4.6,
    tint: col(0.95, 0.97, 1.05),
    outside: TOWER_DOORS.astronomyAnnex,
    lights: ([x, y, z]) => [warm([x, y + 3.4, z], 80, 13, 0xe6ecff), warm([x - 2, y + 1.3, z - 2], 30, 6)],
    fill: (b, [x, y, z], ring) => {
      bed(ring(1.9, 4.3), NIGHT, true);
      const t = ring(-1.6, 4.2);
      table(t, 1.8, 0.9);
      chair(t.at(0, 0, 0.8, Math.PI));
      t.box('iplain', 1.2, 0.01, 0.7, 0, 0.76, 0, NIGHT);
      t.cyl('iplain', 0.05, 0.07, 0.15, 0.6, 0.76, 0.2, 6, GOLD);
      t.sphere('iglow', 0.05, 0.6, 0.98, 0.2, FIRE, 1.5, 5);
      const tel = ring(Math.PI, 3.6);
      for (let j = 0; j < 3; j++) tel.geo('iplain', new THREE.CylinderGeometry(0.025, 0.025, 1.4, 4), Math.cos(j * 2.09) * 0.3, 0.65, Math.sin(j * 2.09) * 0.3, BRONZE, 0, Math.cos(j * 2.09) * 0.2, Math.sin(j * 2.09) * 0.2);
      tel.geo('iplain', new THREE.CylinderGeometry(0.07, 0.11, 1.6, 10), 0, 1.6, -0.3, BRONZE, 0, -1.0);
      for (const a of [Math.PI - 0.6, Math.PI + 0.6, 0.9]) {
        const p = ring(a, 5.58, 1.4);
        p.box('iplain', 1, 2.2, 0.02, 0, 0, 0, col(0.3, 0.4, 0.6));
      }
      for (const a of [Math.PI - 0.6, Math.PI + 0.6]) pane(b, 1.0, 2.2, x + Math.sin(a) * 5.55, y + 1.4, z + Math.cos(a) * 5.55, a + Math.PI);
      bookshelf(ring(-2.6, 5.15), 2.4, 3.4);
      b.cyl('iplain', 2, 2, 0.02, x, y, z, 20, BLUE);
    },
  });

  // ================================================================ 崔老妮教授的儲藏室（北塔副塔）
  chamber({
    k: 36,
    id: 'trelawneyStore',
    name: '占卜學儲藏室',
    intro: '北塔副塔裡塞滿了東西：一排排備用的水晶球、茶杯，還有崔老妮教授藏起來的雪莉酒。',
    r: 4.6,
    h: 4.2,
    tint: col(1.2, 0.95, 0.85),
    outside: TOWER_DOORS.divinationAnnex,
    ambient: 0.1,
    lights: ([x, y, z]) => [warm([x, y + 2.8, z], 50, 10, 0xff7a55)],
    fill: (b, [x, y, z], ring) => {
      for (const a of [1.3, 2.3, 3.3, 4.3, 5.1]) {
        const p = ring(a, 4.15);
        p.box('iwood', 1.8, 3.2, 0.06, 0, 0, -0.2, DARKWOOD);
        for (let r = 0; r < 5; r++) {
          p.box('iwood', 1.8, 0.04, 0.45, 0, 0.4 + r * 0.6, 0, DARKWOOD);
          for (let i = 0; i < 5; i++) {
            const lx = -0.7 + i * 0.35;
            if ((a * 10 + r + i) % 3 < 1) p.sphere('iglow', 0.12, lx, 0.56 + r * 0.6, 0, col(0.7, 0.8, 1.1), 1, 8);
            else if (r % 2) p.cyl('iplain', 0.05, 0.04, 0.07, lx, 0.44 + r * 0.6, 0, 6, [WHITE, col(0.8, 0.5, 0.55)][i % 2]);
            else p.cyl('iplain', 0.04, 0.05, 0.3, lx, 0.44 + r * 0.6, 0, 6, col(0.15, 0.25, 0.1));
          }
        }
      }
      // 地上的雪莉酒空瓶、紗巾與蜘蛛網
      const rng = b.rng;
      for (let i = 0; i < 9; i++) b.add('iplain', new THREE.CylinderGeometry(0.04, 0.06, 0.3, 6), mat4(x - 1 + rng() * 2, y + 0.06, z - 1 + rng() * 2, rng() * 6, Math.PI / 2), col(0.2, 0.35, 0.12));
      for (let i = 0; i < 3; i++) b.box('iplain', 0.9, 0.02, 1.4, x + 1 - i * 0.6, y + i * 0.03, z - 1 + i * 0.5, i, [col(0.5, 0.1, 0.25), col(0.6, 0.45, 0.1), col(0.2, 0.15, 0.45)][i]);
      for (let i = 0; i < 6; i++) b.rod('iplain', V(x + Math.sin(i) * 4.4, y + 4.1, z + Math.cos(i) * 4.4), V(x + Math.sin(i + 0.4) * 3.6, y + 3.6, z + Math.cos(i + 0.4) * 3.6), 0.006, col(0.8, 0.8, 0.8), 3);
      roundTable(new At(b, x, y, z - 0.5), 0.5, 0.65);
      b.sphere('iglow', 0.15, x, y + 0.82, z - 0.5, col(1.3, 1.5, 2.0));
    },
  });

  // ================================================================ 麻瓜研究學教室（鐘樓旁的廂房）
  chamber({
    k: 37,
    id: 'muggleStudies',
    name: '麻瓜研究學教室',
    intro: '講桌上擺著橡皮小鴨、插頭、電話和一台電視機。巫師們研究麻瓜怎麼不用魔法過日子。',
    w: 14,
    d: 11,
    h: 5.5,
    outside: TOWER_DOORS.mugglesWing,
    lights: ([x, y, z]) => [warm([x, y + 4.2, z], 160, 20)],
    fill: (b, [x, y, z]) => {
      blackboard(new At(b, x, y + 1.4, z - 5.5), 4.5, 1.8);
      const t = new At(b, x, y, z - 3.6);
      table(t, 3.6, 1.2, 0.85);
      // 橡皮小鴨
      t.sphere('iplain', 0.1, -1.2, 0.95, 0, col(1.0, 0.85, 0.1), 0.8, 8);
      t.sphere('iplain', 0.065, -1.12, 1.07, 0, col(1.0, 0.85, 0.1), 1, 8);
      t.box('iplain', 0.06, 0.02, 0.04, -1.05, 1.06, 0, col(0.95, 0.45, 0.1));
      // 電話、插頭、電視機
      t.box('iplain', 0.3, 0.12, 0.25, -0.5, 0.85, 0, BLACK);
      t.geo('iplain', new THREE.TorusGeometry(0.12, 0.03, 5, 10, Math.PI), -0.5, 1.0, 0, BLACK, Math.PI / 2, 0, 0);
      t.box('iplain', 0.12, 0.08, 0.06, 0.1, 0.85, 0.2, WHITE);
      for (const s of [-1, 1]) t.box('iplain', 0.015, 0.06, 0.015, 0.1 + s * 0.03, 0.85, 0.25, STEEL);
      t.box('iplain', 0.8, 0.6, 0.5, 0.9, 0.85, 0, col(0.3, 0.22, 0.15));
      t.box('iplain', 0.62, 0.45, 0.01, 0.85, 0.92, 0.26, col(0.15, 0.2, 0.2));
      // 腳踏車輪、時鐘、牆上的海報
      b.add('iplain', new THREE.TorusGeometry(0.4, 0.03, 5, 20), mat4(x + 6.6, y + 1.6, z - 2, Math.PI / 2), BLACK);
      for (let k = 0; k < 6; k++) b.add('iplain', new THREE.BoxGeometry(0.01, 0.8, 0.01), mat4(x + 6.6, y + 1.6, z - 2, Math.PI / 2, (k * Math.PI) / 6), STEEL);
      for (const [px, c] of [[-5, col(0.8, 0.3, 0.25)], [-2.5, col(0.2, 0.45, 0.7)], [2.5, col(0.85, 0.7, 0.2)]] as const) {
        const p = new At(b, x + px, y + 2.2, z + 5.48, Math.PI);
        p.box('iplain', 1.4, 1.8, 0.02, 0, 0, 0, c);
        p.box('iplain', 1.0, 0.7, 0.02, 0, 0.8, 0.01, WHITE);
      }
      for (let r = 0; r < 2; r++) for (const lx of [-3.2, 0, 3.2]) studentDesk(new At(b, x + lx, y, z - 0.6 + r * 2.2, Math.PI), 2.2);
      for (const pz of [-2, 2]) pane(b, 1.6, 3.2, x - 6.99, y + 1.6, z + pz, Math.PI / 2);
    },
  });

  // ================================================================ 龐芮夫人的藥品室
  chamber({
    k: 38,
    id: 'pomfreyStore',
    name: '醫院廂房的藥品室',
    intro: '龐芮夫人的藥櫃：生骨水、提神藥水、一罐罐巧克力。斷了骨頭的魁地奇球員最常被送到這裡。',
    r: 5.5,
    h: 4.6,
    tint: col(1.1, 1.08, 1.05),
    outside: TOWER_DOORS.hospitalTower,
    ambient: 0.5,
    lights: ([x, y, z]) => [warm([x, y + 3.4, z], 110, 14, 0xfff0e0)],
    fill: (b, [x, y, z], ring) => {
      for (const a of [1.1, 2.0, 2.9, 3.8, 4.7]) potionShelf(ring(a, 5.15), 2.4, 5, col(0.9, 0.88, 0.85));
      const t = new At(b, x, y, z - 0.4);
      table(t, 2.2, 1.0, 0.9, col(0.9, 0.88, 0.85));
      t.cyl('iplain', 0.14, 0.1, 0.16, -0.6, 0.9, 0, 10, STEEL);
      t.cyl('iplain', 0.02, 0.02, 0.25, -0.55, 1.0, 0.03, 4, STEEL);
      for (let i = 0; i < 4; i++) t.cyl('iplain', 0.05, 0.06, 0.2, 0 + i * 0.18, 0.9, 0.2, 6, [col(0.5, 0.35, 0.15), col(0.2, 0.5, 0.25), col(0.6, 0.2, 0.5), WHITE][i]);
      t.box('iplain', 0.3, 0.12, 0.2, 0.7, 0.9, -0.2, col(0.35, 0.18, 0.08));
      // 摺好的床單與毛毯
      const p = ring(-1.6, 4.6);
      p.box('iwood', 1.6, 1.8, 0.6, 0, 0, 0, col(0.9, 0.88, 0.85));
      for (let r = 0; r < 6; r++) p.box('iplain', 1.4, 0.12, 0.5, 0, 0.1 + r * 0.28, 0.02, r % 2 ? WHITE : col(0.6, 0.7, 0.8));
      b.cyl('iplain', 1.5, 1.5, 0.02, x, y, z, 20, col(0.65, 0.75, 0.8));
    },
  });

  // ================================================================ 訪客等候走廊（醫院廂房旁的連接廂房）
  chamber({
    k: 39,
    id: 'hospitalHall',
    name: '醫院廂房前的走廊',
    intro: '探病的人在這裡等。長椅旁擺著別人送來的花和蛙巧克力，牆上的畫像都在小聲說話。',
    w: 26,
    d: 6,
    h: 5.5,
    outside: TOWER_DOORS.hospitalWing,
    lights: ([x, y, z]) => [warm([x - 6, y + 4, z], 110, 16), warm([x + 6, y + 4, z], 110, 16)],
    fill: (b, [x, y, z]) => {
      b.box('iplain', 24, 0.02, 2, x, y, z, 0, col(0.4, 0.1, 0.08));
      for (const px of [-9, -3, 3, 9]) {
        const p = new At(b, x + px, y, z - 2.6);
        p.box('iwood', 2.6, 0.07, 0.45, 0, 0.42, 0, DARKWOOD);
        for (const s of [-1, 1]) p.box('iwood', 0.07, 0.42, 0.4, s * 1.1, 0, 0, DARKWOOD);
        p.box('iwood', 2.6, 0.6, 0.06, 0, 0.6, -0.22, DARKWOOD);
        portrait(new At(b, x + px, y + 2.1, z - 2.99), 1.1, 1.4);
      }
      for (const px of [-6, 0, 6]) {
        const p = new At(b, x + px, y, z - 2.6);
        p.cyl('iwood', 0.3, 0.3, 0.7, 0, 0, 0, 10, DARKWOOD);
        p.cyl('iplain', 0.12, 0.09, 0.3, 0, 0.7, 0, 8, col(0.7, 0.75, 0.8));
        for (let k = 0; k < 5; k++) p.sphere('iplain', 0.07, Math.cos(k * 1.26) * 0.1, 1.08, Math.sin(k * 1.26) * 0.1, [col(0.9, 0.3, 0.4), col(0.95, 0.85, 0.3), WHITE][k % 3], 1, 6);
        p.geo('iplain', new THREE.CylinderGeometry(0.0, 0.12, 0.08, 5), 0.2, 0.7, 0.15, col(0.35, 0.18, 0.08), 0.3, Math.PI / 2);
      }
      for (const px of [-10, -5, 5, 10]) pane(b, 1.4, 3, x + px, y + 1.6, z + 2.99, Math.PI);
      for (const px of [-8, 8]) torch(b, x + px, y + 3.2, z - 3, 0);
      door(new At(b, x - 13, y, z, Math.PI / 2), 1.8, 3);
    },
  });

  void sofa;
  void GREENLAMP;
  void IRON;
  void STEEL;
}
