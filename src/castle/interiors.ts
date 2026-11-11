import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, col, mat4 } from './kit';
import { PL } from '../world/heightfield';
import { U, makeRng } from '../core/globals';
import { getMaterials } from './materials';
import { registerScene, box3, type DoorEnd } from './scenes/registry';
import { DOORS, doorDecal } from './scenes/doors';
import { createCeilingSkyMaterial } from '../environment/sky';

const Y = PL;
/** 室內地板的高度（比台地高半公尺，和門前的石階齊平） */
export const FLOOR = Y + 0.5;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Side = 'N' | 'S' | 'E' | 'W';
export interface Opening {
  side: Side;
  at: number; // 沿牆方向的中心座標（N/S 牆是 x，E/W 牆是 z）
  w: number;
  h: number;
  /** 開口離地板的高度（二樓的門） */
  sill?: number;
}
export interface RoomOpts {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** 牆高（從地板算起） */
  h: number;
  t: number | Partial<Record<Side, number>>;
  found?: number;
  tint?: THREE.Color;
  itint?: THREE.Color;
  openings?: Opening[];
  /** 天花板高度；不給就不封頂 */
  ceil?: number;
  /** 地板高度（預設是城堡一樓） */
  y?: number;
  /** false：只砌室內那一層，不做外牆與地基（獨立的室內場景用） */
  shell?: boolean;
  ceilKey?: 'iwood' | 'istone';
}

export const WARM = col(1.08, 1.02, 0.93);
export const IWARM = col(1.12, 1.04, 0.92);
export const MARBLE = col(1.75, 1.7, 1.6);
export const GOLD = col(0.95, 0.66, 0.16);
export const IRON = col(0.03, 0.03, 0.035);
export const FIRE = col(7.5, 2.9, 0.7);
export const DARKWOOD = col(0.75, 0.7, 0.66);
/** 葛來分多、赫夫帕夫、雷文克勞、史萊哲林 */
export const HOUSE_TINTS = [col(0.5, 0.03, 0.035), col(0.85, 0.6, 0.06), col(0.04, 0.09, 0.42), col(0.03, 0.24, 0.09)];
const GEMS = [col(5, 0.25, 0.2), col(5, 3.6, 0.3), col(0.3, 0.8, 5), col(0.25, 4.2, 0.6)];

/** 砌一間中空的房間：外層是城堡石材，內層是室內石材，門洞是真的開口 */
export function room(b: Builder, o: RoomOpts) {
  const T = (s: Side) => (typeof o.t === 'number' ? o.t : (o.t[s] ?? 1.5));
  const LIN = 0.15;
  const y = o.y ?? FLOOR;
  const shell = o.shell !== false;
  const found = o.found ?? 14;
  const tint = o.tint ?? WARM;
  const itint = o.itint ?? IWARM;
  for (const s of ['N', 'S', 'E', 'W'] as Side[]) {
    const t = T(s);
    const alongX = s === 'N' || s === 'S';
    const a0 = alongX ? o.x0 - T('W') : o.z0;
    const a1 = alongX ? o.x1 + T('E') : o.z1;
    const ops = (o.openings || []).filter((p) => p.side === s).sort((p, q) => p.at - q.at);
    const sign = s === 'N' || s === 'W' ? -1 : 1;
    const inner = s === 'N' ? o.z0 : s === 'S' ? o.z1 : s === 'W' ? o.x0 : o.x1;
    const oc = inner + sign * (LIN + (t - LIN) / 2);
    const ic = inner + sign * (LIN / 2);
    const piece = (c0: number, c1: number, y0: number, y1: number) => {
      const len = c1 - c0;
      const hh = y1 - y0;
      if (len <= 0.01 || hh <= 0.01) return;
      const mid = (c0 + c1) / 2;
      if (alongX) {
        if (shell) b.box('stone', len, hh, t - LIN, mid, y0, oc, 0, tint);
        b.box('istone', len, hh, LIN, mid, y0, ic, 0, itint);
      } else {
        if (shell) b.box('stone', t - LIN, hh, len, oc, y0, mid, 0, tint);
        b.box('istone', LIN, hh, len, ic, y0, mid, 0, itint);
      }
    };
    let cur = a0;
    for (const p of ops) {
      const sill = p.sill ?? 0;
      piece(cur, p.at - p.w / 2, y - 0.5, y + o.h);
      piece(p.at - p.w / 2, p.at + p.w / 2, y + sill + p.h, y + o.h);
      // 門檻（二樓的門則是門下方的牆）
      if (sill > 0) piece(p.at - p.w / 2, p.at + p.w / 2, y - 0.5, y + sill);
      else if (alongX) b.box('istone', p.w, 0.5, t, p.at, y - 0.5, inner + (sign * t) / 2, 0, itint);
      else b.box('istone', t, 0.5, p.w, inner + (sign * t) / 2, y - 0.5, p.at, 0, itint);
      cur = p.at + p.w / 2;
    }
    piece(cur, a1, y - 0.5, y + o.h);
    if (!shell) continue;
    // 屋簷下的石線腳
    const len = a1 - a0 + 0.7;
    const ec = inner + sign * (t + 0.1);
    if (alongX) b.box('stone', len, 0.7, 0.55, (a0 + a1) / 2, y + o.h - 0.7, ec, 0, tint);
    else b.box('stone', 0.55, 0.7, len, ec, y + o.h - 0.7, (a0 + a1) / 2, 0, tint);
  }
  const ox0 = o.x0 - T('W');
  const ox1 = o.x1 + T('E');
  const oz0 = o.z0 - T('N');
  const oz1 = o.z1 + T('S');
  b.box('istone', ox1 - ox0 - 0.1, 0.5, oz1 - oz0 - 0.1, (ox0 + ox1) / 2, y - 0.5, (oz0 + oz1) / 2, 0, itint);
  if (shell) b.box('stone', ox1 - ox0, found, oz1 - oz0, (ox0 + ox1) / 2, y - 0.5 - found, (oz0 + oz1) / 2, 0, tint);
  if (o.ceil != null) b.box(o.ceilKey ?? 'iwood', o.x1 - o.x0, 0.3, o.z1 - o.z0, (o.x0 + o.x1) / 2, y + o.ceil, (o.z0 + o.z1) / 2, 0, DARKWOOD);
}

/** 從室內看出去的窗；(x,y,z) 是窗底中心，貼在牆的內面上 */
export function pane(b: Builder, w: number, h: number, x: number, y: number, z: number, ry: number) {
  b.add('iwin', new THREE.PlaneGeometry(w, h), mat4(x + Math.sin(ry) * 0.04, y + h / 2, z + Math.cos(ry) * 0.04, ry), col(h / w / 10, 0, 0));
}

/** 牆上的火把 */
export function torch(b: Builder, x: number, y: number, z: number, ry: number) {
  const nx = Math.sin(ry);
  const nz = Math.cos(ry);
  b.rod('iplain', V(x, y - 0.5, z), V(x + nx * 0.45, y, z + nz * 0.45), 0.035, IRON, 5);
  b.cyl('iplain', 0.11, 0.05, 0.22, x + nx * 0.45, y, z + nz * 0.45, 6, IRON);
  b.sphere('iglow', 0.16, x + nx * 0.45, y + 0.36, z + nz * 0.45, FIRE, 1.6, 6);
}

// ------------------------------------------------------------------ 大廳
export const GH = { x0: -139.5, x1: -70.5, z0: 100.5, z1: 123.5, door: -85 };
const GH_TABLE_Z = [0, 1, 2, 3].map((k) => GH.z0 + ((GH.z1 - GH.z0) * (k + 0.5)) / 4);

export function greatHallInterior(b: Builder) {
  const { x0, x1, z0, z1 } = GH;
  const F = FLOOR;
  const zc = (z0 + z1) / 2;
  room(b, { x0, x1, z0, z1, h: 29.5, t: 1.5, openings: [{ side: 'N', at: GH.door, w: 5, h: 8 }] });
  // 敞開的橡木門
  for (const s of [-1, 1]) b.box('iwood', 0.22, 8, 2.5, GH.door + s * 2.62, F, z0 + 1.25, 0, DARKWOOD);

  // 窗：南面整排朝湖；北面東段貼著入口大廳，沒有窗
  for (let i = 0; i < 8; i++) {
    const x = -133 + i * 8;
    pane(b, 4.3, 19.5, x, Y + 5.5, z1, Math.PI);
    if (x < -97) pane(b, 4.3, 19.5, x, Y + 5.5, z0, 0);
    if (i < 7) {
      torch(b, x + 4, F + 3.6, z1, Math.PI);
      if (x + 4 < -98) torch(b, x + 4, F + 3.6, z0, 0);
    }
  }
  pane(b, 10, 23, x0, Y + 5, zc, Math.PI / 2);

  // 教職員席的高台
  b.box('istone', 8.5, 0.35, z1 - z0, x0 + 4.25, F, zc, 0, IWARM);
  const dy = F + 0.35;
  b.box('iwood', 1.2, 0.1, 16, -135.2, dy + 0.8, zc, 0);
  for (let i = 0; i < 5; i++) for (const s of [-0.45, 0.45]) b.box('iwood', 0.12, 0.8, 0.12, -135.2 + s, dy, zc - 7.6 + i * 3.8);
  for (let i = 0; i < 11; i++) {
    const z = zc - 7 + i * 1.4;
    const head = i === 5;
    const tint = head ? GOLD : DARKWOOD;
    b.box(head ? 'iplain' : 'iwood', 0.6, 0.5, head ? 0.9 : 0.6, -136.7, dy, z, 0, tint);
    b.box(head ? 'iplain' : 'iwood', 0.12, head ? 2.3 : 1.5, head ? 0.9 : 0.6, -137.05, dy, z, 0, tint);
  }
  // 貓頭鷹講台
  b.cyl('iplain', 0.12, 0.3, 1.25, -130, F, zc, 8, GOLD);
  b.sphere('iplain', 0.24, -130, F + 1.5, zc, GOLD, 1.25, 8);
  for (const s of [-1, 1]) b.add('iplain', new THREE.BoxGeometry(0.06, 0.75, 0.5), mat4(-130.05, F + 1.45, zc + s * 0.42, 0, s * 0.5, 0), GOLD);

  // 四張學院長桌
  GH_TABLE_Z.forEach((z, k) => {
    const cx = -108.5;
    const len = 37;
    b.box('iwood', len, 0.1, 1.1, cx, F + 0.74, z);
    for (const s of [-1, 1]) b.box('iwood', len, 0.08, 0.38, cx, F + 0.4, z + s * 0.95);
    for (let i = 0; i <= 6; i++) {
      const x = cx - len / 2 + 0.4 + (i * (len - 0.8)) / 6;
      b.box('iwood', 0.16, 0.74, 0.9, x, F, z);
      for (const s of [-1, 1]) b.box('iwood', 0.12, 0.4, 0.3, x, F, z + s * 0.95);
    }
    for (let i = 0; i < 27; i++) {
      const x = cx - len / 2 + 1 + i * 1.35;
      for (const s of [-1, 1]) b.cyl('iplain', 0.15, 0.13, 0.025, x, F + 0.84, z + s * 0.3, 8, GOLD);
      if (i % 3 === 1) {
        b.cyl('iplain', 0.05, 0.07, 0.3, x + 0.6, F + 0.84, z, 6, GOLD);
        b.sphere('iglow', 0.045, x + 0.6, F + 1.2, z, FIRE, 1.7, 5);
      }
    }
    // 懸在桌子上方的學院旗
    for (const x of [-122, -108.5, -95]) {
      b.box('iplain', 2.6, 6.2, 0.05, x, F + 15, z, 0, HOUSE_TINTS[k]);
      b.box('iplain', 2.8, 0.18, 0.09, x, F + 21.2, z, 0, GOLD);
      b.box('iplain', 2.6, 0.5, 0.07, x, F + 15, z, 0, GOLD);
    }
  });

  // 北牆的大壁爐
  {
    const fx = -94.5;
    for (const s of [-1, 1]) b.box('istone', 0.9, 4.2, 1.0, fx + s * 2.9, F, z0 + 0.5, 0, MARBLE);
    b.box('istone', 7.2, 1.0, 1.2, fx, F + 4.2, z0 + 0.6, 0, MARBLE);
    b.box('istone', 5.6, 5, 0.8, fx, F + 5.2, z0 + 0.4, 0, IWARM);
    b.box('iplain', 4.9, 4.2, 0.1, fx, F, z0 + 0.08, 0, col(0.012, 0.01, 0.01));
    for (let i = 0; i < 7; i++) b.sphere('iglow', 0.32 + (i % 3) * 0.1, fx - 1.5 + i * 0.5, F + 0.4 + (i % 2) * 0.25, z0 + 0.5, FIRE, 1.9, 6);
    for (let i = 0; i < 4; i++) b.add('iwood', new THREE.CylinderGeometry(0.13, 0.13, 2.4, 6), mat4(fx - 0.9 + i * 0.6, F + 0.16, z0 + 0.55, 0.2 * i, 0, Math.PI / 2), col(0.4, 0.35, 0.3));
  }

  // 屋架：每一跨一組人字樑
  for (let i = 0; i < 8; i++) {
    const x = -129 + i * 8;
    const apex = V(x, F + 46.5, zc);
    for (const s of [-1, 1]) {
      const foot = V(x, F + 28, zc + s * 11.2);
      b.beam('iwood', foot, apex, 0.5, DARKWOOD, 0.6);
      const mid = new THREE.Vector3().lerpVectors(foot, apex, 0.42);
      b.beam('iwood', V(x, F + 21.5, zc + s * 11.3), mid, 0.4, DARKWOOD, 0.45);
      b.box('istone', 0.9, 0.8, 0.7, x, F + 20.8, zc + s * 11.15, 0, IWARM);
    }
    const yT = F + 38;
    const hw = (11.2 * (46.5 - 38)) / (46.5 - 28);
    b.beam('iwood', V(x, yT, zc - hw), V(x, yT, zc + hw), 0.42, DARKWOOD, 0.5);
    b.beam('iwood', V(x, yT, zc), apex, 0.3, DARKWOOD);
  }
}

// ------------------------------------------------------------------ 入口大廳
export const EH = { x0: -93.5, x1: -66.5, z0: 59.5, z1: 95.8 };

export function entranceInterior(b: Builder) {
  const { x0, x1, z0, z1 } = EH;
  const F = FLOOR;
  room(b, {
    x0, x1, z0, z1,
    h: 33.5,
    t: { N: 1.5, S: 3.4, E: 1.5, W: 1.5 },
    ceil: 17,
    openings: [
      { side: 'W', at: 78, w: 6, h: 9 },
      { side: 'S', at: GH.door, w: 5, h: 8 },
      { side: 'E', at: 66, w: 3, h: 3.2 },
      { side: 'E', at: 78, w: 4, h: 6.2, sill: 4 },
    ],
  });
  // 正門的兩扇橡木門，朝內敞開
  for (const s of [-1, 1]) b.box('iwood', 3, 9, 0.25, x0 + 1.5, F, 78 + s * 3.15, 0, DARKWOOD);
  // 東側小門外的台階
  b.box('stone', 2.2, 0.25, 4.5, -63.9, Y, 66, 0, WARM);
  b.box('iwood', 1.5, 3.2, 0.14, x1 - 0.75, F, 64.42, 0, DARKWOOD);

  // 大理石階梯：正對大門，通往二樓平台
  const sx0 = -82;
  const run = 0.55;
  const steps = 16;
  for (let i = 0; i < steps; i++) b.box('istone', run + 0.02, 0.25 * (i + 1), 10, sx0 + run * (i + 0.5), F, 78, 0, MARBLE);
  const lx = sx0 + run * steps; // 平台西緣
  b.box('istone', x1 - lx, 0.4, 32, (lx + x1) / 2, F + 3.6, 78, 0, MARBLE);
  // 平台下的柱子
  for (const z of [63, 70.5, 85.5, 93]) b.cyl('istone', 0.42, 0.5, 3.6, lx + 0.6, F, z, 10, MARBLE);
  // 欄杆
  for (const s of [-1, 1]) {
    b.box('istone', 0.28, 1.05, 11, lx + 0.14, F + 4, 78 + s * 10.5, 0, MARBLE);
    b.beam('istone', V(sx0, F + 1.0, 78 + s * 5.1), V(lx, F + 5.0, 78 + s * 5.1), 0.28, MARBLE, 0.3);
    b.box('istone', 0.5, 1.5, 0.5, sx0 - 0.1, F, 78 + s * 5.1, 0, MARBLE);
    b.sphere('istone', 0.34, sx0 - 0.1, F + 1.8, 78 + s * 5.1, MARBLE);
    b.box('istone', 0.5, 1.4, 0.5, lx + 0.14, F + 4, 78 + s * 5.1, 0, MARBLE);
  }
  // 窗
  pane(b, 5, 6.5, x0, F + 10, 78, Math.PI / 2);
  for (const z of [65, 91]) pane(b, 2.6, 7.5, x1, F + 7.5, z, -Math.PI / 2);
  for (const x of [-87, -73]) pane(b, 2.6, 7.5, x, F + 7.5, z0, 0);
  // 火把
  for (const z of [64, 71, 85, 92]) torch(b, x0, F + 4.2, z, Math.PI / 2);
  for (const x of [-90, -80]) torch(b, x, F + 4.2, z1, Math.PI);
  // 通往地窖的門
  doorDecal(b, DOORS.dungeon);
  for (const x of [-91, -69]) torch(b, x, F + 4.2, z0, 0);
  for (const z of [72, 84]) torch(b, x1, F + 8.4, z, -Math.PI / 2);

  // 記錄學院分數的四座寶石沙漏
  [-84.5, -81.5, -78.5, -75.5].forEach((x, k) => {
    const z = z0 + 0.75;
    b.box('iwood', 1.5, 4.6, 0.3, x, F, z0 + 0.15, 0, DARKWOOD);
    for (const yy of [0.25, 2.2, 4.15]) b.cyl('iplain', 0.55, 0.55, 0.14, x, F + yy, z, 12, GOLD);
    for (const s of [-1, 1]) b.cyl('iplain', 0.035, 0.035, 4.1, x + s * 0.5, F + 0.25, z, 5, GOLD);
    const fill = [0.75, 0.5, 0.62, 0.68][k];
    // 下半：已經落下的寶石
    b.cyl('iglow', 0.4, 0.4, 1.7 * fill, x, F + 0.4, z, 10, GEMS[k].clone().multiplyScalar(0.45));
    b.cyl('iglow', 0.06, 0.38, 1.4 * (1 - fill) + 0.2, x, F + 2.35, z, 10, GEMS[k].clone().multiplyScalar(0.3));
    b.box('iplain', 0.9, 0.5, 0.05, x, F + 4.9, z0 + 0.1, 0, HOUSE_TINTS[k]);
  });
}

// ------------------------------------------------------------------ 大樓梯塔
export const GS = { x0: -57.5, x1: -26.5, z0: 54.5, z1: 85.5, top: 36, ceil: 46 };

/** 一段樓梯：從 a 走到 b（軸向），每階是一塊懸空的石板，靠天井的一側有欄杆 */
export function flight(b: Builder, a: THREE.Vector3, c: THREE.Vector3, width: number, inner: THREE.Vector3 | null, both = false) {
  const dx = c.x - a.x;
  const dz = c.z - a.z;
  const len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.round((c.y - a.y) / 0.25));
  const run = len / n;
  const ux = dx / len;
  const uz = dz / len;
  const alongX = Math.abs(ux) > 0.5;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * run;
    b.box('istone', alongX ? run + 0.03 : width, 0.42, alongX ? width : run + 0.03, a.x + ux * t, a.y + 0.25 * (i + 1) - 0.42, a.z + uz * t, 0, MARBLE);
  }
  const sides: THREE.Vector3[] = [];
  if (inner) sides.push(inner);
  if (both && inner) sides.push(inner.clone().multiplyScalar(-1));
  for (const s of sides) {
    const off = s.clone().multiplyScalar(width / 2 - 0.14);
    for (const hgt of [1.1, 0.55]) b.beam('istone', a.clone().add(off).setY(a.y + hgt + 0.1), c.clone().add(off).setY(c.y + hgt + 0.1), hgt > 1 ? 0.2 : 0.1, MARBLE, hgt > 1 ? 0.26 : 0.1);
    b.beam('istone', a.clone().add(off).setY(a.y - 0.25), c.clone().add(off).setY(c.y - 0.25), 0.5, MARBLE, 0.22);
  }
}

/** 大樓梯第 i 個轉角平台上的門（0 起算，每層高六公尺） */
export function landingDoor(i: number): DoorEnd {
  const L = 5;
  const c = [
    [GS.x1, GS.z1 - L / 2, -1],
    [GS.x1, GS.z0 + L / 2, -1],
    [GS.x0, GS.z0 + L / 2, 1],
    [GS.x0, GS.z1 - L / 2, 1],
  ][i % 4];
  return { pos: [c[0], FLOOR + 6 * (i + 1), c[1]], face: (c[2] * Math.PI) / 2, name: `大樓梯 ${i + 2} 樓` };
}

export function staircaseInterior(b: Builder) {
  const { x0, x1, z0, z1 } = GS;
  const F = FLOOR;
  room(b, {
    x0, x1, z0, z1,
    h: 81.5,
    t: 1.5,
    found: 16,
    tint: col(1, 1, 1),
    ceil: GS.ceil,
    openings: [
      { side: 'W', at: 66, w: 3, h: 3.2 },
      { side: 'W', at: 78, w: 4, h: 6.2, sill: 4 },
      { side: 'N', at: -48, w: 3.6, h: 5 },
    ],
  });
  b.box('stone', 2.2, 0.25, 4.5, x0 - 2.6, Y, 66, 0, WARM);

  // 連接入口大廳二樓平台的廊橋
  {
    const bx0 = EH.x1 + 1.4;
    const bx1 = x0 - 1.4;
    const cx = (bx0 + bx1) / 2;
    const len = bx1 - bx0 + 0.2;
    b.box('istone', len, 0.4, 4.6, cx, F + 3.6, 78, 0, MARBLE);
    b.box('stone', len, 0.5, 5.4, cx, F + 3.1, 78, 0, WARM);
    for (const s of [-1, 1]) {
      b.box('stone', len, 7.2, 0.5, cx, F + 3.6, 78 + s * 2.45, 0, WARM);
      b.window(1.1, 2.6, cx, F + 5.6, 78 + s * 2.7, s === 1 ? 0 : Math.PI, 0, 0.06);
      pane(b, 1.1, 2.6, cx, F + 5.6, 78 + s * 2.2, s === 1 ? Math.PI : 0);
    }
    b.box('stone', len, 0.5, 5.6, cx, F + 10.4, 78, 0, WARM);
    b.gable('roof', null, len, 5.6, 2.2, cx, F + 10.9, 78, 0, 0.3);
  }

  // 二樓入口的平台，和通往地面的中央階梯
  const bx = x0 + 5.5;
  b.box('istone', 5.5, 0.4, 8, x0 + 2.75, F + 3.6, 78, 0, MARBLE);
  for (const z of [74.5, 80.8]) b.cyl('istone', 0.4, 0.48, 3.6, bx - 0.5, F, z, 10, MARBLE);
  for (const s of [-1, 1]) {
    b.box('istone', 5.5, 1.1, 0.26, x0 + 2.75, F + 4, 78 + s * 3.87, 0, MARBLE);
    b.box('istone', 0.26, 1.1, 1, bx - 0.13, F + 4, 78 + s * 3.5, 0, MARBLE);
  }
  flight(b, V(bx + 8.8, F, 78), V(bx, F + 4, 78), 6, V(0, 0, 1), true);

  // 沿著四面牆盤旋而上的樓梯：每段升高六公尺，轉角是平台
  const W = 4;
  const L = 5;
  const c = { x0: x0 + L, x1: x1 - L, z0: z0 + L, z1: z1 - L };
  const legs: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
    [V(c.x0, 0, z1 - W / 2), V(c.x1, 0, z1 - W / 2), V(0, 0, -1)], // 南牆，往東
    [V(x1 - W / 2, 0, c.z1), V(x1 - W / 2, 0, c.z0), V(-1, 0, 0)], // 東牆，往北
    [V(c.x1, 0, z0 + W / 2), V(c.x0, 0, z0 + W / 2), V(0, 0, 1)], // 北牆，往西
    [V(x0 + W / 2, 0, c.z0), V(x0 + W / 2, 0, c.z1), V(1, 0, 0)], // 西牆，往南
  ];
  const corners: [number, number, number, number][] = [
    [x1 - L / 2, z1 - L / 2, -1, -1], // 東南
    [x1 - L / 2, z0 + L / 2, -1, 1], // 東北
    [x0 + L / 2, z0 + L / 2, 1, 1], // 西北
    [x0 + L / 2, z1 - L / 2, 1, -1], // 西南
  ];
  const flights = GS.top / 6;
  for (let i = 0; i < flights; i++) {
    const [a, e, inner] = legs[i % 4];
    const y0 = F + i * 6;
    flight(b, a.clone().setY(y0), e.clone().setY(y0 + 6), W, inner);
    // 轉角平台與內角的欄杆柱
    const [cx, cz, sx, sz] = corners[i % 4];
    b.box('istone', L, 0.42, L, cx, y0 + 6 - 0.42, cz, 0, MARBLE);
    b.box('istone', 1, 1.25, 1, cx + sx * (L / 2 - 0.5), y0 + 6, cz + sz * (L / 2 - 0.5), 0, MARBLE);
    b.sphere('istone', 0.42, cx + sx * (L / 2 - 0.5), y0 + 7.6, cz + sz * (L / 2 - 0.5), MARBLE);
    // 平台上的門：通往城堡各處
    const d = landingDoor(i);
    b.window(2.2, 3.4, d.pos[0], d.pos[1], d.pos[2], d.face, 4, 0.06);
    // 每段樓梯中途的火把
    const mid = new THREE.Vector3().lerpVectors(a, e, 0.5).addScaledVector(inner, -W / 2);
    torch(b, mid.x, y0 + 6.2, mid.z, Math.atan2(inner.x, inner.z));
  }
  // 頂層：沿北牆的長廊，盡頭是通往八樓的門
  {
    const y = F + GS.top;
    b.box('istone', c.x1 - c.x0, 0.42, W, (c.x0 + c.x1) / 2, y - 0.42, z0 + W / 2, 0, MARBLE);
    b.box('istone', c.x1 - c.x0, 1.1, 0.26, (c.x0 + c.x1) / 2, y, z0 + W - 0.13, 0, MARBLE);
    b.box('istone', L, 0.42, L, x0 + L / 2, y - 0.42, z0 + L / 2, 0, MARBLE);
    b.box('istone', L, 1.1, 0.26, x0 + L / 2, y, z0 + L - 0.13, 0, MARBLE);
    b.box('istone', 0.26, 1.1, L - W, x0 + L - 0.13, y, z0 + W + (L - W) / 2, 0, MARBLE);
    b.window(3, 5, x0, y, z0 + 2.5, Math.PI / 2, 4, 0.06);
  }

  // 高窗
  for (const yy of [8, 22, 34]) for (const x of [-49, -42, -35]) pane(b, 1.8, 5.5, x, F + yy, z1, Math.PI);

  // 掛滿四面牆的畫像
  const rng = makeRng(4242);
  const walls: [number, number, number, number, number][] = [
    [x0, 0, 1, 0, Math.PI / 2], // 西
    [x1, 0, -1, 0, -Math.PI / 2], // 東
    [0, z0, 0, 1, 0], // 北
    [0, z1, 0, -1, Math.PI], // 南
  ];
  for (let i = 0; i < 190; i++) {
    const wI = Math.floor(rng() * 4);
    const [wx, wz, nx, nz] = walls[wI];
    const along = -14 + rng() * 28;
    const yy = F + 2.2 + rng() * 40;
    const w = 0.9 + rng() * 1.5;
    const h = w * (1.1 + rng() * 0.5);
    const px = nx !== 0 ? wx : -42 + along;
    const pz = nx !== 0 ? 70 + along : wz;
    // 避開門洞與高窗
    if (wI === 0 && yy < F + 11.5 && Math.abs(pz - 72) < 10) continue;
    if (wI < 2 && (Math.abs(pz - 83) < 2.4 || Math.abs(pz - 57) < 2.4)) continue;
    if (wI === 2 && yy < F + 6.5 && Math.abs(px + 48) < 3.2) continue;
    if (wI === 3 && Math.abs(px + 42) < 9.5 && [8, 22, 34].some((q) => yy + h > F + q - 0.5 && yy < F + q + 6)) continue;
    const hue = rng();
    const canvas = new THREE.Color().setHSL(hue, 0.35, 0.05 + rng() * 0.06);
    const figure = new THREE.Color().setHSL((hue + 0.08 + rng() * 0.2) % 1, 0.3, 0.16 + rng() * 0.12);
    const sx = nx !== 0 ? 0.07 : w;
    const sz = nx !== 0 ? w : 0.07;
    b.box('iplain', sx + (nx !== 0 ? 0 : 0.22), h + 0.22, sz + (nx !== 0 ? 0.22 : 0), px + nx * 0.04, yy - 0.11, pz + nz * 0.04, 0, GOLD);
    b.box('iplain', sx, h, sz, px + nx * 0.07, yy, pz + nz * 0.07, 0, canvas);
    b.box('iplain', nx !== 0 ? 0.07 : w * 0.42, h * 0.5, nx !== 0 ? w * 0.42 : 0.07, px + nx * 0.09, yy + h * 0.12, pz + nz * 0.09, 0, figure);
    b.sphere('iplain', w * 0.15, px + nx * 0.08, yy + h * 0.74, pz + nz * 0.08, col(0.42, 0.3, 0.22), 1.15, 6);
  }

  // 天井中央的吊燈
  {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const y = F + 39;
    b.cyl('iplain', 0.05, 0.05, GS.ceil - 39, cx, y, cz, 5, IRON);
    for (const [r, n, dy] of [[3.2, 16, 0], [1.9, 10, 1.3]] as const) {
      const ring = new THREE.TorusGeometry(r, 0.07, 6, 28);
      ring.rotateX(Math.PI / 2);
      b.add('iplain', ring, mat4(cx, y + dy, cz), GOLD);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        b.cyl('iplain', 0.05, 0.05, 0.3, cx + Math.cos(a) * r, y + dy, cz + Math.sin(a) * r, 5, col(0.6, 0.55, 0.42));
        b.sphere('iglow', 0.07, cx + Math.cos(a) * r, y + dy + 0.42, cz + Math.sin(a) * r, FIRE, 1.8, 5);
      }
    }
  }
}

// ------------------------------------------------------------------ 需要獨立材質或會動的東西
export interface InteriorExtras {
  group: THREE.Group;
  update(time: number): void;
}

export function buildInteriorExtras(): InteriorExtras {
  const group = new THREE.Group();
  group.name = 'interiors';
  const F = FLOOR;
  const { x0, x1, z0, z1 } = GH;
  const zc = (z0 + z1) / 2;

  // 施了魔法的天花板
  {
    const yb = F + 29.45;
    const ya = F + 49.6;
    const P = [
      [x0, yb, z0], [x1, yb, z0], [x1, ya, zc], [x0, ya, zc], [x0, yb, z1], [x1, yb, z1],
    ];
    const idx = [0, 1, 2, 0, 2, 3, 5, 4, 3, 5, 3, 2, 0, 3, 4, 1, 5, 2];
    const pos: number[] = [];
    for (const i of idx) pos.push(P[i][0], P[i][1], P[i][2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(g, createCeilingSkyMaterial());
    m.name = 'enchantedCeiling';
    group.add(m);
  }

  // 漂浮的蠟燭
  {
    const body = new THREE.CylinderGeometry(0.028, 0.03, 0.3, 6).toNonIndexed();
    const flame = new THREE.SphereGeometry(0.036, 6, 5).toNonIndexed();
    flame.scale(1, 2.1, 1);
    flame.translate(0, 0.22, 0);
    const paint = (g: THREE.BufferGeometry, r: number, gg: number, bl: number) => {
      const n = g.attributes.position.count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.set([r, gg, bl], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    };
    paint(body, 0.55, 0.5, 0.38);
    paint(flame, 9, 4.2, 1.1);
    const geo = mergeGeometries([body, flame], false)!;
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = U.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
           transformed.y += sin(uTime * 0.7 + instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3) * 0.14;
           #endif`,
        );
    };
    mat.customProgramCacheKey = () => 'candle';
    const count = 460;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const rng = makeRng(777);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m4.makeTranslation(-129 + rng() * 55, F + 6.5 + rng() * 6.5, z0 + 1.6 + rng() * (z1 - z0 - 3.2));
      inst.setMatrixAt(i, m4);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.name = 'candles';
    group.add(inst);
  }

  // 會自己轉向的樓梯：懸在天井高處，慢慢地從一邊擺到另一邊
  const movers: { g: THREE.Group; base: number; phase: number }[] = [];
  {
    const M = getMaterials();
    const make = (px: number, py: number, pz: number, base: number, phase: number, len: number, rise: number) => {
      const sb = new Builder(900 + movers.length);
      flight(sb, V(0, 0, 0), V(len, rise, 0), 3, V(0, 0, 1), true);
      sb.box('istone', 2.4, 0.42, 3, -1.2, -0.42, 0, 0, MARBLE);
      const g = sb.build('movingStair', M);
      g.position.set(px, py, pz);
      group.add(g);
      movers.push({ g, base, phase });
    };
    make(GS.x0 + 6.4, F + 18, GS.z0 + 6.4, -0.78, 0, 17, 5);
    make(GS.x1 - 6.4, F + 12, GS.z0 + 6.4, Math.PI + 0.78, 2.1, 16, 4.5);
    make(GS.x1 - 6.4, F + 30, GS.z1 - 6.4, Math.PI - 0.78, 4.0, 17, 5);
  }
  const update = (time: number) => {
    for (const m of movers) {
      // 擺動一下、停一下
      const s = Math.sin(time * 0.16 + m.phase);
      const eased = Math.sign(s) * Math.min(1, Math.abs(s) * 1.6);
      m.g.rotation.y = m.base + eased * eased * Math.sign(s) * 0.42;
    }
  };

  // 登記成場景：室內判定、燈光、「前往」清單
  registerScene({
    id: 'greatHall',
    name: '大廳',
    intro: '四張學院長桌、漂浮的蠟燭，還有映出真實天空的魔法天花板。',
    box: box3(x0, F - 1, z0, x1, F + 51, z1),
    lights: [
      { pos: [-124, F + 8, zc], intensity: 190, dist: 30 },
      { pos: [-98, F + 8, zc], intensity: 190, dist: 30 },
    ],
    spawn: [-84, F, 108, -Math.PI / 2],
    zone: 'core',
  });
  registerScene({
    id: 'entrance',
    name: '入口大廳',
    intro: '橡木大門後的挑高大廳，大理石階梯通往樓上，牆邊是四座學院沙漏。',
    box: box3(EH.x0, F - 1, EH.z0, EH.x1, F + 17.5, EH.z1 + 4.8),
    lights: [{ pos: [-86, F + 8, 78], intensity: 170, dist: 30 }],
    spawn: [-89, F, 78, Math.PI / 2],
    zone: 'core',
  });
  registerScene({
    id: 'staircase',
    name: '大樓梯',
    intro: '掛滿畫像的天井，樓梯會自己轉向；各層平台的門通往城堡各處。',
    box: box3(GS.x0, F - 1, GS.z0, GS.x1, F + GS.ceil, GS.z1),
    lights: [{ pos: [(GS.x0 + GS.x1) / 2, F + 40, (GS.z0 + GS.z1) / 2], intensity: 950, dist: 75 }],
    spawn: [-44, F, 64, 0],
    zone: 'core',
  });
  registerScene({ id: 'bridge', name: '', intro: '', box: box3(EH.x1, F + 3, 75.5, GS.x0, F + 11, 80.5), lights: [], spawn: [-62, F + 4, 78, 0], zone: 'core' });
  return { group, update };
}
