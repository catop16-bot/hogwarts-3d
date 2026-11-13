import * as THREE from 'three';
import { mat4, type Builder } from '../kit';
import { heightAt, getPath, STAMPS } from '../../world/heightfield';
import { samplePath } from '../grounds';
import { PL } from '../../world/heightfield';
import type { DoorEnd } from './registry';

const F = PL + 0.5;
const ASTRO = { x: -118, z: -92, deck: PL + 30 + 84 + 0.6 };

/** 位在既有建築上、通往獨立場景的門 */
export const DOORS = {
  /** 入口大廳南牆：往地窖的樓梯 */
  dungeon: { pos: [-72, F, 95.8], face: Math.PI, name: '入口大廳' } as DoorEnd,
  /** 一樓走廊西牆 */
  transfiguration: { pos: [-8, F, 26], face: Math.PI / 2, name: '一樓走廊' } as DoorEnd,
  /** 一樓走廊西牆：愛哭鬼麥朵的廁所 */
  myrtle: { pos: [-8, F, 55.5], face: Math.PI / 2, name: '一樓走廊' } as DoorEnd,
  /** 一樓走廊東牆：獨眼女巫的雕像 */
  witch: { pos: [2, F, 20], face: -Math.PI / 2, name: '一樓走廊' } as DoorEnd,
  /** 北塔塔底 */
  divination: { pos: [62, PL, -119.55], face: 0, name: '北塔塔底' } as DoorEnd,
  /** 雷文克勞塔塔底（東面） */
  ravenclaw: { pos: [-155.8, PL, -38], face: Math.PI / 2, name: '雷文克勞塔塔底' } as DoorEnd,
  /** 天文塔塔底（西面）與塔頂 */
  astronomyBase: { pos: [-135.4, PL, -96], face: -Math.PI / 2, name: '天文塔塔底' } as DoorEnd,
  astronomyDeck: { pos: [ASTRO.x, ASTRO.deck, ASTRO.z + 6.65], face: 0, name: '天文塔觀星台' } as DoorEnd,
};
export { ASTRO };

/** 在牆上畫一扇木門 */
export function doorDecal(b: Builder, d: DoorEnd, w = 2.2, h = 3.4, push = 0.06) {
  b.window(w, h, d.pos[0], d.pos[1], d.pos[2], d.face, 4, push);
}

/** 圓塔塔底的門：先砌一座凸出基座的石門廊，門才不會被基座擋住 */
export function towerDoor(b: Builder, d: DoorEnd, w = 2, h = 3.2, depth = 2.4, tint?: Parameters<Builder['box']>[8]) {
  const nx = Math.sin(d.face);
  const nz = Math.cos(d.face);
  const tx = Math.cos(d.face);
  const tz = -Math.sin(d.face);
  const cx = d.pos[0] - (nx * depth) / 2;
  const cz = d.pos[2] - (nz * depth) / 2;
  const y = d.pos[1];
  const W = w + 1.2;
  // 門廊本體、基座與山牆屋頂（山牆朝外）
  b.box('stone', W, 4.9, depth, cx, y - 0.5, cz, d.face, tint);
  b.box('stone', W + 0.5, 0.9, depth + 0.25, cx + nx * 0.1, y - 0.5, cz + nz * 0.1, d.face, tint);
  b.gable('roof', 'stone', depth + 0.5, W, 1.9, cx, y + 4.4, cz, d.face - Math.PI / 2, 0.3, undefined, tint);
  // 兩側的小扶壁與尖飾
  for (const s of [-1, 1]) {
    const bx = d.pos[0] + tx * s * (W / 2 + 0.1) - nx * 0.25;
    const bz = d.pos[2] + tz * s * (W / 2 + 0.1) - nz * 0.25;
    b.box('stone', 0.55, 3.9, 0.9, bx, y - 0.5, bz, d.face, tint);
    b.box('stone', 0.45, 1.2, 0.6, bx - nx * 0.12, y + 3.4, bz - nz * 0.12, d.face, tint);
    b.pinnacle(bx - nx * 0.12, y + 4.6, bz - nz * 0.12, 0.5, tint);
  }
  // 門洞上方的尖拱線腳、門前的石階
  for (const s of [-1, 1]) {
    b.add('stone', new THREE.BoxGeometry(0.16, w * 0.75, 0.18), mat4(d.pos[0] + tx * s * w * 0.27 + nx * 0.05, y + h + 0.12, d.pos[2] + tz * s * w * 0.27 + nz * 0.05, d.face, 0, s * 0.82), tint);
  }
  b.box('stone', W + 0.4, 0.14, 1.0, d.pos[0] + nx * 0.5, y - 0.02, d.pos[2] + nz * 0.5, d.face, tint);
  doorDecal(b, d, w, h, 0.06);
}

let honey: DoorEnd | null = null;
/** 活米村街邊蜂蜜公爵的地窖口：位置取自道路最靠近村子中心的那一點 */
export function honeydukesDoor(): DoorEnd {
  if (honey) return honey;
  const road = getPath('road');
  const hs = STAMPS.hogsmeade;
  const p = new THREE.Vector3();
  const d = new THREE.Vector3();
  let best = 0;
  let bd = Infinity;
  for (let s = 0; s < road.length; s += 2) {
    samplePath(road, s, p);
    const dist = Math.hypot(p.x - hs.x, p.z - hs.z);
    if (dist < bd) {
      bd = dist;
      best = s;
    }
  }
  // 往旁邊挪半格，落在兩棟房子之間
  samplePath(road, best + 5.75, p, d);
  const x = p.x + d.z * 5.2;
  const z = p.z - d.x * 5.2;
  honey = { pos: [x, heightAt(x, z), z], face: Math.atan2(-d.z, d.x), name: '活米村' };
  return honey;
}

export interface WingShape {
  x: number;
  z: number;
  w: number;
  d: number;
  ry?: number;
  y?: number;
}
/**
 * 廂房外牆上的門：side 是廂房自己的方向（S=+Z、N=-Z、E=+X、W=-X），along 是沿牆的位置。
 * 回傳的 DoorEnd 面向屋外（從門走出來的方向）。
 */
export function wingDoor(b: Builder | null, o: WingShape, side: 'N' | 'S' | 'E' | 'W', along: number, name: string, w = 2, h = 3.2, off = 0.46): DoorEnd {
  const ry = o.ry ?? 0;
  const [lx, lz, a] =
    side === 'S' ? [along, o.d / 2 + off, 0] : side === 'N' ? [along, -o.d / 2 - off, Math.PI] : side === 'E' ? [o.w / 2 + off, along, Math.PI / 2] : [-o.w / 2 - off, along, -Math.PI / 2];
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const x = o.x + lx * c + lz * s;
  const z = o.z - lx * s + lz * c;
  const d: DoorEnd = { pos: [x, o.y ?? PL, z], face: ry + a, name };
  if (b) doorDecal(b, d, w, h, 0.04);
  return d;
}

/** 渾拍柳樹根部的地道口（朝城堡那一側） */
export const WILLOW_DOOR: DoorEnd = (() => {
  const x = STAMPS.willow.x - 3.4;
  const z = STAMPS.willow.z;
  return { pos: [x, heightAt(x, z), z], face: -Math.PI / 2, name: '渾拍柳樹', sign: false };
})();

/** 尖叫屋一樓的正門 */
export const SHACK_SHAPE: WingShape = (() => {
  const sh = STAMPS.shack;
  return { x: sh.x, z: sh.z, w: 10, d: 8, ry: 0.1, y: heightAt(sh.x, sh.z) };
})();
export const SHACK_DOOR: DoorEnd = wingDoor(null, SHACK_SHAPE, 'S', 2.6, '尖叫屋', 1.6, 2.6, 0.03);

/** 魁地奇球場兩座看台塔底的更衣室門：由 grounds.ts 建看台時填入 */
export const PITCH_DOORS: DoorEnd[] = [];
