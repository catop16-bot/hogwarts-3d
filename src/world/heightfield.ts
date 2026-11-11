import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { makeRng, lerp, smoothstep, clamp } from '../core/globals';

/**
 * 世界座標：+X 東、+Y 上、+Z 南（北方是 -Z）。單位：公尺。
 * 城堡坐落在黑湖北岸的岩石岬角上，湖在南面與西面。
 */
export const PL = 70; // 城堡台地高度
export const WATER = 0; // 湖面高度

const n2 = createNoise2D(makeRng(20011116));
const n2b = createNoise2D(makeRng(777));

export function fbm(x: number, z: number, oct: number, gain = 0.5) {
  let a = 1;
  let f = 1;
  let s = 0;
  let t = 0;
  for (let i = 0; i < oct; i++) {
    s += n2(x * f, z * f) * a;
    t += a;
    a *= gain;
    f *= 2.03;
  }
  return s / t;
}
function ridged(x: number, z: number, oct: number) {
  let a = 1;
  let f = 1;
  let s = 0;
  let t = 0;
  let prev = 1;
  for (let i = 0; i < oct; i++) {
    let v = 1 - Math.abs(n2b(x * f, z * f));
    v *= v;
    s += v * a * prev;
    prev = v;
    t += a;
    a *= 0.5;
    f *= 2.1;
  }
  return s / t;
}
const ell = (x: number, z: number, cx: number, cz: number, rx: number, rz: number) => {
  const dx = (x - cx) / rx;
  const dz = (z - cz) / rz;
  return 1 - (dx * dx + dz * dz);
};

/** 城堡台地外框（順著岬角邊緣） */
export const PLATEAU: [number, number][] = [
  [-162, 134],
  [-40, 134],
  [20, 127],
  [90, 130],
  [150, 127],
  [176, 100],
  [186, 20],
  [212, -18],
  [214, -72],
  [190, -102],
  [152, -150],
  [135, -222],
  [45, -222],
  [36, -162],
  [-60, -152],
  [-135, -138],
  [-188, -92],
  [-192, -20],
  [-182, 40],
  [-184, 100],
];

export function sdPoly(x: number, z: number, poly: [number, number][]) {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a0 = poly[j][0];
    const a1 = poly[j][1];
    const b0 = poly[i][0];
    const b1 = poly[i][1];
    const ex = b0 - a0;
    const ez = b1 - a1;
    const wx = x - a0;
    const wz = z - a1;
    const t = clamp((wx * ex + wz * ez) / (ex * ex + ez * ez), 0, 1);
    const dx = wx - ex * t;
    const dz = wz - ez * t;
    d = Math.min(d, dx * dx + dz * dz);
    if (a1 > z !== b1 > z && x < ((b0 - a0) * (z - a1)) / (b1 - a1) + a0) inside = !inside;
  }
  return inside ? -Math.sqrt(d) : Math.sqrt(d);
}

/** 湖域：>0 表示在湖的範圍內 */
export function lakeField(x: number, z: number) {
  let f = Math.max(ell(x, z, -200, 900, 1600, 800), ell(x, z, -310, -50, 95, 650));
  f += fbm(x / 300, z / 300, 2) * 0.07;
  return f;
}

function baseHeight(x: number, z: number) {
  // 細節只保留在近處：遠處的地形網格較粗，高頻雜訊會變成鋸齒狀的假紋理
  const r = Math.hypot(x, z);
  const near = r < 760 ? 1 - smoothstep(520, 760, r) : 0;
  const mid = r < 3050 ? 1 - smoothstep(2500, 3050, r) : 0;
  let hills = fbm(x / 1100, z / 1100, 3) * 46 + n2(x / 260 + 7, z / 260 - 3) * 7;
  if (mid > 0) hills += (n2(x / 128 + 3, z / 128 + 9) * 3.5 + n2(x / 63 - 5, z / 63 + 2) * 1.7) * mid;
  if (near > 0) hills += (n2(x / 31, z / 31) * 0.9 + n2(x / 55 + 1, z / 55) * 1.2 + n2(x / 27, z / 27 + 4) * 0.6 + n2(x / 14 + 8, z / 14) * 0.3) * near;
  const dc = Math.hypot(x + 200, z - 300);
  const mm = smoothstep(1500, 5200, dc);
  const mount = mm > 0 ? (Math.pow(ridged(x / 5200 + 3.1, z / 5200 - 1.7, 5), 1.3) * 1050 + fbm(x / 1700 + 9, z / 1700 + 4, 3) * 170) * mm * mm + mm * 120 : 0;
  let h = 52 + hills + mount;
  const t = smoothstep(-0.12, 0.3, lakeField(x, z));
  h = lerp(h, -30, t);
  return h;
}

type Stamp = { x: number; z: number; r: number; fall: number; h: number; rock?: number };
/** 把地形整平到指定高度的圓形區域 */
export const STAMPS: Record<string, Stamp> = {
  westBluff: { x: -452, z: 72, r: 46, fall: 55, h: 69 },
  stoneCircle: { x: 372, z: -55, r: 34, fall: 42, h: 69 },
  willow: { x: 312, z: -238, r: 16, fall: 40, h: 67 },
  hagrid: { x: 482, z: 140, r: 32, fall: 60, h: 24 },
  pitch: { x: 380, z: -690, r: 112, fall: 90, h: 48 },
  owlery: { x: -150, z: -380, r: 12, fall: 27, h: 92, rock: 1 },
  boathouse: { x: -190, z: 158, r: 12, fall: 9, h: 1.3 },
  hogsmeade: { x: -1000, z: -1130, r: 230, fall: 220, h: 58 },
  station: { x: -565, z: -742, r: 85, fall: 80, h: 16 },
  dock: { x: -322, z: -664, r: 9, fall: 14, h: 1.3 },
  shack: { x: -1390, z: -1430, r: 30, fall: 130, h: 104 },
};
const STAMP_LIST = Object.values(STAMPS);

// 東側深谷（木橋橫跨其上），由北向南流入黑湖
const RAVINE: [number, number, number][] = [
  [252, -270, 56],
  [266, -150, 42],
  [272, -50, 28],
  [266, 60, 14],
  [280, 170, 2],
  [302, 270, -6],
];
// 鐵道高架橋所在的峽谷（西方遠處）
const GLEN: [number, number, number][] = [
  [-2040, -40, 34],
  [-1930, 180, 22],
  [-1850, 330, 12],
  [-1740, 540, 4],
  [-1640, 760, -6],
];

function carve(x: number, z: number, h: number, line: [number, number, number][], flat: number, slope: number, pad: number) {
  let best = Infinity;
  let floor = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1);
    const d = Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
    if (d < best) {
      best = d;
      floor = lerp(a[2], b[2], t);
    }
  }
  if (best > pad) return h;
  const rh = floor + Math.max(0, best - flat) * slope + fbm(x / 22, z / 22, 2) * 2.5;
  // 平滑取最小值
  const k = 10;
  const hh = clamp(0.5 + (0.5 * (rh - h)) / k, 0, 1);
  return lerp(rh, h, hh) - k * hh * (1 - hh);
}

function heightNoPaths(x: number, z: number) {
  let h = baseHeight(x, z);
  if (x < -1300 && x > -2400) h = carve(x, z, h, GLEN, 40, 0.42, 320);
  // 城堡台地
  if (x > -420 && x < 460 && z > -460 && z < 380) {
    const sd = sdPoly(x, z, PLATEAU);
    if (sd < 160) {
      const dl = Math.hypot(x - 20, z + 20) || 1;
      const dot = (((x - 20) / dl) * 0.35 + ((z + 20) / dl) * -0.94) * 0.5 + 0.5;
      const w = lerp(26, 150, smoothstep(0.45, 0.85, dot));
      const k = 1 - smoothstep(0, w, sd);
      h = lerp(h, PL, k);
      h += fbm(x / 16, z / 16, 3) * 7 * k * (1 - k) * 4 * (w < 60 ? 1 : 0.25);
    }
  }
  for (const s of STAMP_LIST) {
    const dx = x - s.x;
    const dz = z - s.z;
    const lim = s.r + s.fall;
    if (dx > lim || dx < -lim || dz > lim || dz < -lim) continue;
    const d = Math.hypot(dx, dz);
    if (d >= lim) continue;
    const k = 1 - smoothstep(s.r, lim, d);
    h = lerp(h, s.h, k);
    if (s.rock) h += fbm(x / 9, z / 9, 3) * 6 * k * (1 - k) * 4;
  }
  if (x > 150 && x < 420 && z > -340 && z < 330) h = carve(x, z, h, RAVINE, 9, 1.55, 110);
  return h;
}

// ------------------------------------------------------------------ 道路／鐵道
export type PathKind = 'road' | 'trail' | 'rail';
export interface PathDef {
  name: string;
  kind: PathKind;
  pts: [number, number][];
  width: number;
  fall: number;
  smooth: number; // 高度平滑視窗（公尺）
  bridge?: [number, number]; // 以弧長比例表示、不整地的區段（高架橋）
  endH?: [number | null, number | null]; // 兩端固定高度
}
export interface BuiltPath {
  def: PathDef;
  n: number;
  spacing: number;
  length: number;
  x: Float32Array;
  z: Float32Array;
  h: Float32Array;
  bridgeIdx?: [number, number];
}

export const PATH_DEFS: PathDef[] = [
  {
    name: 'road',
    kind: 'road',
    width: 5,
    fall: 9,
    smooth: 70,
    endH: [69.6, null],
    pts: [
      [-404, 72],
      [-455, 66],
      [-515, -60],
      [-552, -290],
      [-585, -520],
      [-552, -690],
      [-488, -752],
      [-462, -812],
      [-540, -868],
      [-700, -960],
      [-880, -1070],
      [-1000, -1130],
      [-1140, -1230],
      [-1270, -1340],
      [-1372, -1420],
    ],
  },
  {
    name: 'hagrid',
    kind: 'trail',
    width: 2.6,
    fall: 6,
    smooth: 22,
    endH: [69, null],
    pts: [
      [338, -52],
      [362, -44],
      [392, -22],
      [418, 20],
      [440, 70],
      [462, 112],
      [476, 128],
    ],
  },
  {
    name: 'pitch',
    kind: 'trail',
    width: 3.2,
    fall: 8,
    smooth: 40,
    endH: [69.5, null],
    pts: [
      [92, -218],
      [120, -300],
      [200, -420],
      [290, -560],
      [340, -640],
    ],
  },
  {
    name: 'owlery',
    kind: 'trail',
    width: 2.2,
    fall: 5,
    smooth: 16,
    endH: [69.5, null],
    pts: [
      [-40, -150],
      [-70, -230],
      [-112, -310],
      [-136, -356],
      [-146, -374],
    ],
  },
  {
    name: 'dock',
    kind: 'trail',
    width: 2.4,
    fall: 6,
    smooth: 30,
    pts: [
      [-520, -720],
      [-440, -690],
      [-370, -668],
      [-330, -664],
    ],
  },
  {
    name: 'rail',
    kind: 'rail',
    width: 9,
    fall: 16,
    smooth: 420,
    bridge: [0.345, 0.475],
    pts: [
      [-3900, 1750],
      [-3300, 1400],
      [-2700, 880],
      [-2260, 560],
      [-2060, 436],
      [-1850, 316],
      [-1640, 196],
      [-1320, -80],
      [-1020, -390],
      [-770, -636],
      [-600, -736],
      [-505, -790],
    ],
  },
];

let built: BuiltPath[] | null = null;
const grid = new Map<number, number[]>(); // cell -> [pathIdx, sampleIdx, ...]
const CELL = 40;
const cellKey = (cx: number, cz: number) => (cx + 2048) * 4096 + (cz + 2048);

function buildPaths() {
  built = [];
  PATH_DEFS.forEach((def, pi) => {
    const curve = new THREE.CatmullRomCurve3(
      def.pts.map((p) => new THREE.Vector3(p[0], 0, p[1])),
      false,
      'centripetal',
    );
    const length = curve.getLength();
    const spacing = def.kind === 'rail' ? 8 : 4;
    const n = Math.max(2, Math.round(length / spacing) + 1);
    const pts = curve.getSpacedPoints(n - 1);
    const x = new Float32Array(n);
    const z = new Float32Array(n);
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = pts[i].x;
      z[i] = pts[i].z;
      raw[i] = Math.max(heightNoPaths(x[i], z[i]), WATER + 1.2);
    }
    let bridgeIdx: [number, number] | undefined;
    if (def.bridge) {
      bridgeIdx = [Math.round(def.bridge[0] * (n - 1)), Math.round(def.bridge[1] * (n - 1))];
      const [a, b] = bridgeIdx;
      for (let i = a; i <= b; i++) raw[i] = lerp(raw[a], raw[b], (i - a) / (b - a));
    }
    const h = new Float32Array(n);
    const win = Math.max(1, Math.round(def.smooth / spacing / 2));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        let s = 0;
        let c = 0;
        for (let k = -win; k <= win; k++) {
          const j = clamp(i + k, 0, n - 1);
          s += raw[j];
          c++;
        }
        h[i] = s / c;
      }
      raw.set(h);
    }
    if (def.endH) {
      const blend = Math.min(n - 1, Math.round(60 / spacing));
      if (def.endH[0] != null) for (let i = 0; i <= blend; i++) h[i] = lerp(def.endH[0], h[i], smoothstep(0, blend, i));
      if (def.endH[1] != null) for (let i = 0; i <= blend; i++) h[n - 1 - i] = lerp(def.endH[1], h[n - 1 - i], smoothstep(0, blend, i));
    }
    built!.push({ def, n, spacing, length, x, z, h, bridgeIdx });
    const reach = def.width / 2 + def.fall + spacing;
    for (let i = 0; i < n; i++) {
      if (bridgeIdx && i > bridgeIdx[0] && i < bridgeIdx[1]) continue;
      const c0x = Math.floor((x[i] - reach) / CELL);
      const c1x = Math.floor((x[i] + reach) / CELL);
      const c0z = Math.floor((z[i] - reach) / CELL);
      const c1z = Math.floor((z[i] + reach) / CELL);
      for (let cx = c0x; cx <= c1x; cx++)
        for (let cz = c0z; cz <= c1z; cz++) {
          const key = cellKey(cx, cz);
          let arr = grid.get(key);
          if (!arr) grid.set(key, (arr = []));
          arr.push(pi, i);
        }
    }
  });
}

export function getPaths(): BuiltPath[] {
  if (!built) buildPaths();
  return built!;
}
export function getPath(name: string) {
  return getPaths().find((p) => p.def.name === name)!;
}

/** 回傳離 (x,z) 最近的路徑資訊：距離與該處路面高度 */
function nearestPath(x: number, z: number, out: { d: number; h: number; half: number; fall: number; kind: PathKind | null }) {
  out.kind = null;
  out.d = Infinity;
  const arr = grid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!arr) return;
  let bestScore = Infinity;
  for (let k = 0; k < arr.length; k += 2) {
    const p = built![arr[k]];
    const i = arr[k + 1];
    const j = Math.min(i + 1, p.n - 1);
    const ex = p.x[j] - p.x[i];
    const ez = p.z[j] - p.z[i];
    const l2 = ex * ex + ez * ez || 1;
    const t = clamp(((x - p.x[i]) * ex + (z - p.z[i]) * ez) / l2, 0, 1);
    const d = Math.hypot(x - p.x[i] - ex * t, z - p.z[i] - ez * t);
    const score = d - p.def.width / 2;
    if (score < bestScore) {
      bestScore = score;
      out.d = d;
      out.h = lerp(p.h[i], p.h[j], t);
      out.half = p.def.width / 2;
      out.fall = p.def.fall;
      out.kind = p.def.kind;
    }
  }
}

const tmpNear = { d: 0, h: 0, half: 0, fall: 0, kind: null as PathKind | null };

/** 最終地形高度 */
export function heightAt(x: number, z: number) {
  if (!built) buildPaths();
  let h = heightNoPaths(x, z);
  nearestPath(x, z, tmpNear);
  if (tmpNear.kind) {
    const k = 1 - smoothstep(tmpNear.half, tmpNear.half + tmpNear.fall, tmpNear.d);
    h = lerp(h, tmpNear.h - (tmpNear.kind === 'rail' ? 0.5 : 0.05), k);
  }
  return h;
}

/** 地面高度（水面以下回傳水面） */
export const groundAt = (x: number, z: number) => Math.max(heightAt(x, z), WATER);

export function normalAt(x: number, z: number, eps = 1.5, out = new THREE.Vector3()) {
  const hx = heightAt(x + eps, z) - heightAt(x - eps, z);
  const hz = heightAt(x, z + eps) - heightAt(x, z - eps);
  return out.set(-hx, 2 * eps, -hz).normalize();
}

/** 森林密度：forbidden = 禁忌森林，wood = 其他零星林地 */
export function forestDensity(x: number, z: number) {
  let f = ell(x, z, 1260, 300, 790, 1300);
  f = smoothstep(-0.04, 0.22, f + fbm(x / 210, z / 210, 2) * 0.13);
  f *= smoothstep(44, 80, Math.hypot(x - 482, z - 140));
  f *= smoothstep(150, 215, Math.hypot(x - 380, z + 690));
  f *= smoothstep(60, 100, Math.hypot(x - 372, z + 55));
  let w = smoothstep(0.18, 0.5, fbm(x / 520 + 11, z / 520 + 5, 3)) * 0.6;
  const sd = x > -500 && x < 520 && z > -520 && z < 420 ? sdPoly(x, z, PLATEAU) : 999;
  const castleClear = smoothstep(90, 230, sd);
  w *= castleClear;
  f *= smoothstep(20, 80, sd);
  w *= smoothstep(260, 420, Math.hypot(x + 1000, z + 1130));
  w *= smoothstep(120, 180, Math.hypot(x + 565, z + 742));
  w *= smoothstep(150, 230, Math.hypot(x - 380, z + 690));
  w *= 1 - f;
  return { forbidden: f, wood: w };
}

export function onPath(x: number, z: number) {
  nearestPath(x, z, tmpNear);
  return tmpNear.kind ? tmpNear.d - tmpNear.half : Infinity;
}
