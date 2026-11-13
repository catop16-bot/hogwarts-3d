import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../core/globals';

/** i 開頭的是室內專用材質：不積雪、不淋濕、不投影 */
export type MatKey = 'stone' | 'roof' | 'wood' | 'window' | 'matte' | 'cloth' | 'lamp' | 'glass' | 'istone' | 'iwood' | 'iplain' | 'iglow' | 'iwin';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
const WHITE = new THREE.Color(1, 1, 1);

export const col = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

export function mat4(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s);
}

export type WinType = 0 | 1 | 2 | 3 | 4 | 5;
/** 牆面上要留空的位置（門）：壁柱等裝飾會避開 */
export const KEEP_CLEAR: [number, number][] = [];
const TRIM = new THREE.Color(1.12, 1.1, 1.05);
/** 0 小窗、1 哥德式高窗（大廳）、2 鐘面、3 箭孔、4 木門、5 玫瑰窗 */

export interface TowerOpts {
  x: number;
  z: number;
  y?: number;
  r: number;
  h: number;
  roofH?: number;
  seg?: number;
  taper?: number;
  top?: 'corbel' | 'crenel' | 'plain';
  rows?: number;
  per?: number;
  tint?: THREE.Color;
  roofTint?: THREE.Color;
  found?: number;
  winFrom?: number; // 從多高開始有窗（比例）
  noFinial?: boolean;
  /** 不建實心塔身、基座與腰線（由室內模組另外砌出中空的圓牆） */
  noBody?: boolean;
}
export interface SquareOpts {
  x: number;
  z: number;
  y?: number;
  w: number;
  d: number;
  h: number;
  ry?: number;
  roof?: 'pyramid' | 'flat' | 'gable';
  roofH?: number;
  turrets?: number; // 角樓半徑（0 表示沒有）
  turretH?: number;
  crenel?: boolean;
  rows?: number;
  cols?: number;
  tint?: THREE.Color;
  found?: number;
  winType?: WinType;
  winW?: number;
  winH?: number;
  /** 不建實心塔身（由室內模組另外砌出中空的牆） */
  noBody?: boolean;
}
export interface WingOpts {
  x: number;
  z: number;
  y?: number;
  w: number; // 沿屋脊方向的長度
  d: number;
  h: number;
  ry?: number;
  roofH?: number;
  rows?: number;
  spacing?: number;
  winW?: number;
  winH?: number;
  winType?: WinType;
  winY?: number; // 第一排窗的高度
  buttress?: boolean;
  crenel?: boolean;
  tint?: THREE.Color;
  found?: number;
  gableWin?: [number, number, WinType] | null;
  sides?: [boolean, boolean]; // 是否在 +Z / -Z 兩側開窗
  chimneys?: number;
  dormers?: number;
  /** 不建實心牆身（由室內模組另外砌出中空的牆） */
  noBody?: boolean;
  /** 依世界座標略過某些窗 */
  skipWin?: (wx: number, wz: number) => boolean;
}

/** 收集各種材質的幾何，最後合併成少量網格 */
export class Builder {
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  rng: () => number;
  tint: THREE.Color = WHITE;
  /** 窗台、線腳等修飾石材的色調（略淺的琢石） */
  trim: THREE.Color = TRIM;
  private setTrim(tint?: THREE.Color) {
    this.trim = tint ? tint.clone().multiplyScalar(1.04) : TRIM;
  }

  constructor(seed = 1) {
    this.rng = makeRng(seed);
  }

  add(key: MatKey, geo: THREE.BufferGeometry, m?: THREE.Matrix4, tint?: THREE.Color) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'aWin') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const c = tint || this.tint;
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    let arr = this.parts.get(key);
    if (!arr) this.parts.set(key, (arr = []));
    arr.push(g);
    return this;
  }

  /** 合併並輸出成一個群組；materials 由外部提供 */
  build(name: string, materials: Record<MatKey, THREE.Material>) {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, geos] of this.parts) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      for (const g of geos) g.dispose();
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.name = `${name}:${key}`;
      const interior = /^i(stone|wood|plain|glow|win)$/.test(key);
      mesh.castShadow = key !== 'window' && key !== 'lamp' && !interior;
      mesh.receiveShadow = key !== 'lamp' && key !== 'iglow' && key !== 'iwin';
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }

  // ------------------------------------------------------------ 基本形體
  box(key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, tint?: THREE.Color) {
    return this.add(key, new THREE.BoxGeometry(w, h, d), mat4(x, y + h / 2, z, ry), tint);
  }
  cyl(key: MatKey, rTop: number, rBot: number, h: number, x: number, y: number, z: number, seg = 16, tint?: THREE.Color, ry = 0) {
    return this.add(key, new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false), mat4(x, y + h / 2, z, ry), tint);
  }
  cone(key: MatKey, r: number, h: number, x: number, y: number, z: number, seg = 16, tint?: THREE.Color, ry = 0) {
    return this.add(key, new THREE.ConeGeometry(r, h, seg, 1, false), mat4(x, y + h / 2, z, ry), tint);
  }
  sphere(key: MatKey, r: number, x: number, y: number, z: number, tint?: THREE.Color, sy = 1, seg = 10) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7)));
    g.scale(1, sy, 1);
    return this.add(key, g, mat4(x, y, z), tint);
  }
  /** 兩點之間的方樑 */
  beam(key: MatKey, a: THREE.Vector3, b: THREE.Vector3, th: number, tint?: THREE.Color, th2 = th) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return this;
    _q.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
    const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, _s);
    return this.add(key, new THREE.BoxGeometry(th, len, th2), m, tint);
  }
  /** 兩點之間的圓柱 */
  rod(key: MatKey, a: THREE.Vector3, b: THREE.Vector3, r: number, tint?: THREE.Color, seg = 6, r2 = r) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return this;
    _q.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
    const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, _s);
    return this.add(key, new THREE.CylinderGeometry(r2, r, len, seg, 1, false), m, tint);
  }

  /**
   * 山牆屋頂：屋脊沿局部 X 軸，長 w、跨度 d、高 h。
   * 斜面用 roofKey，山牆三角形用 wallKey。
   */
  gable(roofKey: MatKey, wallKey: MatKey | null, w: number, d: number, h: number, x: number, y: number, z: number, ry = 0, over = 0.7, roofTint?: THREE.Color, wallTint?: THREE.Color) {
    const hw = w / 2 + over;
    const hd = d / 2 + over;
    const drop = (over * h) / (d / 2);
    const P = [
      [-hw, -drop, hd],
      [hw, -drop, hd],
      [hw, h, 0],
      [-hw, h, 0],
      [-hw, -drop, -hd],
      [hw, -drop, -hd],
    ];
    const tris = [0, 1, 2, 0, 2, 3, 5, 4, 3, 5, 3, 2];
    const pos: number[] = [];
    const uv: number[] = [];
    const sl = Math.hypot(hd, h + drop);
    for (const i of tris) {
      pos.push(P[i][0], P[i][1], P[i][2]);
      uv.push(P[i][0], i === 2 || i === 3 ? sl : 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    // 屋頂厚度：再加一層略低的內面，避免從下方看穿
    this.add(roofKey, g, mat4(x, y, z, ry), roofTint);
    if (wallKey) {
      const hw2 = w / 2;
      const hd2 = d / 2;
      const wp = [
        -hw2, 0, hd2, -hw2, h, 0, -hw2, 0, -hd2,
        hw2, 0, -hd2, hw2, h, 0, hw2, 0, hd2,
      ];
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      wg.computeVertexNormals();
      this.add(wallKey, wg, mat4(x, y, z, ry), wallTint);
    }
    return this;
  }

  /** 窗戶貼片：面向局部 +Z，以 ry 旋轉；(x,y,z) 為窗底中心 */
  window(w: number, h: number, x: number, y: number, z: number, ry: number, type: WinType = 0, push = 0.14) {
    const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    const seed = this.rng();
    for (let i = 0; i < n; i++) {
      a[i * 3] = seed;
      a[i * 3 + 1] = h / w;
      a[i * 3 + 2] = type;
    }
    g.setAttribute('aWin', new THREE.BufferAttribute(a, 3));
    const m = mat4(x + Math.sin(ry) * push, y + h / 2, z + Math.cos(ry) * push, ry);
    // 一般的窗：石窗台與窗楣，讓牆面有一點凹凸
    if ((type === 0 || type === 1) && w >= 0.9 && push >= 0.1) {
      const d = push + 0.2;
      const ox = Math.sin(ry) * (d / 2 - 0.04);
      const oz = Math.cos(ry) * (d / 2 - 0.04);
      this.box('stone', w + 0.36, 0.16, d, x + ox, y - 0.16, z + oz, ry, this.trim);
      this.box('stone', w + 0.3, 0.13, d - 0.06, x + ox, y + h + 0.02, z + oz, ry, this.trim);
    }
    return this.add('window', g, m);
  }

  /** 沿著一面牆排一列窗。牆面中心 (cx,cz)，法線方向 ry，寬 len */
  windowRow(len: number, count: number, w: number, h: number, cx: number, y: number, cz: number, ry: number, type: WinType = 0, skip?: (i: number) => boolean) {
    const tx = Math.cos(ry);
    const tz = -Math.sin(ry);
    for (let i = 0; i < count; i++) {
      if (skip && skip(i)) continue;
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * len;
      this.window(w, h, cx + tx * t, y, cz + tz * t, ry, type);
    }
    return this;
  }

  /** 矩形城垛（沿四邊） */
  crenelRect(w: number, d: number, x: number, y: number, z: number, ry = 0, tint?: THREE.Color, mer = 1.3, mh = 1.5) {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const place = (lx: number, lz: number, bw: number, bd: number, bh: number) =>
      this.box('stone', bw, bh, bd, x + lx * c + lz * s, y, z - lx * s + lz * c, ry, tint);
    const th = 0.7;
    place(0, d / 2 - th / 2, w, th, 1.0);
    place(0, -d / 2 + th / 2, w, th, 1.0);
    place(w / 2 - th / 2, 0, th, d, 1.0);
    place(-w / 2 + th / 2, 0, th, d, 1.0);
    const nx = Math.max(2, Math.round(w / (mer * 2)));
    const nz = Math.max(2, Math.round(d / (mer * 2)));
    for (let i = 0; i < nx; i++) {
      const lx = -w / 2 + (i + 0.5) * (w / nx);
      place(lx, d / 2 - th / 2, w / nx / 2, th, 1.0 + mh);
      place(lx, -d / 2 + th / 2, w / nx / 2, th, 1.0 + mh);
    }
    for (let i = 0; i < nz; i++) {
      const lz = -d / 2 + (i + 0.5) * (d / nz);
      place(w / 2 - th / 2, lz, th, d / nz / 2, 1.0 + mh);
      place(-w / 2 + th / 2, lz, th, d / nz / 2, 1.0 + mh);
    }
    return this;
  }

  /** 圓形城垛 */
  crenelRing(r: number, x: number, y: number, z: number, tint?: THREE.Color, mh = 1.4) {
    const g = new THREE.CylinderGeometry(r, r, 1.0, 24, 1, true);
    this.add('stone', g, mat4(x, y + 0.5, z), tint);
    const g2 = new THREE.CylinderGeometry(r - 0.6, r - 0.6, 1.0, 24, 1, true);
    g2.scale(-1, 1, 1);
    this.add('stone', g2, mat4(x, y + 0.5, z), tint);
    const n = Math.max(6, Math.round((Math.PI * 2 * r) / 2.6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.box('stone', 1.3, 1.0 + mh, 0.65, x + Math.sin(a) * (r - 0.3), y, z + Math.cos(a) * (r - 0.3), a, tint);
    }
    return this;
  }

  /** 小尖塔（扶壁頂、屋角裝飾） */
  pinnacle(x: number, y: number, z: number, s = 1, tint?: THREE.Color) {
    this.box('stone', 1.1 * s, 2.6 * s, 1.1 * s, x, y, z, 0, tint);
    this.cone('stone', 0.85 * s, 3.4 * s, x, y + 2.6 * s, z, 4, tint, Math.PI / 4);
    return this;
  }

  // ------------------------------------------------------------ 組合件
  /** 圓塔：塔身、腰線、懸挑的塔頂迴廊、錐形屋頂 */
  roundTower(o: TowerOpts) {
    const y0 = o.y ?? 0;
    this.setTrim(o.tint);
    const seg = o.seg ?? 20;
    const taper = o.taper ?? 0.05;
    const found = o.found ?? 16;
    const top = o.top ?? 'corbel';
    const rTop = o.r * (1 - taper);
    const tint = o.tint;
    if (!o.noBody) {
      this.cyl('stone', rTop, o.r * 1.02, o.h + found, o.x, y0 - found, o.z, seg, tint);
      // 基座與腰線
      this.cyl('stone', o.r * 1.06, o.r * 1.1, 3, o.x, y0 - 0.5, o.z, seg, tint);
      for (const f of [0.34, 0.66]) {
        const rr = o.r * (1 - taper * f) + 0.22;
        this.cyl('stone', rr, rr, 0.55, o.x, y0 + o.h * f, o.z, seg, tint);
      }
    }
    let roofR = rTop;
    let roofY = y0 + o.h;
    if (top === 'corbel') {
      const cr = rTop * 1.17 + 0.3;
      const ch = Math.min(3.2, o.r * 0.45);
      const gh = Math.max(3.2, o.r * 0.42);
      this.cyl('stone', cr, rTop, ch, o.x, y0 + o.h - ch, o.z, seg, tint);
      this.cyl('stone', cr, cr, gh, o.x, y0 + o.h, o.z, seg, tint);
      const n = Math.max(6, Math.round(cr * 1.3));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.3;
        this.window(0.8, gh * 0.55, o.x + Math.sin(a) * cr, y0 + o.h + gh * 0.2, o.z + Math.cos(a) * cr, a, 0, 0.1);
      }
      roofR = cr;
      roofY = y0 + o.h + gh;
    } else if (top === 'crenel') {
      const cr = rTop * 1.12 + 0.3;
      this.cyl('stone', cr, rTop, 2.2, o.x, y0 + o.h - 2.2, o.z, seg, tint);
      this.cyl('stone', cr, cr, 0.6, o.x, y0 + o.h, o.z, seg, tint);
      this.crenelRing(cr, o.x, y0 + o.h + 0.6, o.z, tint);
      roofR = rTop * 0.72;
      roofY = y0 + o.h + 0.6;
      if (o.roofH) this.cyl('stone', roofR, roofR, 3.5, o.x, roofY, o.z, seg, tint);
      roofY += o.roofH ? 3.5 : 0;
    }
    if (o.roofH) {
      this.cone('roof', roofR + 0.75, o.roofH, o.x, roofY - 0.25, o.z, seg, o.roofTint);
      if (!o.noFinial) {
        this.cyl('matte', 0.05, 0.14, o.roofH * 0.16 + 1.6, o.x, roofY + o.roofH - 0.6, o.z, 5, col(0.05, 0.05, 0.05));
        this.sphere('matte', 0.32, o.x, roofY + o.roofH + 0.1, o.z, col(0.06, 0.06, 0.06), 1, 6);
      }
    }
    // 窗戶：螺旋排列
    const rows = o.rows ?? Math.max(2, Math.round(o.h / 9));
    const per = o.per ?? Math.max(2, Math.round(o.r / 2.6));
    const from = o.winFrom ?? 0.1;
    for (let i = 0; i < rows; i++) {
      const f = from + ((0.86 - from) * (i + 0.5)) / rows;
      const y = y0 + o.h * f;
      const rr = o.r * (1 - taper * f) + 0.02;
      const off = i * 2.399 + this.rng() * 0.5;
      for (let k = 0; k < per; k++) {
        if (this.rng() < 0.12) continue;
        const a = off + (k / per) * Math.PI * 2;
        const slit = this.rng() < 0.22;
        this.window(slit ? 0.5 : 1.15, slit ? 2.2 : 2.7, o.x + Math.sin(a) * rr, y, o.z + Math.cos(a) * rr, a, slit ? 3 : 0, 0.1);
      }
    }
    return { topY: roofY + (o.roofH || 0), roofY, roofR };
  }

  /** 附著在主塔側面的懸挑小角塔 */
  bartizan(x: number, z: number, yBase: number, r: number, h: number, roofH: number, tint?: THREE.Color, roofTint?: THREE.Color) {
    // 底部的倒錐形托座
    const g = new THREE.ConeGeometry(r, r * 2.4, 12);
    g.rotateX(Math.PI);
    this.add('stone', g, mat4(x, yBase - r * 1.2, z), tint);
    this.cyl('stone', r, r, h, x, yBase, z, 12, tint);
    this.cyl('stone', r + 0.25, r + 0.25, 0.4, x, yBase + h - 0.4, z, 12, tint);
    this.cone('roof', r + 0.5, roofH, x, yBase + h - 0.1, z, 12, roofTint);
    this.cyl('matte', 0.04, 0.1, 1.8, x, yBase + h + roofH - 0.4, z, 5, col(0.05, 0.05, 0.05));
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      this.window(0.7, 1.9, x + Math.sin(a) * r, yBase + h * (0.25 + 0.5 * (i / n)), z + Math.cos(a) * r, a, this.rng() < 0.3 ? 3 : 0, 0.08);
    }
    return this;
  }

  /** 方塔：四角可帶八角小塔，頂部為金字塔頂或城垛 */
  squareTower(o: SquareOpts) {
    this.setTrim(o.tint);
    const y0 = o.y ?? 0;
    const ry = o.ry ?? 0;
    const found = o.found ?? 16;
    const tint = o.tint;
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const W = (lx: number, lz: number) => [o.x + lx * c + lz * s, o.z - lx * s + lz * c] as const;
    if (!o.noBody) {
      this.box('stone', o.w, o.h + found, o.d, o.x, y0 - found, o.z, ry, tint);
      this.box('stone', o.w + 1.2, 3.5, o.d + 1.2, o.x, y0 - 1, o.z, ry, tint);
      for (const f of [0.3, 0.62, 0.97]) this.box('stone', o.w + 0.6, 0.6, o.d + 0.6, o.x, y0 + o.h * f, o.z, ry, tint);
    }
    const topY = y0 + o.h;
    if (o.crenel ?? true) this.crenelRect(o.w + 0.6, o.d + 0.6, o.x, topY, o.z, ry, tint);
    const tr = o.turrets ?? 0;
    if (tr > 0) {
      const th = o.turretH ?? o.h * 0.18 + 8;
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const [tx, tz] = W((sx * o.w) / 2, (sz * o.d) / 2);
        const base = y0 + o.h * 0.55;
        this.cyl('stone', tr, tr, topY - base + th, tx, base, tz, 8, tint);
        const g = new THREE.ConeGeometry(tr, tr * 2.2, 8);
        g.rotateX(Math.PI);
        this.add('stone', g, mat4(tx, base - tr * 1.1, tz), tint);
        this.cyl('stone', tr + 0.3, tr + 0.3, 0.5, tx, topY + th - 0.5, tz, 8, tint);
        this.cone('roof', tr + 0.55, tr * 3.4, tx, topY + th - 0.1, tz, 8);
        this.window(0.6, 1.8, tx + (sx * c + sz * s) * tr * 0.72, topY + th * 0.35, tz + (-sx * s + sz * c) * tr * 0.72, Math.atan2(sx * c + sz * s, -sx * s + sz * c), 3, 0.06);
      }
    }
    const roof = o.roof ?? 'pyramid';
    if (roof === 'pyramid' && o.roofH) {
      const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
      g.rotateY(Math.PI / 4);
      g.scale(o.w - 1.6, o.roofH, o.d - 1.6);
      this.add('roof', g, mat4(o.x, topY + o.roofH / 2, o.z, ry));
      this.cyl('matte', 0.06, 0.16, 3.2, o.x, topY + o.roofH - 0.5, o.z, 5, col(0.05, 0.05, 0.05));
    } else if (roof === 'gable' && o.roofH) {
      this.gable('roof', 'stone', o.w - 1.4, o.d - 1.4, o.roofH, o.x, topY, o.z, ry, 0.2, undefined, tint);
    }
    // 窗戶
    const rows = o.rows ?? Math.max(2, Math.round(o.h / 10));
    const cols = o.cols ?? Math.max(1, Math.round(o.w / 7));
    const ww = o.winW ?? 1.3;
    const wh = o.winH ?? 3.0;
    for (let r = 0; r < rows; r++) {
      const y = y0 + o.h * (0.1 + (0.8 * (r + 0.4)) / rows);
      for (let side = 0; side < 4; side++) {
        const a = ry + (side * Math.PI) / 2;
        const half = side % 2 === 0 ? o.d / 2 : o.w / 2;
        const len = (side % 2 === 0 ? o.w : o.d) * 0.62;
        const cx = o.x + Math.sin(a) * half;
        const cz = o.z + Math.cos(a) * half;
        this.windowRow(len, cols, ww, wh, cx, y, cz, a, o.winType ?? 0, () => this.rng() < 0.1);
      }
    }
    return { topY: topY + (o.roofH || 0) };
  }

  /** 長形建築：牆身＋山牆屋頂＋成排窗戶，可加扶壁 */
  wing(o: WingOpts) {
    const y0 = o.y ?? 0;
    this.setTrim(o.tint);
    const ry = o.ry ?? 0;
    const found = o.found ?? 14;
    const tint = o.tint;
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const W = (lx: number, lz: number) => [o.x + lx * c + lz * s, o.z - lx * s + lz * c] as const;
    if (!o.noBody) {
      this.box('stone', o.w, o.h + found, o.d, o.x, y0 - found, o.z, ry, tint);
      this.box('stone', o.w + 0.9, 2.2, o.d + 0.9, o.x, y0 - 0.6, o.z, ry, tint);
      this.box('stone', o.w + 0.7, 0.7, o.d + 0.7, o.x, y0 + o.h - 0.7, o.z, ry, tint);
    }
    const roofH = o.roofH ?? o.d * 0.62;
    // 樓層之間的腰線
    if (!o.noBody && o.h >= 14) {
      const bands = Math.max(1, Math.round(o.h / 9) - 1);
      for (let i = 1; i <= bands; i++) this.box('stone', o.w + 0.5, 0.32, o.d + 0.5, o.x, y0 + (o.h * i) / (bands + 1) + 0.6, o.z, ry, tint);
    }
    // 屋脊的石脊與兩端的尖飾
    if (roofH > 0 && !o.crenel) {
      this.box('stone', o.w + 1.3, 0.34, 0.5, o.x, y0 + o.h + roofH - 0.12, o.z, ry, tint);
      if (o.h >= 15) for (const sx of [1, -1]) {
        const [px, pz] = W(sx * (o.w / 2 + 0.55), 0);
        this.pinnacle(px, y0 + o.h + roofH + 0.1, pz, 0.8, tint);
      }
    }
    if (o.crenel) this.crenelRect(o.w + 0.7, o.d + 0.7, o.x, y0 + o.h, o.z, ry, tint);
    if (roofH > 0) this.gable('roof', 'stone', o.crenel ? o.w - 2 : o.w, o.crenel ? o.d - 2.4 : o.d, roofH, o.x, y0 + o.h, o.z, ry, o.crenel ? 0 : 0.7, undefined, tint);
    // 兩側的窗
    const spacing = o.spacing ?? 5.5;
    const count = Math.max(1, Math.floor((o.w - 4) / spacing));
    const rows = o.rows ?? Math.max(1, Math.round(o.h / 8));
    const ww = o.winW ?? 1.4;
    const wh = o.winH ?? Math.min(3.4, (o.h / rows) * 0.55);
    const sides = o.sides ?? [true, true];
    for (let r = 0; r < rows; r++) {
      const y = o.winY != null && rows === 1 ? y0 + o.winY : y0 + 2.2 + ((o.h - 3.5) * r) / rows + (o.winY ?? 0);
      for (let side = 0; side < 2; side++) {
        if (!sides[side]) continue;
        const a = ry + side * Math.PI;
        const [cx, cz] = W(0, (side === 0 ? 1 : -1) * (o.d / 2));
        const len = (count - 1) * spacing;
        const skip = o.skipWin
          ? (i: number) => {
              const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * len;
              return o.skipWin!(cx + Math.cos(a) * t, cz - Math.sin(a) * t);
            }
          : undefined;
        this.windowRow(len, count, ww, wh, cx, y, cz, a, o.winType ?? 0, skip);
      }
    }
    // 長廂房沒有扶壁時：窗與窗之間加淺壁柱，避開門的位置
    if (!o.buttress && o.w >= 40 && o.h >= 18) {
      for (let i = 0; i <= count; i++) {
        const lx = (i - count / 2) * spacing;
        if (Math.abs(lx) > o.w / 2 - 0.8) continue;
        for (const sz of [1, -1]) {
          if (!sides[sz === 1 ? 0 : 1]) continue;
          const [bx, bz] = W(lx, sz * (o.d / 2 + 0.22));
          if (KEEP_CLEAR.some(([kx, kz]) => Math.hypot(kx - bx, kz - bz) < 2.6)) continue;
          this.box('stone', 0.95, o.h - 0.9, 0.5, bx, y0, bz, ry, tint);
          this.box('stone', 1.25, 1.6, 0.75, bx, y0 - 0.4, bz, ry, tint);
        }
      }
    }
    // 扶壁與小尖塔
    if (o.buttress) {
      for (let i = 0; i <= count; i++) {
        const lx = (i - count / 2) * spacing;
        for (const sz of [1, -1]) {
          if (!sides[sz === 1 ? 0 : 1]) continue;
          const [bx, bz] = W(lx, sz * (o.d / 2 + 1.3));
          this.box('stone', 1.5, o.h * 0.5 + found, 2.8, bx, y0 - found, bz, ry, tint);
          const [bx2, bz2] = W(lx, sz * (o.d / 2 + 0.9));
          this.box('stone', 1.3, o.h * 0.42, 1.9, bx2, y0 + o.h * 0.5, bz2, ry, tint);
          const [bx3, bz3] = W(lx, sz * (o.d / 2 + 0.55));
          this.pinnacle(bx3, y0 + o.h * 0.92, bz3, 0.9, tint);
        }
      }
    }
    // 山牆上的窗
    if (o.gableWin) {
      const [gw, gh, gt] = o.gableWin;
      for (const sx of [1, -1]) {
        const [gx, gz] = W(sx * (o.w / 2), 0);
        this.window(gw, gh, gx, y0 + o.h * 0.22, gz, ry + (sx * Math.PI) / 2, gt);
      }
    }
    const chimneys = o.chimneys ?? (o.w >= 40 && o.h >= 15 ? Math.round(o.w / 26) : 0);
    for (let i = 0; i < chimneys; i++) {
      const lx = (this.rng() - 0.5) * o.w * 0.8;
      const lz = (this.rng() - 0.5) * o.d * 0.4;
      const [cx, cz] = W(lx, lz);
      const ch = roofH * (1 - Math.abs(lz) / (o.d / 2)) + 2.5;
      this.box('stone', 1.3, ch, 1.3, cx, y0 + o.h, cz, ry, tint);
      this.box('stone', 1.6, 0.4, 1.6, cx, y0 + o.h + ch, cz, ry, tint);
    }
    for (let i = 0; i < (o.dormers ?? 0); i++) {
      const lx = ((i + 0.5) / o.dormers! - 0.5) * o.w * 0.8;
      for (const sz of [1, -1]) {
        const [dx, dz] = W(lx, sz * o.d * 0.3);
        const dy = y0 + o.h + roofH * 0.22;
        this.box('stone', 2, 2.4, 2.4, dx, dy, dz, ry, tint);
        this.gable('roof', 'stone', 2.4, 2, 1.4, dx, dy + 2.4, dz, ry + Math.PI / 2, 0.25, undefined, tint);
        const [wx, wz] = W(lx, sz * (o.d * 0.3 + 1.2));
        this.window(1.0, 1.7, wx, dy + 0.4, wz, ry + (sz === 1 ? 0 : Math.PI), 0, 0.05);
      }
    }
    return { roofY: y0 + o.h + roofH };
  }

  /**
   * 拱牆：一段有連續拱洞的牆（高架橋、迴廊都用它）。
   * 從 a 到 b，頂面高度 topY，拱的起拱點高度 springY。
   */
  archWall(key: MatKey, a: THREE.Vector3, b: THREE.Vector3, topY: number, springY: number, spans: number, pier: number, thick: number, pointed = 0.0, tint?: THREE.Color) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const span = len / spans;
    const ry = Math.atan2(-dz, dx);
    const R = (span - pier) / 2;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(pier / 2, 0);
    if (pointed > 0) {
      const apex = R * (1 + pointed);
      shape.bezierCurveTo(pier / 2, apex * 0.62, span / 2 - R * 0.42, apex * 0.9, span / 2, apex);
      shape.bezierCurveTo(span / 2 + R * 0.42, apex * 0.9, span - pier / 2, apex * 0.62, span - pier / 2, 0);
    } else {
      shape.absarc(span / 2, 0, R, Math.PI, 0, true);
    }
    shape.lineTo(span, 0);
    shape.lineTo(span, topY - springY);
    shape.lineTo(0, topY - springY);
    shape.closePath();
    for (let i = 0; i < spans; i++) {
      const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 10 });
      g.translate(0, 0, -thick / 2);
      const t = (i * span) / len;
      this.add(key, g, mat4(a.x + dx * t, springY, a.z + dz * t, ry), tint);
    }
    return { span, ry };
  }
}
