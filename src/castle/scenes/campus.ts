import * as THREE from 'three';
import { Builder, col, mat4 } from '../kit';
import { getMaterials } from '../materials';
import { heightAt } from '../../world/heightfield';
import { room, pane, torch, flight, GOLD, IRON, FIRE, DARKWOOD, IWARM, MARBLE } from '../interiors';
import { At, ringWall, orientedRoom, door, bookshelf, table, chair, fireplace, cauldron, potionShelf, roundTable, blackboard, portrait, STEEL, WHITE, BLACK, type LocalOpening } from './kit';
import { registerScene, link, box3, pocketOrigin, type DoorEnd } from './registry';
import { WILLOW_DOOR, SHACK_DOOR, PITCH_DOORS, type WingShape } from './doors';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const COPPER = col(0.75, 0.33, 0.14);
const STRAW = col(0.75, 0.6, 0.3);
const LEATHER = col(0.32, 0.2, 0.12);
const HOUSE = { gryffindor: col(0.5, 0.035, 0.04), slytherin: col(0.03, 0.22, 0.1) };

/** 圓屋裡的擺放：a 是方位角，d 是離圓心的距離，正面朝圓心 */
const ringOf = (b: Builder, ox: number, oy: number, oz: number) => (a: number, d: number, yy = 0) => new At(b, ox + Math.sin(a) * d, oy + yy, oz + Math.cos(a) * d, a + Math.PI);

/** 半開的木門（往外推開） */
function openDoorLeaf(b: Builder, x: number, y: number, z: number, face: number, w: number, h: number, swing = 1.2) {
  const hx = x + Math.cos(face) * (w / 2);
  const hz = z - Math.sin(face) * (w / 2);
  new At(b, hx, y, hz, face + swing).box('iplain', w, h, 0.1, -w / 2, 0, 0.05, col(0.6, 0.45, 0.32));
}

/** 一座低矮的長凳，正面朝 +Z */
function bench(p: At, w: number, back = true, tint?: THREE.Color) {
  p.box('iwood', w, 0.07, 0.45, 0, 0.42, 0, tint);
  for (const s of [-1, 1]) p.box('iwood', 0.07, 0.42, 0.4, s * (w / 2 - 0.15), 0, 0, tint);
  if (back) p.box('iwood', w, 0.55, 0.06, 0, 0.62, -0.22, tint);
}

// ================================================================== 海格的小屋
/** 兩間相連的圓石屋，挖空後直接從門走進去。hx/hz 是大間的圓心，hy 是地面高度 */
export function hagridHut(b: Builder, hx: number, hy: number, hz: number, HS: THREE.Color, THATCH: THREE.Color, LAMP: THREE.Color) {
  const ax = hx + 8.2;
  const az = hz + 3.5;
  const R1 = 6.75;
  const R2 = 4.75;
  const DOOR = 2.6;
  const inMain = (a: number, r: number) => Math.hypot(ax + Math.sin(a) * r - hx, az + Math.cos(a) * r - hz) < R1 - 0.3;
  const inAnnex = (a: number, r: number) => Math.hypot(hx + Math.sin(a) * r - ax, hz + Math.cos(a) * r - az) < R2 - 0.3;
  const PLANK = col(0.62, 0.48, 0.34);
  ringWall(b, hx, hy - 3, hz, R1 - 0.55, R1, 9, { tint: HS, lining: col(1.05, 0.95, 0.82), gaps: [{ a: DOOR, w: 2.4, y0: hy - 0.3, y1: hy + 3.2 }], skip: (a) => inAnnex(a, R1 - 0.3) });
  ringWall(b, ax, hy - 3, az, R2 - 0.5, R2, 8, { tint: HS, lining: col(1.05, 0.95, 0.82), skip: (a) => inMain(a, R2 - 0.25) });
  b.cone('roof', 7.9, 8.5, hx, hy + 5.6, hz, 10, THATCH);
  b.cone('roof', 5.7, 6.5, ax, hy + 4.7, az, 10, THATCH);
  // 木地板
  b.cyl('iwood', R1 - 0.5, R1 - 0.5, 0.3, hx, hy - 0.3, hz, 20, PLANK);
  b.cyl('iwood', R2 - 0.45, R2 - 0.45, 0.3, ax, hy - 0.3, az, 16, PLANK);
  // 天花板的橫樑
  for (let k = 0; k < 3; k++) b.box('iwood', 0.3, 0.3, 12.4, hx - 3 + k * 3, hy + 5.3, hz, 0.4, DARKWOOD);
  openDoorLeaf(b, hx + Math.sin(DOOR) * R1, hy, hz + Math.cos(DOOR) * R1, DOOR, 2.3, 3.1);
  for (const a of [0.4, 1.5, 5.2]) b.window(1.2, 1.5, hx + Math.sin(a) * (R1 + 0.02), hy + 2.1, hz + Math.cos(a) * (R1 + 0.02), a, 0, 0.08);
  for (const a of [0.2, 1.9]) b.window(1.0, 1.3, ax + Math.sin(a) * (R2 + 0.02), hy + 1.9, az + Math.cos(a) * (R2 + 0.02), a, 0, 0.08);
  for (const a of [0.4, 1.5, 5.2]) pane(b, 1.2, 1.5, hx + Math.sin(a) * (R1 - 0.56), hy + 2.1, hz + Math.cos(a) * (R1 - 0.56), a + Math.PI);
  for (const a of [0.2, 1.9]) pane(b, 1.0, 1.3, ax + Math.sin(a) * (R2 - 0.51), hy + 1.9, az + Math.cos(a) * (R2 - 0.51), a + Math.PI);
  b.sphere('lamp', 0.25, hx + Math.sin(2.95) * 7.0, hy + 3.2, hz + Math.cos(2.95) * 7.0, LAMP);

  const ring = ringOf(b, hx, hy, hz);
  // 壁爐：就在外面那根煙囪的位置
  const CH = Math.atan2(-4.2, -3.6) + Math.PI * 2;
  const fp = ring(CH, 4.5);
  fireplace(fp, 2.2, col(0.95, 0.88, 0.78));
  cauldron(fp.at(-0.3, 0.12, 0.6), 1.7, col(0.9, 0.6, 0.2), false);
  fp.box('iplain', 0.05, 1.6, 0.05, -0.3, 1.25, 0.6, IRON);
  // 火裡孵著一顆龍蛋
  fp.sphere('iplain', 0.26, 0.6, 0.42, 0.55, col(0.05, 0.05, 0.06), 1.3, 9);
  // 巨大的扶手椅
  {
    const p = ring(CH + 0.75, 3.2);
    const C = col(0.42, 0.26, 0.14);
    p.box('iwood', 1.7, 0.6, 1.5, 0, 0, 0, C);
    p.box('iwood', 1.7, 1.6, 0.4, 0, 0.6, -0.55, C);
    for (const s of [-1, 1]) p.box('iwood', 0.35, 0.5, 1.5, s * 0.68, 0.6, 0, C);
    p.box('iplain', 1.0, 0.04, 1.0, 0, 0.61, 0.1, col(0.5, 0.2, 0.12));
  }
  // 牙牙的籃子
  {
    const p = ring(CH - 0.7, 3.4);
    p.cyl('iplain', 0.75, 0.6, 0.35, 0, 0, 0, 12, col(0.55, 0.42, 0.25));
    p.cyl('iplain', 0.62, 0.62, 0.05, 0, 0.3, 0, 12, col(0.45, 0.2, 0.15));
    const DOG = col(0.03, 0.025, 0.025);
    p.sphere('iplain', 0.38, 0, 0.55, 0, DOG, 0.7, 8);
    p.sphere('iplain', 0.2, 0.32, 0.62, 0.3, DOG, 0.9, 7);
    for (const s of [-1, 1]) p.box('iplain', 0.08, 0.22, 0.1, 0.32 + s * 0.12, 0.5, 0.33, DOG);
  }
  // 大木桌：茶壺、大馬克杯與岩石餅
  {
    const t = new At(b, hx + 1.3, hy, hz + 0.8, 0.4);
    table(t, 3.2, 1.8, 1.05, col(0.7, 0.55, 0.4));
    t.sphere('iplain', 0.3, -0.8, 1.3, 0, COPPER, 0.85, 10);
    t.geo('iplain', new THREE.ConeGeometry(0.05, 0.35, 5), -0.45, 1.35, 0, COPPER, 0, 0, -1.0);
    for (let i = 0; i < 3; i++) t.cyl('iplain', 0.13, 0.12, 0.25, 0.1 + i * 0.45, 1.05, (i % 2) * 0.4 - 0.2, 8, [col(0.7, 0.68, 0.6), col(0.4, 0.2, 0.15), col(0.3, 0.45, 0.6)][i]);
    t.cyl('iplain', 0.35, 0.3, 0.04, 0.9, 1.05, 0.4, 10, WHITE);
    for (let i = 0; i < 5; i++) t.sphere('iplain', 0.1, 0.8 + (i % 3) * 0.12, 1.15, 0.3 + Math.floor(i / 3) * 0.16, col(0.5, 0.36, 0.2), 0.7, 6);
    // 巨人尺寸的板凳
    for (const s of [-1, 1]) {
      const c = t.at(0, 0, s * 1.4, s > 0 ? Math.PI : 0);
      c.box('iwood', 2.6, 0.12, 0.6, 0, 0.65, 0, col(0.6, 0.45, 0.32));
      for (const k of [-1, 1]) c.box('iwood', 0.12, 0.65, 0.5, k * 1.1, 0, 0, col(0.6, 0.45, 0.32));
    }
  }
  // 大床：在相連的小圓屋裡，拼布被子
  {
    const p = new At(b, ax + 1.0, hy, az + 0.6, -Math.PI / 2 + 0.3);
    const F = col(0.6, 0.45, 0.32);
    p.box('iwood', 2.4, 0.6, 3.4, 0, 0, 0, F);
    p.box('iwood', 2.4, 1.6, 0.18, 0, 0, -1.7, F);
    p.box('iplain', 2.2, 0.3, 3.2, 0, 0.6, 0, WHITE);
    const PATCH = [col(0.5, 0.15, 0.1), col(0.2, 0.3, 0.15), col(0.6, 0.5, 0.2), col(0.25, 0.25, 0.45), col(0.45, 0.3, 0.2)];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) p.box('iplain', 0.56, 0.06, 0.56, -0.84 + i * 0.56, 0.88, -0.6 + k * 0.56, PATCH[(i * 3 + k) % 5]);
    p.box('iplain', 1.5, 0.25, 0.5, 0, 0.9, -1.35, WHITE);
  }
  // 牆上：鼴鼠皮大衣、粉紅色的雨傘、十字弓、銅鍋
  {
    const p = ring(DOOR + 0.5, R1 - 0.6, 1.6);
    p.box('iplain', 0.05, 0.1, 0.25, 0, 1.5, 0.1, IRON);
    p.box('iplain', 1.3, 1.8, 0.3, 0, -0.3, 0.25, col(0.28, 0.2, 0.13));
    const u = ring(DOOR - 0.45, R1 - 0.7);
    u.cyl('iplain', 0.02, 0.02, 1.0, 0, 0, 0, 5, col(0.95, 0.45, 0.6));
    u.geo('iplain', new THREE.ConeGeometry(0.12, 0.6, 8), 0, 0.9, 0, col(0.95, 0.45, 0.6), 0, Math.PI);
    const cb = ring(1.0, R1 - 0.6, 2.2);
    cb.box('iwood', 1.4, 0.1, 0.1, 0, 0, 0.1, DARKWOOD);
    cb.geo('iplain', new THREE.TorusGeometry(0.6, 0.03, 4, 12, Math.PI), 0.3, 0.05, 0.12, DARKWOOD, Math.PI / 2, 0, 0);
    for (let k = 0; k < 4; k++) {
      const q = ring(0.1 + k * 0.28, R1 - 0.62, 2.8);
      q.box('iplain', 0.05, 0.25, 0.05, 0, 0.3, 0.02, IRON);
      q.cyl('iplain', 0.2 + (k % 2) * 0.08, 0.16, 0.2, 0, 0.0, 0.15, 10, COPPER);
    }
  }
  potionShelf(ring(Math.PI * 0.08 + 0.7, R1 - 0.75), 2.2, 4, col(0.7, 0.55, 0.4));
  // 從橫樑吊下來的火腿、野禽與一串串乾燥香草
  const rng = b.rng;
  for (let i = 0; i < 14; i++) {
    const x = hx - 4 + rng() * 8;
    const z = hz - 4 + rng() * 8;
    const len = 0.4 + rng() * 0.6;
    b.cyl('iplain', 0.008, 0.008, len, x, hy + 5.3 - len, z, 4, IRON);
    const k = i % 3;
    if (k === 0) b.sphere('iplain', 0.22, x, hy + 5.0 - len, z, col(0.55, 0.22, 0.15), 1.5, 7);
    else if (k === 1) {
      b.sphere('iplain', 0.18, x, hy + 5.0 - len, z, col(0.45, 0.35, 0.25), 1.2, 6);
      b.cyl('iplain', 0.02, 0.02, 0.3, x, hy + 4.85 - len - 0.3, z, 4, col(0.6, 0.5, 0.3));
    } else b.cyl('iplain', 0.12, 0.03, 0.5, x, hy + 4.85 - len, z, 5, col(0.25, 0.35, 0.12));
  }
  // 屋外門邊的燈另外點著
  registerScene({
    id: 'hagrid',
    name: '海格的小屋',
    intro: '禁忌森林邊的石屋。爐火上吊著一大鍋東西，牙牙在籃子裡打呼。小心桌上的岩石餅，會崩牙。',
    box: box3(hx - R1, hy - 1, hz - R1, ax + R2, hy + 5.6, az + R2),
    lights: [
      { pos: [fp.x + Math.sin(CH + Math.PI) * 1.2, hy + 1.2, fp.z + Math.cos(CH + Math.PI) * 1.2], intensity: 90, dist: 14, color: 0xff8a40 },
      { pos: [hx + 1, hy + 4.2, hz + 1], intensity: 70, dist: 16, color: 0xffc888 },
      { pos: [ax, hy + 3.4, az], intensity: 35, dist: 10, color: 0xffc080 },
    ],
    spawn: [hx + Math.sin(DOOR) * 4.6, hy, hz + Math.cos(DOOR) * 4.6, DOOR + Math.PI],
    ambient: 0.25,
  });
}

// ================================================================== 貓頭鷹屋
/** 塔身已由 roundTower({ noBody }) 省略；這裡砌中空的圓牆、螺旋木梯與棲木 */
export function owleryInterior(b: Builder, ox: number, oy: number, oz: number, r: number, h: number, tint: THREE.Color) {
  const DOOR = 0.78;
  const rIn = r - 0.6;
  const gap = { a: DOOR, w: 2.2, y0: oy - 0.2, y1: oy + 3.2 };
  ringWall(b, ox, oy - 12, oz, rIn, r, h + 12, { tint, lining: col(0.95, 0.92, 0.86), gaps: [gap] });
  ringWall(b, ox, oy - 0.5, oz, r - 0.1, r * 1.1, 3, { tint, gaps: [{ ...gap, y1: oy + 4 }] });
  for (const f of [0.34, 0.66]) ringWall(b, ox, oy + h * f, oz, r - 0.1, r + 0.22, 0.55, { tint });
  b.cyl('istone', rIn + 0.05, rIn + 0.05, 0.4, ox, oy - 0.4, oz, 20, col(0.7, 0.65, 0.55));
  // 塔外的石階比門檻低了一截，補幾階接上
  for (let k = 0; k <= 16; k++) {
    const top = oy - 0.42 * k;
    const rr = r + 0.55 + 0.6 * k;
    if (top < heightAt(ox + Math.sin(DOOR) * rr, oz + Math.cos(DOOR) * rr) + 0.3) break;
    new At(b, ox + Math.sin(DOOR) * rr, top - 4, oz + Math.cos(DOOR) * rr, DOOR).box('stone', 2.6, 4, k === 0 ? 1.3 : 0.62, 0, 0, 0, tint);
  }
  openDoorLeaf(b, ox + Math.sin(DOOR) * r, oy, oz + Math.cos(DOOR) * r, DOOR, 1.8, 3.0, 1.4);
  // 地上鋪著稻草，散著骨頭和鼠骨
  const rng = b.rng;
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * (rIn - 0.6);
    b.cyl('iplain', 0.5 + rng() * 0.7, 0.6 + rng() * 0.7, 0.04, ox + Math.sin(a) * d, oy, oz + Math.cos(a) * d, 7, STRAW.clone().multiplyScalar(0.7 + rng() * 0.5));
  }
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * (rIn - 0.4);
    b.add('iplain', new THREE.CylinderGeometry(0.015, 0.015, 0.12 + rng() * 0.15, 4), mat4(ox + Math.sin(a) * d, oy + 0.06, oz + Math.cos(a) * d, rng() * 6, Math.PI / 2), WHITE);
  }
  // 窗洞內側：看得到天光
  for (let row = 0; row < 5; row++) {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + row * 0.35;
      pane(b, 0.9, 2.3, ox + Math.sin(a) * (rIn - 0.02), oy + 4.05 + row * 4.4, oz + Math.cos(a) * (rIn - 0.02), a + Math.PI);
    }
  }
  // 沿著牆面盤旋而上的木梯，通到半空的平台
  const top = 10.8;
  const n = Math.round(top / 0.22);
  const a0 = DOOR + 0.75;
  const da = 0.155;
  for (let i = 0; i < n; i++) {
    const a = a0 + i * da;
    const yy = oy + (i + 1) * 0.22;
    new At(b, ox + Math.sin(a) * (rIn - 0.65), yy - 0.3, oz + Math.cos(a) * (rIn - 0.65), a).box('iwood', 0.95, 0.3, 1.25, 0, 0, 0, DARKWOOD);
    if (i % 3 === 0) b.cyl('iwood', 0.04, 0.04, 1.1, ox + Math.sin(a) * (rIn - 1.25), yy, oz + Math.cos(a) * (rIn - 1.25), 4, DARKWOOD);
    // 靠天井一側的欄板（後半段底下是空的，摔下去很高）
    if (yy - oy > 2.5) new At(b, ox + Math.sin(a) * (rIn - 1.3), yy, oz + Math.cos(a) * (rIn - 1.3), a).box('iwood', 0.95, 0.95, 0.06, 0, 0, 0, DARKWOOD);
  }
  const aEnd = a0 + n * da;
  const P = 2.6;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const da2 = Math.atan2(Math.sin(a - aEnd), Math.cos(a - aEnd));
    if (da2 < 0.1 && da2 > -2.3) continue;
    new At(b, ox + Math.sin(a) * ((P + rIn) / 2), oy + top - 0.3, oz + Math.cos(a) * ((P + rIn) / 2), a).box('iwood', 2 * rIn * Math.tan(Math.PI / 24) + 0.05, 0.3, rIn - P, 0, 0, 0, DARKWOOD);
    b.cyl('iwood', 0.05, 0.05, 1.0, ox + Math.sin(a) * (P + 0.05), oy + top, oz + Math.cos(a) * (P + 0.05), 4, DARKWOOD);
  }
  b.add('iwood', new THREE.TorusGeometry(P + 0.05, 0.05, 4, 32).rotateX(Math.PI / 2), mat4(ox, oy + top + 1.0, oz), DARKWOOD);
  // 平台開口的另一頭：橫跨的欄杆，免得從平台邊緣踩空掉進樓梯井
  {
    const a = aEnd - 2.3;
    const r0 = P;
    const r1 = rIn;
    new At(b, ox + Math.sin(a) * ((r0 + r1) / 2), oy + top, oz + Math.cos(a) * ((r0 + r1) / 2), a + Math.PI / 2).box('iwood', r1 - r0, 1.0, 0.08, 0, 0, 0, DARKWOOD);
  }
  // 平台上：寄信用的小桌與一疊信
  {
    const p = new At(b, ox + Math.sin(aEnd + 2) * 3.6, oy + top, oz + Math.cos(aEnd + 2) * 3.6, aEnd + 2 + Math.PI);
    table(p, 1.2, 0.6, 0.8);
    for (let k = 0; k < 6; k++) p.box('iplain', 0.24, 0.02, 0.16, -0.3 + (k % 3) * 0.28, 0.8 + Math.floor(k / 3) * 0.02, 0, col(0.85, 0.78, 0.6), k * 0.3);
    p.box('iplain', 0.05, 0.05, 0.05, 0.4, 0.8, 0.1, col(0.6, 0.05, 0.05));
  }
  // 一圈圈的棲木與停在上面的貓頭鷹
  const OWL = [col(0.85, 0.84, 0.8), col(0.38, 0.27, 0.17), col(0.3, 0.28, 0.27), col(0.55, 0.42, 0.28), col(0.2, 0.15, 0.1)];
  for (let lv = 0; lv < 10; lv++) {
    const yy = oy + 2.6 + lv * 2.3;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + lv * 0.5;
      const p = new At(b, ox + Math.sin(a) * (rIn - 0.35), yy, oz + Math.cos(a) * (rIn - 0.35), a + Math.PI);
      p.box('iplain', 0.08, 0.08, 0.7, 0, 0, 0, DARKWOOD);
      const taken = rng() < 0.45;
      // 下面幾層空著的棲木留給 NPC 貓頭鷹（嘿美）
      if (!taken && lv < 3) p.spot('perch', 0, 0.08, 0.15);
      if (taken) {
        const c = OWL[Math.floor(rng() * OWL.length)];
        const s = 0.8 + rng() * 0.5;
        p.sphere('iplain', 0.15 * s, 0, 0.2 * s, 0.05, c, 1.35, 7);
        p.sphere('iplain', 0.11 * s, 0, 0.44 * s, 0.07, c, 1, 7);
        for (const e of [-1, 1]) p.sphere('iglow', 0.025 * s, e * 0.045 * s, 0.46 * s, 0.17 * s, col(2.2, 1.4, 0.2), 1, 4);
        p.geo('iplain', new THREE.ConeGeometry(0.015, 0.05, 4), 0, 0.41 * s, 0.18 * s, col(0.3, 0.25, 0.1), 0, Math.PI / 2);
      }
    }
  }
  registerScene({
    id: 'owlery',
    name: '貓頭鷹屋',
    intro: '學校的貓頭鷹都住在這裡。地上鋪滿稻草和吃剩的骨頭，沿著木梯爬上平台可以寄信。',
    box: box3(ox - r, oy - 1, oz - r, ox + r, oy + h, oz + r),
    lights: [
      { pos: [ox, oy + 5, oz], intensity: 60, dist: 16, color: 0xffd8a8 },
      { pos: [ox, oy + top + 3, oz], intensity: 60, dist: 16, color: 0xffd8a8 },
    ],
    spawn: [ox + Math.sin(DOOR) * 3.4, oy, oz + Math.cos(DOOR) * 3.4, DOOR + Math.PI],
    ambient: 0.65,
  });
}

// ================================================================== 船屋
export function boathouseInterior(b: Builder, s: WingShape, h: number, found: number, tint: THREE.Color) {
  const ry = s.ry ?? 0;
  const y = s.y!;
  const openings: LocalOpening[] = [
    { side: 'W', at: 0, w: 2.2, h: 3.4 },
    { side: 'S', at: 0, w: 5.6, h: 5 },
  ];
  const p = orientedRoom(b, s.x, y, s.z, ry, s.w, s.d, h, { t: 0.45, openings, tint, found, ceil: h, itint: col(1.0, 0.95, 0.85) });
  const iw = s.w / 2 - 0.45;
  const id = s.d / 2 - 0.45;
  // 木地板與窗
  for (let i = 0; i < 14; i++) p.box('iplain', s.w - 1, 0.03, (2 * id) / 14 - 0.03, 0, 0, -id + ((i + 0.5) * 2 * id) / 14, col(0.55, 0.42, 0.3));
  for (const lx of [-4.4, 4.4]) for (const sz of [1, -1]) {
    const [wx, wz] = p.w(lx, sz * (id - 0.01));
    pane(b, 1.5, 3.6, wx, y + 1.4, wz, ry + (sz > 0 ? Math.PI : 0));
  }
  {
    const [wx, wz] = p.w(0, -(id - 0.01));
    pane(b, 1.5, 3.6, wx, y + 1.4, wz, ry);
  }
  // 屋架
  for (let i = -3; i <= 3; i++) p.box('iwood', 0.25, 0.3, 2 * id, i * 2.6, h - 0.55, 0, DARKWOOD);
  // 架在木架上、翻過來的小船
  for (const lx of [-5.5, 4.6]) {
    const q = p.at(lx, 0, -1.5, Math.PI / 2);
    for (const k of [-1, 1]) q.box('iwood', 0.2, 0.7, 1.6, k * 1.1, 0, 0, DARKWOOD);
    const g = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(0.85, 0.75, 2.3);
    q.geo('iplain', g, 0, 0.75, 0, col(0.6, 0.45, 0.3), Math.PI / 2);
    // 龍骨、船舷與幾道船板線，看得出是翻過來的小船
    q.box('iplain', 0.1, 0.1, 4.5, 0, 1.47, 0, col(0.35, 0.25, 0.18), Math.PI / 2);
    q.geo('iplain', new THREE.TorusGeometry(1, 0.05, 4, 24).rotateX(Math.PI / 2).scale(0.87, 1, 2.32), 0, 0.77, 0, col(0.35, 0.25, 0.18), Math.PI / 2);
    for (const t of [0.35, 0.65]) q.geo('iplain', new THREE.TorusGeometry(1, 0.012, 3, 24).rotateX(Math.PI / 2).scale(0.85 * Math.cos(Math.asin(t)) + 0.01, 1, 2.3 * Math.cos(Math.asin(t)) + 0.01), 0, 0.75 + 0.75 * t, 0, col(0.4, 0.3, 0.22), Math.PI / 2);
  }
  // 牆上的槳、救生圈與繩索
  for (let k = 0; k < 6; k++) {
    const q = p.at(-6 + k * 0.45, 0.4, -(id - 0.12));
    q.box('iplain', 0.06, 2.6, 0.05, 0, 0, 0, col(0.6, 0.45, 0.3), 0.08);
    q.box('iplain', 0.18, 0.5, 0.04, 0, 0.1, 0.02, col(0.6, 0.45, 0.3));
  }
  for (const lx of [1.6, 3.4]) {
    const q = p.at(lx, 2.6, -(id - 0.12));
    q.geo('iplain', new THREE.TorusGeometry(0.42, 0.11, 6, 16), 0, 0, 0.1, col(0.85, 0.82, 0.78));
    for (let k = 0; k < 4; k++) q.geo('iplain', new THREE.BoxGeometry(0.12, 0.25, 0.25), Math.sin(k * 1.57) * 0.42, Math.cos(k * 1.57) * 0.42, 0.1, col(0.7, 0.1, 0.08), 0, 0, k * 1.57);
  }
  for (const [lx, lz] of [[-7.2, 2.6], [6.8, 3.0]]) for (let k = 0; k < 4; k++) p.geo('iplain', new THREE.TorusGeometry(0.4, 0.06, 5, 14), lx, 0.05 + k * 0.1, lz, col(0.7, 0.6, 0.42), 0, Math.PI / 2);
  // 海格帶新生過湖時提的大燈籠、木箱與告示
  {
    const q = p.at(-iw + 1.0, 0, 2.4);
    q.box('iwood', 1.0, 0.8, 0.8, 0, 0, 0, col(0.7, 0.55, 0.4));
    q.box('iwood', 0.8, 0.6, 0.7, 0.1, 0.8, 0, col(0.6, 0.48, 0.34));
    q.cyl('iplain', 0.22, 0.25, 0.5, 0.1, 1.4, 0, 6, IRON);
    q.sphere('iglow', 0.14, 0.1, 1.65, 0, FIRE, 1.3, 6);
  }
  blackboard(p.at(iw - 0.1 - 2.4, 1.5, -(id - 0.02)), 1.6, 1.0);
  for (const lx of [-3, 3]) {
    const q = p.at(lx, 0, id - 0.3);
    q.cyl('iwood', 0.1, 0.1, 2.2, 0, 0, 0, 6, DARKWOOD);
    q.cyl('iplain', 0.16, 0.18, 0.35, 0, 2.2, 0, 6, IRON);
    q.sphere('iglow', 0.11, 0, 2.38, 0, FIRE, 1.3, 6);
  }
  const L = (lx: number, lz: number, yy: number): [number, number, number] => {
    const [wx, wz] = p.w(lx, lz);
    return [wx, y + yy, wz];
  };
  const [c0, c1] = p.w(0, 0);
  registerScene({
    id: 'boathouse',
    name: '船屋',
    intro: '一年級新生搭著小船過湖之後，就是在這裡上岸。牆上掛著槳和救生圈，小船翻過來晾在木架上。',
    box: box3(c0 - 9, y - 1, c1 - 9, c0 + 9, y + h, c1 + 9),
    lights: [
      { pos: L(-3, 0, 4.4), intensity: 70, dist: 16, color: 0xffc080 },
      { pos: L(3.5, 0, 4.4), intensity: 70, dist: 16, color: 0xffc080 },
    ],
    spawn: [...L(-iw + 2.2, 0, 0), ry + Math.PI / 2] as [number, number, number, number],
    ambient: 0.4,
  });
}

// ================================================================== 活米村車站
/** platform：月台在廂房的哪一側 */
export function stationInterior(b: Builder, s: WingShape, platform: 'N' | 'S', tint: THREE.Color) {
  const ry = s.ry ?? 0;
  const y = s.y!;
  const h = 5;
  const openings: LocalOpening[] = [
    { side: platform, at: 0, w: 1.9, h: 3 },
  ];
  const p = orientedRoom(b, s.x, y, s.z, ry, s.w, s.d, h, { t: 0.4, openings, tint, found: 6, ceil: h - 0.3, itint: col(1.15, 1.05, 0.92) });
  const iw = s.w / 2 - 0.4;
  const id = s.d / 2 - 0.4;
  const ps = platform === 'S' ? 1 : -1;
  // 窗
  for (let i = 0; i < 6; i++) {
    const lx = (i - 2.5) * 3.6;
    if (Math.abs(lx) < 1) continue;
    for (const sz of [1, -1]) {
      const [wx, wz] = p.w(lx, sz * (id - 0.01));
      pane(b, 1.2, 2, wx, y + 1.4, wz, ry + (sz > 0 ? Math.PI : 0));
    }
  }
  // 地磚
  for (let i = 0; i < 12; i++) for (let k = 0; k < 4; k++) if ((i + k) % 2) p.box('iplain', (2 * iw) / 12, 0.015, (2 * id) / 4, -iw + ((i + 0.5) * 2 * iw) / 12, 0, -id + ((k + 0.5) * 2 * id) / 4, col(0.35, 0.3, 0.27));
  // 售票口：一端的木櫃台加鐵柵
  {
    const q = p.at(-iw + 1.6, 0, 0, Math.PI / 2);
    q.box('iwood', 2 * id - 0.4, 1.1, 0.5, 0, 0, 0, DARKWOOD);
    q.box('iwood', 2 * id - 0.4, 0.06, 0.7, 0, 1.1, 0.05, DARKWOOD);
    for (let k = 0; k < 14; k++) q.cyl('iplain', 0.012, 0.012, 1.2, -2.6 + k * 0.4, 1.16, 0, 4, GOLD);
    q.box('iwood', 2 * id - 0.4, 0.4, 0.1, 0, 2.36, 0, DARKWOOD);
    q.box('iplain', 1.6, 0.3, 0.03, 0, 2.4, 0.07, col(0.85, 0.75, 0.5));
    // 櫃台後的鴿籠格與票卷
    q.box('iwood', 3, 1.6, 0.4, 0, 1.0, -1.1, DARKWOOD);
    for (let k = 0; k < 12; k++) q.box('iplain', 0.2, 0.04, 0.3, -1.2 + (k % 6) * 0.48, 1.3 + Math.floor(k / 6) * 0.6, -0.9, col(0.85, 0.75, 0.5));
  }
  // 候車長椅（背靠背）
  for (const lx of [-3, 2, 7]) for (const s2 of [-1, 1]) bench(p.at(lx, 0, s2 * 0.5, s2 > 0 ? 0 : Math.PI), 2.6, true, col(0.45, 0.28, 0.16));
  // 時刻表與大鐘
  {
    const [wx, wz] = p.w(iw - 0.02, 0);
    const q = new At(b, wx, y + 1.6, wz, ry - Math.PI / 2);
    blackboard(q, 2.4, 1.3);
    q.box('iplain', 2.3, 0.18, 0.02, 0, 1.4, 0.08, col(0.85, 0.75, 0.5));
    q.geo('iplain', new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), 0, 2.4, 0.06, WHITE, 0, Math.PI / 2);
    q.geo('iplain', new THREE.TorusGeometry(0.43, 0.04, 4, 20), 0, 2.4, 0.08, GOLD);
    q.box('iplain', 0.03, 0.3, 0.02, 0, 2.4, 0.12, BLACK);
    q.box('iplain', 0.22, 0.03, 0.02, 0.1, 2.4, 0.12, BLACK);
  }
  // 行李推車：皮箱、鳥籠
  {
    const q = p.at(5.5, 0, ps * (id - 1.3), 0.2);
    q.box('iplain', 1.6, 0.06, 0.8, 0, 0.35, 0, IRON);
    for (const k of [-1, 1]) q.geo('iplain', new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10), k * 0.6, 0.17, 0.42, BLACK, 0, Math.PI / 2);
    q.box('iplain', 0.05, 1.0, 0.8, -0.8, 0.35, 0, IRON);
    q.box('iwood', 1.0, 0.45, 0.6, 0.1, 0.41, 0, LEATHER);
    q.box('iwood', 0.8, 0.35, 0.5, 0.1, 0.86, 0, col(0.2, 0.25, 0.35));
    q.cyl('iplain', 0.2, 0.2, 0.03, 0.15, 1.21, 0, 10, GOLD);
    for (let k = 0; k < 8; k++) q.cyl('iplain', 0.006, 0.006, 0.45, 0.15 + Math.cos(k * 0.785) * 0.19, 1.24, Math.sin(k * 0.785) * 0.19, 3, GOLD);
    q.sphere('iplain', 0.1, 0.15, 1.4, 0, WHITE, 1.3, 6);
  }
  // 燒煤的鐵爐
  {
    const q = p.at(-2, 0, -ps * (id - 0.7));
    q.cyl('iplain', 0.35, 0.38, 0.9, 0, 0, 0, 10, BLACK);
    q.cyl('iplain', 0.08, 0.08, h - 1.2, 0, 0.9, 0, 6, BLACK);
    q.sphere('iglow', 0.1, 0, 0.35, 0.33, FIRE, 1, 5);
  }
  for (const lx of [-5, 5]) {
    const [wx, wz] = p.w(lx, 0);
    b.cyl('iplain', 0.01, 0.01, 0.8, wx, y + h - 1.1, wz, 4, IRON);
    b.sphere('iglow', 0.14, wx, y + h - 1.2, wz, col(4, 2.6, 1.2), 1.1, 6);
  }
  const L = (lx: number, yy: number): [number, number, number] => {
    const [wx, wz] = p.w(lx, 0);
    return [wx, y + yy, wz];
  };
  const [c0, c1] = p.w(0, 0);
  registerScene({
    id: 'station',
    name: '活米村車站',
    intro: '霍格華茲特快車的終點站。候車室裡有售票口、時刻表和一台堆滿行李的推車。',
    box: box3(c0 - 13.5, y - 1, c1 - 13.5, c0 + 13.5, y + h, c1 + 13.5),
    lights: [
      { pos: L(-5, 3.6), intensity: 70, dist: 16, color: 0xffd0a0 },
      { pos: L(5, 3.6), intensity: 70, dist: 16, color: 0xffd0a0 },
    ],
    spawn: [...L(1.2, 0), ry] as [number, number, number, number],
    ambient: 0.45,
  });
}

// ================================================================== 盆栽棚
export function pottingShed(b: Builder, x0: number, x1: number, z0: number, z1: number, y: number, tint: THREE.Color) {
  const h = 6;
  room(b, { x0, x1, z0, z1, y, h, t: 0.4, found: 3, tint, ceil: 5.6, openings: [{ side: 'E', at: (z0 + z1) / 2, w: 1.8, h: 3 }] });
  openDoorLeaf(b, x1 + 0.4, y, (z0 + z1) / 2, Math.PI / 2, 1.7, 2.9, 1.0);
  pane(b, 1.2, 2.2, (x0 + x1) / 2, y + 1.6, z1 - 0.01, Math.PI);
  pane(b, 1.2, 2.2, (x0 + x1) / 2 - 3, y + 1.6, z0 + 0.01, 0);
  const cx = (x0 + x1) / 2;
  const rng = b.rng;
  // 北牆的工作台與工具
  {
    const p = new At(b, cx - 0.5, y, z0 + 0.6);
    table(p, 6.5, 1.0, 0.9, col(0.7, 0.55, 0.4));
    p.box('iwood', 6.5, 1.4, 0.05, 0, 1.5, -0.5, DARKWOOD);
    for (let i = 0; i < 12; i++) {
      const lx = -3 + i * 0.52;
      p.box('iplain', 0.03, 0.3, 0.03, lx, 2.0, -0.45, IRON);
      if (i % 3 === 0) p.box('iplain', 0.18, 0.35, 0.03, lx, 1.6, -0.43, STEEL);
      else if (i % 3 === 1) p.box('iplain', 0.05, 0.55, 0.03, lx, 1.4, -0.43, col(0.5, 0.35, 0.2));
      else p.geo('iplain', new THREE.TorusGeometry(0.1, 0.02, 4, 10), lx, 1.7, -0.43, col(0.5, 0.15, 0.1));
    }
    for (let i = 0; i < 6; i++) p.cyl('iplain', 0.12, 0.09, 0.18, -2.4 + i * 0.5, 0.9, 0.1, 8, col(0.55, 0.25, 0.14));
    p.box('iplain', 0.5, 0.06, 0.3, 1.8, 0.9, 0.1, col(0.3, 0.2, 0.1));
  }
  // 種子抽屜櫃
  {
    const p = new At(b, x0 + 0.5, y, z1 - 2.2, Math.PI / 2);
    p.box('iwood', 2.4, 2.0, 0.6, 0, 0, 0, DARKWOOD);
    for (let i = 0; i < 6; i++) for (let k = 0; k < 5; k++) {
      p.box('iplain', 0.34, 0.3, 0.02, -1.0 + i * 0.4, 0.2 + k * 0.36, 0.31, col(0.7, 0.55, 0.4));
      p.sphere('iplain', 0.025, -1.0 + i * 0.4, 0.35 + k * 0.36, 0.33, GOLD);
    }
  }
  // 一疊疊的空花盆、龍糞肥料袋與澆水壺
  for (let i = 0; i < 5; i++) {
    const px = x0 + 1.2 + rng() * 2;
    const pz = z0 + 2.4 + i * 0.7;
    for (let k = 0; k < 4 + (i % 3); k++) b.cyl('iplain', 0.2, 0.15, 0.14, px, y + k * 0.1, pz, 8, col(0.55, 0.25, 0.14));
  }
  for (let i = 0; i < 4; i++) b.sphere('iplain', 0.4, x1 - 1.2, y + 0.35, z0 + 1.8 + i * 0.9, col(0.55, 0.5, 0.38), 0.85, 7);
  for (let i = 0; i < 3; i++) {
    const p = new At(b, x1 - 2.6 + i * 0.6, y, z1 - 1.0, 0.4);
    p.cyl('iplain', 0.16, 0.18, 0.35, 0, 0, 0, 8, COPPER);
    p.geo('iplain', new THREE.CylinderGeometry(0.02, 0.04, 0.5, 5), 0.22, 0.3, 0, COPPER, 0, 0, -0.8);
  }
  // 掛在門邊的一排耳罩與龍皮手套
  for (let i = 0; i < 6; i++) {
    const p = new At(b, x1 - 0.2, y + 1.9, z1 - 1.6 - i * 0.35, -Math.PI / 2);
    p.geo('iplain', new THREE.TorusGeometry(0.09, 0.02, 5, 10, Math.PI), 0, 0, 0.05, col(0.2, 0.2, 0.22));
    for (const s of [-1, 1]) p.sphere('iplain', 0.05, s * 0.09, -0.01, 0.05, [col(0.75, 0.4, 0.5), col(0.4, 0.5, 0.75), col(0.85, 0.75, 0.3)][i % 3], 1, 6);
  }
  for (let i = 0; i < 3; i++) new At(b, x1 - 0.2, y + 1.3, z0 + 2.6 + i * 0.4, -Math.PI / 2).box('iplain', 0.18, 0.4, 0.06, 0, 0, 0.05, col(0.3, 0.32, 0.18));
  b.cyl('iplain', 0.01, 0.01, 0.8, cx, y + 4.8, (z0 + z1) / 2, 4, IRON);
  b.sphere('iglow', 0.14, cx, y + 4.7, (z0 + z1) / 2, col(4, 2.6, 1.2), 1.1, 6);
  registerScene({
    id: 'pottingShed',
    name: '盆栽棚',
    intro: '溫室旁的工具間：鏟子、修枝剪、種子抽屜，門邊掛著一排上課要戴的耳罩。',
    box: box3(x0, y - 1, z0, x1, y + h, z1),
    lights: [{ pos: [cx, y + 4.3, (z0 + z1) / 2], intensity: 60, dist: 13, color: 0xffd0a0 }],
    spawn: [x1 - 1.6, y, (z0 + z1) / 2, -Math.PI / 2],
    ambient: 0.4,
  });
}

// ================================================================== 獨立場景：尖叫屋、柳樹地道、更衣室
export function buildCampusPockets() {
  const M = getMaterials();

  // ---- 尖叫屋（兩層樓）
  let trap: DoorEnd;
  {
    const [ox, oy, oz] = pocketOrigin(23);
    const w = 11;
    const d = 9;
    const H = 4.4;
    const x0 = ox - w / 2;
    const x1 = ox + w / 2;
    const z0 = oz - d / 2;
    const z1 = oz + d / 2;
    const front: DoorEnd = { pos: [ox + 2.6, oy, z1], face: Math.PI, name: '尖叫屋' };
    trap = { pos: [x0 + 1.6, oy, z0 + 0.1], face: 0, name: '尖叫屋', sign: false };
    const WALL = col(0.62, 0.5, 0.42);
    registerScene({
      id: 'shack',
      name: '尖叫屋',
      intro: '全英國最常鬧鬼的房子。其實只是狼人每個月變身時躲進來的地方，家具都被撕爛了。',
      box: box3(x0, oy - 1, z0, x1, oy + H * 2 + 0.2, z1),
      lights: [
        { pos: [ox, oy + 2.8, oz], intensity: 30, dist: 12, color: 0xc8b8a0 },
        { pos: [ox, oy + H + 2.6, oz], intensity: 30, dist: 12, color: 0xc8b8a0 },
      ],
      spawn: [ox + 2.6, oy, z1 - 2, Math.PI],
      pocket: true,
      ambient: 0.12,
      build: () => {
        const b = new Builder(740);
        room(b, { x0, x1, z0, z1, y: oy, h: H * 2, t: 0.3, shell: false, ceil: H * 2, itint: WALL, ceilKey: 'iwood' });
        door(new At(b, ox + 2.6, oy, z1, Math.PI), 1.5, 2.6, col(0.5, 0.42, 0.36));
        // 二樓地板，留一個樓梯口
        b.box('iwood', w - 3.2, 0.3, d, ox + 1.6, oy + H - 0.3, oz, 0, col(0.5, 0.4, 0.3));
        b.box('iwood', 3.2, 0.3, d - 2, x0 + 1.6, oy + H - 0.3, oz + 1, 0, col(0.5, 0.4, 0.3));
        flight(b, V(x0 + 1.6, oy, z1 - 0.8), V(x0 + 1.6, oy + H, z0 + 2.3), 1.6, V(1, 0, 0));
        // 地板與牆上的爪痕、剝落的壁紙
        const rng = b.rng;
        for (let i = 0; i < 40; i++) {
          const lvl = i % 2;
          const yy = oy + lvl * H;
          const side = Math.floor(rng() * 4);
          const along = rng() - 0.5;
          const hh = 1 + rng() * 2.4;
          const [px, pz, ry] = side === 0 ? [ox + along * w, z0 + 0.02, 0] : side === 1 ? [ox + along * w, z1 - 0.02, Math.PI] : side === 2 ? [x0 + 0.02, oz + along * d, Math.PI / 2] : [x1 - 0.02, oz + along * d, -Math.PI / 2];
          const q = new At(b, px, yy + hh, pz, ry);
          if (i % 3) for (let k = 0; k < 4; k++) q.geo('iplain', new THREE.BoxGeometry(0.03, 0.7, 0.02), k * 0.08, 0, 0.01, col(0.15, 0.1, 0.08), 0, 0, 0.3);
          else q.box('iplain', 0.6 + rng() * 0.6, 1.2 + rng(), 0.02, 0, -1, 0.01, col(0.42, 0.34, 0.3), 0);
        }
        // 一樓：翻倒的椅子、斷腳的桌子、壞掉的鋼琴
        {
          const t = new At(b, ox + 1.5, oy, oz - 0.5, 0.4);
          t.geo('iwood', new THREE.BoxGeometry(2, 0.08, 1.1), 0, 0.45, 0, col(0.45, 0.35, 0.28), 0, 0, 0.42);
          for (const k of [-1, 1]) t.box('iwood', 0.08, 0.76, 0.08, 0.85, 0, k * 0.45, col(0.45, 0.35, 0.28));
          t.geo('iplain', new THREE.BoxGeometry(0.08, 0.7, 0.08), -0.5, 0.05, 0.6, col(0.45, 0.35, 0.28), 0, 0, Math.PI / 2);
          chair(t.at(-1.8, 0, 1.2, 1.4), col(0.45, 0.35, 0.28));
          t.geo('iplain', new THREE.BoxGeometry(0.5, 0.06, 0.5), 2.1, 0.03, 1.4, col(0.45, 0.35, 0.28), 0.6, 1.4);
        }
        {
          const p = new At(b, x1 - 0.6, oy, oz - 1, -Math.PI / 2);
          p.box('iwood', 2.2, 1.2, 0.8, 0, 0, 0, col(0.12, 0.08, 0.06));
          p.box('iplain', 1.8, 0.05, 0.25, 0, 0.9, 0.4, WHITE);
          for (let k = 0; k < 8; k++) p.box('iplain', 0.06, 0.06, 0.15, -0.8 + k * 0.23, 0.95, 0.45, BLACK);
          p.geo('iwood', new THREE.BoxGeometry(2.2, 0.06, 0.8), 0, 1.5, -0.1, col(0.12, 0.08, 0.06), 0, -0.6);
        }
        // 撕爛的沙發，填充物散了一地
        {
          const p = new At(b, ox - 1.5, oy, z0 + 1, 0);
          p.box('iplain', 2.4, 0.4, 0.9, 0, 0.08, 0, col(0.35, 0.18, 0.12));
          p.box('iplain', 2.4, 0.6, 0.2, 0, 0.48, -0.35, col(0.35, 0.18, 0.12));
          for (let k = 0; k < 10; k++) p.sphere('iplain', 0.1 + rng() * 0.1, -1.5 + rng() * 3, 0.05, 0.6 + rng() * 1.2, col(0.75, 0.7, 0.6), 0.6, 5);
        }
        // 釘死的窗
        for (const [px, pz, ry] of [[ox - 2, z1 - 0.02, Math.PI], [x0 + 0.02, oz + 2, Math.PI / 2], [ox + 1, z0 + 0.02, 0]] as const) {
          for (const lvl of [0, 1]) {
            pane(b, 1.0, 1.7, px, oy + lvl * H + 1.2, pz, ry);
            const q = new At(b, px, oy + lvl * H + 1.2, pz, ry);
            for (let k = 0; k < 3; k++) q.geo('iwood', new THREE.BoxGeometry(1.4, 0.18, 0.06), 0, 0.4 + k * 0.5, 0.06, col(0.4, 0.32, 0.25), 0, 0, (k - 1) * 0.25);
          }
        }
        // 一樓角落的活板門（通往渾拍柳樹）
        b.box('iwood', 1.2, 0.04, 1.2, trap.pos[0], oy, z0 + 1.0, 0, col(0.55, 0.45, 0.35));
        b.box('iplain', 0.2, 0.05, 0.06, trap.pos[0], oy + 0.03, z0 + 1.5, 0, IRON);
        // 二樓：垮掉的四柱床、破鏡子
        {
          const p = new At(b, ox + 1.5, oy + H, z0 + 1.6, 0);
          const F = col(0.35, 0.25, 0.2);
          p.box('iwood', 1.6, 0.4, 2.3, 0, 0, 0, F);
          p.geo('iplain', new THREE.BoxGeometry(1.5, 0.2, 2.2), 0, 0.45, 0.1, col(0.55, 0.45, 0.35), 0, 0.12);
          for (const [sx, sz, tilt] of [[-1, -1, 0], [1, -1, 0], [-1, 1, 0.5], [1, 1, 0]]) p.geo('iplain', new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), sx * 0.75, 1.1, sz * 1.1, F, 0, tilt, tilt * 0.6);
          for (const s of [-1, 1]) p.box('iplain', 0.04, 1.8, 0.8, s * 0.78, 0.4, -0.6, col(0.3, 0.08, 0.08));
          const m = new At(b, x1 - 0.02, oy + H + 1.0, oz + 1.5, -Math.PI / 2);
          m.box('iwood', 1.0, 1.6, 0.06, 0, 0, 0, F);
          m.box('iplain', 0.85, 1.4, 0.02, 0, 0.1, 0.04, col(0.4, 0.45, 0.48));
          for (let k = 0; k < 3; k++) m.geo('iplain', new THREE.BoxGeometry(0.02, 1.2, 0.01), -0.2 + k * 0.2, 0.8, 0.06, BLACK, 0, 0, (k - 1) * 0.5);
          chair(new At(b, ox - 2.5, oy + H, oz, 2.2), F);
          b.box('iplain', 3, 0.02, 2, ox - 1, oy + H, oz + 1.5, 0.3, col(0.3, 0.1, 0.08));
        }
        return b.build('shack', M);
      },
    });
    link(SHACK_DOOR, front);
  }

  // ---- 渾拍柳樹下的地道
  {
    const [ox, oy, oz] = pocketOrigin(24);
    const L = 44;
    const h = 2.3;
    const z0 = oz - L / 2;
    const z1 = oz + L / 2;
    const willowEnd: DoorEnd = { pos: [ox, oy, z1], face: Math.PI, name: '渾拍柳樹下的地道', sign: false };
    const shackEnd: DoorEnd = { pos: [ox, oy, z0 + 0.6], face: 0, name: '渾拍柳樹下的地道', sign: false };
    registerScene({
      id: 'willowTunnel',
      name: '渾拍柳樹下的地道',
      intro: '從柳樹的樹根底下一路通到尖叫屋。按住樹根上那個樹瘤，柳樹才會停下來不打人。',
      box: box3(ox - 1.2, oy - 1, z0, ox + 1.2, oy + h, z1),
      lights: [{ pos: [ox, oy + 1.8, z1 - 3], intensity: 18, dist: 10, color: 0xb0c4ff }],
      spawn: [ox, oy, z1 - 3, Math.PI],
      pocket: true,
      ambient: 0.02,
      build: () => {
        const b = new Builder(741);
        const EARTH = col(0.42, 0.32, 0.24);
        room(b, { x0: ox - 1.2, x1: ox + 1.2, z0, z1, y: oy, h, t: 0.3, shell: false, ceil: h, itint: EARTH, ceilKey: 'istone' });
        const rng = b.rng;
        // 樹根從頂上鑽下來
        for (let i = 0; i < 60; i++) {
          const z = z0 + rng() * L;
          const s = rng() < 0.5 ? -1 : 1;
          if (i % 2) b.rod('iplain', V(ox + (rng() - 0.5) * 2, oy + h, z), V(ox + s * (0.4 + rng() * 0.6), oy + h - 0.5 - rng() * 1.2, z + (rng() - 0.5)), 0.05, col(0.25, 0.17, 0.1), 4, 0.015);
          else b.sphere('iplain', 0.2 + rng() * 0.3, ox + s * 1.2, oy + rng() * h, z, EARTH.clone().multiplyScalar(0.6 + rng() * 0.5), 0.8, 6);
        }
        // 柳樹那頭：往上的土坡與樹根間的天光
        b.box('iplain', 1.6, 1.4, 0.05, ox, oy + 0.6, z1 - 0.05, 0, col(0.35, 0.45, 0.6));
        // 尖叫屋那頭：木梯
        for (const s of [-1, 1]) b.rod('iplain', V(ox + s * 0.3, oy, z0 + 0.4), V(ox + s * 0.3, oy + h, z0 + 0.2), 0.03, DARKWOOD, 4);
        for (let k = 0; k < 6; k++) b.rod('iplain', V(ox - 0.3, oy + 0.3 + k * 0.33, z0 + 0.38 - k * 0.03), V(ox + 0.3, oy + 0.3 + k * 0.33, z0 + 0.38 - k * 0.03), 0.02, DARKWOOD, 4);
        return b.build('willowTunnel', M);
      },
    });
    link(WILLOW_DOOR, willowEnd);
    link(shackEnd, trap);
  }

  // ---- 魁地奇更衣室：葛來分多與史萊哲林各一間
  const team = (k: number, id: string, name: string, house: THREE.Color, trim: THREE.Color, d: DoorEnd) => {
    const [ox, oy, oz] = pocketOrigin(25 + k);
    const w = 12;
    const dd = 9;
    const h = 4.6;
    const end: DoorEnd = { pos: [ox, oy, oz + dd / 2], face: Math.PI, name };
    registerScene({
      id,
      name,
      intro: '看台底下的更衣室。比賽前隊長在戰術板上畫好跑位，掃帚一支支靠在架上。',
      box: box3(ox - w / 2, oy - 1, oz - dd / 2, ox + w / 2, oy + h, oz + dd / 2),
      lights: [{ pos: [ox, oy + 3.6, oz], intensity: 110, dist: 16, color: 0xffe0b0 }],
      spawn: [ox, oy, oz + 2.4, Math.PI],
      pocket: true,
      ambient: 0.35,
      build: () => {
        const b = new Builder(742 + k);
        room(b, { x0: ox - w / 2, x1: ox + w / 2, z0: oz - dd / 2, z1: oz + dd / 2, y: oy, h, t: 0.3, shell: false, ceil: h, itint: col(0.95, 0.85, 0.7), ceilKey: 'iwood' });
        door(new At(b, ox, oy, oz + dd / 2, Math.PI), 1.6, 2.8);
        b.box('iplain', 8, 0.02, 3, ox, oy, oz, 0, house);
        // 兩側的置物櫃
        for (const s of [-1, 1]) {
          for (let i = 0; i < 7; i++) {
            const p = new At(b, ox + s * (w / 2 - 0.35), oy, oz - 3.3 + i * 1.0, (-s * Math.PI) / 2);
            p.box('iwood', 0.9, 2.2, 0.6, 0, 0, 0, house);
            p.box('iplain', 0.8, 0.05, 0.02, 0, 1.8, 0.31, trim);
            p.box('iplain', 0.04, 0.2, 0.03, 0.3, 1.1, 0.31, trim);
            if (i % 2 === 0) p.box('iplain', 0.5, 0.9, 0.05, 0, 0.9, 0.33, house.clone().multiplyScalar(1.4));
          }
          bench(new At(b, ox + s * (w / 2 - 1.6), oy, oz, (-s * Math.PI) / 2), 6, false, DARKWOOD);
        }
        // 戰術板
        {
          const p = new At(b, ox, oy + 1.2, oz - dd / 2, 0);
          blackboard(p, 3.6, 1.8);
          p.geo('iplain', new THREE.CircleGeometry(0.75, 20), 0, 0.9, 0.1, col(0.1, 0.14, 0.1));
          for (let i = 0; i < 7; i++) p.geo('iplain', new THREE.TorusGeometry(0.06, 0.012, 4, 10), -1.2 + i * 0.4, 0.4 + (i % 3) * 0.45, 0.1, i < 3 ? col(0.9, 0.3, 0.2) : WHITE);
        }
        // 掃帚架
        for (let i = 0; i < 7; i++) {
          const p = new At(b, ox - 3.2 + i * 0.4, oy, oz - dd / 2 + 0.3, 0);
          p.geo('iplain', new THREE.CylinderGeometry(0.025, 0.025, 1.9, 5), 0, 1.0, 0.05, col(0.45, 0.3, 0.18), 0, 0.12);
          p.geo('iplain', new THREE.ConeGeometry(0.12, 0.5, 6), 0, 0.12, -0.06, col(0.6, 0.48, 0.28), 0, Math.PI + 0.12);
        }
        b.box('iwood', 3.2, 0.1, 0.2, ox - 2.0, oy + 1.9, oz - dd / 2 + 0.15, 0, DARKWOOD);
        // 球箱：鬼抓子、被鐵鍊綁住的兩顆搏格，還有金探子
        {
          const p = new At(b, ox + 3.2, oy, oz - dd / 2 + 1.2, 0);
          p.box('iwood', 1.4, 0.45, 0.8, 0, 0, 0, LEATHER);
          p.box('iplain', 1.3, 0.02, 0.7, 0, 0.45, 0, col(0.45, 0.1, 0.08));
          p.sphere('iplain', 0.17, -0.4, 0.58, 0, col(0.6, 0.12, 0.08), 1, 10);
          for (const s of [0.05, 0.4]) {
            p.sphere('iplain', 0.12, s, 0.56, 0.05, BLACK, 1, 8);
            p.geo('iplain', new THREE.TorusGeometry(0.13, 0.015, 4, 10), s, 0.56, 0.05, STEEL, 0, Math.PI / 2);
          }
          p.sphere('iglow', 0.03, 0.4, 0.5, -0.25, col(2.5, 1.8, 0.4), 1, 6);
        }
        // 隊伍的合照與錦旗
        for (let i = 0; i < 3; i++) portrait(new At(b, ox - 3 + i * 3, oy + 2.6, oz + dd / 2 - 0.02, Math.PI), 1.0, 0.7);
        for (const s of [-1, 1]) {
          const p = new At(b, ox + s * 4.6, oy + 2.4, oz + dd / 2 - 0.03, Math.PI);
          p.box('iplain', 0.9, 1.4, 0.03, 0, 0, 0, house);
          p.box('iplain', 0.9, 0.12, 0.04, 0, 1.3, 0, trim);
        }
        torch(b, ox - w / 2, oy + 2.8, oz + 3.6, Math.PI / 2);
        torch(b, ox + w / 2, oy + 2.8, oz + 3.6, -Math.PI / 2);
        return b.build(id, M);
      },
    });
    link(d, end);
  };
  if (PITCH_DOORS.length >= 2) {
    team(0, 'teamGryffindor', '葛來分多更衣室', HOUSE.gryffindor, GOLD, PITCH_DOORS[0]);
    team(1, 'teamSlytherin', '史萊哲林更衣室', HOUSE.slytherin, col(0.6, 0.62, 0.65), PITCH_DOORS[1]);
  }
  void bookshelf;
  void roundTable;
  void IWARM;
  void MARBLE;
}
