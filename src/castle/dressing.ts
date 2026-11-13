import * as THREE from 'three';
import { Builder, col, mat4, KEEP_CLEAR } from './kit';
import { getMaterials } from './materials';
import { PL, heightAt, sdPoly, PLATEAU } from '../world/heightfield';
import { makeRng } from '../core/globals';
import type { CollisionWorld } from '../player/collision';

const PAVE = col(0.8, 0.78, 0.74);
const KERB = col(0.66, 0.65, 0.62);
const STONE = col(0.95, 0.93, 0.88);
const IRON = col(0.04, 0.04, 0.045);
const LAMP = col(1, 0.62, 0.25);
const W = 3;

/** 台地上的石板步道（折線）。拱廊牆的位置取拱洞正中 */
const PATHS: [number, number][][] = [
  // 西南草地：石像鬼塔門、教職員休息室，往西北接雷文克勞塔
  [[-74, 36], [-98, 36], [-125, 36], [-125, 10], [-115, -10]],
  [[-98, 36], [-98, 29.5]],
  [[-74, 36], [-74, 25.5]],
  [[-115, -10], [-150, -38]],
  // 西北草地到北翼前的東西向主道（穿過兩道拱廊牆）
  [[-115, -10], [-70, -10], [-70, -92]],
  [[-84, -92], [-36, -92.2], [20, -91.75], [40, -92]],
  // 中段草地
  [[-22, -92], [-22, -8]],
  // 東北：往黑魔法防禦術塔、東側圓塔與鐘樓
  [[40, -92], [52, -70], [66, -31], [84, -31], [118, -37], [140, -40]],
  // 南側草地：大樓梯塔東邊到葛來分多塔
  [[-20, 100], [20, 100], [60, 100], [96, 100]],
  [[20, 100], [20, 112]],
  [[60, 100], [60, 88]],
  // 東側草地：醫院廂房前
  [[166, 60], [166, 30], [166, -14]],
];

/** 庭院：噴泉周圍擺長椅與燈 */
const COURTS: [number, number, number][] = [
  [-138, 76, 9],
  [30, 42, 9.5],
  [182, -48, 8.5],
];

export interface Dressing {
  group: THREE.Group;
  /** 要交給森林一起種的樹：x, z, 高度, 是否針葉 */
  trees: [number, number, number, boolean][];
}

export function buildDressing(world: CollisionWorld): Dressing {
  const b = new Builder(5150);
  const rng = makeRng(5151);
  /** 這一點上方有沒有建築、鋪面或城牆 */
  const blocked = (x: number, z: number) => {
    const g = heightAt(x, z);
    const f = world.floorBelow(x, g + 60, z, 59.75);
    return f != null;
  };
  const nearDoor = (x: number, z: number, r: number) => KEEP_CLEAR.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < r);

  // ------------------------------------------------------------ 步道
  const segs: [number, number, number, number][] = [];
  const slabs: [number, number][] = [];
  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      const [x0, z0] = path[i];
      const [x1, z1] = path[i + 1];
      segs.push([x0, z0, x1, z1]);
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2.2));
      const ry = Math.atan2(-(z1 - z0), x1 - x0);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        if (blocked(x, z)) continue;
        const y = heightAt(x, z);
        // 每塊石板寬窄、明暗略有不同，邊緣不整齊
        const w = W + (rng() - 0.5) * 0.3;
        const shade = 0.9 + rng() * 0.2;
        b.box('stone', len / n - 0.06, 0.16, w, x, y - 0.08, z, ry, PAVE.clone().multiplyScalar(shade));
        for (const s of [-1, 1]) b.box('stone', len / n - 0.02, 0.2, 0.22, x + Math.sin(ry) * s * (w / 2 + 0.1), y - 0.08, z + Math.cos(ry) * s * (w / 2 + 0.1), ry, KERB);
        slabs.push([x, z]);
      }
    }
    // 轉折處鋪一塊圓石
    for (const [x, z] of path) if (!blocked(x, z)) b.cyl('stone', W / 2 + 0.25, W / 2 + 0.25, 0.17, x, heightAt(x, z) - 0.08, z, 10, PAVE);
  }
  const pathDist = (x: number, z: number) => {
    let best = Infinity;
    for (const [x0, z0, x1, z1] of segs) {
      const dx = x1 - x0;
      const dz = z1 - z0;
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - x0 - dx * t, z - z0 - dz * t));
    }
    return best;
  };

  // ------------------------------------------------------------ 小物
  const lamp = (x: number, z: number) => {
    const y = heightAt(x, z);
    b.box('stone', 0.5, 0.5, 0.5, x, y - 0.1, z, 0, STONE);
    b.cyl('matte', 0.06, 0.09, 3.1, x, y + 0.4, z, 6, IRON);
    b.box('matte', 0.42, 0.06, 0.42, x, y + 3.5, z, 0, IRON);
    b.sphere('lamp', 0.24, x, y + 3.82, z, LAMP);
    b.cone('matte', 0.34, 0.3, x, y + 4.02, z, 4, IRON, Math.PI / 4);
  };
  /** 石長椅：正面朝 ry */
  const bench = (x: number, z: number, ry: number) => {
    const y = heightAt(x, z);
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    b.box('stone', 2.2, 0.16, 0.62, x, y + 0.42, z, ry, STONE);
    for (const k of [-1, 1]) b.box('stone', 0.24, 0.5, 0.56, x + c * k * 0.85, y - 0.08, z - s * k * 0.85, ry, STONE);
  };
  const urn = (x: number, z: number) => {
    const y = heightAt(x, z);
    b.box('stone', 0.8, 0.6, 0.8, x, y - 0.1, z, 0, STONE);
    b.cyl('stone', 0.18, 0.26, 0.3, x, y + 0.5, z, 8, STONE);
    b.cyl('stone', 0.42, 0.2, 0.5, x, y + 0.8, z, 10, STONE);
    b.cyl('stone', 0.46, 0.46, 0.08, x, y + 1.3, z, 10, STONE);
  };
  /** 披著長袍的石像，立在基座上 */
  const statue = (x: number, z: number, ry: number) => {
    const y = heightAt(x, z);
    b.box('stone', 1.5, 0.3, 1.5, x, y - 0.1, z, ry, STONE);
    b.box('stone', 1.1, 1.3, 1.1, x, y + 0.2, z, ry, STONE);
    b.box('stone', 1.3, 0.16, 1.3, x, y + 1.5, z, ry, STONE);
    b.cyl('stone', 0.22, 0.46, 1.5, x, y + 1.66, z, 8, STONE);
    b.cyl('stone', 0.3, 0.24, 0.5, x, y + 3.16, z, 8, STONE);
    b.sphere('stone', 0.2, x, y + 3.9, z, STONE);
    b.cone('stone', 0.24, 0.5, x, y + 4.0, z, 8, STONE);
    b.add('stone', new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), mat4(x + Math.cos(ry) * 0.42, y + 2.9, z - Math.sin(ry) * 0.42, 0, 0.06, 0.08), STONE);
  };
  const sundial = (x: number, z: number) => {
    const y = heightAt(x, z);
    b.cyl('stone', 1.3, 1.4, 0.24, x, y - 0.08, z, 12, PAVE);
    b.cyl('stone', 0.28, 0.4, 1.0, x, y + 0.16, z, 8, STONE);
    b.cyl('stone', 0.62, 0.62, 0.1, x, y + 1.16, z, 14, STONE);
    b.add('matte', new THREE.ConeGeometry(0.03, 0.6, 3), mat4(x, y + 1.42, z, 0.4, 0.9, 0), col(0.5, 0.36, 0.12));
  };

  // 沿步道：燈柱與長椅交錯，都擺在步道外側
  let acc = 9;
  let side = 1;
  let item = 0;
  for (const [x0, z0, x1, z1] of segs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / len;
    const uz = (z1 - z0) / len;
    for (let d = acc; d < len; d += 13) {
      const px = x0 + ux * d;
      const pz = z0 + uz * d;
      const off = W / 2 + 1.0;
      const x = px - uz * side * off;
      const z = pz + ux * side * off;
      side = -side;
      if (blocked(x, z) || blocked(px, pz) || nearDoor(x, z, 4)) continue;
      // 四周一公尺內要是空的，免得卡進牆裡
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => blocked(x + a * 1.1, z + c * 1.1))) continue;
      if (item++ % 3 === 2) bench(x, z, Math.atan2(px - x, pz - z));
      else lamp(x, z);
    }
    acc = (acc + 13 - (len % 13)) % 13;
  }
  // 步道的端點與幾個路口：石甕、石像與日晷
  for (const [x, z, ry] of [[-128.5, 39.5, 2.3], [-118.5, -13.5, 0.8], [-73.5, -95.5, 0.4], [43.5, -95.5, -0.6], [-23.5, 103.5, 1.2]] as const) if (!blocked(x, z)) statue(x, z, ry);
  for (const [x, z] of [[-101.5, 39.5], [-94.5, 39.5], [-25.5, -6], [-18.5, -6], [99.5, 97], [99.5, 103], [163, -17], [169, -17]]) if (!blocked(x, z)) urn(x, z);
  if (!blocked(-48, 110)) sundial(-48, 110);
  if (!blocked(-100, -40)) sundial(-100, -40);

  // 庭院：噴泉四周的長椅與四角的燈
  for (const [cx, cz, r] of COURTS) {
    for (let k = 0; k < 4; k++) {
      const a = k * (Math.PI / 2) + Math.PI / 4;
      const x = cx + Math.sin(a) * r;
      const z = cz + Math.cos(a) * r;
      const y = heightAt(x, z) + 0.25;
      const ry = a + Math.PI;
      b.box('stone', 2.2, 0.16, 0.62, x, y + 0.42, z, ry, STONE);
      for (const s of [-1, 1]) b.box('stone', 0.24, 0.5, 0.56, x + Math.cos(ry) * s * 0.85, y - 0.08, z - Math.sin(ry) * s * 0.85, ry, STONE);
    }
    for (let k = 0; k < 4; k++) {
      const a = k * (Math.PI / 2);
      const x = cx + Math.sin(a) * (r + 3.5);
      const z = cz + Math.cos(a) * (r + 3.5);
      const y = PL + 0.2;
      b.cyl('matte', 0.06, 0.09, 3.1, x, y, z, 6, IRON);
      b.box('matte', 0.42, 0.06, 0.42, x, y + 3.1, z, 0, IRON);
      b.sphere('lamp', 0.24, x, y + 3.42, z, LAMP);
    }
  }

  // ------------------------------------------------------------ 樹：台地的空地上零星幾棵
  const trees: Dressing['trees'] = [];
  const STEP = 15;
  for (let gz = -128; gz <= 122; gz += STEP) {
    for (let gx = -172; gx <= 178; gx += STEP) {
      const x = gx + rng() * STEP;
      const z = gz + rng() * STEP;
      const keep = rng();
      const size = rng();
      const pine = rng() < 0.2;
      if (keep > 0.5) continue;
      if (sdPoly(x, z, PLATEAU) > -9) continue;
      if (pathDist(x, z) < 7 || nearDoor(x, z, 9)) continue;
      // 樹冠的範圍內不能有建築
      const R = 5.5;
      if (blocked(x, z) || [0, 1, 2, 3, 4, 5, 6, 7].some((k) => blocked(x + Math.cos(k * 0.785) * R, z + Math.sin(k * 0.785) * R))) continue;
      trees.push([x, z, pine ? 11 + size * 6 : 7.5 + size * 4.5, pine]);
    }
  }

  const group = b.build('dressing', getMaterials());
  group.userData.slabs = slabs.length;
  return { group, trees };
}
