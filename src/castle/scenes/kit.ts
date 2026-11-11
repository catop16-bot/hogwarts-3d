import * as THREE from 'three';
import { Builder, col, mat4, type MatKey } from '../kit';
import { GOLD, IRON, FIRE, DARKWOOD, MARBLE, IWARM } from '../interiors';

/**
 * 以某個位置與朝向為原點擺放零件。局部座標：+X 向右、+Z 向前（家具的正面）。
 */
export class At {
  private c: number;
  private s: number;
  constructor(
    readonly b: Builder,
    readonly x: number,
    readonly y: number,
    readonly z: number,
    readonly ry = 0,
  ) {
    this.c = Math.cos(ry);
    this.s = Math.sin(ry);
  }
  w(lx: number, lz: number): [number, number] {
    return [this.x + lx * this.c + lz * this.s, this.z - lx * this.s + lz * this.c];
  }
  at(lx: number, ly: number, lz: number, ry = 0) {
    const [wx, wz] = this.w(lx, lz);
    return new At(this.b, wx, this.y + ly, wz, this.ry + ry);
  }
  /** 方塊：(lx, lz) 是中心，ly 是底面 */
  box(key: MatKey, w: number, h: number, d: number, lx = 0, ly = 0, lz = 0, tint?: THREE.Color, ry = 0) {
    const [wx, wz] = this.w(lx, lz);
    this.b.box(key, w, h, d, wx, this.y + ly, wz, this.ry + ry, tint);
    return this;
  }
  cyl(key: MatKey, rt: number, rb: number, h: number, lx = 0, ly = 0, lz = 0, seg = 10, tint?: THREE.Color) {
    const [wx, wz] = this.w(lx, lz);
    this.b.cyl(key, rt, rb, h, wx, this.y + ly, wz, seg, tint, this.ry);
    return this;
  }
  sphere(key: MatKey, r: number, lx = 0, ly = 0, lz = 0, tint?: THREE.Color, sy = 1, seg = 8) {
    const [wx, wz] = this.w(lx, lz);
    this.b.sphere(key, r, wx, this.y + ly, wz, tint, sy, seg);
    return this;
  }
  geo(key: MatKey, g: THREE.BufferGeometry, lx = 0, ly = 0, lz = 0, tint?: THREE.Color, ry = 0, rx = 0, rz = 0) {
    const [wx, wz] = this.w(lx, lz);
    this.b.add(key, g, mat4(wx, this.y + ly, wz, this.ry + ry, rx, rz), tint);
    return this;
  }
}

export const STEEL = col(0.45, 0.47, 0.5);
export const WHITE = col(0.85, 0.84, 0.8);
export const BLACK = col(0.015, 0.014, 0.014);
export const GREENLAMP = col(0.6, 4.5, 1.6);
const BOOKS = [col(0.3, 0.05, 0.04), col(0.05, 0.16, 0.08), col(0.06, 0.08, 0.25), col(0.28, 0.17, 0.06), col(0.12, 0.1, 0.09), col(0.33, 0.27, 0.16), col(0.2, 0.05, 0.16)];

/** 圓形房間（塔樓）：朝內的圓筒牆、地板與錐形天花板 */
export function roundRoom(b: Builder, x: number, y: number, z: number, r: number, h: number, tint: THREE.Color = IWARM, roofH = r * 0.7, seg = 40, roof = true) {
  const pos: number[] = [];
  const quad = (p: number[][]) => {
    // 讓法線朝向圓心
    for (const i of [0, 1, 2, 0, 2, 3]) pos.push(p[i][0], p[i][1], p[i][2]);
  };
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const p0 = [Math.sin(a0) * r, 0, Math.cos(a0) * r];
    const p1 = [Math.sin(a1) * r, 0, Math.cos(a1) * r];
    quad([p1, p0, [p0[0], h, p0[2]], [p1[0], h, p1[2]]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add('istone', g, mat4(x, y, z), tint);
  b.cyl('istone', r + 0.4, r + 0.4, 0.5, x, y - 0.5, z, seg, tint);
  if (!roof) return;
  // 天花板：朝下的錐面
  const cp: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    cp.push(Math.sin(a1) * r, h, Math.cos(a1) * r, Math.sin(a0) * r, h, Math.cos(a0) * r, 0, h + roofH, 0);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cg.computeVertexNormals();
  b.add('iwood', cg, mat4(x, y, z), DARKWOOD);
  // 屋架
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.beam('iwood', new THREE.Vector3(x + Math.sin(a) * (r - 0.1), y + h - 0.2, z + Math.cos(a) * (r - 0.1)), new THREE.Vector3(x, y + h + roofH - 0.25, z), 0.22, DARKWOOD, 0.3);
  }
}

/** 一扇關著的門（裝在牆的內面）；p 的原點在門底中心，+Z 朝房間內 */
export function door(p: At, w = 1.8, h = 3.1, tint: THREE.Color = DARKWOOD) {
  p.box('iwood', w, h, 0.12, 0, 0, 0.07, tint);
  for (const s of [-1, 1]) p.box('istone', 0.3, h + 0.3, 0.3, s * (w / 2 + 0.15), 0, 0.1, MARBLE);
  p.box('istone', w + 0.9, 0.35, 0.34, 0, h, 0.1, MARBLE);
  for (const yy of [0.5, h - 0.6]) p.box('iplain', w * 0.92, 0.09, 0.03, 0, yy, 0.14, IRON);
  p.sphere('iplain', 0.06, w * 0.34, h * 0.42, 0.18, GOLD);
}

/** 書架：w 寬、h 高，正面朝 +Z；double 為背靠背的雙面書架 */
export function bookshelf(p: At, w: number, h = 3.3, double = false, wood: THREE.Color = DARKWOOD) {
  const d = double ? 0.9 : 0.5;
  const rng = p.b.rng;
  p.box('iwood', w, h, double ? 0.08 : 0.06, 0, 0, double ? 0 : -d / 2 + 0.03, wood);
  for (const s of [-1, 1]) p.box('iwood', 0.08, h, d, s * (w / 2 - 0.04), 0, 0, wood);
  p.box('iwood', w + 0.16, 0.12, d + 0.12, 0, h, 0, wood);
  p.box('iwood', w, 0.14, d, 0, 0, 0, wood);
  const rows = Math.max(2, Math.floor((h - 0.2) / 0.52));
  const rowH = (h - 0.14) / rows;
  for (let r = 0; r < rows; r++) {
    const y = 0.14 + r * rowH;
    if (r > 0) p.box('iwood', w - 0.12, 0.05, d - 0.04, 0, y - 0.05, 0, wood);
    for (const side of double ? [-1, 1] : [1]) {
      let x = -w / 2 + 0.1;
      while (x < w / 2 - 0.25) {
        const bw = 0.22 + rng() * 0.38;
        const ww = Math.min(bw, w / 2 - 0.1 - x);
        if (rng() > 0.08) {
          const bh = rowH * (0.55 + rng() * 0.32);
          const bd = 0.2 + rng() * 0.08;
          const z = double ? side * (d / 2 - bd / 2 - 0.03) : d / 2 - bd / 2 - 0.05;
          p.box('iplain', ww - 0.015, bh, bd, x + ww / 2, y, z, BOOKS[Math.floor(rng() * BOOKS.length)]);
        }
        x += bw;
      }
    }
  }
}

export function table(p: At, w: number, d: number, h = 0.76, tint?: THREE.Color) {
  p.box('iwood', w, 0.08, d, 0, h - 0.08, 0, tint);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('iwood', 0.1, h - 0.08, 0.1, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12), tint);
  p.box('iwood', w - 0.3, 0.1, 0.06, 0, h - 0.22, 0, tint);
}

/** 椅子：正面朝 +Z */
export function chair(p: At, tint?: THREE.Color) {
  p.box('iwood', 0.44, 0.06, 0.44, 0, 0.44, 0, tint);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('iwood', 0.05, 0.44, 0.05, sx * 0.18, 0, sz * 0.18, tint);
  p.box('iwood', 0.44, 0.55, 0.05, 0, 0.5, -0.2, tint);
}

/** 扶手椅 */
export function armchair(p: At, tint: THREE.Color) {
  p.box('iplain', 0.95, 0.42, 0.9, 0, 0.08, 0, tint);
  p.box('iplain', 0.95, 0.75, 0.24, 0, 0.42, -0.36, tint);
  for (const s of [-1, 1]) p.box('iplain', 0.22, 0.32, 0.9, s * 0.42, 0.42, 0, tint);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('iwood', 0.08, 0.1, 0.08, sx * 0.38, 0, sz * 0.36, DARKWOOD);
}

export function sofa(p: At, w: number, tint: THREE.Color) {
  p.box('iplain', w, 0.42, 0.95, 0, 0.08, 0, tint);
  p.box('iplain', w, 0.7, 0.24, 0, 0.42, -0.38, tint);
  for (const s of [-1, 1]) p.box('iplain', 0.24, 0.34, 0.95, s * (w / 2 - 0.12), 0.42, 0, tint);
}

/** 壁爐：背靠牆（牆在 -Z），w 是爐口寬 */
export function fireplace(p: At, w = 3, stone: THREE.Color = MARBLE, lit = true) {
  for (const s of [-1, 1]) p.box('istone', 0.6, 2.4, 0.8, s * (w / 2 + 0.3), 0, 0.4, stone);
  p.box('istone', w + 1.8, 0.5, 1.0, 0, 2.4, 0.45, stone);
  p.box('istone', w + 0.6, 2.6, 0.6, 0, 2.9, 0.3, IWARM);
  p.box('iplain', w, 2.4, 0.08, 0, 0, 0.05, BLACK);
  p.box('istone', w + 1.4, 0.12, 1.3, 0, 0, 0.65, stone);
  if (lit) {
    const n = Math.max(3, Math.round(w * 1.6));
    for (let i = 0; i < n; i++) p.sphere('iglow', 0.2 + (i % 3) * 0.07, -w / 2 + 0.4 + (i * (w - 0.8)) / (n - 1), 0.3 + (i % 2) * 0.16, 0.42, FIRE, 1.9, 6);
    for (let i = 0; i < 3; i++) p.geo('iwood', new THREE.CylinderGeometry(0.09, 0.09, w * 0.7, 6), 0, 0.14, 0.36 + i * 0.12, col(0.4, 0.35, 0.3), 0.12 * (i - 1), 0, Math.PI / 2);
  }
}

/** 吊燈：一圈燭火，從天花板垂下 */
export function chandelier(b: Builder, x: number, y: number, z: number, r: number, n: number, chain: number) {
  b.cyl('iplain', 0.035, 0.035, chain, x, y, z, 5, IRON);
  const ring = new THREE.TorusGeometry(r, 0.05, 6, 24);
  ring.rotateX(Math.PI / 2);
  b.add('iplain', ring, mat4(x, y, z), IRON);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    b.cyl('iplain', 0.04, 0.04, 0.22, x + Math.cos(a) * r, y, z + Math.sin(a) * r, 5, col(0.6, 0.55, 0.42));
    b.sphere('iglow', 0.06, x + Math.cos(a) * r, y + 0.32, z + Math.sin(a) * r, FIRE, 1.8, 5);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    b.rod('iplain', new THREE.Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r), new THREE.Vector3(x, y + Math.min(chain, r * 0.9), z), 0.015, IRON, 4);
  }
}

/** 掛在牆上的畫像：正面朝 +Z，p 在畫框底邊中心（貼著牆面） */
export function portrait(p: At, w: number, h: number) {
  const rng = p.b.rng;
  const hue = rng();
  const canvas = new THREE.Color().setHSL(hue, 0.35, 0.05 + rng() * 0.06);
  const figure = new THREE.Color().setHSL((hue + 0.08 + rng() * 0.2) % 1, 0.3, 0.16 + rng() * 0.12);
  p.box('iplain', w + 0.2, h + 0.2, 0.07, 0, -0.1, 0.04, GOLD);
  p.box('iplain', w, h, 0.07, 0, 0, 0.07, canvas);
  p.box('iplain', w * 0.42, h * 0.5, 0.07, 0, h * 0.12, 0.09, figure);
  p.sphere('iplain', w * 0.15, 0, h * 0.74, 0.08, col(0.42, 0.3, 0.22), 1.15, 6);
}

/** 盔甲 */
export function armour(p: At) {
  p.box('istone', 0.8, 0.25, 0.8, 0, 0, 0, MARBLE);
  for (const s of [-1, 1]) p.cyl('iplain', 0.09, 0.08, 0.85, s * 0.13, 0.25, 0, 8, STEEL);
  p.cyl('iplain', 0.24, 0.18, 0.62, 0, 1.1, 0, 10, STEEL);
  p.sphere('iplain', 0.15, 0, 1.92, 0, STEEL, 1.15);
  p.cyl('iplain', 0.02, 0.1, 0.2, 0, 2.05, 0, 6, col(0.5, 0.05, 0.05));
  for (const s of [-1, 1]) {
    p.sphere('iplain', 0.11, s * 0.3, 1.66, 0, STEEL);
    p.cyl('iplain', 0.065, 0.06, 0.6, s * 0.33, 1.05, 0, 8, STEEL);
  }
  p.cyl('iplain', 0.02, 0.02, 2.5, 0.42, 0.25, 0.12, 5, col(0.25, 0.17, 0.1));
  p.geo('iplain', new THREE.ConeGeometry(0.07, 0.34, 4), 0.42, 2.92, 0.12, STEEL);
}

/** 病床或寢室的床：床頭在 -Z */
export function bed(p: At, cover: THREE.Color, posts = false, frame: THREE.Color = DARKWOOD) {
  const key: MatKey = posts ? 'iwood' : 'iplain';
  const ft = posts ? frame : STEEL;
  p.box(key, 1.1, 0.12, 2.1, 0, 0.38, 0, ft);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(key, 0.08, posts ? 2.2 : sz < 0 ? 1.1 : 0.7, 0.08, sx * 0.53, 0, sz * 1.03, ft);
  p.box(key, 1.1, 0.5, 0.06, 0, 0.55, -1.03, ft);
  p.box('iplain', 1.02, 0.18, 2.0, 0, 0.5, 0, WHITE);
  p.box('iplain', 1.06, 0.1, 1.4, 0, 0.66, 0.3, cover);
  p.box('iplain', 0.7, 0.12, 0.4, 0, 0.68, -0.72, WHITE);
  if (posts) {
    p.box('iwood', 1.2, 0.08, 2.2, 0, 2.2, 0, frame);
    for (const s of [-1, 1]) p.box('iplain', 0.04, 1.75, 0.5, s * 0.56, 0.45, -0.8, cover);
    p.box('iplain', 1.1, 1.75, 0.04, 0, 0.45, -1.07, cover);
    p.box('iplain', 1.22, 0.3, 2.22, 0, 1.9, 0, cover);
  }
}

/** 玻璃展示櫃，裡面擺著獎盃 */
export function trophyCase(p: At, w: number) {
  const rng = p.b.rng;
  p.box('iwood', w, 0.9, 0.7, 0, 0, 0, DARKWOOD);
  p.box('iwood', w, 0.1, 0.7, 0, 2.5, 0, DARKWOOD);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('iwood', 0.07, 1.6, 0.07, sx * (w / 2 - 0.035), 0.9, sz * 0.315, DARKWOOD);
  p.box('iplain', w - 0.1, 0.03, 0.6, 0, 1.7, 0, col(0.5, 0.6, 0.62));
  for (const y of [0.9, 1.73]) {
    const n = Math.floor(w / 0.55);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.3 + (i * (w - 0.6)) / Math.max(1, n - 1);
      const s = 0.6 + rng() * 0.6;
      const tint = rng() < 0.7 ? GOLD : STEEL;
      if (rng() < 0.6) {
        p.cyl('iplain', 0.06 * s, 0.09 * s, 0.05, x, y, 0, 8, tint);
        p.cyl('iplain', 0.02 * s, 0.02 * s, 0.18 * s, x, y + 0.05, 0, 6, tint);
        p.cyl('iplain', 0.12 * s, 0.05 * s, 0.22 * s, x, y + 0.05 + 0.18 * s, 0, 10, tint);
      } else {
        p.box('iwood', 0.2, 0.04, 0.12, x, y, 0, DARKWOOD);
        p.geo('iplain', new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.025, 14), x, y + 0.04 + 0.17 * s, 0, tint, 0, Math.PI / 2);
      }
    }
  }
}

/** 閱覽桌上的綠罩檯燈 */
export function deskLamp(p: At) {
  p.cyl('iplain', 0.05, 0.08, 0.03, 0, 0, 0, 8, GOLD);
  p.cyl('iplain', 0.012, 0.012, 0.3, 0, 0.03, 0, 5, GOLD);
  p.cyl('iglow', 0.06, 0.14, 0.11, 0, 0.3, 0, 10, GREENLAMP);
}

/** 學生的雙人課桌與長凳：正面（學生面對的方向）朝 +Z */
export function studentDesk(p: At, w = 1.5) {
  p.geo('iwood', new THREE.BoxGeometry(w, 0.06, 0.55), 0, 0.78, 0.1, undefined, 0, 0.12);
  for (const s of [-1, 1]) p.box('iwood', 0.06, 0.75, 0.5, s * (w / 2 - 0.05), 0, 0.1);
  p.box('iwood', w - 0.1, 0.4, 0.04, 0, 0.3, 0.33);
  p.box('iwood', w, 0.06, 0.32, 0, 0.44, -0.55);
  for (const s of [-1, 1]) p.box('iwood', 0.06, 0.44, 0.28, s * (w / 2 - 0.05), 0, -0.55);
}

/** 黑板：貼牆，正面朝 +Z，p 在黑板底邊中心 */
export function blackboard(p: At, w = 4, h = 1.8) {
  p.box('iwood', w + 0.24, h + 0.24, 0.06, 0, -0.12, 0.03, DARKWOOD);
  p.box('iplain', w, h, 0.05, 0, 0, 0.06, col(0.03, 0.06, 0.045));
  p.box('iwood', w, 0.05, 0.14, 0, -0.1, 0.12, DARKWOOD);
  const rng = p.b.rng;
  for (let i = 0; i < 7; i++) p.box('iplain', 0.5 + rng() * 1.2, 0.025, 0.01, (rng() - 0.5) * (w - 2), 0.35 + i * ((h - 0.6) / 7), 0.09, col(0.5, 0.5, 0.46));
}

/** 大釜：s 為大小倍率，liquid 為藥水的顏色（發光），fire 表示底下生火 */
export function cauldron(p: At, s = 1, liquid?: THREE.Color, fire = true) {
  const g = new THREE.SphereGeometry(0.34 * s, 12, 8, 0, Math.PI * 2, Math.PI * 0.28, Math.PI * 0.72);
  p.geo('iplain', g, 0, 0.5 * s, 0, BLACK);
  p.geo('iplain', new THREE.TorusGeometry(0.3 * s, 0.03 * s, 6, 16), 0, 0.71 * s, 0, BLACK, 0, Math.PI / 2);
  for (let k = 0; k < 3; k++) p.cyl('iplain', 0.025 * s, 0.02 * s, 0.24 * s, Math.cos(k * 2.09) * 0.2 * s, 0, Math.sin(k * 2.09) * 0.2 * s, 5, BLACK);
  if (liquid) p.cyl('iglow', 0.27 * s, 0.27 * s, 0.02, 0, 0.66 * s, 0, 12, liquid);
  if (fire) for (let k = 0; k < 3; k++) p.sphere('iglow', 0.07 * s, Math.cos(k * 2.09 + 1) * 0.1 * s, 0.1 * s, Math.sin(k * 2.09 + 1) * 0.1 * s, FIRE, 1.6, 5);
}

/** 靠牆的藥櫃：一排排發著微光的瓶瓶罐罐，正面朝 +Z */
export function potionShelf(p: At, w: number, rows = 5, wood: THREE.Color = DARKWOOD) {
  const tints = [col(0.3, 1.8, 0.6), col(1.8, 0.4, 0.25), col(0.4, 0.7, 2.0), col(1.6, 1.3, 0.3), col(1.2, 0.4, 1.6), col(0.9, 0.9, 0.8)];
  const rng = p.b.rng;
  p.box('iwood', w, rows * 0.6 + 0.3, 0.06, 0, 0, -0.2, wood);
  for (const s of [-1, 1]) p.box('iwood', 0.08, rows * 0.6 + 0.3, 0.45, s * (w / 2), 0, 0, wood);
  for (let r = 0; r < rows; r++) {
    p.box('iwood', w, 0.05, 0.45, 0, 0.3 + r * 0.6, 0, wood);
    for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.3 + rng() * 0.15) {
      if (rng() < 0.15) continue;
      const big = rng() < 0.25;
      p.cyl(rng() < 0.6 ? 'iglow' : 'iplain', big ? 0.08 : 0.035, big ? 0.09 : 0.06, 0.14 + rng() * 0.16, x, 0.35 + r * 0.6, 0.03, 6, tints[Math.floor(rng() * tints.length)].clone().multiplyScalar(0.4));
    }
  }
}

/** 小圓桌 */
export function roundTable(p: At, r = 0.6, h = 0.7, tint?: THREE.Color) {
  p.cyl('iwood', r, r, 0.05, 0, h - 0.05, 0, 14, tint);
  p.cyl('iwood', 0.05, 0.07, h - 0.05, 0, 0, 0, 6, tint);
  p.cyl('iwood', r * 0.55, r * 0.6, 0.04, 0, 0, 0, 10, tint);
}

/** 坐墊凳 */
export function pouf(p: At, tint: THREE.Color) {
  p.cyl('iplain', 0.3, 0.33, 0.36, 0, 0, 0, 10, tint);
  p.sphere('iplain', 0.3, 0, 0.36, 0, tint, 0.35);
}

export interface RingGap {
  /** 方位角（0 朝 +Z） */
  a: number;
  /** 開口寬度（公尺） */
  w: number;
  /** 開口的上下緣（世界高度） */
  y0: number;
  y1: number;
}
/**
 * 由一圈方塊砌成的中空圓牆（可以開門洞），碰撞與外觀都跟實心圓塔一樣，只是裡面是空的。
 * lining 表示內側再貼一層室內石材。skip(a) 為 true 的那一段不砌（兩間圓屋相連時用）。
 */
export function ringWall(
  b: Builder,
  x: number,
  y: number,
  z: number,
  rIn: number,
  rOut: number,
  h: number,
  o: { seg?: number; tint?: THREE.Color; gaps?: RingGap[]; skip?: (a: number) => boolean; lining?: THREE.Color; key?: MatKey } = {},
) {
  const seg = o.seg ?? Math.max(12, Math.round(rOut * 4.2));
  const step = (Math.PI * 2) / seg;
  const width = 2 * rOut * Math.tan(step / 2) + 0.04;
  const LIN = o.lining ? 0.15 : 0;
  const depth = rOut - rIn - LIN;
  for (let i = 0; i < seg; i++) {
    const a = i * step;
    if (o.skip?.(a)) continue;
    const p = new At(b, x + Math.sin(a) * ((rIn + LIN + rOut) / 2), y, z + Math.cos(a) * ((rIn + LIN + rOut) / 2), a);
    const q = new At(b, x + Math.sin(a) * (rIn + LIN / 2), y, z + Math.cos(a) * (rIn + LIN / 2), a);
    const piece = (y0: number, y1: number) => {
      if (y1 - y0 < 0.01) return;
      p.box(o.key ?? 'stone', width, y1 - y0, depth, 0, y0 - y, 0, o.tint);
      if (o.lining) q.box('istone', 2 * rIn * Math.tan(step / 2) + 0.04, y1 - y0, LIN, 0, y0 - y, 0, o.lining);
    };
    const gap = o.gaps?.find((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) < g.w / 2 / rOut);
    if (gap) {
      piece(y, Math.max(y, gap.y0));
      piece(Math.min(y + h, gap.y1), y + h);
    } else piece(y, y + h);
  }
}

export interface LocalOpening {
  /** 廂房自己的方向：S=+Z、N=-Z、E=+X、W=-X */
  side: 'N' | 'S' | 'E' | 'W';
  at: number;
  w: number;
  h: number;
}
/**
 * 會旋轉的房間（room() 只能沿座標軸）：w、d 是外牆的外緣尺寸，t 是牆厚。
 * 外層是城堡石材、內層是室內石材，開口是真的洞。
 */
export function orientedRoom(
  b: Builder,
  cx: number,
  y: number,
  cz: number,
  ry: number,
  w: number,
  d: number,
  h: number,
  o: { t?: number; openings?: LocalOpening[]; tint?: THREE.Color; itint?: THREE.Color; key?: MatKey; found?: number; ceil?: number; floorTint?: THREE.Color } = {},
) {
  const t = o.t ?? 0.4;
  const LIN = 0.15;
  const p = new At(b, cx, y, cz, ry);
  const itint = o.itint ?? IWARM;
  const key = o.key ?? 'stone';
  for (const side of ['N', 'S', 'E', 'W'] as const) {
    const alongX = side === 'N' || side === 'S';
    const len = alongX ? w : d - 2 * t;
    const sgn = side === 'S' || side === 'E' ? 1 : -1;
    const off = ((alongX ? d : w) / 2) * sgn;
    const ops = (o.openings || []).filter((q) => q.side === side).sort((a, c) => a.at - c.at);
    const piece = (c0: number, c1: number, y0: number, y1: number) => {
      const l = c1 - c0;
      if (l < 0.01 || y1 - y0 < 0.01) return;
      const m = (c0 + c1) / 2;
      const outer = off - sgn * ((t - LIN) / 2);
      const inner = off - sgn * (t - LIN / 2);
      // 內側那層要退到牆角內，避免從屋外看得到
      const il = alongX ? Math.min(c1, w / 2 - t) - Math.max(c0, -w / 2 + t) : l;
      const im = alongX ? (Math.min(c1, w / 2 - t) + Math.max(c0, -w / 2 + t)) / 2 : m;
      if (alongX) {
        p.box(key, l, y1 - y0, t - LIN, m, y0, outer, o.tint);
        if (il > 0.01) p.box('istone', il, y1 - y0, LIN, im, y0, inner, itint);
      } else {
        p.box(key, t - LIN, y1 - y0, l, outer, y0, m, o.tint);
        p.box('istone', LIN, y1 - y0, l, inner, y0, m, itint);
      }
    };
    let cur = -len / 2;
    for (const q of ops) {
      piece(cur, q.at - q.w / 2, -(o.found ?? 0.5), h);
      piece(q.at - q.w / 2, q.at + q.w / 2, q.h, h);
      // 門檻：開口下方填實，免得門口變成一道往下的縫
      piece(q.at - q.w / 2, q.at + q.w / 2, -(o.found ?? 0.5), 0);
      cur = q.at + q.w / 2;
    }
    piece(cur, len / 2, -(o.found ?? 0.5), h);
  }
  p.box('istone', w - 2 * t + 0.02, 0.5, d - 2 * t + 0.02, 0, -0.5, 0, o.floorTint ?? itint);
  if (o.ceil != null) p.box('iwood', w - 2 * t, 0.25, d - 2 * t, 0, o.ceil, 0, DARKWOOD);
  return p;
}
