import * as THREE from 'three';
import { Builder, col, mat4 } from '../kit';
import { PL } from '../../world/heightfield';
import { pane, torch, GOLD, IRON, FIRE, DARKWOOD, MARBLE } from '../interiors';
import {
  At, door, bookshelf, table, chair, armchair, sofa, fireplace, chandelier, portrait, bed, blackboard, studentDesk, armour,
  potionShelf, roundTable, deskLamp, cauldron, STEEL, WHITE, BLACK, GREENLAMP,
} from './kit';
import { link, pocketOrigin, type DoorEnd } from './registry';
import { wingDoor } from './doors';
import { chamber, roundDoor, warm } from './towers';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const RED = col(0.5, 0.035, 0.04);
const BLUE = col(0.05, 0.1, 0.42);
const NIGHT = col(0.015, 0.025, 0.11);
const BRONZE = col(0.5, 0.3, 0.12);
const COPPER = col(0.75, 0.33, 0.14);
const PARCH = col(0.85, 0.78, 0.6);
const HOUSES = [col(0.5, 0.03, 0.035), col(0.85, 0.6, 0.06), col(0.04, 0.09, 0.42), col(0.03, 0.24, 0.09)];

const NORTH_WING = { x: -30, z: -106, w: 140, d: 20 };
const QUAD_N = { x: 30, z: 8, w: 78, d: 13 };
const QUAD_S = { x: 30, z: 76, w: 78, d: 13 };
const QUAD_E = { x: 63, z: 42, w: 56, d: 13, ry: Math.PI / 2 };
const LINK_WING = { x: 8, z: -42, w: 60, d: 13, ry: Math.PI / 2 };
const NE_WING = { x: 100, z: -70, w: 76, d: 13, ry: 0.86 };
const DADA_WING = { x: 96, z: 20, w: 44, d: 12, ry: -0.9 };
const ASTRO_WING = { x: -106, z: -70, w: 26, d: 11, ry: -0.5 };
const GRYF_WING = { x: 96, z: 92, w: 46, d: 15, ry: 0.12 };

/** 第 7 批：廂房與其餘建築的入口。wing 類由 castle.ts 畫門，tower 類畫石門廊 */
export const WING_DOORS = {
  filch: wingDoor(null, NORTH_WING, 'S', -50, '北翼'),
  brooms: wingDoor(null, NORTH_WING, 'S', -15, '北翼'),
  arithmancy: wingDoor(null, NORTH_WING, 'S', 20, '北翼'),
  creatures: wingDoor(null, NORTH_WING, 'S', 50, '北翼'),
  staffQuarters: wingDoor(null, QUAD_N, 'S', -20, '中庭'),
  history: wingDoor(null, QUAD_S, 'N', -20, '中庭'),
  erised: wingDoor(null, QUAD_E, 'N', 6, '中庭'),
  barnabas: wingDoor(null, LINK_WING, 'N', 0, '城堡中段'),
  alchemy: wingDoor(null, NE_WING, 'S', 0, '城堡東北'),
  mcgonagall: wingDoor(null, DADA_WING, 'S', 0, '城堡東側'),
  astroClass: wingDoor(null, ASTRO_WING, 'S', 0, '天文塔'),
  slugClub: wingDoor(null, GRYF_WING, 'N', -6, '葛來分多塔'),
};
export const SMALL_TOWER_DOORS = {
  bookRepair: roundDoor(-36, -56, 6, Math.PI / 2, '圖書館'),
  broomCupboard: roundDoor(111, 110, 6.2, Math.PI / 2, '葛來分多塔'),
  prefects: roundDoor(20, -74, 6, 0, '城堡中段'),
  lostProperty: roundDoor(-8, -40, 6.5, -Math.PI / 2, '城堡中段'),
  classroom11: roundDoor(118, -22, 7.4, Math.PI, '城堡東側'),
  storeroom: roundDoor(100, 44, 5.6, 0, '醫院廂房'),
  hallAttic: { pos: [-141, PL, 99 - 2.95], face: Math.PI, name: '高架橋庭院' } as DoorEnd,
  gate: { pos: [60 + 7.65, PL, -152], face: Math.PI / 2, name: '北門' } as DoorEnd,
};
/** 城牆上的四座小塔共用一間崗哨 */
export const LOOKOUT_DOORS: DoorEnd[] = [
  roundDoor(20, 122, 5.5, Math.PI, '南城牆'),
  roundDoor(76, 124, 5, Math.PI, '南城牆'),
  roundDoor(172, 73, 5, -Math.PI / 2, '東城牆'),
  roundDoor(-134, -128, 5, Math.PI / 4, '西北城牆'),
];

export function buildWingPockets() {
  // ================================================================ 北翼：飛七的辦公室
  chamber({
    k: 40,
    id: 'filch',
    name: '飛七的辦公室',
    intro: '管理員飛七的小房間：一整排標著「沒收，極度危險」的檔案櫃，天花板還吊著擦得發亮的鐵鍊與手銬。',
    w: 8,
    d: 7,
    h: 4.2,
    tint: col(0.85, 0.82, 0.78),
    outside: WING_DOORS.filch,
    ambient: 0.12,
    lights: ([x, y, z]) => [warm([x, y + 3, z], 60, 11, 0xffb070)],
    fill: (b, [x, y, z]) => {
      for (let i = 0; i < 5; i++) {
        const p = new At(b, x - 3 + i * 0.95, y, z - 3.15);
        p.box('iwood', 0.85, 1.8, 0.6, 0, 0, 0, col(0.4, 0.32, 0.25));
        for (let k = 0; k < 4; k++) {
          p.box('iplain', 0.75, 0.38, 0.02, 0, 0.08 + k * 0.43, 0.31, col(0.45, 0.36, 0.28));
          p.box('iplain', 0.2, 0.05, 0.02, 0, 0.3 + k * 0.43, 0.32, GOLD);
        }
      }
      const desk = new At(b, x + 1.5, y, z + 0.5, -Math.PI / 2);
      table(desk, 1.8, 0.9);
      chair(desk.at(0, 0, -0.7));
      for (let i = 0; i < 6; i++) desk.box('iplain', 0.2, 0.01, 0.3, -0.6 + i * 0.15, 0.76 + i * 0.01, 0, PARCH, i * 0.2);
      desk.cyl('iplain', 0.05, 0.06, 0.1, 0.6, 0.76, 0.2, 6, BLACK);
      // 吊著的鐵鍊與手銬
      for (let i = 0; i < 5; i++) {
        const px = x - 2 + i;
        b.cyl('iplain', 0.015, 0.015, 1.4, px, y + 2.8, z - 1, 4, STEEL);
        b.add('iplain', new THREE.TorusGeometry(0.09, 0.02, 4, 10), mat4(px, y + 2.75, z - 1), STEEL);
      }
      // 拿樂絲太太的籃子
      const p = new At(b, x - 3, y, z + 2.3);
      p.cyl('iplain', 0.4, 0.32, 0.25, 0, 0, 0, 10, col(0.55, 0.42, 0.25));
      p.sphere('iplain', 0.2, 0, 0.32, 0, col(0.35, 0.3, 0.27), 0.7, 8);
      p.sphere('iplain', 0.11, 0.15, 0.42, 0.1, col(0.35, 0.3, 0.27), 1, 8);
      for (const s of [-1, 1]) p.sphere('iglow', 0.02, 0.2 + s * 0.04, 0.45, 0.19, col(2.4, 1.6, 0.2), 1, 4);
      torch(b, x + 4, y + 2.6, z - 1, -Math.PI / 2);
    },
  });

  // ================================================================ 北翼：掃帚儲藏室
  chamber({
    k: 41,
    id: 'broomStore',
    name: '學校的掃帚儲藏室',
    intro: '飛行課用的學校掃帚都收在這裡。有些已經老到會往左偏，胡奇夫人一直說要換新的。',
    w: 10,
    d: 6,
    h: 4,
    outside: WING_DOORS.brooms,
    lights: ([x, y, z]) => [warm([x, y + 3, z], 70, 12)],
    fill: (b, [x, y, z]) => {
      for (const s of [-1, 1]) {
        const p = new At(b, x, y, z + s * 2.75, s > 0 ? Math.PI : 0);
        p.box('iwood', 9, 0.1, 0.2, 0, 1.8, 0.05, DARKWOOD);
        p.box('iwood', 9, 0.1, 0.2, 0, 0.3, 0.05, DARKWOOD);
        for (let i = 0; i < 18; i++) {
          if (s > 0 && Math.abs(-4.25 + i * 0.5) < 1) continue;
          p.geo('iplain', new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), -4.25 + i * 0.5, 1.15, 0.15, col(0.5, 0.35, 0.2), 0, 0.08);
          p.geo('iplain', new THREE.ConeGeometry(0.11, 0.45, 6), -4.25 + i * 0.5, 0.15, 0.1, col(0.6, 0.48, 0.28), 0, Math.PI + 0.08);
        }
      }
      for (let i = 0; i < 3; i++) b.cyl('iplain', 0.2, 0.17, 0.35, x + 3.6 + i * 0.1, y, z + 0.8 - i * 0.5, 8, STEEL);
      const t = new At(b, x - 3.5, y, z);
      t.box('iwood', 1.0, 0.8, 0.7, 0, 0, 0, DARKWOOD);
      t.sphere('iplain', 0.05, 0, 0.85, 0, STEEL);
      t.box('iplain', 0.4, 0.02, 0.3, 0.2, 0.8, 0.1, PARCH);
    },
  });

  // ================================================================ 北翼：算命學教室
  chamber({
    k: 42,
    id: 'arithmancy',
    name: '算命學教室',
    intro: '牆上掛滿數字圖表與魔法數陣，維克多教授的黑板永遠寫得密密麻麻。',
    w: 14,
    d: 11,
    h: 5.5,
    outside: WING_DOORS.arithmancy,
    lights: ([x, y, z]) => [warm([x, y + 4.2, z], 160, 20)],
    fill: (b, [x, y, z]) => {
      const rng = b.rng;
      blackboard(new At(b, x, y + 1.3, z - 5.5), 5, 2);
      const bb = new At(b, x, y + 1.3, z - 5.5);
      for (let i = 0; i < 10; i++) for (let k = 0; k < 4; k++) if (rng() < 0.7) bb.box('iplain', 0.18, 0.12, 0.01, -2.2 + i * 0.48, 0.3 + k * 0.4, 0.1, col(0.8, 0.8, 0.75));
      // 牆上的數陣圖
      for (const [px, pz, ry] of [[x - 6.98, z - 1.5, Math.PI / 2], [x - 6.98, z + 2.5, Math.PI / 2], [x + 6.98, z, -Math.PI / 2]] as const) {
        const p = new At(b, px, y + 1.6, pz, ry);
        p.box('iplain', 1.8, 1.8, 0.02, 0, 0, 0.01, PARCH);
        for (let k = 0; k < 5; k++) p.geo('iplain', new THREE.BoxGeometry(1.5, 0.02, 0.01), 0, 0.9, 0.03, col(0.3, 0.2, 0.1), 0, 0, (k * Math.PI) / 5);
        p.geo('iplain', new THREE.TorusGeometry(0.7, 0.015, 3, 30), 0, 0.9, 0.03, col(0.3, 0.2, 0.1));
      }
      const desk = new At(b, x - 3, y, z - 3.6);
      table(desk, 2.2, 1.0);
      chair(desk.at(0, 0, -0.8));
      for (let i = 0; i < 4; i++) desk.cyl('iplain', 0.04, 0.04, 0.6, -0.8 + i * 0.12, 0.76, 0, 5, i % 2 ? PARCH : col(0.7, 0.65, 0.5));
      for (let r = 0; r < 2; r++) for (const lx of [-3.4, 0, 3.4]) studentDesk(new At(b, x + lx, y, z - 0.8 + r * 2.2, Math.PI), 2.2);
      for (const pz of [-2, 2]) pane(b, 1.6, 3.2, x + 6.99, y + 1.6, z + pz + 1, -Math.PI / 2);
    },
  });

  // ================================================================ 北翼：奇獸飼育學的室內教室
  chamber({
    k: 43,
    id: 'creatures',
    name: '奇獸飼育學的室內教室',
    intro: '冬天太冷沒辦法在戶外上課時用的房間：一箱箱的黏巴蟲、樹枝上的木精，還有一個裝著爆尾釘蝦、正在冒煙的箱子。',
    w: 14,
    d: 10,
    h: 5,
    tint: col(1.0, 0.95, 0.85),
    outside: WING_DOORS.creatures,
    lights: ([x, y, z]) => [warm([x, y + 3.8, z], 140, 18)],
    fill: (b, [x, y, z]) => {
      const rng = b.rng;
      for (let i = 0; i < 30; i++) b.cyl('iplain', 0.4 + rng() * 0.5, 0.5 + rng() * 0.5, 0.05, x - 5 + rng() * 10, y, z - 3 + rng() * 6, 7, col(0.75, 0.6, 0.3));
      // 黏巴蟲的木箱（裡面鋪著萵苣）
      for (let i = 0; i < 4; i++) {
        const p = new At(b, x - 4.5 + i * 1.5, y, z - 3.8);
        p.box('iwood', 1.2, 0.5, 0.8, 0, 0, 0, col(0.7, 0.55, 0.38));
        p.box('iplain', 1.1, 0.02, 0.7, 0, 0.45, 0, col(0.3, 0.55, 0.2));
        for (let k = 0; k < 4; k++) p.geo('iplain', new THREE.CapsuleGeometry(0.035, 0.18, 3, 6), -0.4 + k * 0.25, 0.5, (k % 2) * 0.2 - 0.1, col(0.75, 0.68, 0.5), k, Math.PI / 2);
      }
      // 冒煙的爆尾釘蝦箱
      {
        const p = new At(b, x + 4, y, z - 3.4);
        p.box('iwood', 1.6, 0.8, 1.0, 0, 0, 0, col(0.45, 0.35, 0.28));
        for (let k = 0; k < 4; k++) p.sphere('iplain', 0.18 + k * 0.08, 0.1 * k, 1.0 + k * 0.4, 0, col(0.55, 0.55, 0.55), 1, 6);
        p.sphere('iglow', 0.1, 0.4, 0.82, 0.2, FIRE, 1, 6);
      }
      // 樹枝上的木精
      {
        const p = new At(b, x - 4.6, y, z + 2.6);
        p.cyl('iplain', 0.4, 0.3, 0.4, 0, 0, 0, 10, COPPER);
        b.rod('iplain', V(x - 4.6, y + 0.4, z + 2.6), V(x - 4.4, y + 2.2, z + 2.4), 0.06, col(0.35, 0.25, 0.15), 5);
        b.rod('iplain', V(x - 4.5, y + 1.4, z + 2.5), V(x - 4.0, y + 1.9, z + 2.9), 0.04, col(0.35, 0.25, 0.15), 5);
        for (const [dx, dy] of [[0.15, 1.8], [-0.1, 2.0], [0.4, 1.95]]) {
          b.cyl('iplain', 0.015, 0.015, 0.16, x - 4.5 + dx, y + dy, z + 2.55, 4, col(0.3, 0.45, 0.2));
          b.sphere('iplain', 0.02, x - 4.5 + dx, y + dy + 0.18, z + 2.55, col(0.3, 0.45, 0.2));
        }
      }
      // 鳥籠與教科書（怪獸的怪獸書，被皮帶綁著）
      const t = new At(b, x + 2.5, y, z + 1.5);
      table(t, 2.4, 1.1);
      for (let i = 0; i < 3; i++) {
        t.box('iplain', 0.35, 0.12, 0.28, -0.8 + i * 0.5, 0.76, 0, col(0.45, 0.4, 0.22), i * 0.3);
        t.box('iplain', 0.37, 0.03, 0.04, -0.8 + i * 0.5, 0.82, 0, BLACK, i * 0.3);
      }
      t.cyl('iplain', 0.2, 0.2, 0.03, 0.8, 0.76, 0, 10, GOLD);
      for (let k = 0; k < 8; k++) t.cyl('iplain', 0.006, 0.006, 0.4, 0.8 + Math.cos(k * 0.785) * 0.19, 0.79, Math.sin(k * 0.785) * 0.19, 3, GOLD);
      t.sphere('iplain', 0.09, 0.8, 0.95, 0, col(0.6, 0.4, 0.25), 1.2, 6);
      for (const pz of [-2, 2]) pane(b, 1.6, 3, x - 6.99, y + 1.4, z + pz, Math.PI / 2);
    },
  });

  // ================================================================ 中庭北翼：教職員宿舍
  chamber({
    k: 44,
    id: 'staffQuarters',
    name: '教職員宿舍',
    intro: '一位教授的起居室兼臥室：爐火、扶手椅、堆滿作業的書桌，床邊放著一雙格子拖鞋。',
    w: 11,
    d: 9,
    h: 4.6,
    tint: col(1.12, 1.02, 0.9),
    outside: WING_DOORS.staffQuarters,
    lights: ([x, y, z]) => [warm([x, y + 3.5, z], 100, 15), warm([x - 3.5, y + 1.3, z - 3.6], 60, 8, 0xff8a40)],
    fill: (b, [x, y, z]) => {
      fireplace(new At(b, x - 3.5, y, z - 4.5), 2.0);
      armchair(new At(b, x - 4.2, y, z - 1.8, 2.6), col(0.3, 0.2, 0.35));
      bed(new At(b, x + 3.6, y, z - 2.6), col(0.35, 0.12, 0.15), true);
      const t = new At(b, x + 0.5, y, z + 1.8, Math.PI);
      table(t, 2, 1);
      chair(t.at(0, 0, -0.8));
      for (let i = 0; i < 8; i++) t.box('iplain', 0.22, 0.012, 0.3, -0.6 + (i % 4) * 0.25, 0.76 + Math.floor(i / 4) * 0.02, -0.1, PARCH, i * 0.15);
      deskLamp(t.at(0.7, 0.76, 0.2));
      bookshelf(new At(b, x + 5.2, y, z + 2, -Math.PI / 2), 2.4, 3.2);
      b.box('iplain', 3.6, 0.02, 2.6, x - 3, y, z - 1.6, 0, col(0.3, 0.12, 0.1));
      for (const s of [-1, 1]) b.box('iplain', 0.12, 0.06, 0.28, x + 2.6 + s * 0.1, y, z - 1.2, 0, col(0.4, 0.15, 0.12));
      pane(b, 1.4, 2.4, x + 1.5, y + 1.6, z - 4.49, 0);
    },
  });

  // ================================================================ 中庭南翼：魔法史教室
  chamber({
    k: 45,
    id: 'history',
    name: '魔法史教室',
    intro: '全校唯一由鬼魂教課的課：丙斯教授有天在教職員休息室睡著了，醒來就忘了自己的身體，照樣飄去上課。',
    w: 15,
    d: 12,
    h: 6,
    tint: col(0.98, 0.95, 0.9),
    outside: WING_DOORS.history,
    ambient: 0.3,
    lights: ([x, y, z]) => [warm([x, y + 4.4, z + 1], 120, 20), warm([x, y + 2, z - 4.4], 40, 8, 0xbcd8ff)],
    fill: (b, [x, y, z]) => {
      b.box('istone', 15, 0.3, 3, x, y, z - 4.5, 0, col(0.98, 0.95, 0.9));
      const desk = new At(b, x, y + 0.3, z - 4.3);
      table(desk, 2.6, 1.0, 1.05);
      for (let i = 0; i < 5; i++) desk.box('iplain', 0.4, 0.06, 0.3, -0.8 + i * 0.4, 1.05, 0, PARCH, i * 0.2);
      // 飄在講桌後面的鬼魂教授
      const G = col(0.55, 0.75, 1.1);
      desk.cyl('iglow', 0.32, 0.12, 1.1, 0, 1.1, -0.9, 10, G.clone().multiplyScalar(0.35));
      desk.sphere('iglow', 0.16, 0, 2.35, -0.9, G.clone().multiplyScalar(0.4), 1.1, 8);
      // 妖精叛亂的地圖與年表
      for (const [px, w] of [[-4.5, 2.4], [4.5, 2.4]] as const) {
        const p = new At(b, x + px, y + 1.8, z - 5.98);
        p.box('iplain', w, 1.7, 0.02, 0, 0, 0.01, PARCH);
        p.box('iplain', w + 0.12, 0.1, 0.04, 0, 1.7, 0.02, DARKWOOD);
        for (let k = 0; k < 6; k++) p.box('iplain', w * 0.7, 0.03, 0.01, 0, 0.3 + k * 0.22, 0.03, col(0.35, 0.25, 0.15));
      }
      for (let r = 0; r < 3; r++) for (const lx of [-4.4, -1.5, 1.5, 4.4]) studentDesk(new At(b, x + lx, y, z - 1.4 + r * 2.2, Math.PI), 2.2);
      for (const pz of [-2, 2]) pane(b, 1.8, 3.6, x + 7.49, y + 1.8, z + pz, -Math.PI / 2);
      for (const pz of [-1.5, 3]) chandelier(b, x, y + 4.4, z + pz, 1.2, 10, 1.6);
    },
  });

  // ================================================================ 中庭東翼：意若思鏡的空教室
  chamber({
    k: 46,
    id: 'erised',
    name: '空教室與意若思鏡',
    intro: '廢棄的教室，桌椅都疊到牆邊去了，中央立著一面華麗的大鏡子。鏡框上刻著一行倒過來的字：我呈現的不是你的面容，而是你內心的渴望。',
    w: 12,
    d: 10,
    h: 5.5,
    tint: col(0.9, 0.9, 0.95),
    outside: WING_DOORS.erised,
    ambient: 0.15,
    lights: ([x, y, z]) => [warm([x, y + 3, z - 1], 70, 12, 0xd8e0ff)],
    fill: (b, [x, y, z]) => {
      // 疊在牆邊的桌椅
      for (let i = 0; i < 5; i++) {
        for (let k = 0; k < 2; k++) {
          const p = new At(b, x - 5.4 + k * 0.4, y + k * 0.8, z - 3.5 + i * 1.6, Math.PI / 2 + k * 0.1);
          table(p, 1.4, 0.7, 0.78, col(0.55, 0.45, 0.38));
        }
        chair(new At(b, x + 5.2, y, z - 3.5 + i * 1.5, -Math.PI / 2 + i * 0.3), col(0.55, 0.45, 0.38));
      }
      // 意若思鏡
      const m = new At(b, x, y, z - 3.2);
      for (const s of [-1, 1]) {
        m.box('iplain', 0.25, 0.25, 0.8, s * 1.0, 0, 0, GOLD);
        m.cyl('iplain', 0.1, 0.13, 3.6, s * 1.0, 0.25, 0, 8, GOLD);
      }
      m.box('iplain', 2.3, 0.3, 0.2, 0, 3.85, 0, GOLD);
      m.geo('iplain', new THREE.TorusGeometry(0.9, 0.09, 6, 20, Math.PI), 0, 3.85, 0, GOLD);
      m.box('iplain', 1.8, 3.4, 0.04, 0, 0.45, 0.02, col(0.55, 0.6, 0.7));
      m.box('iglow', 1.7, 3.2, 0.01, 0, 0.55, 0.05, col(0.18, 0.2, 0.26));
      m.box('iplain', 2.1, 0.18, 0.06, 0, 4.0, 0.1, col(0.7, 0.5, 0.15));
      for (let i = 0; i < 14; i++) m.box('iplain', 0.06, 0.08, 0.01, -0.85 + i * 0.13, 4.05, 0.14, col(0.25, 0.15, 0.05));
      b.box('iplain', 4, 0.02, 3, x, y, z - 1.5, 0, col(0.25, 0.08, 0.08));
      pane(b, 1.4, 3, x - 2.5, y + 1.6, z - 4.99, 0);
      pane(b, 1.4, 3, x + 2.5, y + 1.6, z - 4.99, 0);
    },
  });

  // ================================================================ 圖書館旁的圓塔：書籍修補室
  chamber({
    k: 47,
    id: 'bookRepair',
    name: '書籍修補室',
    intro: '平斯夫人修書的地方：漿糊、針線、一疊疊破掉的書頁。籠子裡那本怪獸的怪獸書，只有摸書背它才會安靜。',
    r: 5.6,
    h: 4.6,
    outside: SMALL_TOWER_DOORS.bookRepair,
    lights: ([x, y, z]) => [warm([x, y + 3.4, z], 90, 13)],
    fill: (b, [x, y, z], ring) => {
      for (const a of [1.2, 2.2, 3.2, 4.2, 5.1]) bookshelf(ring(a, 5.15), 2.4, 3.6);
      const t = new At(b, x, y, z - 0.3);
      table(t, 2.4, 1.2, 0.85);
      chair(t.at(0, 0, 0.9, Math.PI));
      for (let i = 0; i < 4; i++) t.box('iplain', 0.4, 0.06 + i * 0.03, 0.3, -0.7 + i * 0.45, 0.85, 0, [RED, BLUE, col(0.3, 0.2, 0.1), col(0.1, 0.25, 0.12)][i], i * 0.3);
      t.cyl('iplain', 0.07, 0.07, 0.12, 0.9, 0.85, 0.3, 8, WHITE);
      t.cyl('iplain', 0.01, 0.01, 0.2, 0.9, 0.95, 0.3, 4, col(0.6, 0.45, 0.2));
      deskLamp(t.at(-1.0, 0.85, -0.4));
      // 關在鐵籠裡的怪獸書
      const c = ring(-1.4, 3.6);
      c.box('iwood', 0.9, 0.7, 0.7, 0, 0, 0, DARKWOOD);
      for (let i = 0; i < 6; i++) c.cyl('iplain', 0.01, 0.01, 0.6, -0.35 + i * 0.14, 0.7, 0.3, 4, STEEL);
      for (let i = 0; i < 6; i++) c.cyl('iplain', 0.01, 0.01, 0.6, -0.35 + i * 0.14, 0.7, -0.3, 4, STEEL);
      c.box('iplain', 0.8, 0.04, 0.65, 0, 1.3, 0, STEEL);
      c.box('iplain', 0.4, 0.15, 0.3, 0, 0.72, 0, col(0.45, 0.38, 0.2), 0.4);
      for (let k = 0; k < 4; k++) c.geo('iplain', new THREE.ConeGeometry(0.02, 0.06, 3), -0.12 + k * 0.08, 0.8, 0.12, WHITE);
    },
  });

  // ================================================================ 大廳角落的小塔：大廳上方的閣樓
  chamber({
    k: 48,
    id: 'hallAttic',
    name: '大廳上方的閣樓',
    intro: '大廳屋頂底下堆放節慶裝飾的閣樓：聖誕節的金色彩球、萬聖節的南瓜燈、四個學院的大旗都收在這裡。',
    w: 26,
    d: 8,
    h: 3.6,
    tint: col(0.9, 0.85, 0.78),
    outside: SMALL_TOWER_DOORS.hallAttic,
    entry: ([x, , z]) => ({ x: x - 12.95, z, face: Math.PI / 2 }),
    ambient: 0.1,
    lights: ([x, y, z]) => [warm([x - 6, y + 2.6, z], 60, 14), warm([x + 6, y + 2.6, z], 60, 14)],
    fill: (b, [x, y, z]) => {
      const rng = b.rng;
      for (let i = 0; i < 9; i++) b.box('iwood', 0.3, 0.3, 8, x - 12 + i * 3, y + 3.2, z, 0, DARKWOOD);
      for (let i = 0; i < 9; i++) for (const s of [-1, 1]) b.rod('iwood', V(x - 12 + i * 3, y, z + s * 3.8), V(x - 12 + i * 3, y + 3.3, z + s * 2.6), 0.12, DARKWOOD, 4);
      // 收起來的四面學院大旗
      for (let i = 0; i < 4; i++) {
        const p = new At(b, x - 6 + i * 2.2, y, z - 3.2);
        p.box('iplain', 1.6, 0.5, 0.6, 0, 0, 0, HOUSES[i]);
        p.box('iplain', 1.6, 0.06, 0.62, 0, 0.3, 0, GOLD);
      }
      // 聖誕彩球、南瓜燈與箱子
      for (let i = 0; i < 6; i++) {
        const p = new At(b, x + 2 + (i % 3) * 1.4, y, z + 2.6 - Math.floor(i / 3) * 1.4, rng());
        p.box('iwood', 1.0, 0.6, 0.8, 0, 0, 0, col(0.7, 0.55, 0.38));
        for (let k = 0; k < 4; k++) p.sphere('iplain', 0.12, -0.25 + (k % 2) * 0.5, 0.68, -0.15 + Math.floor(k / 2) * 0.3, [GOLD, RED, col(0.7, 0.72, 0.75), col(0.2, 0.4, 0.2)][(k + i) % 4], 1, 8);
      }
      for (let i = 0; i < 7; i++) {
        const px = x + 7 + (i % 4) * 0.9;
        const pz = z - 1.5 + Math.floor(i / 4) * 1.2;
        b.sphere('iplain', 0.35, px, y + 0.3, pz, col(0.85, 0.42, 0.06), 0.8, 9);
        b.sphere('iglow', 0.07, px, y + 0.38, pz + 0.3, col(2.4, 1.2, 0.2), 1, 5);
      }
      for (let i = 0; i < 8; i++) b.cyl('iplain', 0.05, 0.05, 0.3, x - 9 + rng() * 3, y, z + rng() * 2, 5, col(0.9, 0.86, 0.75));
      b.box('iwood', 2, 1.2, 1.2, x - 10, y, z + 2.6, 0.2, col(0.45, 0.35, 0.28));
      for (const s of [-1, 1]) pane(b, 1, 1.4, x + s * 12.99, y + 1.2, z + 2, (-s * Math.PI) / 2);
    },
  });

  // ================================================================ 北門的警衛室
  chamber({
    k: 49,
    id: 'gatehouse',
    name: '北門的警衛室',
    intro: '門樓裡的警衛室：一排長戟靠在牆邊，桌上一盞油燈、一張棋盤。開學和戰時才會有人站崗。',
    w: 9,
    d: 7,
    h: 4.4,
    tint: col(0.88, 0.86, 0.84),
    outside: SMALL_TOWER_DOORS.gate,
    ambient: 0.2,
    lights: ([x, y, z]) => [warm([x, y + 3, z], 70, 12), warm([x - 3.2, y + 1.2, z - 3], 50, 8, 0xff8a40)],
    fill: (b, [x, y, z]) => {
      fireplace(new At(b, x - 3.2, y, z - 3.5), 1.8);
      for (let i = 0; i < 6; i++) {
        const p = new At(b, x + 4.3, y, z - 2 + i * 0.5, -Math.PI / 2);
        p.cyl('iplain', 0.025, 0.025, 2.6, 0, 0, 0.1, 5, col(0.4, 0.28, 0.16));
        p.geo('iplain', new THREE.ConeGeometry(0.08, 0.5, 4), 0, 2.85, 0.1, STEEL);
        p.box('iplain', 0.3, 0.2, 0.02, 0.1, 2.4, 0.1, STEEL);
      }
      b.box('iwood', 0.2, 0.1, 3.2, x + 4.4, y + 1.6, z - 0.75, 0, DARKWOOD);
      const t = new At(b, x - 0.5, y, z - 1.2);
      table(t, 1.8, 1.0);
      for (const s of [-1, 1]) chair(t.at(s * 1.1, 0, 0, -s * Math.PI / 2));
      t.box('iplain', 0.5, 0.02, 0.5, 0.3, 0.76, 0, WHITE);
      for (let i = 0; i < 6; i++) t.cyl('iplain', 0.015, 0.03, 0.08, 0.15 + (i % 3) * 0.12, 0.78, i < 3 ? -0.15 : 0.15, 5, i < 3 ? BLACK : WHITE);
      t.cyl('iplain', 0.07, 0.09, 0.2, -0.5, 0.76, 0, 6, IRON);
      t.sphere('iglow', 0.05, -0.5, 1.0, 0, FIRE, 1.4, 5);
      armour(new At(b, x - 3.8, y, z + 2.4, Math.PI / 2));
      pane(b, 0.4, 1.8, x + 2, y + 1.4, z - 3.49, 0);
    },
  });

  // ================================================================ 城牆崗哨：四座小塔共用一間
  {
    const k = 50;
    const [ox, oy, oz] = pocketOrigin(k);
    const r = 4.6;
    const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const ends = angles.map((a): DoorEnd => ({ pos: [ox + Math.sin(a) * (r - 0.05), oy, oz + Math.cos(a) * (r - 0.05)], face: a + Math.PI, name: '城牆崗哨' }));
    chamber({
      k,
      id: 'lookout',
      name: '城牆崗哨',
      intro: '城牆小塔裡的崗哨：一個火盆、一架望遠鏡，四面的箭孔看得到湖、森林和遠方的活米村。',
      r,
      h: 4,
      tint: col(0.88, 0.86, 0.84),
      outside: LOOKOUT_DOORS[0],
      ambient: 0.4,
      lights: () => [warm([ox, oy + 1.4, oz], 80, 11, 0xff8a40)],
      fill: (b, _o, ring) => {
        for (let i = 1; i < 4; i++) door(new At(b, ends[i].pos[0], oy, ends[i].pos[2], ends[i].face), 1.7, 2.9);
        for (let i = 0; i < 4; i++) pane(b, 0.35, 1.8, ox + Math.sin(angles[i] + Math.PI / 4) * (r - 0.12), oy + 1.3, oz + Math.cos(angles[i] + Math.PI / 4) * (r - 0.12), angles[i] + Math.PI / 4 + Math.PI);
        b.cyl('iplain', 0.45, 0.25, 0.7, ox, oy, oz, 10, IRON);
        for (let i = 0; i < 4; i++) b.sphere('iglow', 0.14, ox + Math.cos(i * 1.6) * 0.16, oy + 0.75, oz + Math.sin(i * 1.6) * 0.16, FIRE, 1.6, 6);
        const tel = ring(Math.PI / 4 + 0.15, 3.2);
        for (let j = 0; j < 3; j++) tel.geo('iplain', new THREE.CylinderGeometry(0.025, 0.025, 1.3, 4), Math.cos(j * 2.09) * 0.28, 0.6, Math.sin(j * 2.09) * 0.28, BRONZE, 0, Math.cos(j * 2.09) * 0.2, Math.sin(j * 2.09) * 0.2);
        tel.geo('iplain', new THREE.CylinderGeometry(0.06, 0.09, 1.3, 8), 0, 1.45, -0.25, BRONZE, 0, -1.1);
        for (const a of [2.4, -2.4]) {
          const p = ring(a, 3.8);
          p.box('iwood', 1.5, 0.08, 0.45, 0, 0.42, 0, DARKWOOD);
          for (const s of [-1, 1]) p.box('iwood', 0.08, 0.42, 0.4, s * 0.6, 0, 0, DARKWOOD);
        }
      },
    });
    for (let i = 1; i < 4; i++) link(LOOKOUT_DOORS[i], ends[i]);
  }

  // ================================================================ 城堡中段的廂房：巴拿巴斯的掛毯走廊
  chamber({
    k: 51,
    id: 'barnabas',
    name: '傻子巴拿巴斯的掛毯走廊',
    intro: '牆上的大掛毯畫著傻子巴拿巴斯想教巨怪跳芭蕾，巨怪們正拿棍子打他。對面那片空牆，來回走三次就會出現一扇門。',
    w: 26,
    d: 6,
    h: 6,
    tint: col(1.0, 0.96, 0.9),
    outside: WING_DOORS.barnabas,
    entry: ([x, , z]) => ({ x: x + 12.95, z, face: -Math.PI / 2 }),
    spawnDist: 2.2,
    lights: ([x, y, z]) => [warm([x - 7, y + 4.4, z], 110, 16), warm([x + 7, y + 4.4, z], 110, 16)],
    fill: (b, [x, y, z]) => {
      b.box('iplain', 24, 0.02, 1.8, x, y, z, 0, RED);
      // 掛毯
      const p = new At(b, x - 4, y + 1.0, z - 2.97);
      p.box('iplain', 9, 4, 0.04, 0, 0, 0.02, col(0.45, 0.35, 0.22));
      p.box('iplain', 9.2, 0.15, 0.06, 0, 4, 0.03, GOLD);
      p.box('iplain', 8.6, 1.2, 0.01, 0, 0.1, 0.05, col(0.25, 0.4, 0.2));
      for (let i = 0; i < 4; i++) {
        const lx = -3 + i * 1.8;
        p.sphere('iplain', 0.45, lx, 1.8, 0.06, col(0.45, 0.48, 0.42), 1.3, 7);
        p.sphere('iplain', 0.2, lx, 2.6, 0.07, col(0.45, 0.48, 0.42), 1, 6);
        p.geo('iplain', new THREE.CylinderGeometry(0.15, 0.55, 0.3, 10), lx, 1.45, 0.07, col(0.95, 0.6, 0.75));
        p.geo('iplain', new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5), lx + 0.4, 2.4, 0.08, col(0.35, 0.25, 0.15), 0, 0, -0.6);
      }
      p.sphere('iplain', 0.18, 3.6, 2.6, 0.07, col(0.85, 0.7, 0.55), 1, 6);
      p.box('iplain', 0.4, 0.9, 0.02, 3.6, 1.6, 0.07, col(0.5, 0.2, 0.5));
      // 對面那面「空牆」與兩旁的盔甲、畫像
      for (const px of [-11, -7, 2, 6, 10]) armour(new At(b, x + px, y, z + 2.4, Math.PI));
      for (const px of [6.5, 10.5]) portrait(new At(b, x + px, y + 2, z - 2.99), 1.2, 1.6);
      for (const px of [-10, 9]) torch(b, x + px, y + 3, z - 3, 0);
      pane(b, 1.6, 3.4, x - 12.99, y + 1.6, z, Math.PI / 2);
    },
  });

  // ================================================================ 東北廂房：鍊金術教室
  chamber({
    k: 52,
    id: 'alchemy',
    name: '鍊金術教室',
    intro: '六、七年級的選修課，只有夠多學生選才會開。爐火正旺，蒸餾瓶裡冒著泡，講台上放著一塊紅色的石頭模型。',
    w: 14,
    d: 10,
    h: 5.5,
    tint: col(0.95, 0.9, 0.85),
    outside: WING_DOORS.alchemy,
    ambient: 0.2,
    lights: ([x, y, z]) => [warm([x, y + 4, z], 110, 18), warm([x - 4.5, y + 1.2, z - 3.6], 90, 9, 0xff7a30)],
    fill: (b, [x, y, z]) => {
      // 煉金爐
      const f = new At(b, x - 4.5, y, z - 4.4);
      f.box('istone', 2.4, 1.4, 1.2, 0, 0, 0, col(0.5, 0.45, 0.42));
      f.cyl('istone', 0.5, 0.8, 2.5, 0, 1.4, 0, 8, col(0.5, 0.45, 0.42));
      f.box('iplain', 0.9, 0.6, 0.02, 0, 0.3, 0.61, BLACK);
      for (let k = 0; k < 4; k++) f.sphere('iglow', 0.14, -0.3 + k * 0.2, 0.45, 0.55, FIRE, 1.3, 6);
      cauldron(f.at(1.8, 0, 0.5), 1.2, col(2.4, 1.6, 0.3));
      // 工作台上的蒸餾器、曲頸瓶、坩堝
      for (const pz of [-0.5, 2.2]) {
        const t = new At(b, x + 1, y, z + pz);
        table(t, 6, 1.2, 0.9, DARKWOOD);
        for (let i = 0; i < 5; i++) {
          const lx = -2.4 + i * 1.2;
          t.sphere('iplain', 0.16, lx, 1.06, 0, col(0.6, 0.7, 0.72), 1, 8);
          t.sphere('iglow', 0.1, lx, 1.03, 0, [col(1.4, 0.3, 0.2), col(0.4, 1.4, 0.5), col(1.4, 1.2, 0.3)][i % 3], 1, 6);
          b.rod('iplain', V(t.x + lx * Math.cos(0), y + 1.2, t.z), V(t.x + lx + 0.5, y + 1.0, t.z + 0.1), 0.02, col(0.6, 0.7, 0.72), 4);
          t.cyl('iplain', 0.04, 0.05, 0.1, lx + 0.55, 0.9, 0.1, 6, col(0.6, 0.7, 0.72));
        }
        for (const s of [-1, 1]) chair(t.at(s * 1.5, 0, 0.9, Math.PI));
      }
      // 講台上的魔法石模型
      const s = new At(b, x + 4.5, y, z - 3.8);
      s.cyl('istone', 0.3, 0.4, 1.0, 0, 0, 0, 8, MARBLE);
      s.geo('iglow', new THREE.OctahedronGeometry(0.16), 0, 1.15, 0, col(2.4, 0.2, 0.25));
      blackboard(new At(b, x + 2, y + 1.4, z - 4.99), 3.6, 1.8);
      potionShelf(new At(b, x + 6.7, y, z + 2, -Math.PI / 2), 4, 5);
    },
  });

  // ================================================================ 東側廂房：麥教授的辦公室
  chamber({
    k: 53,
    id: 'mcgonagall',
    name: '麥教授的辦公室',
    intro: '葛來分多院長的辦公室：格子呢的地毯、整齊的書桌，桌角那個錫罐裝的是薑汁蠑螈餅乾。',
    w: 9,
    d: 8,
    h: 4.6,
    tint: col(1.1, 1.02, 0.92),
    outside: WING_DOORS.mcgonagall,
    lights: ([x, y, z]) => [warm([x, y + 3.4, z], 100, 14), warm([x + 3, y + 1.3, z - 3.6], 50, 8, 0xff8a40)],
    fill: (b, [x, y, z]) => {
      // 格子呢地毯
      for (let i = 0; i < 6; i++) for (let k = 0; k < 5; k++) b.box('iplain', 0.6, 0.02 + ((i + k) % 2) * 0.003, 0.6, x - 1.5 + i * 0.6, y, z - 1.2 + k * 0.6, 0, (i + k) % 2 ? col(0.4, 0.05, 0.05) : col(0.05, 0.15, 0.07));
      const t = new At(b, x - 1.5, y, z - 2.4);
      table(t, 2.2, 1.0, 0.8);
      chair(t.at(0, 0, -0.8));
      for (const s of [-1, 1]) chair(t.at(s * 0.6, 0, 1.1, Math.PI));
      t.cyl('iplain', 0.12, 0.12, 0.16, 0.8, 0.8, 0.2, 10, col(0.6, 0.15, 0.1));
      t.cyl('iplain', 0.125, 0.125, 0.03, 0.8, 0.96, 0.2, 10, GOLD);
      for (let i = 0; i < 4; i++) t.box('iplain', 0.22, 0.008, 0.3, -0.6 + i * 0.25, 0.8, 0, i === 3 ? col(0.85, 0.75, 0.9) : PARCH, i * 0.1);
      fireplace(new At(b, x + 3, y, z - 4), 1.6);
      bookshelf(new At(b, x - 4.2, y, z, Math.PI / 2), 3.4, 3.4);
      // 窗台上的一排升學輔導手冊
      pane(b, 1.4, 2.4, x + 2, y + 1.5, z + 3.99, Math.PI);
      for (let i = 0; i < 6; i++) b.box('iplain', 0.2, 0.28, 0.03, x + 3.4, y + 0.9 + i * 0.01, z + 2.5 + i * 0.25, 0.1, [PARCH, col(0.6, 0.75, 0.85), col(0.85, 0.7, 0.5)][i % 3]);
      b.box('iwood', 0.5, 0.9, 1.8, x + 3.4, y, z + 3.1, 0, DARKWOOD);
    },
  });

  // ================================================================ 天文塔旁的廂房：天文學教室
  chamber({
    k: 54,
    id: 'astroClass',
    name: '天文學教室',
    intro: '白天上天文學理論的地方：天花板吊著一整套太陽系模型，行星慢慢繞著發光的太陽。',
    w: 14,
    d: 11,
    h: 6,
    tint: col(0.95, 0.97, 1.05),
    outside: WING_DOORS.astroClass,
    ambient: 0.35,
    lights: ([x, y, z]) => [warm([x, y + 4.6, z], 140, 20, 0xe6ecff), warm([x, y + 4.2, z - 1], 60, 8, 0xffd080)],
    fill: (b, [x, y, z]) => {
      // 吊著的太陽系
      b.cyl('iplain', 0.015, 0.015, 1.2, x, y + 4.8, z - 1, 4, IRON);
      b.sphere('iglow', 0.4, x, y + 4.4, z - 1, col(3.5, 2.4, 0.8), 1, 14);
      const P = [col(0.6, 0.55, 0.5), col(0.85, 0.7, 0.4), col(0.25, 0.45, 0.8), col(0.75, 0.35, 0.2), col(0.8, 0.65, 0.5), col(0.85, 0.75, 0.55), col(0.5, 0.75, 0.85), col(0.3, 0.4, 0.85)];
      for (let i = 0; i < 8; i++) {
        const rr = 0.9 + i * 0.55;
        const a = i * 2.2;
        const px = x + Math.sin(a) * rr;
        const pz = z - 1 + Math.cos(a) * rr;
        b.cyl('iplain', 0.006, 0.006, 6 - 4.4 + 0.2, px, y + 4.2, pz, 3, IRON);
        b.sphere('iplain', [0.06, 0.1, 0.11, 0.08, 0.28, 0.24, 0.16, 0.15][i], px, y + 4.2, pz, P[i], 1, 10);
        if (i === 5) b.add('iplain', new THREE.TorusGeometry(0.38, 0.04, 3, 20).rotateX(Math.PI / 2.3), mat4(px, y + 4.2, pz), col(0.8, 0.7, 0.5));
        b.add('iplain', new THREE.TorusGeometry(rr, 0.005, 3, 48).rotateX(Math.PI / 2), mat4(x, y + 4.4, z - 1), BRONZE);
      }
      const bb = new At(b, x, y + 1.3, z - 5.5);
      bb.box('iplain', 5, 2, 0.05, 0, 0, 0.03, NIGHT);
      const rng = b.rng;
      for (let i = 0; i < 40; i++) bb.box('iglow', 0.04, 0.04, 0.01, (rng() - 0.5) * 4.6, 0.1 + rng() * 1.8, 0.07, col(1.4, 1.4, 1.6));
      for (let r = 0; r < 2; r++) for (const lx of [-3.4, 0, 3.4]) studentDesk(new At(b, x + lx, y, z + 0.2 + r * 2.2, Math.PI), 2.2);
      for (let i = 0; i < 5; i++) {
        const p = new At(b, x - 6.6, y, z - 2 + i * 0.6, Math.PI / 2);
        p.geo('iplain', new THREE.CylinderGeometry(0.05, 0.08, 1.4, 8), 0, 1.0, 0, BRONZE, 0, 0.15);
      }
      for (const pz of [-2, 2]) pane(b, 1.6, 3.4, x + 6.99, y + 1.8, z + pz, -Math.PI / 2);
    },
  });

  // ================================================================ 葛來分多塔旁的廂房：鼻涕蟲社的派對室
  chamber({
    k: 55,
    id: 'slugClub',
    name: '鼻涕蟲社的派對室',
    intro: '史拉轟教授辦聖誕派對的房間：天花板垂著翠綠、深紅與金色的帷幔，像一頂大帳篷，桌上堆滿了點心。',
    w: 14,
    d: 12,
    h: 5.5,
    tint: col(1.1, 0.95, 0.85),
    outside: WING_DOORS.slugClub,
    ambient: 0.2,
    lights: ([x, y, z]) => [warm([x, y + 4, z], 150, 20, 0xffc070), warm([x - 4, y + 2.5, z - 3], 60, 10, 0xff9050)],
    fill: (b, [x, y, z]) => {
      // 帳篷般的帷幔
      const DR = [col(0.05, 0.3, 0.12), RED, GOLD];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        b.rod('iplain', V(x, y + 5.3, z), V(x + Math.sin(a) * 7, y + 3.4, z + Math.cos(a) * 6), 0.18, DR[i % 3], 4, 0.4);
      }
      // 掛在帷幔下的金色燈籠
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785 + 0.4;
        const px = x + Math.sin(a) * 3.5;
        const pz = z + Math.cos(a) * 3;
        b.cyl('iplain', 0.005, 0.005, 0.9, px, y + 3.6, pz, 3, IRON);
        b.sphere('iglow', 0.15, px, y + 3.5, pz, col(3, 1.9, 0.6), 1.3, 8);
      }
      for (const [px, pz] of [[-3.5, -2], [3.5, -2], [-3.5, 2.8], [3.5, 2.8]]) {
        const t = new At(b, x + px, y, z + pz);
        roundTable(t, 0.8, 0.78, DARKWOOD);
        t.cyl('iplain', 0.75, 0.75, 0.02, 0, 0.78, 0, 16, RED);
        for (let k = 0; k < 6; k++) t.sphere('iplain', 0.08, Math.cos(k) * 0.4, 0.86, Math.sin(k) * 0.4, [GOLD, col(0.6, 0.3, 0.15), WHITE][k % 3], 0.7, 6);
        t.cyl('iplain', 0.04, 0.05, 0.25, 0, 0.8, 0, 6, col(0.3, 0.1, 0.1));
      }
      // 史拉轟的大扶手椅與沙漏狀的蜂蜜酒瓶
      armchair(new At(b, x, y, z - 4.6), col(0.05, 0.3, 0.12));
      armchair(new At(b, x + 1.3, y, z - 4.4, -0.4), col(0.05, 0.3, 0.12));
      const t = new At(b, x - 1.5, y, z - 4.5);
      roundTable(t, 0.45, 0.6, DARKWOOD);
      t.cyl('iplain', 0.08, 0.1, 0.35, 0, 0.6, 0, 8, col(0.6, 0.4, 0.1));
      sofa(new At(b, x + 5.2, y, z, -Math.PI / 2), 2.6, RED);
      b.box('iplain', 9, 0.02, 7, x, y, z, 0, col(0.3, 0.05, 0.06));
    },
  });

  // ================================================================ 葛來分多副塔：掃帚櫃
  chamber({
    k: 56,
    id: 'broomCupboard',
    name: '掃帚櫃',
    intro: '城堡裡到處都有的那種掃帚櫃：水桶、拖把、一堆舊掃帚。飛七常常在這種地方埋伏抓夜遊的學生。',
    r: 3.2,
    h: 3.4,
    tint: col(0.85, 0.82, 0.78),
    outside: SMALL_TOWER_DOORS.broomCupboard,
    ambient: 0.1,
    lights: ([x, y, z]) => [warm([x, y + 2.6, z], 30, 7, 0xffb070)],
    fill: (b, [x, y, z], ring) => {
      for (let i = 0; i < 9; i++) {
        const p = ring(1.6 + i * 0.32, 2.9);
        p.geo('iplain', new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), 0, 1.0, -0.1, col(0.45, 0.32, 0.2), 0, -0.15);
        p.geo('iplain', new THREE.ConeGeometry(0.12, 0.45, 6), 0, 0.15, 0, col(0.55, 0.45, 0.28));
      }
      for (let i = 0; i < 3; i++) b.cyl('iplain', 0.22, 0.18, 0.38, x - 1.4 + i * 0.5, y, z - 1.5 + (i % 2) * 0.4, 8, STEEL);
      b.cyl('iplain', 0.025, 0.025, 1.5, x + 1.3, y, z - 1.4, 4, col(0.45, 0.32, 0.2));
      for (let k = 0; k < 6; k++) b.cyl('iplain', 0.02, 0.01, 0.35, x + 1.3 + Math.cos(k) * 0.08, y, z - 1.4 + Math.sin(k) * 0.08, 3, WHITE);
      b.box('iwood', 1.2, 1.1, 0.5, x - 1.6, y, z + 0.2, 1.3, DARKWOOD);
    },
  });

  // ================================================================ 城堡中段的圓塔：級長會議室
  chamber({
    k: 57,
    id: 'prefects',
    name: '級長會議室',
    intro: '每學期開學，各學院的級長與男女學生主席在這裡開會，排定巡邏走廊的班表。',
    r: 5.8,
    h: 4.8,
    outside: SMALL_TOWER_DOORS.prefects,
    lights: ([x, y, z]) => [warm([x, y + 3.6, z], 110, 15)],
    fill: (b, [x, y, z], ring) => {
      roundTable(new At(b, x, y, z), 2.2, 0.78, DARKWOOD);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        chair(new At(b, x + Math.sin(a) * 2.8, y, z + Math.cos(a) * 2.8, a + Math.PI));
        b.box('iplain', 0.3, 0.01, 0.22, x + Math.sin(a) * 1.7, y + 0.78, z + Math.cos(a) * 1.7, a, PARCH);
      }
      // 四個學院的旗子與級長徽章展示
      for (let i = 0; i < 4; i++) {
        const p = ring(1.6 + i * 0.75, 5.75, 1.4);
        p.box('iplain', 0.9, 1.8, 0.03, 0, 0, 0, HOUSES[i]);
        p.box('iplain', 0.9, 0.1, 0.04, 0, 1.8, 0, GOLD);
        p.box('iplain', 0.28, 0.32, 0.02, 0, 1.0, 0.03, GOLD);
      }
      const bb = ring(-1.6, 5.75, 1.3);
      bb.box('iwood', 1.6, 1.1, 0.04, 0, 0, 0, DARKWOOD);
      for (let i = 0; i < 6; i++) bb.box('iplain', 0.4, 0.3, 0.01, -0.55 + (i % 3) * 0.55, 0.15 + Math.floor(i / 3) * 0.45, 0.03, PARCH);
      chandelier(b, x, y + 3.6, z, 1.2, 10, 1.2);
    },
  });

  // ================================================================ 城堡中段的圓塔：失物招領室
  chamber({
    k: 58,
    id: 'lostProperty',
    name: '失物招領室',
    intro: '學生丟三落四的東西都被送到這裡：單隻的襪子、沒人認領的帽子、還有一顆發紅的記憶球，提醒著某人忘了什麼。',
    r: 6,
    h: 4.6,
    tint: col(0.95, 0.95, 1.0),
    outside: SMALL_TOWER_DOORS.lostProperty,
    lights: ([x, y, z]) => [warm([x, y + 3.4, z], 90, 14)],
    fill: (b, [x, y, z], ring) => {
      const rng = b.rng;
      for (const a of [1.2, 2.1, 3.0, 3.9, 4.8]) {
        const p = ring(a, 5.55);
        p.box('iwood', 2.2, 3.2, 0.06, 0, 0, -0.25, DARKWOOD);
        for (let r = 0; r < 4; r++) {
          p.box('iwood', 2.2, 0.04, 0.5, 0, 0.5 + r * 0.7, 0, DARKWOOD);
          for (let i = 0; i < 4; i++) p.box('iplain', 0.42, 0.32, 0.4, -0.75 + i * 0.5, 0.54 + r * 0.7, 0, col(0.6 + rng() * 0.2, 0.5 + rng() * 0.15, 0.35));
        }
      }
      for (let i = 0; i < 24; i++) {
        const a = rng() * Math.PI * 2;
        const d = 1 + rng() * 3;
        const kind = i % 4;
        const px = x + Math.sin(a) * d;
        const pz = z + Math.cos(a) * d;
        if (kind === 0) b.box('iplain', 0.1, 0.03, 0.3, px, y, pz, a, [RED, BLUE, col(0.6, 0.55, 0.2), WHITE][i % 4]);
        else if (kind === 1) b.cone('iplain', 0.22, 0.45, px, y, pz, 8, col(0.15, 0.12, 0.12));
        else if (kind === 2) b.box('iplain', 0.35, 0.08, 0.25, px, y, pz, a, col(0.4, 0.25, 0.15));
        else b.box('iplain', 0.8, 0.04, 0.12, px, y, pz, a, [RED, GOLD, col(0.05, 0.25, 0.1), BLUE][i % 4]);
      }
      const t = new At(b, x, y, z - 1);
      table(t, 1.6, 0.8);
      t.sphere('iglow', 0.08, 0, 0.84, 0, col(2.6, 0.3, 0.3), 1, 8);
      t.sphere('iplain', 0.085, 0, 0.84, 0, col(0.7, 0.8, 0.85), 1, 8);
      t.box('iplain', 0.5, 0.01, 0.35, 0.5, 0.76, 0, PARCH);
    },
  });

  // ================================================================ 東側的圓塔：第十一號教室
  chamber({
    k: 59,
    id: 'classroom11',
    name: '第十一號教室',
    intro: '人馬翡冷翠教占卜學的教室：地板長滿青苔，四周是樹，天花板上是會動的星空，像把禁忌森林搬進了城堡。',
    r: 7.2,
    h: 6,
    tint: col(0.25, 0.35, 0.25),
    outside: SMALL_TOWER_DOORS.classroom11,
    ambient: 0.08,
    extraHeight: 4,
    lights: ([x, y, z]) => [warm([x, y + 4.5, z], 110, 20, 0x9fb8ff), warm([x, y + 1.2, z], 45, 9, 0xc8ffd0)],
    fill: (b, [x, y, z], ring) => {
      const rng = b.rng;
      b.cyl('iplain', 7.1, 7.1, 0.04, x, y, z, 32, col(0.12, 0.25, 0.08));
      for (let i = 0; i < 40; i++) {
        const a = rng() * Math.PI * 2;
        const d = rng() * 6.5;
        b.sphere('iplain', 0.15 + rng() * 0.2, x + Math.sin(a) * d, y, z + Math.cos(a) * d, col(0.1, 0.3, 0.08), 0.4, 6);
      }
      // 沿牆的樹
      for (let i = 0; i < 10; i++) {
        const a = 0.5 + i * 0.53;
        const p = ring(a, 6.2);
        p.cyl('iwood', 0.18, 0.28, 3.2, 0, 0, 0, 7, col(0.35, 0.26, 0.18));
        for (let k = 0; k < 3; k++) p.sphere('iplain', 0.9 + k * 0.2, (rng() - 0.5) * 0.8, 2.4 + k * 0.7, (rng() - 0.5) * 0.8, [col(0.1, 0.28, 0.08), col(0.06, 0.2, 0.06), col(0.14, 0.32, 0.1)][k], 0.8, 7);
      }
      // 天花板：一片星空
      const g = new THREE.SphereGeometry(7.15, 30, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, 0.5, 1);
      g.translate(x, y + 6, z);
      b.add('iplain', g, undefined, NIGHT);
      for (let i = 0; i < 160; i++) {
        const a = rng() * Math.PI * 2;
        const el = Math.asin(0.1 + rng() * 0.88);
        const rr = 7.0 * Math.cos(el);
        b.sphere('iglow', rng() > 0.92 ? 0.06 : 0.03, x + Math.sin(a) * rr, y + 6 + 3.5 * Math.sin(el), z + Math.cos(a) * rr, col(2.4, 2.5, 3), 1, 4);
      }
      // 中央的一小堆營火與學生坐的樹墩
      for (let k = 0; k < 4; k++) b.sphere('iglow', 0.12, x + Math.cos(k * 1.6) * 0.15, y + 0.15, z + Math.sin(k * 1.6) * 0.15, col(1.2, 2.4, 1.4), 1.6, 6);
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        b.cyl('iwood', 0.3, 0.34, 0.45, x + Math.sin(a) * 2.6, y, z + Math.cos(a) * 2.6, 9, col(0.45, 0.33, 0.22));
      }
    },
  });

  // ================================================================ 醫院廂房裡的小圓塔：魔藥材料儲藏室
  chamber({
    k: 60,
    id: 'ingredients',
    name: '魔藥材料儲藏室',
    intro: '醫院與魔藥課共用的備用材料：非洲樹蛇皮、雙角獸角粉、甲蟲眼珠。少了什麼，石內卜一定第一個發現。',
    r: 5,
    h: 4.4,
    tint: col(0.75, 0.8, 0.85),
    outside: SMALL_TOWER_DOORS.storeroom,
    ambient: 0.1,
    lights: ([x, y, z]) => [warm([x, y + 3, z], 60, 11, 0xc0ffd0)],
    fill: (b, [x, y, z], ring) => {
      for (const a of [1.1, 2.0, 2.9, 3.8, 4.7, 5.5]) potionShelf(ring(a, 4.6), 2.2, 5);
      for (let i = 0; i < 4; i++) {
        const p = new At(b, x - 1.2 + (i % 2) * 0.9, y, z - 1.2 + Math.floor(i / 2) * 0.9);
        p.cyl('iwood', 0.38, 0.38, 0.85, 0, 0, 0, 10, col(0.55, 0.42, 0.3));
        p.cyl('iplain', 0.4, 0.4, 0.05, 0, 0.2, 0, 10, IRON);
        p.cyl('iplain', 0.4, 0.4, 0.05, 0, 0.65, 0, 10, IRON);
      }
      for (let i = 0; i < 6; i++) {
        const px = x + 1.4 + (i % 3) * 0.4;
        b.cyl('iplain', 0.006, 0.006, 0.9, px, y + 3.0, z + 1, 3, IRON);
        b.cyl('iplain', 0.07, 0.03, 0.5, px, y + 2.5, z + 1, 5, [col(0.25, 0.35, 0.12), col(0.5, 0.4, 0.2), col(0.15, 0.25, 0.1)][i % 3]);
      }
      // 蛇皮
      b.box('iplain', 1.6, 0.01, 0.3, x + 1.5, y + 0.02, z - 0.6, 0.6, col(0.4, 0.45, 0.25));
    },
  });

  void GREENLAMP;
  void sofa;
}
