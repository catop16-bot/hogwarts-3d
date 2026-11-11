import * as THREE from 'three';
import type { Builder } from '../kit';
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
  b.box('stone', w + 1.2, 4.9, depth, d.pos[0] - (nx * depth) / 2, d.pos[1] - 0.5, d.pos[2] - (nz * depth) / 2, d.face, tint);
  b.box('stone', w + 1.8, 0.4, depth - 0.1, d.pos[0] - (nx * depth) / 2, d.pos[1] + 4.4, d.pos[2] - (nz * depth) / 2, d.face, tint);
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
