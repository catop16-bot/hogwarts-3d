import * as THREE from 'three';
import { Builder, col, mat4 } from '../kit';
import { getMaterials } from '../materials';
import { PL } from '../../world/heightfield';
import { FLOOR, room, pane, torch, landingDoor, GOLD, IRON, FIRE, DARKWOOD, MARBLE, IWARM, WARM } from '../interiors';
import { At, roundRoom, door, bookshelf, table, chair, armchair, fireplace, chandelier, portrait, armour, bed, trophyCase, deskLamp, STEEL, WHITE, BLACK } from './kit';
import { registerScene, link, box3, pocketOrigin } from './registry';
import { DOORS, doorDecal } from './doors';

const Y = PL;
const F = FLOOR;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const RED = col(0.42, 0.04, 0.04);

// ================================================================== 圖書館（改建圖書館翼）
export const LIB = { x0: -57.5, x1: -38.5, z0: -53.5, z1: 51.5, door: -48 };

export function libraryInterior(b: Builder) {
  const { x0, x1, z0, z1 } = LIB;
  room(b, { x0, x1, z0, z1, h: 29.5, t: 1.5, tint: col(1, 1, 1), ceil: 11, openings: [{ side: 'S', at: LIB.door, w: 3.6, h: 5 }] });
  const cx = (x0 + x1) / 2;
  // 兩側的書架隔間
  for (let z = -30; z <= 42; z += 6) {
    bookshelf(new At(b, x0 + 3.5, F, z), 6.4, 4.2, true);
    bookshelf(new At(b, x1 - 3.5, F, z), 6.4, 4.2, true);
    if (z < 42) {
      pane(b, 1.6, 5, x0, F + 3.4, z + 3, Math.PI / 2);
      pane(b, 1.6, 5, x1, F + 3.4, z + 3, -Math.PI / 2);
    }
  }
  // 中央走道的閱覽桌
  for (let z = -24; z <= 36; z += 12) {
    const t = new At(b, cx, F, z + 3, Math.PI / 2);
    table(t, 3.8, 1.3);
    for (const lx of [-1.2, 0, 1.2]) {
      chair(t.at(lx, 0, 1.0, Math.PI));
      chair(t.at(lx, 0, -1.0, 0));
    }
    for (const lx of [-0.9, 0.9]) deskLamp(t.at(lx, 0.76, 0));
    t.box('iplain', 0.34, 0.05, 0.46, 0.2, 0.76, 0.3, col(0.3, 0.05, 0.04), 0.3);
  }
  for (const z of [36, 12, -12]) chandelier(b, cx, F + 7.6, z, 1.5, 10, 3.4);
  // 平斯夫人的櫃台
  {
    const d = new At(b, x0 + 4.2, F, 47, -Math.PI / 2);
    d.box('iwood', 3.4, 1.05, 0.9, 0, 0, 0, DARKWOOD);
    d.box('iwood', 3.6, 0.07, 1.1, 0, 1.05, 0, DARKWOOD);
    chair(d.at(0, 0, -1.0, 0));
    deskLamp(d.at(1.1, 1.12, 0));
    for (let i = 0; i < 4; i++) d.box('iplain', 0.36, 0.06, 0.5, -1.1, 1.12 + i * 0.06, 0, [RED, col(0.05, 0.16, 0.08), col(0.06, 0.08, 0.25), col(0.28, 0.17, 0.06)][i], i * 0.15);
  }
  bookshelf(new At(b, x1 - 0.3, F, 47, -Math.PI / 2), 7, 4.2);

  // 禁書區：鐵柵欄後面
  const gz = -34;
  for (let x = x0 + 0.2; x < x1; x += 0.28) {
    if (Math.abs(x - cx) < 1.3) continue;
    b.box('iwood', 0.06, 3.4, 0.06, x, F, gz, 0, IRON);
  }
  for (const s of [-1, 1]) {
    const w = (x1 - x0) / 2 - 1.3;
    b.box('iwood', w, 0.1, 0.1, cx + s * (1.3 + w / 2), F + 3.4, gz, 0, IRON);
    b.box('iwood', w, 0.1, 0.1, cx + s * (1.3 + w / 2), F + 0.3, gz, 0, IRON);
    b.box('iwood', 0.16, 3.8, 0.16, cx + s * 1.3, F, gz, 0, IRON);
  }
  for (let i = 0; i < 9; i++) b.box('iwood', 0.05, 3.2, 0.05, cx - 1.3 - 0.05, F, gz - 0.2 - i * 0.26, 0, IRON);
  const DARK = col(0.5, 0.47, 0.45);
  for (let z = -38.5; z >= -47.5; z -= 4.5) {
    bookshelf(new At(b, x0 + 3.2, F, z), 5.8, 4.6, true, DARK);
    bookshelf(new At(b, x1 - 4.4, F, z), 4.6, 4.6, true, DARK);
  }
  bookshelf(new At(b, cx - 3, F, z0 + 0.3), 11, 4.6, false, DARK);
  // 被鐵鍊鎖住、發著微光的書
  {
    const l = new At(b, cx, F, -42);
    l.cyl('iwood', 0.12, 0.3, 1.1, 0, 0, 0, 8, DARK);
    l.geo('iwood', new THREE.BoxGeometry(0.7, 0.06, 0.55), 0, 1.16, 0, DARK, 0, 0.35);
    l.geo('iglow', new THREE.BoxGeometry(0.5, 0.08, 0.38), 0, 1.24, 0.01, col(1.4, 0.7, 2.4), 0, 0.35);
    for (const s of [-1, 1]) b.rod('iplain', V(cx + s * 0.3, F + 1.25, -42), V(cx + s * 0.9, F, -42.4), 0.012, STEEL, 4);
  }
  for (const z of [44, 20, -4, -28]) {
    torch(b, x0, F + 6.2, z, Math.PI / 2);
    torch(b, x1, F + 6.2, z, -Math.PI / 2);
  }
  registerScene({
    id: 'library',
    name: '圖書館',
    intro: '數萬冊藏書排滿高聳的書架，最深處的鐵柵欄後面是禁書區。',
    box: box3(x0, F - 1, z0, x1, F + 11, z1 + 3.1),
    lights: [
      { pos: [cx, F + 7, 30], intensity: 210, dist: 34 },
      { pos: [cx, F + 7, -4], intensity: 210, dist: 34 },
      { pos: [cx, F + 6, -44], intensity: 70, dist: 22, color: 0xa9b6ff },
    ],
    spawn: [cx, F, 46, Math.PI],
    zone: 'core',
  });
}

// ================================================================== 醫院廂房
export const HOSP = { x0: 143.5, x1: 160.5, z0: 1.5, z1: 58.5 };

export function hospitalInterior(b: Builder) {
  const { x0, x1, z0, z1 } = HOSP;
  room(b, { x0, x1, z0, z1, h: 24.5, t: 1.5, tint: col(1, 1, 1), itint: col(1.35, 1.3, 1.2), ceil: 9.5, openings: [{ side: 'E', at: 30, w: 3, h: 4.5 }] });
  b.box('stone', 2.2, 0.25, 4.5, x1 + 2.6, Y, 30, 0, WARM);
  const cx = (x0 + x1) / 2;
  const SHEET = col(0.75, 0.78, 0.8);
  for (let k = 0; k < 10; k++) {
    const z = 7 + k * 5.2;
    for (const s of [-1, 1]) {
      if (s === 1 && Math.abs(z - 30) < 4) continue;
      const p = new At(b, s === -1 ? x0 + 1.3 : x1 - 1.3, F, z, (-s * Math.PI) / 2);
      bed(p, SHEET);
      p.box('iwood', 0.5, 0.62, 0.45, 0.95, 0, -0.75, DARKWOOD);
      if (k % 3 === 1) p.cyl('iglow', 0.05, 0.07, 0.16, 0.95, 0.62, -0.75, 6, [col(0.4, 2.4, 0.8), col(2.4, 0.6, 0.3), col(0.5, 0.9, 2.6)][k % 3]);
      // 床邊的屏風
      if (k % 3 === 0) for (let j = 0; j < 3; j++) p.box('iplain', 0.03, 1.8, 0.95, -1.0, 0.1, -0.6 + j * 0.98, WHITE, (j % 2 ? 1 : -1) * 0.18);
      if (s === -1 || Math.abs(z + 2.6 - 30) > 3.5) pane(b, 1.9, 5, s === -1 ? x0 : x1, F + 2.8, z + 2.6, (-s * Math.PI) / 2);
    }
  }
  // 龐芮夫人的辦公桌與藥櫃
  {
    const d = new At(b, cx + 3, F, z0 + 3.2);
    table(d, 2.4, 1.1);
    chair(d.at(0, 0, -0.9, 0));
    deskLamp(d.at(0.8, 0.76, 0));
    const c = new At(b, cx - 3.5, F, z0 + 0.3);
    c.box('iwood', 5, 3.2, 0.06, 0, 0, -0.2, DARKWOOD);
    for (let r = 0; r < 5; r++) {
      c.box('iwood', 5, 0.05, 0.45, 0, 0.3 + r * 0.6, 0, DARKWOOD);
      for (let i = 0; i < 14; i++) {
        const t = [col(0.3, 1.8, 0.6), col(1.8, 0.4, 0.25), col(0.4, 0.7, 2.0), col(1.6, 1.3, 0.3), col(1.2, 0.4, 1.6)][(i * 3 + r) % 5];
        c.cyl('iglow', 0.035, 0.06, 0.14 + ((i + r) % 3) * 0.05, -2.3 + i * 0.35, 0.35 + r * 0.6, 0.05, 6, t.multiplyScalar(0.5));
      }
    }
    for (const s of [-1, 1]) c.box('iwood', 0.08, 3.2, 0.45, s * 2.5, 0, 0, DARKWOOD);
  }
  for (const z of [16, 44]) chandelier(b, cx, F + 7, z, 1.3, 8, 2.5);
  registerScene({
    id: 'hospital',
    name: '醫院廂房',
    intro: '龐芮夫人照料傷患的地方，兩排鐵架病床沿著高窗排開。',
    box: box3(x0, F - 1, z0, x1 + 1.7, F + 9.5, z1),
    lights: [
      { pos: [cx, F + 6.5, 16], intensity: 190, dist: 32, color: 0xffdcb0 },
      { pos: [cx, F + 6.5, 44], intensity: 190, dist: 32, color: 0xffdcb0 },
    ],
    spawn: [(x0 + x1) / 2, F, 52, Math.PI],
    ambient: 0.6,
    nightScale: 0.35,
  });
}

// ================================================================== 鐘樓內部
export const CLK = { x0: 144, x1: 160, z0: -56, z1: -40 };

export function clockInterior(b: Builder) {
  const { x0, x1, z0, z1 } = CLK;
  room(b, { x0, x1, z0, z1, h: 69.5, t: 1.5, found: 16, ceil: 58, openings: [{ side: 'E', at: -48, w: 4, h: 6.5 }] });
  b.box('stone', 2.2, 0.25, 5.5, x1 + 2.6, Y, -48, 0, WARM);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  // 木造的機械平台與樑
  for (const y of [18, 34, 46]) {
    for (const z of [z0 + 0.4, z1 - 0.4]) b.box('iwood', x1 - x0, 0.5, 0.5, cx, F + y, z, 0, DARKWOOD);
    for (const x of [x0 + 3, x1 - 3]) b.box('iwood', 0.45, 0.45, z1 - z0, x, F + y + 0.5, cz, 0, DARKWOOD);
  }
  // 大鐘
  b.cyl('iplain', 0.9, 2.0, 2.6, cx, F + 49.5, cz, 14, col(0.5, 0.36, 0.12));
  b.cyl('iwood', 0.3, 0.3, 14, cx, F + 52.3, cz, 8, DARKWOOD, Math.PI / 2);
  for (const z of [z0 + 2.4, z1 - 2.4]) for (const x of [x0 + 2.4, x1 - 2.4]) torch(b, x < cx ? x0 : x1, F + 4.5, z, x < cx ? Math.PI / 2 : -Math.PI / 2);
  for (const yy of [10, 26]) for (const x of [cx - 4, cx + 4]) pane(b, 1.4, 5, x, F + yy, z0, 0);

  // 會動的鐘擺與齒輪
  const M = getMaterials();
  const group = new THREE.Group();
  const pend = new THREE.Group();
  {
    const sb = new Builder(601);
    sb.cyl('iplain', 0.07, 0.07, 38, 0, -38, 0, 6, col(0.5, 0.36, 0.12));
    const bob = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 24);
    bob.rotateZ(Math.PI / 2);
    sb.add('iplain', bob, mat4(0, -38.5, 0), GOLD);
    const rim = new THREE.TorusGeometry(1.5, 0.1, 6, 24);
    rim.rotateY(Math.PI / 2);
    sb.add('iplain', rim, mat4(0, -38.5, 0), col(0.5, 0.36, 0.12));
    pend.add(sb.build('pendulum', M));
    pend.position.set(cx, F + 47, cz);
    group.add(pend);
  }
  const gears: { g: THREE.Group; sp: number }[] = [];
  const gear = (r: number, y: number, z: number, sp: number) => {
    const sb = new Builder(610 + gears.length);
    const BR = col(0.42, 0.3, 0.1);
    const ring = new THREE.TorusGeometry(r, r * 0.09, 6, 28);
    ring.rotateY(Math.PI / 2);
    sb.add('iplain', ring, undefined, BR);
    for (let k = 0; k < 3; k++) sb.add('iplain', new THREE.BoxGeometry(0.14, r * 2, r * 0.12), mat4(0, 0, 0, 0, (k * Math.PI) / 3), BR);
    const n = Math.round(r * 9);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      sb.add('iplain', new THREE.BoxGeometry(0.2, r * 0.2, r * 0.13), mat4(0, Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1, 0, a), BR);
    }
    const hub = new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.5, 10);
    hub.rotateZ(Math.PI / 2);
    sb.add('iplain', hub, undefined, GOLD);
    const g = sb.build('gear', M);
    g.position.set(x0 + 0.6, F + y, z);
    group.add(g);
    gears.push({ g, sp });
  };
  gear(3.2, 22, cz - 1.5, 0.25);
  gear(1.9, 26.2, cz + 3.1, -0.42);
  gear(1.3, 19.2, cz + 3.6, 0.62);
  gear(2.4, 12, cz + 1, -0.33);
  registerScene({
    id: 'clockTower',
    name: '鐘樓內部',
    intro: '巨大的鐘擺在塔心來回擺動，牆上的齒輪帶動四面鐘。',
    box: box3(x0, F - 1, z0, x1 + 1.7, F + 58, z1),
    lights: [
      { pos: [cx + 3, F + 8, cz], intensity: 240, dist: 40 },
      { pos: [cx, F + 30, cz], intensity: 260, dist: 40 },
    ],
    spawn: [x1 - 3, F, cz, -Math.PI / 2],
    group,
    animate: (t) => {
      pend.rotation.x = Math.sin(t * 1.35) * 0.1;
      for (const g of gears) g.g.rotation.x = t * g.sp;
    },
  });
}

// ================================================================== 中庭西側的一樓走廊
export const CORR = { x0: -8, x1: 2, z0: 15.5, z1: 68.5, door: 44.75 };

export function corridorInterior(b: Builder) {
  const { x0, x1, z0, z1 } = CORR;
  room(b, {
    x0, x1, z0, z1,
    h: 21.5,
    t: 1.5,
    tint: col(1, 1, 1),
    ceil: 7,
    openings: [
      { side: 'W', at: CORR.door, w: 3.4, h: 5 },
      { side: 'E', at: CORR.door, w: 3.4, h: 5 },
    ],
  });
  b.box('stone', 2.2, 0.25, 4.5, x0 - 2.6, Y, CORR.door, 0, WARM);
  b.box('stone', 1.6, 0.3, 4.5, x1 + 2.3, Y + 0.2, CORR.door, 0, WARM);
  const cx = (x0 + x1) / 2;
  b.box('iplain', 2.6, 0.03, z1 - z0 - 2, cx, F, (z0 + z1) / 2, 0, RED);
  for (let z = 20; z <= 66; z += 7.5) {
    if (Math.abs(z - CORR.door) < 4) continue;
    const nearDoor = Math.abs(z - 26) < 4 || Math.abs(z - DOORS.myrtle.pos[2]) < 4;
    if (!nearDoor) armour(new At(b, x0 + 0.6, F, z, Math.PI / 2));
    if (z !== DOORS.witch.pos[2]) armour(new At(b, x1 - 0.6, F, z, -Math.PI / 2));
    torch(b, x0, F + 4.4, z + 3.2, Math.PI / 2);
    torch(b, x1, F + 4.4, z + 3.2, -Math.PI / 2);
    if (!nearDoor) portrait(new At(b, x0, F + 2.4, z + 1.8, Math.PI / 2), 1.3, 1.8);
    portrait(new At(b, x1, F + 2.4, z - 1.8, -Math.PI / 2), 1.3, 1.8);
  }
  doorDecal(b, DOORS.transfiguration);
  doorDecal(b, DOORS.myrtle);
  // 獨眼女巫的雕像：駝背後面藏著一條密道
  {
    const p = new At(b, x1 - 0.75, F, DOORS.witch.pos[2], -Math.PI / 2);
    const ST = col(0.7, 0.72, 0.7);
    p.box('istone', 1.3, 0.5, 1.3, 0, 0, 0, MARBLE);
    p.cyl('istone', 0.3, 0.55, 1.5, 0, 0.5, 0, 10, ST);
    p.sphere('iplain', 0.42, 0, 1.95, -0.22, ST, 0.9);
    p.sphere('iplain', 0.24, 0, 2.3, 0.2, ST, 1.1);
    p.geo('iplain', new THREE.ConeGeometry(0.26, 0.7, 8), 0, 2.85, 0.16, ST, 0, -0.25);
    p.cyl('iplain', 0.36, 0.36, 0.04, 0, 2.5, 0.18, 10, ST);
    p.geo('iplain', new THREE.ConeGeometry(0.05, 0.22, 5), 0, 2.26, 0.46, ST, 0, Math.PI / 2);
    p.sphere('iplain', 0.04, 0.09, 2.36, 0.4, col(0.02, 0.02, 0.02));
    p.cyl('iplain', 0.025, 0.03, 1.9, 0.42, 0.5, 0.25, 5, col(0.25, 0.17, 0.1));
  }
  pane(b, 2.4, 4.4, cx, F + 2, z0, 0);
  pane(b, 2.4, 4.4, cx, F + 2, z1, Math.PI);
  registerScene({
    id: 'corridor',
    name: '一樓走廊',
    intro: '穿過這條擺滿盔甲的走廊，就能走進有噴泉的中庭。',
    box: box3(x0 - 1.7, F - 1, z0, x1 + 1.7, F + 7, z1),
    lights: [
      { pos: [cx, F + 5, 30], intensity: 120, dist: 24 },
      { pos: [cx, F + 5, 56], intensity: 120, dist: 24 },
    ],
    spawn: [cx, F, 40, 0],
  });
}

// ================================================================== 獨立場景
export function buildPublicPockets() {
  const M = getMaterials();

  // ---- 校長室
  {
    const [ox, oy, oz] = pocketOrigin(0);
    const b = new Builder(701);
    const r = 8.5;
    roundRoom(b, ox, oy, oz, r, 7.5);
    const dp = new At(b, ox, oy, oz + r - 0.05, Math.PI);
    door(dp, 1.8, 3.1);
    b.box('iplain', 5, 0.03, 9, ox, oy, oz + 2, 0, RED);
    // 後方的高台與書桌
    b.box('istone', 10, 0.4, 5.2, ox, oy, oz - 4.6, 0, IWARM);
    const desk = new At(b, ox, oy + 0.4, oz - 4.2);
    table(desk, 2.8, 1.3, 0.8);
    desk.box('iwood', 2.6, 0.7, 0.06, 0, 0.05, 0.6, DARKWOOD);
    desk.box('iplain', 0.7, 0.9, 0.8, 0, 0, -1.3, GOLD);
    desk.box('iplain', 0.8, 1.5, 0.14, 0, 0.6, -1.7, col(0.5, 0.06, 0.06));
    desk.box('iplain', 0.9, 0.2, 0.2, 0, 2.1, -1.7, GOLD);
    desk.cyl('iplain', 0.05, 0.06, 0.09, 0.9, 0.8, 0.2, 6, BLACK);
    desk.geo('iplain', new THREE.CylinderGeometry(0.008, 0.02, 0.4, 4), 0.95, 0.95, 0.2, WHITE, 0, 0, -0.4);
    desk.box('iplain', 0.5, 0.02, 0.7, -0.3, 0.8, 0.05, col(0.8, 0.75, 0.6), 0.2);
    // 牆邊的書架、歷任校長的畫像
    const ring = (a: number, d: number, yy = 0) => new At(b, ox + Math.sin(a) * d, oy + yy, oz + Math.cos(a) * d, a + Math.PI);
    for (const a of [0.75, 1.3, 1.85, -0.75, -1.3, -1.85]) bookshelf(ring(a, r - 0.45), 2.6, 2.9);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + 0.16;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue;
      const back = Math.abs(Math.abs(a - Math.PI)) < 0.9;
      if (!back) portrait(ring(a, r - 0.04, 3.4), 1.1, 1.5);
      portrait(ring(a + 0.05, r - 0.04, 5.4), 1.0, 1.4);
    }
    for (const a of [Math.PI - 0.55, Math.PI, Math.PI + 0.55]) pane(b, 1.5, 3.6, ox + Math.sin(a) * (r - 0.1), oy + 2.2, oz + Math.cos(a) * (r - 0.1), a + Math.PI);
    // 分類帽
    {
      const s = ring(1.3, r - 0.45, 2.95);
      s.cyl('iplain', 0.24, 0.3, 0.05, 0, 0.07, 0, 12, col(0.2, 0.13, 0.07));
      s.geo('iplain', new THREE.ConeGeometry(0.2, 0.5, 10), 0, 0.36, 0, col(0.22, 0.14, 0.08), 0, 0.2);
    }
    // 葛來分多寶劍
    {
      const s = ring(-1.3, r - 0.45, 2.95);
      s.box('iplain', 1.1, 0.03, 0.05, 0, 0.3, 0, STEEL);
      s.box('iplain', 0.05, 0.22, 0.06, -0.42, 0.2, 0, GOLD);
      s.sphere('iglow', 0.035, -0.55, 0.31, 0, col(4, 0.2, 0.2));
    }
    // 儲思盆
    {
      const p = new At(b, ox + 5.2, oy, oz + 1.5);
      p.cyl('istone', 0.55, 0.4, 0.95, 0, 0, 0, 12, MARBLE);
      p.cyl('istone', 0.7, 0.55, 0.16, 0, 0.95, 0, 14, MARBLE);
      p.cyl('iglow', 0.6, 0.6, 0.03, 0, 1.1, 0, 16, col(1.4, 2.4, 3.6));
    }
    // 佛客使的棲架
    {
      const p = new At(b, ox - 4.2, oy, oz + 0.5);
      p.cyl('iplain', 0.03, 0.2, 1.6, 0, 0, 0, 8, GOLD);
      p.box('iplain', 0.7, 0.04, 0.04, 0, 1.6, 0, GOLD);
      p.sphere('iglow', 0.16, 0, 1.82, 0, col(2.6, 0.5, 0.15), 1.3);
      p.sphere('iglow', 0.09, 0, 2.06, 0.08, col(2.8, 0.7, 0.15));
      p.geo('iglow', new THREE.ConeGeometry(0.07, 0.6, 6), 0, 1.6, -0.22, col(3, 1.6, 0.3), 0, -2.3);
    }
    // 細腳桌上的銀器
    for (const [dx, dz] of [[3.4, 4.2], [-3.2, 4.6], [-5.6, -1.6]]) {
      const p = new At(b, ox + dx, oy, oz + dz);
      p.cyl('iwood', 0.5, 0.5, 0.05, 0, 0.9, 0, 12, DARKWOOD);
      p.cyl('iwood', 0.04, 0.2, 0.9, 0, 0, 0, 6, DARKWOOD);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + dx;
        p.cyl('iplain', 0.02, 0.07, 0.2 + k * 0.08, Math.cos(a) * 0.25, 0.95, Math.sin(a) * 0.25, 6, STEEL);
        p.sphere(k === 1 ? 'iglow' : 'iplain', 0.06, Math.cos(a) * 0.25, 1.22 + k * 0.08, Math.sin(a) * 0.25, k === 1 ? col(1.5, 1.8, 2.6) : STEEL);
      }
    }
    armchair(new At(b, ox - 1.6, oy, oz + 0.2, Math.PI + 0.3), col(0.3, 0.05, 0.06));
    armchair(new At(b, ox + 1.6, oy, oz + 0.2, Math.PI - 0.3), col(0.3, 0.05, 0.06));
    chandelier(b, ox, oy + 6.4, oz, 1.5, 10, 4);
    const group = b.build('headmasterOffice', M);
    registerScene({
      id: 'headmasterOffice',
      name: '校長室',
      intro: '歷任校長的畫像在牆上打盹，分類帽、葛來分多寶劍與儲思盆都收在這裡。',
      box: box3(ox - r - 0.5, oy - 1, oz - r - 0.5, ox + r + 0.5, oy + 14, oz + r + 0.5),
      lights: [{ pos: [ox, oy + 5, oz - 1], intensity: 230, dist: 24 }],
      spawn: [ox, oy, oz + 2.5, Math.PI],
      pocket: true,
      ambient: 0.28,
      group,
    });
    link(landingDoor(1), { pos: [dp.x, oy, dp.z], face: Math.PI, name: '校長室' });
  }

  // ---- 獎盃室
  {
    const [ox, oy, oz] = pocketOrigin(1);
    const b = new Builder(702);
    room(b, { x0: ox - 10, x1: ox + 10, z0: oz - 4.5, z1: oz + 4.5, y: oy, h: 6, t: 0.3, shell: false, ceil: 6 });
    const dp = new At(b, ox - 7, oy, oz + 4.5, Math.PI);
    door(dp);
    b.box('iplain', 16, 0.03, 2.4, ox, oy, oz, 0, col(0.06, 0.1, 0.3));
    for (const x of [-7.5, -2.5, 2.5, 7.5]) trophyCase(new At(b, ox + x, oy, oz - 4.1), 3.8);
    for (const x of [-1.5, 3.5, 8]) trophyCase(new At(b, ox + x, oy, oz + 4.1, Math.PI), 3.6);
    // 學院盃與魁地奇盃
    for (const [x, s] of [[-3, 1.25], [3, 1]] as const) {
      const p = new At(b, ox + x, oy, oz);
      p.cyl('istone', 0.45, 0.55, 1.1, 0, 0, 0, 8, MARBLE);
      p.cyl('iplain', 0.18 * s, 0.26 * s, 0.1, 0, 1.1, 0, 10, GOLD);
      p.cyl('iplain', 0.05 * s, 0.05 * s, 0.4 * s, 0, 1.2, 0, 8, GOLD);
      p.cyl('iplain', 0.36 * s, 0.12 * s, 0.55 * s, 0, 1.2 + 0.4 * s, 0, 14, GOLD);
      for (const k of [-1, 1]) p.geo('iplain', new THREE.TorusGeometry(0.16 * s, 0.025, 5, 12), k * 0.38 * s, 1.5 + 0.4 * s, 0, GOLD);
    }
    // 牆上的盾徽
    [col(0.5, 0.03, 0.035), col(0.85, 0.6, 0.06), col(0.04, 0.09, 0.42), col(0.03, 0.24, 0.09)].forEach((c, i) => {
      const p = new At(b, ox + 10, oy + 3.2, oz - 2.7 + i * 1.8, -Math.PI / 2);
      p.geo('iplain', new THREE.CylinderGeometry(0.6, 0.6, 0.06, 5), 0, 0.5, 0.05, GOLD, 0, Math.PI / 2);
      p.geo('iplain', new THREE.CylinderGeometry(0.48, 0.48, 0.08, 5), 0, 0.5, 0.07, c, 0, Math.PI / 2);
    });
    armour(new At(b, ox + 9.3, oy, oz - 3.6, -Math.PI / 2));
    armour(new At(b, ox + 9.3, oy, oz + 3.6, -Math.PI / 2));
    for (const x of [-5, 5]) chandelier(b, ox + x, oy + 4.6, oz, 1.1, 8, 1.4);
    registerScene({
      id: 'trophyRoom',
      name: '獎盃室',
      intro: '玻璃櫃裡陳列著歷年的獎盃、獎牌與盾徽，學院盃也放在這裡。',
      box: box3(ox - 10, oy - 1, oz - 4.5, ox + 10, oy + 6, oz + 4.5),
      lights: [
        { pos: [ox - 5, oy + 4.2, oz], intensity: 130, dist: 20 },
        { pos: [ox + 5, oy + 4.2, oz], intensity: 130, dist: 20 },
      ],
      spawn: [ox + 6, oy, oz, -Math.PI / 2],
      pocket: true,
      ambient: 0.25,
      group: b.build('trophyRoom', M),
    });
    link(landingDoor(0), { pos: [dp.x, oy, dp.z], face: Math.PI, name: '獎盃室' });
  }

  // ---- 級長浴室
  {
    const [ox, oy, oz] = pocketOrigin(2);
    const b = new Builder(703);
    const TILE = col(1.55, 1.55, 1.5);
    room(b, { x0: ox - 8, x1: ox + 8, z0: oz - 6, z1: oz + 6, y: oy, h: 8.5, t: 0.3, shell: false, ceil: 8.5, itint: TILE, ceilKey: 'istone' });
    // 池畔比池底高一公尺，中央就是像游泳池一樣大的浴池
    const D = 1.0;
    b.box('istone', 16, D, 3, ox, oy, oz - 4.5, 0, TILE);
    b.box('istone', 16, D, 3, ox, oy, oz + 4.5, 0, TILE);
    b.box('istone', 3, D, 6, ox - 6.5, oy, oz, 0, TILE);
    b.box('istone', 3, D, 6, ox + 6.5, oy, oz, 0, TILE);
    for (let i = 0; i < 2; i++) b.box('istone', 0.5, D * (0.66 - i * 0.33), 3, ox - 4.75 + i * 0.5, oy, oz, 0, TILE);
    const water = new THREE.PlaneGeometry(10, 6);
    water.rotateX(-Math.PI / 2);
    b.add('iplain', water, mat4(ox, oy + 0.78, oz), col(0.16, 0.5, 0.52));
    const dp = new At(b, ox + 5.5, oy + D, oz + 6, Math.PI);
    door(dp, 1.6, 3);
    // 池邊一百個金色水龍頭（這裡放四十個），把手上各鑲一顆寶石
    const gems = [col(4, 0.3, 0.3), col(0.3, 3.4, 0.8), col(0.4, 0.9, 4), col(3.6, 2.8, 0.3), col(2.6, 0.5, 3.4)];
    let gi = 0;
    const tap = (x: number, z: number, ry: number) => {
      const p = new At(b, x, oy + D, z, ry);
      p.cyl('iplain', 0.03, 0.04, 0.22, 0, 0, 0, 6, GOLD);
      p.geo('iplain', new THREE.CylinderGeometry(0.022, 0.022, 0.2, 6), 0, 0.2, 0.08, GOLD, 0, Math.PI / 2);
      p.sphere('iglow', 0.035, 0, 0.27, -0.02, gems[gi++ % gems.length]);
    };
    for (let i = 0; i < 13; i++) {
      tap(ox - 4.6 + i * 0.77, oz - 3.12, 0);
      tap(ox - 4.6 + i * 0.77, oz + 3.12, Math.PI);
    }
    for (let i = 0; i < 7; i++) tap(ox + 5.12, oz - 2.4 + i * 0.8, -Math.PI / 2);
    // 泡泡
    for (let i = 0; i < 46; i++) {
      const x = ox - 4 + b.rng() * 8.6;
      const z = oz - 2.6 + b.rng() * 5.2;
      const tint = [WHITE, col(1.0, 0.75, 0.85), col(0.75, 0.85, 1.0)][i % 3];
      b.sphere('iplain', 0.1 + b.rng() * 0.22, x, oy + 0.8, z, tint, 0.7, 7);
    }
    // 跳水板、毛巾、牆上的人魚彩繪玻璃
    b.box('iwood', 2.4, 0.08, 0.6, ox - 5.4, oy + D + 0.5, oz + 1.8, 0, col(1.4, 1.2, 1.0));
    b.box('istone', 0.5, 0.5, 0.6, ox - 6.2, oy + D, oz + 1.8, 0, TILE);
    for (let i = 0; i < 5; i++) b.box('iplain', 0.7, 0.09, 0.45, ox - 7.2, oy + D + i * 0.09, oz - 4.6, 0, WHITE);
    pane(b, 3.2, 5.2, ox, oy + D + 1.4, oz - 6, 0);
    {
      const p = new At(b, ox, oy + D + 1.4, oz - 5.93);
      p.geo('iglow', new THREE.SphereGeometry(0.28, 10, 8), 0.15, 3.3, 0, col(1.6, 1.1, 0.8));
      p.geo('iglow', new THREE.CylinderGeometry(0.2, 0.32, 1.1, 8), 0.1, 2.5, 0, col(1.5, 1.05, 0.8), 0, 0, 0.15);
      p.geo('iglow', new THREE.CylinderGeometry(0.32, 0.08, 1.7, 8), -0.25, 1.3, 0, col(0.3, 1.5, 1.1), 0, 0, -0.45);
      p.geo('iglow', new THREE.ConeGeometry(0.45, 0.5, 4), -0.75, 0.5, 0, col(0.3, 1.5, 1.1), 0, 0, 2.2);
      p.geo('iglow', new THREE.SphereGeometry(0.42, 8, 6), 0.02, 3.1, -0.03, col(1.9, 1.2, 0.3));
      p.box('iglow', 0.85, 0.5, 0.2, 0.9, 0.25, -0.02, col(0.5, 0.45, 0.4));
    }
    for (const x of [-6.5, 6.5]) for (const z of [-5.95, 5.95]) torch(b, ox + x, oy + D + 3.4, oz + z, z < 0 ? 0 : Math.PI);
    chandelier(b, ox, oy + 6.6, oz, 1.8, 12, 1.9);
    registerScene({
      id: 'prefectsBath',
      name: '級長浴室',
      intro: '像游泳池一樣大的大理石浴池，池邊的金色水龍頭各鑲著不同的寶石。',
      box: box3(ox - 8, oy - 1, oz - 6, ox + 8, oy + 8.5, oz + 6),
      lights: [{ pos: [ox, oy + 5.6, oz], intensity: 260, dist: 24, color: 0xffe2bc }],
      spawn: [ox + 6.5, oy + D, oz + 1, -Math.PI / 2],
      pocket: true,
      ambient: 0.45,
      group: b.build('prefectsBath', M),
    });
    link(landingDoor(3), { pos: [dp.x, oy + D, dp.z], face: Math.PI, name: '級長浴室' });
  }
  void fireplace;
  void FIRE;
}
