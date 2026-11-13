import * as THREE from 'three';
import { Builder, col, mat4, KEEP_CLEAR } from './kit';
import { getMaterials } from './materials';
import { PL, heightAt } from '../world/heightfield';
import { greatHallInterior, entranceInterior, staircaseInterior, GH } from './interiors';
import { libraryInterior, hospitalInterior, clockInterior, corridorInterior, CORR } from './scenes/public';
import { greenhouseInterior, astronomyDeck } from './scenes/classrooms';
import { boathouseInterior, pottingShed } from './scenes/campus';
import { DOORS, towerDoor, doorDecal } from './scenes/doors';
import { TOWER_DOORS as TD } from './scenes/towers';
import { WING_DOORS, SMALL_TOWER_DOORS, LOOKOUT_DOORS } from './scenes/wings';

export interface Built {
  id: string;
  group: THREE.Group;
}

const Y = PL;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const WARM = col(1.08, 1.02, 0.93);
const COOL = col(0.9, 0.92, 0.96);
const DARK = col(0.78, 0.78, 0.8);
const PAVE = col(0.8, 0.78, 0.74);
const IRON = col(0.04, 0.04, 0.045);

/** 城牆：一段帶城垛的厚牆 */
function curtain(b: Builder, x0: number, z0: number, x1: number, z1: number, h = 11, th = 3.2, tint?: THREE.Color) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = Math.atan2(-(z1 - z0), x1 - x0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  b.box('stone', len, h + 16, th, cx, Y - 16, cz, ry, tint);
  b.box('stone', len, 0.5, th + 0.6, cx, Y + h - 0.5, cz, ry, tint);
  b.crenelRect(len, th + 0.6, cx, Y + h, cz, ry, tint);
  const n = Math.floor(len / 9);
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n - 0.5) * len;
    for (const s of [1, -1]) {
      const a = ry + (s === 1 ? 0 : Math.PI);
      b.window(0.5, 2.0, cx + Math.cos(ry) * t + Math.sin(a) * (th / 2), Y + h * 0.45, cz - Math.sin(ry) * t + Math.cos(a) * (th / 2), a, 3, 0.06);
    }
  }
}

/** 拱廊牆：把兩棟建築連起來，底下的尖拱可以走過去 */
function arcade(b: Builder, x0: number, z0: number, x1: number, z1: number, h = 7.5, tint?: THREE.Color) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const spans = Math.max(2, Math.round(len / 6.5));
  const spring = Y + 2.9;
  const { span, ry } = b.archWall('stone', V(x0, 0, z0), V(x1, 0, z1), Y + h, spring, spans, 1.5, 1.9, 0.4, tint);
  const ux = (x1 - x0) / len;
  const uz = (z1 - z0) / len;
  for (let i = 0; i <= spans; i++) {
    const px = x0 + ux * span * i;
    const pz = z0 + uz * span * i;
    b.box('stone', 1.5, spring - Y + 6, 1.9, px, Y - 6, pz, ry, tint);
    b.box('stone', 1.9, 0.5, 2.3, px, Y - 0.1, pz, ry, tint);
  }
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  b.box('stone', len + 1.5, 0.4, 2.4, cx, Y + h - 0.4, cz, ry, tint);
  b.crenelRect(len + 1.5, 2.4, cx, Y + h, cz, ry, tint, 1.1, 1.0);
}

/** 噴泉 */
function fountain(b: Builder, x: number, z: number, s = 1) {
  b.cyl('stone', 4.2 * s, 4.4 * s, 0.9, x, Y, z, 12, PAVE);
  b.cyl('matte', 3.8 * s, 3.8 * s, 0.1, x, Y + 0.75, z, 12, col(0.05, 0.09, 0.1));
  b.cyl('stone', 0.5 * s, 0.7 * s, 3.2 * s, x, Y, z, 8, PAVE);
  b.cyl('stone', 1.7 * s, 0.4 * s, 0.5, x, Y + 3.2 * s, z, 10, PAVE);
  b.cyl('stone', 0.25 * s, 0.35 * s, 1.6 * s, x, Y + 3.2 * s, z, 6, PAVE);
  b.sphere('stone', 0.45 * s, x, Y + 5.0 * s, z, PAVE);
}

/** 迴廊：一排尖拱＋單斜屋頂。牆面永遠在行進方向的左手邊（局部 -Z 側） */
function cloister(b: Builder, x0: number, z0: number, x1: number, z1: number, depth: number, h = 6.5, gap?: number) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const spans = Math.max(2, Math.round(len / 5.2));
  b.archWall('stone', V(x0, 0, z0), V(x1, 0, z1), Y + h, Y + 2.6, spans, 0.9, 0.9, 0.45, WARM);
  const ry = Math.atan2(-(z1 - z0), x1 - x0);
  // 拱只從起拱點往上砌，底下要有落地的柱身，不然柱子會懸在半空
  for (let i = 0; i <= spans; i++) {
    const t = i / spans;
    const px = x0 + (x1 - x0) * t;
    const pz = z0 + (z1 - z0) * t;
    if (gap != null && Math.abs(t * len - gap) < 1.7) continue;
    b.box('stone', 0.9, 2.7, 0.9, px, Y, pz, ry, WARM);
    b.box('stone', 1.15, 0.22, 1.15, px, Y + 2.45, pz, ry, WARM);
    b.box('stone', 1.2, 0.35, 1.2, px, Y, pz, ry, WARM);
  }
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  // 拱下的矮牆
  if (gap == null) b.box('stone', len, 0.9, 1.1, cx, Y, cz, ry, WARM);
  else {
    // 在某一跨留出通道
    const ux = (x1 - x0) / len;
    const uz = (z1 - z0) / len;
    for (const [a, e] of [[0, gap - 2.3], [gap + 2.3, len]]) b.box('stone', e - a, 0.9, 1.1, x0 + (ux * (a + e)) / 2, Y, z0 + (uz * (a + e)) / 2, ry, WARM);
  }
  // 單斜屋頂（往牆的方向升高）
  const hl = len / 2;
  const P = [
    [-hl, h, 0.6],
    [hl, h, 0.6],
    [hl, h + 2.4, -depth],
    [-hl, h + 2.4, -depth],
  ];
  const pos: number[] = [];
  for (const i of [0, 1, 2, 0, 2, 3]) pos.push(P[i][0], P[i][1], P[i][2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add('roof', g, mat4(cx, Y, cz, ry));
}

export function buildCastle(): Built[] {
  KEEP_CLEAR.length = 0;
  for (const d of [...Object.values(DOORS), ...Object.values(TD), ...Object.values(WING_DOORS), ...Object.values(SMALL_TOWER_DOORS), ...LOOKOUT_DOORS]) KEEP_CLEAR.push([d.pos[0], d.pos[2]]);
  KEEP_CLEAR.push([CORR.x0, CORR.door], [CORR.x1, CORR.door], [GH.door, GH.z0], [162, 30], [-95, 78], [-65, 78], [-65, 66]);
  const M = getMaterials();
  const out: Built[] = [];
  const done = (id: string, b: Builder) => out.push({ id, group: b.build(id, M) });

  // ================================================================ 大廳
  {
    const b = new Builder(11);
    const gx = -105;
    const gz = 112;
    b.wing({ x: gx, z: gz, y: Y, w: 72, d: 26, h: 30, roofH: 21, rows: 1, spacing: 8, winW: 4.3, winH: 19.5, winType: 1, winY: 5.5, buttress: true, tint: WARM, noBody: true, skipWin: (wx, wz) => wz < gz && Math.abs(wx - GH.door) < 3 });
    greatHallInterior(b);
    // 西側山牆的大窗
    b.window(10, 23, gx - 36, Y + 5, gz, -Math.PI / 2, 1);
    b.window(4, 4, gx - 36, Y + 33, gz, -Math.PI / 2, 5);
    // 四角的八角小塔
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const tx = gx + sx * 36;
      const tz = gz + sz * 13;
      b.cyl('stone', 2.5, 2.8, 30 + 9 + 16, tx, Y - 16, tz, 8, WARM);
      b.cyl('stone', 2.9, 2.9, 0.6, tx, Y + 30, tz, 8, WARM);
      b.cyl('stone', 2.9, 2.9, 0.6, tx, Y + 38.4, tz, 8, WARM);
      b.cone('roof', 3.1, 10, tx, Y + 39, tz, 8);
      b.cyl('matte', 0.05, 0.12, 2.4, tx, Y + 48.6, tz, 5, IRON);
      for (let k = 0; k < 4; k++) b.window(0.6, 2.2, tx + Math.sin(k * 1.57 + 0.78) * 2.5, Y + 31.5, tz + Math.cos(k * 1.57 + 0.78) * 2.5, k * 1.57 + 0.78, 3, 0.06);
    }
    // 屋脊中央的小尖塔
    b.cyl('stone', 1.7, 1.9, 6, gx, Y + 49, gz, 8, WARM);
    for (let k = 0; k < 8; k++) b.window(0.7, 2.6, gx + Math.sin(k * 0.785) * 1.8, Y + 51.6, gz + Math.cos(k * 0.785) * 1.8, k * 0.785, 0, 0.05);
    b.cone('roof', 2.3, 15, gx, Y + 55, gz, 8);
    b.cyl('matte', 0.05, 0.12, 3, gx, Y + 69.6, gz, 5, IRON);
    // 朝湖一側的露台
    b.box('stone', 78, 14, 6, gx, Y - 13, gz + 16, 0, DARK);
    b.crenelRect(78, 6, gx, Y + 1, gz + 16, 0, DARK, 1.2, 0.9);
    done('greatHall', b);
  }

  // ================================================================ 入口大廳與高架橋庭院
  {
    const b = new Builder(12);
    b.wing({ x: -80, z: 78, y: Y, w: 40, d: 30, h: 34, ry: Math.PI / 2, roofH: 17, rows: 3, spacing: 6.5, winW: 1.6, winH: 4.2, tint: WARM, sides: [true, false], dormers: 3, noBody: true, skipWin: (_wx, wz) => Math.abs(wz - 66) < 2.6 || Math.abs(wz - 78) < 2.6 });
    entranceInterior(b);
    // 朝庭院的大門上方的大窗
    b.window(5.5, 11, -95, Y + 14, 78, -Math.PI / 2, 1, 0.2);
    b.box('stone', 3, 0.5, 12, -97.5, Y, 78, 0, PAVE);
    b.box('stone', 2, 0.25, 14, -99.5, Y, 78, 0, PAVE);
    for (const dz of [-5, 5]) {
      b.box('stone', 1.6, 13, 1.6, -96, Y, 78 + dz, 0, WARM);
      b.pinnacle(-96, Y + 13, 78 + dz, 0.9, WARM);
      b.sphere('lamp', 0.4, -96.9, Y + 5.2, 78 + dz, col(1, 0.62, 0.25));
    }
    done('entrance', b);
  }
  {
    const b = new Builder(13);
    // 鋪面
    b.box('stone', 76, 0.5, 48, -134, Y - 0.25, 74.5, 0, PAVE);
    // 北側迴廊與西側城牆
    cloister(b, -172, 51.5, -97, 51.5, 5.5);
    b.box('stone', 76, 9, 1.2, -134, Y, 46.2, 0, WARM);
    curtain(b, -174, 46, -174, 62, 10, 3, WARM);
    curtain(b, -174, 82, -174, 99, 10, 3, WARM);
    // 門樓：兩座小塔夾著拱門
    for (const dz of [-8.5, 8.5]) {
      b.roundTower({ x: -174, z: 72 + dz, y: Y, r: 4.2, h: 20, roofH: 9, seg: 12, rows: 2, per: 3, tint: WARM, top: 'corbel' });
      b.sphere('lamp', 0.45, -169.4, Y + 5, 72 + dz * 0.62, col(1, 0.62, 0.25));
    }
    b.archWall('stone', V(-174, 0, 66), V(-174, 0, 78), Y + 13, Y + 5.5, 1, 3.4, 4.5, 0.4, WARM);
    b.crenelRect(4.5, 12, -174, Y + 13, 72, 0, WARM);
    fountain(b, -138, 76, 0.8);
    done('viaductCourtyard', b);
  }

  // ================================================================ 高架橋
  {
    const b = new Builder(14);
    const x0 = -177;
    const x1 = -404;
    const z = 72;
    const spans = 7;
    const span = (x0 - x1) / spans;
    const topY = Y - 0.7;
    const R = (span - 5.2) / 2;
    const springY = topY - R - 3.2;
    b.archWall('stone', V(x1, 0, z), V(x0, 0, z), topY, springY, spans, 5.2, 8.4, 0.12, COOL);
    for (let i = 0; i <= spans; i++) {
      const px = x1 + i * span;
      const g = Math.min(heightAt(px, z), heightAt(px, z - 5), heightAt(px, z + 5)) - 4;
      if (springY - g > 1) {
        const hgt = springY - g;
        b.box('stone', 5.2, hgt, 8.4, px, g, z, 0, COOL);
        b.box('stone', 6.4, hgt * 0.55, 9.8, px, g, z, 0, COOL);
        b.box('stone', 7.6, hgt * 0.22, 11.2, px, g, z, 0, COOL);
        b.box('stone', 5.8, 0.8, 9.0, px, springY - 0.8, z, 0, COOL);
      }
      // 橋墩頂的小壁龕與燈
      for (const s of [1, -1]) {
        b.box('stone', 2.4, 3.2, 1.2, px, topY + 0.7, z + s * 4.6, 0, COOL);
        b.sphere('lamp', 0.38, px, topY + 4.4, z + s * 4.6, col(1, 0.62, 0.25));
        b.cyl('matte', 0.07, 0.07, 0.9, px, topY + 3.9, z + s * 4.6, 5, IRON);
      }
    }
    // 橋面與護欄
    b.box('stone', x0 - x1, 0.7, 9.4, (x0 + x1) / 2, topY, z, 0, PAVE);
    for (const s of [1, -1]) {
      b.box('stone', x0 - x1, 1.3, 0.7, (x0 + x1) / 2, topY + 0.7, z + s * 4.35, 0, COOL);
      const n = Math.round((x0 - x1) / 3.2);
      for (let i = 0; i < n; i += 2) b.box('stone', 1.6, 0.7, 0.7, x1 + (i + 0.5) * ((x0 - x1) / n), topY + 2.0, z + s * 4.35, 0, COOL);
    }
    done('viaduct', b);
  }

  // ================================================================ 大樓梯塔
  {
    const b = new Builder(15);
    b.squareTower({ x: -42, z: 70, y: Y, w: 34, d: 34, h: 82, roofH: 30, turrets: 3.5, turretH: 15, rows: 7, cols: 3, winW: 1.7, winH: 4.4, noBody: true });
    staircaseInterior(b);
    // 塔頂的採光亭
    b.cyl('stone', 2.4, 2.6, 5, -42, Y + 82 + 26, 70, 8);
    done('grandStaircase', b);
  }

  // ================================================================ 中庭（變形學庭院）
  {
    const b = new Builder(16);
    const cx = 30;
    const cz = 42;
    b.wing({ x: cx, z: 8, y: Y, w: 78, d: 13, h: 22, roofH: 9, rows: 2, spacing: 6, dormers: 5, chimneys: 2 });
    b.wing({ x: cx, z: 76, y: Y, w: 78, d: 13, h: 22, roofH: 9, rows: 2, spacing: 6, dormers: 5, chimneys: 2 });
    b.wing({ x: -3, z: cz, y: Y, w: 56, d: 13, h: 22, ry: Math.PI / 2, roofH: 9, rows: 2, spacing: 6, dormers: 3, noBody: true, skipWin: (_wx, wz) => Math.abs(wz - CORR.door) < 2.6 });
    corridorInterior(b);
    b.wing({ x: 63, z: cz, y: Y, w: 56, d: 13, h: 22, ry: Math.PI / 2, roofH: 9, rows: 2, spacing: 6, dormers: 3 });
    b.box('stone', 54, 0.4, 56, cx, Y - 0.2, cz, 0, PAVE);
    cloister(b, 5, 19.5, 55, 19.5, 5);
    cloister(b, 55, 64.5, 5, 64.5, 5);
    cloister(b, 8.5, 64, 8.5, 20, 5, 6.5, 64 - CORR.door);
    cloister(b, 51.5, 20, 51.5, 64, 5);
    fountain(b, cx, cz, 1);
    // 北側的雙鐘塔
    b.squareTower({ x: 12, z: 2, y: Y, w: 11, d: 11, h: 56, roofH: 17, turrets: 1.5, turretH: 7, rows: 5, cols: 1 });
    b.squareTower({ x: 48, z: 2, y: Y, w: 11, d: 11, h: 60, roofH: 17, turrets: 1.5, turretH: 7, rows: 5, cols: 1 });
    done('quad', b);
  }

  // ================================================================ 黑魔法防禦術塔
  {
    const b = new Builder(17);
    b.roundTower({ x: 77, z: -4, y: Y, r: 11.5, h: 76, roofH: 27, rows: 8, per: 5, tint: COOL });
    b.bartizan(77 + 11.2, -4 + 4, Y + 50, 3.6, 22, 11, COOL);
    b.bartizan(77 - 6, -4 - 10.5, Y + 42, 3.2, 18, 10, COOL);
    b.wing({ x: 96, z: 20, y: Y, w: 44, d: 12, h: 20, roofH: 8, ry: -0.9, rows: 2, spacing: 6 });
    towerDoor(b, TD.dada, 2.4, 3.6, 2.8, COOL);
    done('darkTower', b);
  }

  // ================================================================ 圖書館翼
  {
    const b = new Builder(18);
    b.wing({ x: -48, z: -1, y: Y, w: 108, d: 22, h: 30, ry: Math.PI / 2, roofH: 14, rows: 3, spacing: 6.2, winW: 1.8, winH: 4.6, dormers: 6, chimneys: 3, buttress: false, noBody: true });
    libraryInterior(b);
    b.roundTower({ x: -36, z: -56, y: Y, r: 6, h: 54, roofH: 16, rows: 5, per: 3 });
    done('library', b);
  }

  // ================================================================ 校長室塔
  {
    const b = new Builder(19);
    const hx = -98;
    const hz = 16;
    b.roundTower({ x: hx, z: hz, y: Y, r: 9.5, h: 68, roofH: 25, rows: 7, per: 4, tint: WARM });
    // 三座懸挑的小塔樓簇擁著主塔
    const angs = [0.5, 2.6, 4.5];
    angs.forEach((a, i) => {
      b.bartizan(hx + Math.sin(a) * 10.4, hz + Math.cos(a) * 10.4, Y + 44 + i * 4, 3.9, 22 + i * 3, 12, WARM);
    });
    b.wing({ x: -74, z: 16, y: Y, w: 30, d: 14, h: 26, roofH: 10, rows: 3, spacing: 5.5, tint: WARM });
    towerDoor(b, TD.gargoyle, 2.4, 3.6, 2.6, WARM);
    doorDecal(b, TD.staffRoom, 2, 3.2, 0.04);
    done('headmaster', b);
  }

  // ================================================================ 天文塔
  {
    const b = new Builder(20);
    const ax = -118;
    const az = -92;
    b.squareTower({ x: ax, z: az, y: Y, w: 32, d: 32, h: 36, roof: 'flat', crenel: true, turrets: 2.6, turretH: 8, rows: 3, cols: 3, tint: COOL });
    b.roundTower({ x: ax, z: az, y: Y + 30, r: 12.5, h: 84, roofH: 0, top: 'crenel', rows: 8, per: 5, tint: COOL, found: 2 });
    // 頂端的觀星台與中央小塔
    const deck = Y + 30 + 84 + 0.6;
    b.roundTower({ x: ax, z: az, y: deck, r: 6.6, h: 19, roofH: 25, rows: 2, per: 4, tint: COOL, found: 1 });
    // 觀星台上的渾天儀
    for (let k = 0; k < 3; k++) {
      const g = new THREE.TorusGeometry(1.5, 0.07, 5, 20);
      b.add('matte', g, mat4(ax + 9.6, deck + 2.6, az + 2, k * 1.05, k * 0.9, 0), col(0.5, 0.38, 0.12));
    }
    b.cyl('matte', 0.1, 0.25, 1.2, ax + 9.6, deck, az + 2, 6, IRON);
    b.bartizan(ax + 12.4, az - 4, Y + 78, 4.4, 26, 14, COOL);
    b.bartizan(ax - 9, az + 9.2, Y + 66, 4.0, 24, 13, COOL);
    b.bartizan(ax - 5, az - 11.8, Y + 86, 3.4, 18, 11, COOL);
    // 相連的副塔
    b.roundTower({ x: ax + 24, z: az + 14, y: Y, r: 6.5, h: 82, roofH: 21, rows: 8, per: 3, tint: COOL });
    b.wing({ x: ax + 12, z: az + 22, y: Y, w: 26, d: 11, h: 44, roofH: 9, ry: -0.5, rows: 5, spacing: 5.5, tint: COOL });
    astronomyDeck(b);
    towerDoor(b, DOORS.astronomyBase, 2.4, 3.6, 3.2, COOL);
    towerDoor(b, TD.astronomyNorth, 2.2, 3.4, 1.2, COOL);
    towerDoor(b, TD.astronomyAnnex, 1.8, 3.0, 2.0, COOL);
    done('astronomy', b);
  }

  // ================================================================ 雷文克勞塔
  {
    const b = new Builder(21);
    b.roundTower({ x: -166, z: -38, y: Y, r: 9.2, h: 80, roofH: 27, rows: 8, per: 4 });
    b.bartizan(-166 - 9, -38 + 3, Y + 52, 3.4, 20, 11);
    b.bartizan(-166 + 5, -38 - 8, Y + 60, 3.0, 16, 10);
    b.roundTower({ x: -155, z: -55, y: Y, r: 5.2, h: 60, roofH: 16, rows: 6, per: 3 });
    b.wing({ x: -143, z: -68, y: Y, w: 36, d: 12, h: 24, roofH: 9, ry: 0.72, rows: 3, spacing: 5.5 });
    towerDoor(b, DOORS.ravenclaw);
    towerDoor(b, TD.ravenclawAnnex, 1.8, 3.0, 2.0);
    doorDecal(b, TD.ravenclawWing, 2, 3.2, 0.04);
    done('ravenclaw', b);
  }

  // ================================================================ 占卜學塔（北塔）
  {
    const b = new Builder(22);
    b.roundTower({ x: 62, z: -128, y: Y, r: 7.6, h: 96, roofH: 25, rows: 10, per: 3, tint: WARM });
    b.bartizan(62 + 7.6, -128 - 3, Y + 70, 3.2, 20, 11, WARM);
    b.roundTower({ x: 73, z: -116, y: Y, r: 4.6, h: 68, roofH: 15, rows: 7, per: 2, tint: WARM });
    towerDoor(b, DOORS.divination, 2, 3.2, 2.4, WARM);
    towerDoor(b, TD.divinationAnnex, 1.6, 2.8, 1.8, WARM);
    done('divination', b);
  }

  // ================================================================ 葛來分多塔
  {
    const b = new Builder(23);
    b.roundTower({ x: 128, z: 96, y: Y, r: 11, h: 92, roofH: 29, rows: 10, per: 5, tint: WARM });
    b.bartizan(128 + 10.8, 96 + 3, Y + 62, 3.8, 24, 12, WARM);
    b.bartizan(128 - 4, 96 + 10.4, Y + 54, 3.4, 20, 11, WARM);
    b.bartizan(128 - 8, 96 - 8, Y + 70, 3.2, 20, 11, WARM);
    b.roundTower({ x: 111, z: 110, y: Y, r: 6.2, h: 70, roofH: 19, rows: 7, per: 3, tint: WARM });
    b.wing({ x: 96, z: 92, y: Y, w: 46, d: 15, h: 27, roofH: 10, ry: 0.12, rows: 3, spacing: 5.5, tint: WARM, dormers: 3 });
    towerDoor(b, TD.gryffindor, 2.2, 3.4, 2.6, WARM);
    done('gryffindor', b);
  }

  // ================================================================ 醫院廂房
  {
    const b = new Builder(24);
    b.wing({ x: 152, z: 30, y: Y, w: 60, d: 20, h: 25, ry: Math.PI / 2, roofH: 12, rows: 2, spacing: 6, winW: 1.9, winH: 5.4, buttress: true, sides: [true, true], noBody: true, skipWin: (wx, wz) => wx > 152 && Math.abs(wz - 30) < 2.6 });
    hospitalInterior(b);
    b.roundTower({ x: 152, z: 66, y: Y, r: 7, h: 54, roofH: 18, rows: 5, per: 3 });
    b.wing({ x: 108, z: 42, y: Y, w: 70, d: 11, h: 19, roofH: 7, rows: 2, spacing: 6 });
    towerDoor(b, TD.hospitalTower, 1.8, 3.0, 2.0);
    doorDecal(b, TD.hospitalWing, 2, 3.2, 0.04);
    done('hospital', b);
  }

  // ================================================================ 鐘樓與鐘樓庭院
  {
    const b = new Builder(25);
    const cx = 152;
    const cz = -48;
    b.squareTower({ x: cx, z: cz, y: Y, w: 19, d: 19, h: 70, roofH: 24, turrets: 2.2, turretH: 10, rows: 3, cols: 2, tint: WARM, noBody: true });
    clockInterior(b);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      b.window(12, 12, cx + Math.sin(a) * 9.5, Y + 48, cz + Math.cos(a) * 9.5, a, 2, 0.25);
    }
    b.wing({ x: cx, z: cz + 28, y: Y, w: 36, d: 13, h: 22, roofH: 9, ry: Math.PI / 2, rows: 3, spacing: 5.5, tint: WARM });
    doorDecal(b, TD.mugglesWing, 2, 3.2, 0.04);
    done('clockTower', b);
  }
  {
    const b = new Builder(26);
    const cx = 184;
    const cz = -48;
    b.box('stone', 44, 0.5, 46, cx, Y - 0.25, cz, 0, PAVE);
    cloister(b, 163, -69, 205, -69, 5);
    cloister(b, 205, -27, 163, -27, 5);
    b.box('stone', 44, 8, 1.2, cx, Y, -74.2, 0, WARM);
    b.box('stone', 44, 8, 1.2, cx, Y, -21.8, 0, WARM);
    curtain(b, 206, -74, 206, -56, 8, 2.6, WARM);
    curtain(b, 206, -40, 206, -22, 8, 2.6, WARM);
    b.archWall('stone', V(206, 0, -54), V(206, 0, -42), Y + 10, Y + 4.5, 1, 3, 3.4, 0.45, WARM);
    for (const z of [-54, -42]) b.box('stone', 3.4, 4.6, 3, 206, Y, z, 0, WARM);
    fountain(b, cx - 2, cz, 0.85);
    // 庭院裡的幾塊立石與長凳
    for (let i = 0; i < 4; i++) b.box('stone', 2.4, 0.5, 0.8, cx - 10 + i * 6.5, Y, cz + 12, 0, PAVE);
    done('clockCourtyard', b);
  }

  // ================================================================ 木造廊橋
  {
    const b = new Builder(27);
    const A = V(207, Y, -48);
    const B = V(337, 69.2, -53);
    const n = 30;
    const dir = new THREE.Vector3().subVectors(B, A);
    const len = dir.length();
    dir.normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const ry = Math.atan2(-dir.z, dir.x);
    const frames: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(A, B, t);
      p.y -= Math.sin(Math.PI * t) * 1.5;
      p.addScaledVector(perp, Math.sin(i * 1.3) * 0.35 * Math.sin(Math.PI * t));
      frames.push(p);
    }
    const WD = col(0.95, 0.9, 0.85);
    const WR = col(0.55, 0.42, 0.32);
    for (let i = 0; i <= n; i++) {
      const p = frames[i];
      const lean = (b.rng() - 0.5) * 0.25;
      const L = p.clone().addScaledVector(perp, 2.2);
      const R = p.clone().addScaledVector(perp, -2.2);
      const LT = L.clone().add(V(0, 3.4, 0)).addScaledVector(dir, lean);
      const RT = R.clone().add(V(0, 3.4, 0)).addScaledVector(dir, lean);
      const ridge = p.clone().add(V(0, 5.0, 0)).addScaledVector(dir, lean);
      b.beam('wood', L, LT, 0.34, WD);
      b.beam('wood', R, RT, 0.34, WD);
      b.beam('wood', LT, RT, 0.3, WD);
      b.beam('wood', LT, ridge, 0.22, WD);
      b.beam('wood', RT, ridge, 0.22, WD);
      if (i < n) {
        const q = frames[i + 1];
        const mid = new THREE.Vector3().addVectors(p, q).multiplyScalar(0.5);
        const seg = p.distanceTo(q);
        const pitch = Math.asin((q.y - p.y) / seg);
        b.add('wood', new THREE.BoxGeometry(seg + 0.1, 0.28, 4.9), mat4(mid.x, mid.y - 0.14, mid.z, ry, 0, pitch), WD);
        b.gable('roof', null, seg + 0.2, 5.0, 1.7, mid.x, mid.y + 3.45, mid.z, ry, 0.45, WR);
        const L2 = q.clone().addScaledVector(perp, 2.2);
        const R2 = q.clone().addScaledVector(perp, -2.2);
        for (const [s0, s1] of [[L, L2], [R, R2]] as const) {
          b.beam('wood', s0.clone().add(V(0, 1.15, 0)), s1.clone().add(V(0, 1.15, 0)), 0.16, WD);
          if (i % 2 === 0) b.beam('wood', s0.clone().add(V(0, 0.1, 0)), s1.clone().add(V(0, 3.3, 0)), 0.16, WD);
          else b.beam('wood', s0.clone().add(V(0, 3.3, 0)), s1.clone().add(V(0, 0.1, 0)), 0.16, WD);
        }
        // 屋簷下的燈籠
        if (i % 5 === 2) b.sphere('lamp', 0.26, mid.x, mid.y + 3.0, mid.z, col(1, 0.6, 0.22));
      }
      // 支撐橋身的高腳木架
      if (i % 2 === 0) {
        const g = heightAt(p.x, p.z);
        const drop = p.y - g;
        if (drop > 2.5) {
          const splay = 1 + drop * 0.1;
          const LB = V(p.x, g - 1.5, p.z).addScaledVector(perp, 2.2 + splay);
          const RB = V(p.x, g - 1.5, p.z).addScaledVector(perp, -2.2 - splay);
          b.beam('wood', L, LB, 0.42, WD);
          b.beam('wood', R, RB, 0.42, WD);
          const levels = Math.floor(drop / 7);
          for (let k = 1; k <= levels; k++) {
            const t0 = (k - 0.5) / (levels + 0.5);
            const t1 = (k + 0.3) / (levels + 0.5);
            const a0 = new THREE.Vector3().lerpVectors(L, LB, t0);
            const b0 = new THREE.Vector3().lerpVectors(R, RB, t0);
            const a1 = new THREE.Vector3().lerpVectors(L, LB, Math.min(t1, 1));
            const b1 = new THREE.Vector3().lerpVectors(R, RB, Math.min(t1, 1));
            b.beam('wood', a0, b0, 0.26, WD);
            b.beam('wood', k % 2 ? a0 : b0, k % 2 ? b1 : a1, 0.2, WD);
          }
        }
      }
    }
    // 兩端的石砌橋台
    b.box('stone', 5, 9, 7.5, 338.5, 61, -53, ry, WARM);
    b.archWall('stone', V(339, 0, -57), V(339, 0, -49), 69.2 + 5.6, 69.2 + 2.4, 1, 2.4, 2.4, 0.45, WARM);
    void len;
    done('woodenBridge', b);
  }

  // ================================================================ 溫室
  {
    const b = new Builder(28);
    for (let i = 0; i < 3; i++) {
      const gz = -170 - i * 15;
      const gx = 92 + (i === 1 ? 4 : 0);
      b.box('stone', 36, 1.1, 10.4, gx, Y - 0.2, gz, 0, PAVE);
      greenhouseInterior(b, gx, gz, i);
      b.box('matte', 35.6, 0.25, 0.25, gx, Y + 7.8, gz, 0, col(0.7, 0.72, 0.7));
      // 花圃
      for (let k = 0; k < 6; k++) b.box('matte', 4, 0.5, 1.6, gx - 14 + k * 5.6, Y, gz + 7.2, 0, col(0.1, 0.16, 0.06));
    }
    // 盆栽棚（挖空，可以走進去）
    pottingShed(b, 56, 68, -190.5, -181.5, Y + 0.15, WARM);
    b.gable('roof', 'stone', 12, 9, 4.5, 62, Y + 6.15, -186, 0, 0.5, undefined, WARM);
    b.window(1.2, 2.2, 62, Y + 1.75, -181.1, 0, 0);
    done('greenhouses', b);
    // 玻璃不擋陽光，溫室裡才會亮
    out[out.length - 1].group.traverse((o) => o.name.endsWith(':glass') && (o.castShadow = false));
  }

  // ================================================================ 船屋與下湖的長階梯
  {
    const b = new Builder(29);
    const bx = -190;
    const bz = 158;
    b.box('stone', 26, 6, 15, bx, -4.4, bz, 0.5, DARK);
    {
      // 臨湖那一面的大開口不放窗
      const c = Math.cos(0.5);
      const sn = Math.sin(0.5);
      const ox = bx + 5.25 * sn;
      const oz = bz + 5.25 * c;
      b.wing({ x: bx, z: bz, y: 1.6, w: 19, d: 10.5, h: 7.5, ry: 0.5, roofH: 8, rows: 1, spacing: 4.4, winW: 1.5, winH: 3.6, winY: 1.4, tint: WARM, found: 2, gableWin: null, noBody: true, skipWin: (wx, wz) => Math.hypot(wx - ox, wz - oz) < 2 });
      boathouseInterior(b, { x: bx, z: bz, y: 1.6, w: 19, d: 10.5, ry: 0.5 }, 7.5, 2, WARM);
    }
    for (const [lx, lz] of [[-9, 6.5], [0, 6.5], [9, 6.5], [-11, -3], [11, -3]]) {
      const c = Math.cos(0.5);
      const s = Math.sin(0.5);
      const wx = bx + lx * c + lz * s;
      const wz = bz - lx * s + lz * c;
      b.cyl('matte', 0.08, 0.08, 3.2, wx, 1.6, wz, 5, IRON);
      b.sphere('lamp', 0.3, wx, 5.0, wz, col(1, 0.6, 0.22));
    }
    // 停泊的小船
    for (let i = 0; i < 5; i++) {
      const g = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      g.scale(0.85, 0.55, 2.3);
      const a = 0.5 + (b.rng() - 0.5) * 0.5;
      b.add('wood', g, mat4(bx - 13 + i * 3.4 + 6 * Math.sin(0.5), 0.45, bz + 13 + i * 1.2, a), col(0.8, 0.7, 0.6));
    }
    // 沿著峭壁蜿蜒而上的石階
    const steps = 150;
    let prevX = -212;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = 2 + t * 67;
      const flight = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
      const z = t < 0.5 ? 150 - flight * 62 : 88 + flight * 44;
      // 找出峭壁上高度等於 y 的位置
      let lo = -235;
      let hi = -150;
      for (let k = 0; k < 14; k++) {
        const mid = (lo + hi) / 2;
        if (heightAt(mid, z) < y) lo = mid;
        else hi = mid;
      }
      const x = (lo + hi) / 2 - 1.1;
      prevX = x;
      b.box('stone', 2.8, 1.6, 1.3, x, y - 1.4, z, 0, DARK);
      if (i % 6 === 0) b.box('stone', 0.5, 2.6, 0.5, x - 1.4, y - 0.6, z, 0, DARK);
      if (i % 30 === 15) b.sphere('lamp', 0.24, x - 1.4, y + 2.3, z, col(1, 0.6, 0.22));
    }
    void prevX;
    done('boathouse', b);
  }

  // ================================================================ 其餘城牆、連接建築與點綴的塔樓
  {
    const b = new Builder(30);
    // 北翼（教室）
    b.wing({ x: -30, z: -106, y: Y, w: 140, d: 20, h: 28, roofH: 13, rows: 3, spacing: 6, dormers: 7, chimneys: 4 });
    b.roundTower({ x: 20, z: -74, y: Y, r: 6, h: 52, roofH: 16, rows: 5, per: 3 });
    b.roundTower({ x: -8, z: -40, y: Y, r: 6.5, h: 58, roofH: 18, rows: 6, per: 3, tint: COOL });
    b.wing({ x: 8, z: -42, y: Y, w: 60, d: 13, h: 24, roofH: 9, ry: Math.PI / 2, rows: 3, spacing: 5.5 });
    b.roundTower({ x: 118, z: -22, y: Y, r: 7.4, h: 60, roofH: 19, rows: 6, per: 3 });
    b.wing({ x: 100, z: -70, y: Y, w: 76, d: 13, h: 22, roofH: 9, ry: 0.86, rows: 2, spacing: 6, dormers: 3 });
    b.roundTower({ x: 100, z: 44, y: Y, r: 5.6, h: 50, roofH: 15, rows: 5, per: 3, tint: COOL });
    // 沿著岬角邊緣的城牆
    curtain(b, -176, -30, -176, 44, 12, 3.4);
    curtain(b, -168, -100, -134, -128, 12, 3.4);
    curtain(b, -66, 127, 20, 122, 13, 3.4);
    curtain(b, 20, 122, 76, 124, 13, 3.4);
    curtain(b, 76, 124, 112, 118, 13, 3.4);
    curtain(b, 140, 106, 170, 76, 12, 3.4);
    curtain(b, 172, 70, 180, -18, 11, 3.2);
    // 這段城牆中途被東北廂房穿過：分成兩段，各自接到廂房的牆面
    curtain(b, 70, -122, 110, -92, 11, 3.2);
    curtain(b, 121, -83.8, 150, -62, 11, 3.2);
    curtain(b, 40, -115, 56, -126, 11, 3.2);
    // 補上原本斷開的幾段：西牆接雷文克勞塔、西北角接天文塔、北門接北塔
    curtain(b, -171, -47, -168, -100, 12, 3.4);
    curtain(b, -134, -128, -127, -108, 12, 3.4);
    curtain(b, 60.5, -147, 62, -136, 11, 3.2);
    // 把零散的廂房與塔串起來的拱廊牆（拱下可以通行）
    arcade(b, -36, -62.5, -36, -95.5);
    arcade(b, 20, -80.5, 20, -95.5);
    arcade(b, 76.5, -16, 75.5, -40, 7.5, COOL);
    b.roundTower({ x: 20, z: 122, y: Y, r: 5.5, h: 26, roofH: 11, rows: 2, per: 3 });
    b.roundTower({ x: 76, z: 124, y: Y, r: 5, h: 22, roofH: 0, top: 'crenel', rows: 2, per: 3 });
    b.roundTower({ x: 172, z: 73, y: Y, r: 5, h: 24, roofH: 10, rows: 2, per: 3 });
    b.roundTower({ x: -134, z: -128, y: Y, r: 5, h: 26, roofH: 11, rows: 2, per: 3 });
    // 北門
    b.squareTower({ x: 60, z: -152, y: Y, w: 14, d: 10, h: 20, roof: 'gable', roofH: 6, turrets: 1.4, turretH: 5, rows: 1, cols: 1 });
    b.window(5, 7.5, 60, Y, -157, Math.PI, 4, 0.2);
    b.window(5, 7.5, 60, Y, -147, 0, 4, 0.2);
    // 第 7 批：廂房的門與小塔的門廊
    for (const d of Object.values(WING_DOORS)) doorDecal(b, d, 2, 3.2, 0.04);
    for (const [k, d] of Object.entries(SMALL_TOWER_DOORS)) {
      if (k === 'hallAttic') towerDoor(b, d, 1.4, 2.6, 0.8, WARM);
      else if (k === 'gate') doorDecal(b, d, 1.6, 2.8, 0.04);
      else towerDoor(b, d, 1.8, 3.0, 2.0);
    }
    for (const d of LOOKOUT_DOORS) towerDoor(b, d, 1.6, 2.8, 1.8);
    done('castleMisc', b);
  }

  return out;
}
