import * as THREE from 'three';
import { Builder, col, mat4 } from '../kit';
import { getMaterials } from '../materials';
import { PL } from '../../world/heightfield';
import { room, pane, torch, flight, landingDoor, GOLD, IRON, FIRE, DARKWOOD, MARBLE, IWARM, WARM } from '../interiors';
import { At, roundRoom, door, bookshelf, table, chair, armchair, fireplace, chandelier, portrait, studentDesk, blackboard, cauldron, potionShelf, roundTable, pouf, deskLamp, STEEL, WHITE, BLACK } from './kit';
import { registerScene, link, box3, pocketOrigin, type DoorEnd } from './registry';
import { DOORS, ASTRO } from './doors';

const Y = PL;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const RED = col(0.42, 0.04, 0.04);
const DUNGEON = col(0.62, 0.66, 0.72);

/** 地窖走廊上還沒接場景的門，留給之後的批次 */
export const DUNGEON_DOORS: Record<string, DoorEnd> = {};

// ================================================================== 溫室（改建第一間玻璃溫室）
/** v：0 一號溫室（魔蘋果）、1 二號溫室（一年級的藥草）、2 三號溫室（危險植物） */
export function greenhouseInterior(b: Builder, gx: number, gz: number, v = 0) {
  const GT = col(0.9, 1.0, 0.95);
  const y = Y + 0.9;
  const hw = 17.5;
  const hd = 4.7;
  // 四面玻璃牆，西端留門
  b.box('glass', 35, 3.6, 0.12, gx, y, gz - hd, 0, GT);
  b.box('glass', 35, 3.6, 0.12, gx, y, gz + hd, 0, GT);
  b.box('glass', 0.12, 3.6, 9.4, gx + hw, y, gz, 0, GT);
  for (const s of [-1, 1]) b.box('glass', 0.12, 3.6, 3.6, gx - hw, y, gz + s * 2.9, 0, GT);
  b.box('glass', 0.12, 1.0, 2.2, gx - hw, y + 2.6, gz, 0, GT);
  b.gable('glass', 'glass', 35, 9.4, 3.4, gx, Y + 4.5, gz, 0, 0.15, GT, GT);
  b.box('stone', 2, 0.45, 3.4, gx - hw - 1.4, Y, gz, 0, WARM);
  const SOIL = col(0.1, 0.07, 0.05);
  const POT = col(0.5, 0.22, 0.12);
  const LEAF = [col(0.08, 0.3, 0.07), col(0.14, 0.36, 0.08), col(0.05, 0.22, 0.1)];
  const rng = b.rng;
  // 兩側的長花台與中央的苗床
  for (const s of [-1, 1]) {
    const p = new At(b, gx + 1, y, gz + s * 3.6);
    p.box('iwood', 30, 0.08, 1.2, 0, 0.82, 0);
    for (let i = 0; i < 9; i++) for (const k of [-1, 1]) p.box('iwood', 0.1, 0.82, 0.1, -14.5 + i * 3.6, 0, k * 0.5);
    for (let i = 0; i < 26; i++) {
      const x = -14.2 + i * 1.12;
      const q = p.at(x, 0.9, (rng() - 0.5) * 0.4);
      q.cyl('iplain', 0.2, 0.15, 0.3, 0, 0, 0, 8, POT);
      q.cyl('iplain', 0.18, 0.18, 0.02, 0, 0.29, 0, 8, SOIL);
      if (v === 1 && i % 2 === 0) {
        // 巴波塊莖：黑綠色、長滿發亮膿包的矮胖植物
        q.cyl('iplain', 0.12, 0.15, 0.3, 0, 0.3, 0, 7, col(0.06, 0.12, 0.05));
        for (let k = 0; k < 4; k++) q.sphere('iglow', 0.035, Math.cos(k * 1.6) * 0.12, 0.45 + k * 0.04, Math.sin(k * 1.6) * 0.12, col(1.2, 1.1, 0.2));
      } else if (v === 1) {
        // 長著小尖牙的天竺葵
        q.cyl('iplain', 0.015, 0.02, 0.35, 0, 0.3, 0, 4, LEAF[0]);
        for (let k = 0; k < 5; k++) q.sphere('iplain', 0.07, Math.cos(k * 1.26) * 0.09, 0.68, Math.sin(k * 1.26) * 0.09, col(0.85, 0.25, 0.45), 0.8, 5);
        q.sphere('iplain', 0.04, 0, 0.7, 0, WHITE, 1, 5);
      } else if (v === 2 && i % 3 === 0) {
        // 長成的魔蘋果：葉子更高、更大
        for (let k = 0; k < 6; k++) q.geo('iplain', new THREE.ConeGeometry(0.1, 0.8, 4), Math.cos(k * 1.05) * 0.12, 0.7, Math.sin(k * 1.05) * 0.12, col(0.16, 0.26, 0.12), 0, Math.cos(k * 1.05) * 0.5, Math.sin(k * 1.05) * 0.5);
      } else if (i % 3 === 0) {
        // 魔蘋果：一叢紫綠色的葉子
        for (let k = 0; k < 5; k++) q.geo('iplain', new THREE.ConeGeometry(0.07, 0.42, 4), Math.cos(k * 1.26) * 0.09, 0.5, Math.sin(k * 1.26) * 0.09, col(0.2, 0.28, 0.16), 0, Math.cos(k * 1.26) * 0.5, Math.sin(k * 1.26) * 0.5);
      } else {
        const hgt = 0.3 + rng() * 0.6;
        q.cyl('iplain', 0.015, 0.02, hgt, 0, 0.3, 0, 4, LEAF[2]);
        q.sphere('iplain', 0.16 + rng() * 0.14, 0, 0.3 + hgt, 0, LEAF[i % 3], 0.9, 6);
        if (i % 4 === 1) q.sphere('iglow', 0.05, 0.08, 0.36 + hgt, 0.06, col(2.4, 0.4, 1.6));
      }
    }
  }
  if (v === 1) {
    // 中央：養著鰓囊草的玻璃水槽
    const p = new At(b, gx + 2, y, gz);
    p.box('iwood', 20, 0.6, 1.6, 0, 0, 0);
    p.box('iglow', 19.6, 0.9, 1.3, 0, 0.6, 0, col(0.01, 0.045, 0.05));
    for (const z of [-0.68, 0.68]) p.box('iwood', 19.8, 0.12, 0.08, 0, 1.44, z, col(0.5, 0.4, 0.3));
    for (let i = 0; i < 40; i++) p.box('iplain', 0.04, 0.4 + rng() * 0.5, 0.02, -9.5 + rng() * 19, 0.62, (rng() - 0.5) * 1.1, col(0.2, 0.45, 0.35), rng() * 3);
  } else if (v === 2) {
    // 中央：魔鬼網的深坑、毒觸手，盡頭是一株渾拍柳樹的幼苗
    const p = new At(b, gx + 2, y, gz);
    p.box('iwood', 24, 0.5, 1.6, 0, 0, 0);
    p.box('iplain', 23.7, 0.04, 1.3, 0, 0.5, 0, col(0.03, 0.025, 0.02));
    for (let i = 0; i < 70; i++) {
      const x = -11.5 + rng() * 23;
      p.geo('iplain', new THREE.CylinderGeometry(0.03, 0.04, 1.4 + rng() * 1.6, 4), x, 0.55, (rng() - 0.5) * 1.4, col(0.12, 0.15, 0.06), rng() * 6, Math.PI / 2 - 0.15, 0);
    }
    for (let i = 0; i < 4; i++) {
      const x = -9 + i * 5;
      p.cyl('iplain', 0.08, 0.12, 1.6, x, 0.5, 0, 6, col(0.25, 0.08, 0.12));
      for (let k = 0; k < 5; k++) p.geo('iplain', new THREE.ConeGeometry(0.06, 1.5, 5), x, 2.0, 0, col(0.35, 0.1, 0.15), k * 1.25, 0.7, 0);
    }
    const t = new At(b, gx + 15.5, y, gz);
    t.cyl('iplain', 0.7, 0.8, 0.6, 0, 0, 0, 10, POT);
    t.geo('iplain', new THREE.CylinderGeometry(0.1, 0.18, 1.8, 6), 0, 1.4, 0, col(0.3, 0.22, 0.15), 0, 0.15, 0);
    for (let k = 0; k < 6; k++) b.rod('iplain', V(gx + 15.5, y + 2.0, gz), V(gx + 15.5 + Math.cos(k) * 1.4, y + 2.6 + (k % 3) * 0.3, gz + Math.sin(k) * 1.4), 0.04, col(0.3, 0.22, 0.15), 4, 0.012);
    t.box('iplain', 1.2, 0.5, 0.05, 0, 0.7, 1.0, col(0.7, 0.1, 0.08));
  } else {
    const p = new At(b, gx + 2, y, gz);
    p.box('iwood', 24, 0.5, 1.6, 0, 0, 0);
    p.box('iplain', 23.7, 0.04, 1.3, 0, 0.5, 0, SOIL);
    for (let i = 0; i < 16; i++) {
      const x = -11 + i * 1.47;
      const hgt = 0.8 + rng() * 1.3;
      p.cyl('iplain', 0.03, 0.05, hgt, x, 0.5, 0, 5, LEAF[2]);
      for (let k = 0; k < 4; k++) p.sphere('iplain', 0.25 + rng() * 0.2, x + (rng() - 0.5) * 0.5, 0.6 + hgt * (0.4 + k * 0.2), (rng() - 0.5) * 0.6, LEAF[(i + k) % 3], 0.7, 6);
      // 毒觸手：幾根帶刺的藤蔓
      if (i % 5 === 2) for (let k = 0; k < 3; k++) p.geo('iplain', new THREE.ConeGeometry(0.05, 1.4, 5), x, 0.5 + hgt, 0, col(0.3, 0.08, 0.1), 0, 0.5 * Math.cos(k * 2.1), 0.5 * Math.sin(k * 2.1));
    }
  }
  // 吊籃、澆水壺與耳罩
  for (let i = 0; i < 6; i++) {
    const x = gx - 12 + i * 5;
    b.cyl('iplain', 0.01, 0.01, 1.4, x, Y + 5.2, gz + (i % 2 ? 1.6 : -1.6), 4, IRON);
    b.sphere('iplain', 0.32, x, Y + 5.0, gz + (i % 2 ? 1.6 : -1.6), LEAF[i % 3], 0.8, 7);
  }
  const s = new At(b, gx - 15.5, y, gz + 3.2);
  s.box('iwood', 2.2, 0.8, 0.9, 0, 0, 0);
  for (let i = 0; i < 5; i++) {
    s.geo('iplain', new THREE.TorusGeometry(0.09, 0.02, 5, 10, Math.PI), -0.8 + i * 0.4, 0.92, 0, col(0.2, 0.2, 0.22));
    for (const k of [-1, 1]) s.sphere('iplain', 0.055, -0.8 + i * 0.4 + k * 0.09, 0.9, 0, col(0.75, 0.4, 0.5), 1, 6);
  }
  const INFO = [
    ['greenhouse', '溫室', '藥草學的教室。花台上一盆盆的是魔蘋果，拔出來之前記得先戴耳罩。'],
    ['greenhouse2', '二號溫室', '一年級上藥草學的地方：會咬人的天竺葵、冒膿的巴波塊莖，中央的水槽養著鰓囊草。'],
    ['greenhouse3', '三號溫室', '高年級才准進來：中央的坑裡是魔鬼網，毒觸手會伸手抓人，盡頭種著一株渾拍柳樹的幼苗。'],
  ][v];
  registerScene({
    id: INFO[0],
    name: INFO[1],
    intro: INFO[2],
    box: box3(gx - hw, y - 0.5, gz - hd, gx + hw, Y + 8, gz + hd),
    lights: [{ pos: [gx, Y + 4.4, gz], intensity: 60, dist: 26, color: 0xfff0d0 }],
    spawn: [gx - 14, y, gz, Math.PI / 2],
    ambient: 1,
  });
}

/** 天文塔觀星台上的望遠鏡與星圖桌（蓋在既有的塔頂上） */
export function astronomyDeck(b: Builder) {
  const { x, z, deck } = ASTRO;
  const BRASS = col(0.55, 0.4, 0.14);
  for (let k = 0; k < 5; k++) {
    const a = 0.9 + k * 1.15;
    const px = x + Math.sin(a) * 10.6;
    const pz = z + Math.cos(a) * 10.6;
    for (let j = 0; j < 3; j++) b.rod('matte', V(px + Math.cos(j * 2.09) * 0.45, deck, pz + Math.sin(j * 2.09) * 0.45), V(px, deck + 1.35, pz), 0.025, IRON, 4);
    b.rod('matte', V(px - Math.sin(a) * 0.5, deck + 1.2, pz - Math.cos(a) * 0.5), V(px + Math.sin(a) * 0.75, deck + 1.95, pz + Math.cos(a) * 0.75), 0.05, BRASS, 8, 0.085);
  }
  b.cyl('wood', 0.9, 0.9, 0.07, x - 8.6, deck + 0.85, z - 4.5, 12);
  b.cyl('wood', 0.08, 0.12, 0.85, x - 8.6, deck, z - 4.5, 6);
  b.cyl('matte', 0.75, 0.75, 0.01, x - 8.6, deck + 0.925, z - 4.5, 12, col(0.05, 0.07, 0.2));
  b.window(1.8, 3, x, deck, z + 6.65, 0, 4, 0.08);
  registerScene({
    id: 'astronomyDeck',
    name: '天文塔觀星台',
    intro: '城堡最高的地方。午夜的天文學課在這裡上，四周一覽無遺。',
    box: box3(x - 14.5, deck - 0.6, z - 14.5, x + 14.5, deck + 7, z + 14.5),
    lights: [],
    spawn: [x, deck, z + 9.5, 0],
    outdoor: true,
  });
  link(DOORS.astronomyBase, DOORS.astronomyDeck);
}

/** 一間教室的共同骨架：講台在 -Z 端 */
function classroom(b: Builder, ox: number, oy: number, oz: number, w: number, d: number, h: number, itint: THREE.Color = IWARM) {
  room(b, { x0: ox - w / 2, x1: ox + w / 2, z0: oz - d / 2, z1: oz + d / 2, y: oy, h, t: 0.3, shell: false, ceil: h, itint });
}

// ================================================================== 獨立場景
export function buildClassroomPockets() {
  const M = getMaterials();

  // ---- 地窖走廊
  {
    const [ox, oy, oz] = pocketOrigin(3);
    const b = new Builder(710);
    const L = 34;
    room(b, { x0: ox - 2.4, x1: ox + 2.4, z0: oz - L / 2, z1: oz + L / 2, y: oy, h: 4.6, t: 0.3, shell: false, ceil: 4.6, itint: DUNGEON, ceilKey: 'istone' });
    // 通往入口大廳的樓梯
    const stairs = new At(b, ox, oy, oz + L / 2, Math.PI);
    door(stairs, 2, 3.2);
    for (let z = -12; z <= 12; z += 6) {
      for (const s of [-1, 1]) {
        b.box('istone', 0.5, 4.6, 0.5, ox + s * 2.15, oy, oz + z + 3, 0, DUNGEON);
        torch(b, ox + s * 2.4, oy + 2.9, oz + z, (-s * Math.PI) / 2);
      }
      b.box('istone', 4.8, 0.5, 0.5, ox, oy + 4.1, oz + z + 3, 0, DUNGEON);
    }
    // 走廊兩側的門
    const mk = (z: number, s: number): [At, DoorEnd] => {
      const p = new At(b, ox + s * 2.4, oy, oz + z, (-s * Math.PI) / 2);
      door(p, 1.7, 3);
      return [p, { pos: [p.x, oy, p.z], face: (-s * Math.PI) / 2, name: '地窖走廊' }];
    };
    const potions = mk(6, -1)[1];
    DUNGEON_DOORS.potions = potions;
    DUNGEON_DOORS.slytherin = mk(-9, -1)[1];
    DUNGEON_DOORS.kitchens = mk(9, 1)[1];
    DUNGEON_DOORS.hufflepuff = mk(-3, 1)[1];
    b.box('iwood', 0.7, 0.9, 0.7, ox - 1.6, oy, oz - 15.5, 0, DARKWOOD);
    b.box('iwood', 0.7, 0.7, 0.7, ox - 0.8, oy, oz - 15.9, 0.3, DARKWOOD);
    b.cyl('iwood', 0.45, 0.45, 1.0, ox + 1.5, oy, oz - 15.6, 10, DARKWOOD);
    registerScene({
      id: 'dungeonCorridor',
      name: '地窖走廊',
      intro: '城堡底下陰冷的石廊，通往魔藥學教室、廚房與兩個學院的交誼廳。',
      box: box3(ox - 2.4, oy - 1, oz - L / 2, ox + 2.4, oy + 4.6, oz + L / 2),
      lights: [
        { pos: [ox, oy + 3, oz + 8], intensity: 60, dist: 18, color: 0xff9a55 },
        { pos: [ox, oy + 3, oz - 8], intensity: 60, dist: 18, color: 0xff9a55 },
      ],
      spawn: [ox, oy, oz + 13, Math.PI],
      pocket: true,
      zone: 'dungeon',
      ambient: 0.08,
      group: b.build('dungeonCorridor', M),
    });
    link(DOORS.dungeon, { pos: [stairs.x, oy, stairs.z], face: Math.PI, name: '地窖走廊' });
  }

  // ---- 魔藥學教室
  {
    const [ox, oy, oz] = pocketOrigin(4);
    const b = new Builder(711);
    const w = 18;
    const d = 12;
    room(b, { x0: ox - w / 2, x1: ox + w / 2, z0: oz - d / 2, z1: oz + d / 2, y: oy, h: 5.2, t: 0.3, shell: false, ceil: 5.2, itint: DUNGEON, ceilKey: 'istone' });
    const dp = new At(b, ox + w / 2, oy, oz + 3.5, -Math.PI / 2);
    door(dp, 1.7, 3);
    // 拱頂的柱子
    for (const x of [-4.5, 4.5]) for (const z of [-2.2, 2.2]) {
      b.cyl('istone', 0.4, 0.45, 5.2, ox + x, oy, oz + z, 8, DUNGEON);
      b.box('istone', 1.1, 0.4, 1.1, ox + x, oy + 4.8, oz + z, 0, DUNGEON);
    }
    for (const z of [-2.2, 2.2]) b.box('istone', w, 0.45, 0.6, ox, oy + 4.75, oz + z, 0, DUNGEON);
    // 講桌、黑板
    blackboard(new At(b, ox - w / 2, oy + 1.2, oz, Math.PI / 2), 4.4, 2);
    const desk = new At(b, ox - 6.6, oy, oz, Math.PI / 2);
    table(desk, 3, 1.1, 0.9);
    cauldron(desk.at(-0.9, 0.9, 0), 0.6, col(0.4, 2.6, 0.9), false);
    for (let i = 0; i < 5; i++) desk.cyl('iglow', 0.03, 0.05, 0.2, 0.2 + i * 0.22, 0.9, 0.2, 6, [col(1.2, 0.3, 0.2), col(0.3, 1.2, 0.4), col(0.3, 0.5, 1.4)][i % 3]);
    // 學生的工作桌，每桌兩口大釜
    const POTION = [col(0.5, 2.8, 1.0), col(2.6, 0.7, 2.2), col(0.6, 1.2, 3.0), col(2.8, 2.0, 0.4)];
    let pi = 0;
    for (const x of [-2.4, 1.6, 5.6]) for (const z of [-3.6, 0, 3.6]) {
      if (x > 5 && z > 2) continue;
      const t = new At(b, ox + x, oy, oz + z, Math.PI / 2);
      table(t, 2.2, 0.9, 0.85);
      for (const lx of [-0.6, 0.6]) {
        cauldron(t.at(lx, 0, 1.0), 1, POTION[pi++ % 4]);
        t.box('iplain', 0.3, 0.04, 0.4, lx, 0.85, 0, [RED, col(0.05, 0.16, 0.08)][pi % 2], 0.2);
        t.cyl('iplain', 0.05, 0.07, 0.08, lx + 0.3, 0.85, 0.2, 6, STEEL);
      }
    }
    // 靠牆的藥材櫃
    potionShelf(new At(b, ox - 2, oy, oz - d / 2 + 0.3), 9, 6);
    potionShelf(new At(b, ox + 5.5, oy, oz - d / 2 + 0.3), 4, 6);
    potionShelf(new At(b, ox - 3, oy, oz + d / 2 - 0.3, Math.PI), 10, 6);
    // 泡在罐子裡的標本
    for (let i = 0; i < 6; i++) {
      const p = new At(b, ox + w / 2 - 0.5, oy, oz - 4.8 + i * 1.1, -Math.PI / 2);
      if (i === 0) p.box('iwood', 7, 1.1, 0.6, -2.7, 0, 0, DARKWOOD);
      p.cyl('iglow', 0.18, 0.18, 0.5, 0, 1.1, 0, 10, col(0.25, 0.5, 0.2));
      p.sphere('iplain', 0.09, 0, 1.3, 0, col(0.4, 0.35, 0.3), 1.4, 6);
      p.cyl('iplain', 0.19, 0.19, 0.05, 0, 1.6, 0, 10, BLACK);
    }
    for (const z of [-5.9, 5.9]) for (const x of [-7, 7.6]) torch(b, ox + x, oy + 3.2, oz + z, z < 0 ? 0 : Math.PI);
    registerScene({
      id: 'potions',
      name: '魔藥學教室',
      intro: '地窖裡陰冷的教室，大釜冒著各色蒸氣，牆邊排滿泡著標本的玻璃罐。',
      box: box3(ox - w / 2, oy - 1, oz - d / 2, ox + w / 2, oy + 5.2, oz + d / 2),
      lights: [
        { pos: [ox + 2, oy + 3.6, oz], intensity: 80, dist: 20, color: 0x9be0a8 },
        { pos: [ox - 6, oy + 3.2, oz], intensity: 60, dist: 14, color: 0xffa060 },
      ],
      spawn: [ox + 6.5, oy, oz + 1, -Math.PI / 2],
      pocket: true,
      zone: 'dungeon',
      ambient: 0.06,
      group: b.build('potions', M),
    });
    link(DUNGEON_DOORS.potions, { pos: [dp.x, oy, dp.z], face: -Math.PI / 2, name: '魔藥學教室' });
  }

  // ---- 變形學教室
  {
    const [ox, oy, oz] = pocketOrigin(5);
    const b = new Builder(712);
    const w = 14;
    const d = 21;
    classroom(b, ox, oy, oz, w, d, 7.5);
    const dp = new At(b, ox + w / 2, oy, oz + 8, -Math.PI / 2);
    door(dp);
    for (let i = 0; i < 4; i++) {
      pane(b, 1.8, 4.6, ox - w / 2, oy + 2, oz - 7 + i * 4.6, Math.PI / 2);
      if (i < 3) pane(b, 1.8, 4.6, ox + w / 2, oy + 2, oz - 7 + i * 4.6, -Math.PI / 2);
    }
    b.box('istone', w, 0.3, 4, ox, oy, oz - d / 2 + 2, 0, IWARM);
    blackboard(new At(b, ox, oy + 1.5, oz - d / 2), 5, 2);
    const desk = new At(b, ox - 2.5, oy + 0.3, oz - d / 2 + 2.3);
    table(desk, 2.6, 1.1, 0.85);
    chair(desk.at(0, 0, -0.9));
    deskLamp(desk.at(0.9, 0.85, 0));
    // 麥教授變成的虎斑貓
    desk.sphere('iplain', 0.13, -0.6, 0.98, 0, col(0.3, 0.25, 0.2), 0.8);
    desk.sphere('iplain', 0.08, -0.6, 1.14, 0.1, col(0.3, 0.25, 0.2));
    for (const s of [-1, 1]) desk.geo('iplain', new THREE.ConeGeometry(0.03, 0.06, 4), -0.6 + s * 0.045, 1.22, 0.1, col(0.3, 0.25, 0.2));
    for (let r = 0; r < 5; r++) for (const x of [-4.4, -1.5, 1.5, 4.4]) studentDesk(new At(b, ox + x, oy, oz - 4.5 + r * 2.6, Math.PI), 2.2);
    // 鳥籠與待變形的動物
    for (let i = 0; i < 5; i++) {
      const x = ox + 3.5 + (i % 2) * 1.6;
      const z = oz - d / 2 + 1 + i * 0.5;
      const yy = oy + 4.2 + (i % 3) * 0.5;
      b.cyl('iplain', 0.008, 0.008, 7.5 - (yy - oy) - 0.6, x, yy + 0.6, z, 4, IRON);
      for (let k = 0; k < 8; k++) b.cyl('iplain', 0.008, 0.008, 0.6, x + Math.cos(k * 0.785) * 0.22, yy, z + Math.sin(k * 0.785) * 0.22, 4, GOLD);
      b.cyl('iplain', 0.24, 0.24, 0.03, x, yy, z, 10, GOLD);
      b.cone('iplain', 0.24, 0.16, x, yy + 0.6, z, 10, GOLD);
      b.sphere('iplain', 0.07, x, yy + 0.2, z, [col(0.9, 0.8, 0.2), col(0.2, 0.5, 0.9), WHITE][i % 3]);
    }
    bookshelf(new At(b, ox - w / 2 + 0.3, oy, oz + 7.5, Math.PI / 2), 5, 3.4);
    for (const z of [-4, 3]) chandelier(b, ox, oy + 5.6, oz + z, 1.4, 10, 1.9);
    registerScene({
      id: 'transfiguration',
      name: '變形學教室',
      intro: '麥教授的教室。講桌上那隻虎斑貓，你最好別當牠只是一隻貓。',
      box: box3(ox - w / 2, oy - 1, oz - d / 2, ox + w / 2, oy + 7.5, oz + d / 2),
      lights: [
        { pos: [ox, oy + 5, oz - 4], intensity: 170, dist: 24 },
        { pos: [ox, oy + 5, oz + 4], intensity: 150, dist: 24 },
      ],
      spawn: [ox, oy, oz + 8, Math.PI],
      pocket: true,
      ambient: 0.5,
      group: b.build('transfiguration', M),
    });
    link(DOORS.transfiguration, { pos: [dp.x, oy, dp.z], face: -Math.PI / 2, name: '變形學教室' });
  }

  // ---- 黑魔法防禦術教室
  {
    const [ox, oy, oz] = pocketOrigin(6);
    const b = new Builder(713);
    const w = 13;
    const d = 23;
    classroom(b, ox, oy, oz, w, d, 9, col(1.0, 0.98, 0.95));
    const dp = new At(b, ox, oy, oz + d / 2, Math.PI);
    door(dp);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) pane(b, 1.7, 5.2, ox + (s * w) / 2, oy + 2.4, oz - 6 + i * 4.6, (-s * Math.PI) / 2);
    // 講台後方的樓梯，通往教授的辦公室
    const z0 = oz - d / 2;
    b.box('istone', w, 0.3, 4.6, ox, oy, z0 + 2.3, 0, IWARM);
    b.box('iwood', 5, 0.25, 2.2, ox - 4, oy + 3.2, z0 + 1.1, 0, DARKWOOD);
    for (const x of [-6.2, -1.8]) b.box('iwood', 0.25, 3.2, 0.25, ox + x, oy, z0 + 2.0, 0, DARKWOOD);
    flight(b, V(ox + 4.6, oy + 0.3, z0 + 1.1), V(ox - 1.5, oy + 3.45, z0 + 1.1), 2, V(0, 0, 1));
    b.box('iwood', 5, 1.0, 0.1, ox - 4, oy + 3.45, z0 + 2.15, 0, DARKWOOD);
    door(new At(b, ox - 5, oy + 3.45, z0, 0), 1.4, 2.6);
    blackboard(new At(b, ox + 3.2, oy + 4.6, z0), 3.6, 1.8);
    const desk = new At(b, ox + 2.5, oy + 0.3, z0 + 3.4);
    table(desk, 2.6, 1.1, 0.85);
    chair(desk.at(0, 0, -0.9));
    // 投影機、行李箱與留聲機
    desk.box('iplain', 0.4, 0.3, 0.6, -0.8, 0.85, 0, col(0.25, 0.18, 0.08));
    desk.geo('iplain', new THREE.CylinderGeometry(0.08, 0.12, 0.3, 8), -0.8, 1.05, 0.4, GOLD, 0, Math.PI / 2);
    b.box('iwood', 1.3, 0.6, 0.7, ox - 4.5, oy, oz - 3, 0.3, col(0.6, 0.5, 0.4));
    b.box('iplain', 1.34, 0.05, 0.1, ox - 4.5, oy + 0.3, oz - 2.62, 0.3, GOLD);
    for (let r = 0; r < 5; r++) for (const x of [-3.2, 0, 3.2]) studentDesk(new At(b, ox + x, oy, oz - 3.6 + r * 2.7, Math.PI), 2.4);
    // 吊在天花板下的龍骨架
    {
      const yy = oy + 6.6;
      const n = 22;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const z = oz - 5 + t * 12;
        const sag = Math.sin(t * Math.PI) * 0.5;
        const r = 0.16 * Math.sin(t * Math.PI) + 0.05;
        b.sphere('iplain', r, ox, yy - sag, z, WHITE, 0.9, 6);
        if (i > 3 && i < 13) for (const s of [-1, 1]) b.rod('iplain', V(ox, yy - sag, z), V(ox + s * 0.7, yy - sag - 0.95, z + 0.1), 0.03, WHITE, 4, 0.012);
        if (i % 7 === 3) b.cyl('iplain', 0.008, 0.008, 9 - (yy - sag - oy), ox, yy - sag, z, 4, IRON);
      }
      // 頭骨與翅膀
      b.sphere('iplain', 0.32, ox, yy - 0.05, oz - 5.6, WHITE, 0.75, 8);
      b.add('iplain', new THREE.ConeGeometry(0.2, 0.8, 6), mat4(ox, yy - 0.12, oz - 6.2, 0, -Math.PI / 2), WHITE);
      for (const s of [-1, 1]) {
        b.rod('iplain', V(ox + s * 0.2, yy - 0.3, oz - 2), V(ox + s * 2.6, yy + 0.6, oz - 1.2), 0.04, WHITE, 4);
        for (let k = 0; k < 3; k++) b.rod('iplain', V(ox + s * 2.6, yy + 0.6, oz - 1.2), V(ox + s * (3.2 + k * 0.5), yy - 0.4, oz + k * 1.1), 0.025, WHITE, 4);
      }
    }
    for (const z of [-2, 6]) chandelier(b, ox + 3.5, oy + 6.4, oz + z, 1.1, 8, 2.6);
    for (const z of [-2, 6]) chandelier(b, ox - 3.5, oy + 6.4, oz + z, 1.1, 8, 2.6);
    registerScene({
      id: 'dada',
      name: '黑魔法防禦術教室',
      intro: '天花板下吊著一副龍骨架，講台旁的樓梯通往教授的辦公室。',
      box: box3(ox - w / 2, oy - 1, oz - d / 2, ox + w / 2, oy + 9, oz + d / 2),
      lights: [
        { pos: [ox, oy + 5.6, oz - 4], intensity: 170, dist: 26 },
        { pos: [ox, oy + 5.6, oz + 5], intensity: 150, dist: 26 },
      ],
      spawn: [ox, oy, oz + 8.5, Math.PI],
      pocket: true,
      ambient: 0.45,
      group: b.build('dada', M),
    });
    link(landingDoor(2), { pos: [dp.x, oy, dp.z], face: Math.PI, name: '黑魔法防禦術教室' });
  }

  // ---- 符咒學教室
  {
    const [ox, oy, oz] = pocketOrigin(7);
    const b = new Builder(714);
    const w = 16;
    const d = 18;
    classroom(b, ox, oy, oz, w, d, 8);
    const dp = new At(b, ox, oy, oz + d / 2, Math.PI);
    door(dp);
    for (let i = 0; i < 3; i++) pane(b, 2.2, 5, ox - 4.5 + i * 4.5, oy + 2.2, oz - d / 2, 0);
    // 兩側階梯式的座位，中間是走道
    for (const s of [-1, 1]) {
      for (let t = 0; t < 3; t++) {
        const x = ox + s * (3.2 + t * 1.7);
        b.box('iwood', 1.7, 0.4 * (t + 1), 12, x, oy, oz + 0.5, 0, DARKWOOD);
        for (let k = 0; k < 4; k++) {
          const p = new At(b, x - s * 0.35, oy + 0.4 * (t + 1), oz - 4 + k * 3, (-s * Math.PI) / 2);
          p.box('iwood', 2.4, 0.06, 0.4, 0, 0.72, 0.1);
          p.box('iwood', 2.4, 0.7, 0.05, 0, 0, 0.3);
          p.box('iwood', 2.4, 0.06, 0.3, 0, 0.42, -0.45);
          // 桌上的羽毛
          if ((k + t) % 2 === 0) p.geo('iplain', new THREE.ConeGeometry(0.03, 0.3, 4), 0.4, 0.8, 0.1, WHITE, 0, 0, 1.4);
        }
      }
    }
    // 孚立維教授站的那疊書，和飄在半空的羽毛
    const stack = new At(b, ox, oy, oz - 6);
    for (let i = 0; i < 9; i++) stack.box('iplain', 0.5 - (i % 3) * 0.04, 0.09, 0.38, 0, i * 0.09, 0, [RED, col(0.05, 0.16, 0.08), col(0.06, 0.08, 0.25), col(0.28, 0.17, 0.06)][i % 4], i * 0.4);
    table(new At(b, ox + 2.2, oy, oz - 6.6), 1.8, 0.9);
    blackboard(new At(b, ox - 5.4, oy + 1.4, oz - d / 2), 3, 1.7);
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      b.add('iplain', new THREE.ConeGeometry(0.035, 0.36, 4), mat4(ox + Math.cos(a) * (1 + (i % 3) * 0.5), oy + 2.2 + (i % 5) * 0.45, oz - 1 + Math.sin(a) * 4, a, 0.3, 1.2), WHITE);
    }
    bookshelf(new At(b, ox + 5, oy, oz + d / 2 - 0.3, Math.PI), 5, 3.4);
    chandelier(b, ox, oy + 6, oz, 1.8, 12, 2);
    registerScene({
      id: 'charms',
      name: '符咒學教室',
      intro: '兩側是階梯式的長椅。第一堂課練的是漂浮咒：溫咖癲啦唯啊薩。',
      box: box3(ox - w / 2, oy - 1, oz - d / 2, ox + w / 2, oy + 8, oz + d / 2),
      lights: [{ pos: [ox, oy + 5.4, oz], intensity: 260, dist: 28 }],
      spawn: [ox, oy, oz + 6.5, Math.PI],
      pocket: true,
      ambient: 0.5,
      group: b.build('charms', M),
    });
    link(landingDoor(4), { pos: [dp.x, oy, dp.z], face: Math.PI, name: '符咒學教室' });
  }

  // ---- 占卜學教室
  {
    const [ox, oy, oz] = pocketOrigin(8);
    const b = new Builder(715);
    const r = 9;
    roundRoom(b, ox, oy, oz, r, 4.6, col(1.25, 0.95, 0.85), 4.5);
    const dp = new At(b, ox, oy, oz + r - 0.05, Math.PI);
    door(dp, 1.5, 2.6);
    // 活板門與銀色的梯子
    b.box('iwood', 1.4, 0.04, 1.4, ox + 1.5, oy, oz + 6.2, 0, DARKWOOD);
    for (const s of [-1, 1]) b.rod('iplain', V(ox + 1.5 + s * 0.3, oy, oz + 6.6), V(ox + 1.5 + s * 0.3, oy + 2.6, oz + 7.6), 0.02, STEEL, 4);
    for (let k = 0; k < 7; k++) b.rod('iplain', V(ox + 1.2, oy + 0.3 + k * 0.33, oz + 6.72 + k * 0.127), V(ox + 1.8, oy + 0.3 + k * 0.33, oz + 6.72 + k * 0.127), 0.015, STEEL, 4);
    const ring = (a: number, d: number, yy = 0) => new At(b, ox + Math.sin(a) * d, oy + yy, oz + Math.cos(a) * d, a + Math.PI);
    // 紅色的帷幔遮住了窗
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.22;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue;
      ring(a, r - 0.12, 0.3).box('iplain', 2.6, 4.2, 0.06, 0, 0, 0, i % 2 ? col(0.4, 0.04, 0.05) : col(0.3, 0.03, 0.09));
    }
    // 小圓桌、水晶球與坐墊
    const CUSH = [col(0.45, 0.06, 0.08), col(0.4, 0.2, 0.05), col(0.3, 0.05, 0.25), col(0.08, 0.2, 0.3)];
    let ci = 0;
    for (const [a, d] of [[0.9, 5.6], [1.9, 6.2], [2.9, 5.4], [-0.9, 5.6], [-1.9, 6.2], [-2.9, 5.6], [1.4, 2.6], [-1.6, 2.8], [3.14, 2.2]]) {
      const p = ring(a, d);
      roundTable(p, 0.62, 0.6);
      p.cyl('iplain', 0.1, 0.13, 0.06, 0, 0.6, 0, 8, GOLD);
      p.sphere('iglow', 0.15, 0, 0.8, 0, col(1.3, 1.5, 2.0));
      for (const k of [0, 2.1, 4.2]) pouf(p.at(Math.cos(k) * 1.05, 0, Math.sin(k) * 1.05), CUSH[ci++ % 4]);
      p.cyl('iplain', 0.05, 0.03, 0.05, 0.3, 0.6, 0.2, 6, WHITE);
    }
    fireplace(ring(Math.PI, r - 0.15), 2.2, IWARM);
    // 崔老妮教授的高背扶手椅
    armchair(ring(Math.PI + 0.5, 6.2), col(0.32, 0.08, 0.2));
    // 擺滿茶杯的架子
    {
      const p = ring(Math.PI - 0.62, r - 0.4);
      p.box('iwood', 2.6, 2.6, 0.06, 0, 0, -0.18, DARKWOOD);
      for (let rr = 0; rr < 4; rr++) {
        p.box('iwood', 2.6, 0.04, 0.4, 0, 0.5 + rr * 0.55, 0, DARKWOOD);
        for (let i = 0; i < 8; i++) p.cyl('iplain', 0.055, 0.035, 0.06, -1.1 + i * 0.31, 0.54 + rr * 0.55, 0, 6, [WHITE, col(0.8, 0.5, 0.55), col(0.5, 0.65, 0.8)][(i + rr) % 3]);
      }
    }
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + 0.5;
      b.cyl('iplain', 0.006, 0.006, 1.6, ox + Math.sin(a) * 4, oy + 3.2, oz + Math.cos(a) * 4, 4, IRON);
      b.sphere('iglow', 0.13, ox + Math.sin(a) * 4, oy + 3.1, oz + Math.cos(a) * 4, col(3.2, 0.9, 0.5), 1.3, 7);
    }
    registerScene({
      id: 'divination',
      name: '占卜學教室',
      intro: '北塔頂的閣樓：帷幔低垂、爐火悶燒，每張小圓桌上都有一顆水晶球。',
      box: box3(ox - r - 0.5, oy - 1, oz - r - 0.5, ox + r + 0.5, oy + 9.5, oz + r + 0.5),
      lights: [
        { pos: [ox, oy + 3.2, oz], intensity: 90, dist: 22, color: 0xff7a55 },
        { pos: [ox, oy + 1.4, oz - 6.6], intensity: 60, dist: 12, color: 0xff8a40 },
      ],
      spawn: [ox, oy, oz + 4.5, Math.PI],
      pocket: true,
      ambient: 0.1,
      group: b.build('divination', M),
    });
    link(DOORS.divination, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '占卜學教室' });
  }
  void FIRE;
  void MARBLE;
  void portrait;
}
