import * as THREE from 'three';
import { Builder, col } from '../kit';
import { getMaterials } from '../materials';
import { room, pane, torch, FLOOR, GS, GOLD, IRON, FIRE, DARKWOOD, MARBLE, IWARM } from '../interiors';
import { At, roundRoom, door, bookshelf, table, chair, armchair, sofa, fireplace, chandelier, portrait, bed, roundTable, pouf, deskLamp, STEEL, WHITE, BLACK, GREENLAMP } from './kit';
import { registerScene, link, box3, pocketOrigin, type DoorEnd, type SceneLight } from './registry';
import { DOORS } from './doors';
import { DUNGEON_DOORS } from './classrooms';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const BRONZE = col(0.5, 0.3, 0.12);
const COPPER = col(0.75, 0.33, 0.14);
const LEAF = [col(0.08, 0.3, 0.07), col(0.14, 0.36, 0.08), col(0.05, 0.22, 0.1)];

/** 大樓梯塔頂層長廊盡頭的門：胖女士的畫像 */
const FAT_LADY: DoorEnd = { pos: [GS.x0, FLOOR + GS.top, GS.z0 + 2.5], face: Math.PI / 2, name: '大樓梯 8 樓' };

type Ring = (a: number, d: number, yy?: number) => At;
/** 圓形房間裡的擺放：a 是方位角（0 在南邊的門），d 是離圓心的距離，正面朝圓心 */
const ringOf = (b: Builder, ox: number, oy: number, oz: number): Ring => (a, d, yy = 0) => new At(b, ox + Math.sin(a) * d, oy + yy, oz + Math.cos(a) * d, a + Math.PI);

/** 圓牆上的窗 */
function roundPane(b: Builder, ox: number, oy: number, oz: number, r: number, a: number, w: number, h: number, sill: number) {
  pane(b, w, h, ox + Math.sin(a) * (r - 0.14), oy + sill, oz + Math.cos(a) * (r - 0.14), a + Math.PI);
}

/** 掛毯：貼牆，p 在底邊中心 */
function tapestry(p: At, w: number, h: number, base: THREE.Color, trim: THREE.Color) {
  p.box('iplain', w, h, 0.05, 0, 0, 0.03, base);
  p.box('iplain', w + 0.1, 0.1, 0.07, 0, h, 0.03, trim);
  p.box('iplain', w, 0.14, 0.06, 0, 0.12, 0.035, trim);
  p.geo('iplain', new THREE.CylinderGeometry(w * 0.26, w * 0.26, 0.06, 5), 0, h * 0.58, 0.035, trim, 0, Math.PI / 2);
}

/** 床尾的行李箱 */
function trunk(p: At) {
  p.box('iwood', 0.9, 0.42, 0.5, 0, 0, 0, col(0.5, 0.42, 0.36));
  for (const s of [-1, 1]) p.box('iplain', 0.06, 0.44, 0.52, s * 0.28, 0, 0, GOLD);
}

/** 盆栽 */
function plant(p: At, s = 1, pot: THREE.Color = COPPER) {
  p.cyl('iplain', 0.16 * s, 0.11 * s, 0.24 * s, 0, 0, 0, 8, pot);
  for (let k = 0; k < 3; k++) p.sphere('iplain', (0.16 + k * 0.03) * s, Math.cos(k * 2.1) * 0.08 * s, (0.36 + k * 0.1) * s, Math.sin(k * 2.1) * 0.08 * s, LEAF[k], 0.9, 6);
}

interface DormOpts {
  id: string;
  name: string;
  intro: string;
  pocketIndex: number;
  seed: number;
  cover: THREE.Color;
  tint: THREE.Color;
  trim: THREE.Color;
  from: DoorEnd;
  h?: number;
  light?: number;
  lightColor?: number;
  ambient?: number;
  extra?: (b: Builder, ring: Ring, ox: number, oy: number, oz: number, r: number) => void;
  roundDoor?: boolean;
}

/** 圓形的塔樓寢室：五張四柱床繞著中央的暖爐 */
function roundDorm(o: DormOpts) {
  const M = getMaterials();
  const [ox, oy, oz] = pocketOrigin(o.pocketIndex);
  const b = new Builder(o.seed);
  const r = 6.6;
  const h = o.h ?? 4.6;
  roundRoom(b, ox, oy, oz, r, h, o.tint, 3.2);
  const ring = ringOf(b, ox, oy, oz);
  const dp = ring(0, r - 0.05);
  if (o.roundDoor) barrelDoor(dp);
  else door(dp, 1.4, 2.6);
  b.cyl('iplain', 3.1, 3.1, 0.02, ox, oy, oz, 24, o.cover);
  b.cyl('iplain', 2.7, 2.7, 0.025, ox, oy, oz, 24, o.trim);
  b.cyl('iplain', 2.5, 2.5, 0.03, ox, oy, oz, 24, o.cover);
  for (let i = 0; i < 5; i++) {
    const a = ((i + 1) / 6) * Math.PI * 2;
    bed(ring(a, r - 1.35), o.cover, true);
    trunk(ring(a, r - 2.85));
    // 床邊的小櫃與燭台
    const n = ring(a + 0.36, r - 0.55);
    n.box('iwood', 0.5, 0.6, 0.45, 0, 0, 0, DARKWOOD);
    n.cyl('iplain', 0.03, 0.05, 0.16, 0, 0.6, 0, 6, GOLD);
    n.sphere('iglow', 0.045, 0, 0.84, 0, FIRE, 1.7, 5);
    if (i < 4) roundPane(b, ox, oy, oz, r, a + Math.PI / 6, 0.9, 2.2, 1.3);
  }
  // 中央的暖爐
  b.cyl('iplain', 0.42, 0.5, 0.9, ox, oy, oz, 10, BLACK);
  b.cyl('iplain', 0.5, 0.42, 0.14, ox, oy + 0.9, oz, 10, BLACK);
  b.cyl('iplain', 0.1, 0.1, h + 2.2, ox, oy + 1.0, oz, 6, BLACK);
  for (let k = 0; k < 4; k++) b.sphere('iglow', 0.09, ox + Math.cos(k * 1.57) * 0.44, oy + 0.45, oz + Math.sin(k * 1.57) * 0.44, FIRE, 1.4, 5);
  o.extra?.(b, ring, ox, oy, oz, r);
  registerScene({
    id: o.id,
    name: o.name,
    intro: o.intro,
    box: box3(ox - r - 0.5, oy - 1, oz - r - 0.5, ox + r + 0.5, oy + h + 3.4, oz + r + 0.5),
    lights: [{ pos: [ox, oy + 3, oz + 0.8], intensity: o.light ?? 110, dist: 18, color: o.lightColor }],
    spawn: [ox, oy, oz + 3.6, Math.PI],
    pocket: true,
    ambient: o.ambient ?? 0.3,
    group: b.build(o.id, M),
  });
  link(o.from, { pos: [dp.x, oy, dp.z], face: Math.PI, name: o.name });
}

/** 赫夫帕夫的圓門：像酒桶蓋一樣 */
function barrelDoor(p: At, rr = 1.25) {
  p.geo('iwood', new THREE.CylinderGeometry(rr, rr, 0.14, 24), 0, rr + 0.05, 0.08, col(0.85, 0.62, 0.36), 0, Math.PI / 2);
  for (const k of [1, 0.62]) p.geo('iplain', new THREE.TorusGeometry(rr * k, 0.045, 6, 28), 0, rr + 0.05, 0.16, IRON);
  p.geo('istone', new THREE.TorusGeometry(rr + 0.14, 0.16, 6, 28), 0, rr + 0.05, 0.08, MARBLE);
  p.sphere('iplain', 0.07, 0, rr + 0.05, 0.2, COPPER);
}

export function buildHousePockets() {
  const M = getMaterials();

  // ================================================================ 葛來分多交誼廳
  let gryffDorm: DoorEnd;
  {
    const [ox, oy, oz] = pocketOrigin(9);
    const b = new Builder(720);
    const r = 9.5;
    const h = 5.2;
    const RED = col(0.5, 0.035, 0.04);
    const DEEP = col(0.32, 0.03, 0.04);
    roundRoom(b, ox, oy, oz, r, h, col(1.22, 1.0, 0.86));
    const ring = ringOf(b, ox, oy, oz);
    const dp = ring(0, r - 0.05);
    door(dp, 1.6, 2.7);
    // 畫像洞的背面：一圈畫框
    dp.box('iplain', 2.3, 0.14, 0.1, 0, 3.05, 0.2, GOLD);
    // 壁爐與爐前的座位
    const fp = ring(Math.PI, r - 0.2);
    fireplace(fp, 2.8, IWARM);
    fp.box('iplain', 1.7, 1.9, 0.04, 0, 3.15, 0.63, RED);
    fp.geo('iplain', new THREE.CylinderGeometry(0.55, 0.55, 0.05, 6), 0, 4.1, 0.65, GOLD, 0, Math.PI / 2);
    b.cyl('iplain', 3.6, 3.6, 0.02, ox, oy, oz - r + 4.3, 28, DEEP);
    b.cyl('iplain', 3.2, 3.2, 0.025, ox, oy, oz - r + 4.3, 28, GOLD);
    b.cyl('iplain', 3.05, 3.05, 0.03, ox, oy, oz - r + 4.3, 28, RED);
    sofa(new At(b, ox, oy, oz - r + 5.6, Math.PI), 2.6, RED);
    armchair(new At(b, ox - 2.7, oy, oz - r + 3.3, Math.PI / 2 + 0.3), DEEP);
    armchair(new At(b, ox + 2.7, oy, oz - r + 3.3, -Math.PI / 2 - 0.3), DEEP);
    table(new At(b, ox, oy, oz - r + 3.9), 1.4, 0.7, 0.45);
    // 寫作業的桌子
    for (const s of [-1, 1]) {
      const t = new At(b, ox + s * 5.2, oy, oz + 1.6, s * 0.5);
      table(t, 2.2, 1.1);
      for (const k of [-1, 1]) {
        chair(t.at(k * 0.55, 0, -0.85));
        chair(t.at(k * 0.55, 0, 0.85, Math.PI));
      }
      t.box('iplain', 0.4, 0.05, 0.3, 0.3, 0.76, 0.1, col(0.28, 0.17, 0.06), 0.3);
      t.geo('iplain', new THREE.ConeGeometry(0.025, 0.28, 4), -0.5, 0.82, 0, WHITE, 0, 0, 1.3);
      t.cyl('iplain', 0.04, 0.05, 0.07, -0.7, 0.76, 0.2, 6, BLACK);
    }
    // 巫師棋
    {
      const t = new At(b, ox - 1.2, oy, oz + 4.6, 0.4);
      roundTable(t, 0.55, 0.62);
      t.box('iplain', 0.5, 0.02, 0.5, 0, 0.62, 0, WHITE);
      for (let i = 0; i < 8; i++) t.cyl('iplain', 0.015, 0.03, 0.1, -0.18 + (i % 4) * 0.12, 0.64, i < 4 ? -0.18 : 0.18, 5, i < 4 ? BLACK : WHITE);
      for (const k of [-1, 1]) pouf(t.at(0, 0, k * 1.0), RED);
    }
    // 窗、掛毯、畫像
    const WIN = [1.05, 1.75, -1.05, -1.75];
    for (const a of WIN) {
      roundPane(b, ox, oy, oz, r, a, 1.4, 3, 1.3);
      // 窗台下的軟墊
      ring(a, r - 0.5).box('iplain', 1.6, 0.5, 0.6, 0, 0, 0, DEEP);
    }
    for (const a of [0.5, -0.5, 1.4, -1.4, 2.25, -2.25]) tapestry(ring(a, r - 0.2, 1.1), 1.5, 2.9, a > 0 ? RED : DEEP, GOLD);
    for (const a of [0.78, -0.78]) portrait(ring(a, r - 0.16, 1.7), 0.8, 1.1);
    // 佈告欄
    {
      const p = ring(0.3, r - 0.14, 1.3);
      p.box('iwood', 1.3, 1.0, 0.05, 0, 0, 0, DARKWOOD);
      for (let i = 0; i < 6; i++) p.box('iplain', 0.26, 0.32, 0.01, -0.42 + (i % 3) * 0.42, 0.1 + Math.floor(i / 3) * 0.44, 0.03, [WHITE, col(0.8, 0.75, 0.5)][i % 2]);
    }
    bookshelf(ring(-2.72, r - 0.5), 2.4, 3.2);
    // 通往寢室的樓梯口
    const dd = ring(2.72, r - 0.05);
    door(dd, 1.4, 2.6);
    for (let k = 0; k < 2; k++) dd.box('istone', 2.2 - k * 0.3, 0.16, 1.1 - k * 0.45, 0, k * 0.16 - 0.16, 0.6 - k * 0.2, IWARM);
    gryffDorm = { pos: [dd.x, oy, dd.z], face: 2.72 + Math.PI, name: '葛來分多交誼廳' };
    chandelier(b, ox, oy + 4.5, oz + 0.5, 1.7, 12, 7);
    registerScene({
      id: 'gryffindorCommon',
      name: '葛來分多交誼廳',
      intro: '塔樓上圓形的房間，到處是鬆軟的扶手椅，爐火整晚不滅。',
      box: box3(ox - r - 0.5, oy - 1, oz - r - 0.5, ox + r + 0.5, oy + h + 7, oz + r + 0.5),
      lights: [
        { pos: [ox, oy + 4, oz + 0.5], intensity: 170, dist: 24 },
        { pos: [ox, oy + 1.5, oz - r + 2.2], intensity: 100, dist: 15, color: 0xff8a40 },
      ],
      spawn: [ox, oy, oz + 5.5, Math.PI],
      pocket: true,
      ambient: 0.35,
      group: b.build('gryffindorCommon', M),
    });
    link(FAT_LADY, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '葛來分多交誼廳' });
  }
  roundDorm({
    id: 'gryffindorDorm',
    name: '葛來分多寢室',
    intro: '塔頂的男生寢室：五張掛著深紅色天鵝絨帷幔的四柱床。',
    pocketIndex: 10,
    seed: 721,
    cover: col(0.5, 0.035, 0.04),
    tint: col(1.22, 1.0, 0.86),
    trim: GOLD,
    from: gryffDorm,
  });

  // ================================================================ 雷文克勞交誼廳
  let ravenDorm: DoorEnd;
  {
    const [ox, oy, oz] = pocketOrigin(11);
    const b = new Builder(722);
    const r = 10;
    const h = 6.4;
    const BLUE = col(0.05, 0.1, 0.42);
    const NIGHT = col(0.015, 0.025, 0.11);
    roundRoom(b, ox, oy, oz, r, h, col(1.05, 1.08, 1.18), 0, 40, false);
    const ring = ringOf(b, ox, oy, oz);
    // 畫著星星的穹頂
    {
      const g = new THREE.SphereGeometry(r + 0.05, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, 0.62, 1);
      g.translate(ox, oy + h, oz);
      b.add('iplain', g, undefined, NIGHT);
      const ringG = new THREE.TorusGeometry(r - 0.05, 0.14, 6, 48);
      ringG.rotateX(Math.PI / 2);
      ringG.translate(ox, oy + h, oz);
      b.add('iplain', ringG, undefined, BRONZE);
      const rng = b.rng;
      for (let i = 0; i < 190; i++) {
        const u = rng();
        const a = rng() * Math.PI * 2;
        const el = Math.asin(0.08 + u * 0.9);
        const rr = (r - 0.12) * Math.cos(el);
        const s = rng();
        b.sphere('iglow', s > 0.9 ? 0.07 : 0.035, ox + Math.sin(a) * rr, oy + h + (r - 0.12) * 0.62 * Math.sin(el), oz + Math.cos(a) * rr, s > 0.5 ? col(2.6, 2.7, 3.2) : col(3.0, 2.5, 1.6), 1, 5);
      }
      // 星座的連線
      for (let k = 0; k < 7; k++) {
        const a0 = rng() * 6.28;
        let prev: THREE.Vector3 | null = null;
        for (let j = 0; j < 4; j++) {
          const a = a0 + j * 0.16 + (rng() - 0.5) * 0.1;
          const el = 0.35 + rng() * 0.9;
          const rr = (r - 0.2) * Math.cos(el);
          const p = V(ox + Math.sin(a) * rr, oy + h + (r - 0.2) * 0.62 * Math.sin(el), oz + Math.cos(a) * rr);
          if (prev) b.rod('iplain', prev, p, 0.012, GOLD, 4);
          prev = p;
        }
      }
    }
    const dp = ring(0, r - 0.05);
    door(dp, 1.6, 2.8);
    // 沒有門把，只有一個鷹形的青銅門環
    dp.geo('iplain', new THREE.TorusGeometry(0.13, 0.03, 5, 12), 0, 1.55, 0.16, BRONZE);
    dp.sphere('iplain', 0.1, 0, 1.75, 0.18, BRONZE, 1.2, 6);
    dp.geo('iplain', new THREE.ConeGeometry(0.04, 0.14, 4), 0, 1.72, 0.3, BRONZE, 0, Math.PI / 2);
    // 一圈拱形高窗，掛著藍色與青銅色的絲綢
    const WIN = [0.7, 1.4, 2.1, -0.7, -1.4, -2.1];
    for (const a of WIN) {
      roundPane(b, ox, oy, oz, r, a, 1.9, 4.2, 1.1);
      for (const s of [-1, 1]) ring(a + s * 0.135, r - 0.22, 0.6).box('iplain', 0.5, 5, 0.08, 0, 0, 0, s > 0 ? BLUE : BRONZE);
      ring(a, r - 0.25, 5.4).box('iplain', 3.2, 0.4, 0.14, 0, 0, 0, BLUE);
    }
    for (const a of [1.05, 1.75, -1.05, -1.75]) bookshelf(ring(a, r - 0.5), 2.0, 3.4);
    // 羅威娜．雷文克勞的白色大理石像
    {
      const p = ring(Math.PI, r - 1.3);
      p.cyl('istone', 0.8, 0.9, 0.7, 0, 0, 0, 8, MARBLE);
      p.cyl('iplain', 0.2, 0.55, 1.5, 0, 0.7, 0, 10, WHITE);
      p.cyl('iplain', 0.26, 0.2, 0.55, 0, 2.2, 0, 10, WHITE);
      p.sphere('iplain', 0.17, 0, 2.95, 0, WHITE, 1.15);
      for (const s of [-1, 1]) p.geo('iplain', new THREE.CylinderGeometry(0.06, 0.05, 0.7, 6), s * 0.3, 2.3, 0.12, WHITE, 0, 0.5, s * 0.25);
      p.geo('iplain', new THREE.TorusGeometry(0.15, 0.022, 5, 14), 0, 3.08, 0, GOLD, 0, Math.PI / 2);
      p.sphere('iglow', 0.03, 0, 3.14, 0.15, col(0.5, 0.9, 3.4), 1.3, 5);
      // 壁龕
      const n = ring(Math.PI, r - 0.2);
      for (const s of [-1, 1]) n.cyl('istone', 0.22, 0.26, 4.2, s * 1.5, 0, 0.2, 8, MARBLE);
      n.box('istone', 3.6, 0.4, 0.7, 0, 4.2, 0.2, MARBLE);
    }
    // 地毯：午夜藍，綴著星星
    b.cyl('iplain', 6.4, 6.4, 0.02, ox, oy, oz, 36, NIGHT);
    b.cyl('iplain', 6.0, 6.0, 0.025, ox, oy, oz, 36, BLUE);
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4;
      const d = 1 + ((i * 37) % 48) / 10;
      b.cyl('iplain', 0.09, 0.09, 0.032, ox + Math.sin(a) * d, oy, oz + Math.cos(a) * d, 5, GOLD);
    }
    // 桌椅
    for (const [a, d] of [[0.5, 4.4], [-0.5, 4.4], [2.4, 5.4], [-2.4, 5.4]]) {
      const t = ring(a, d);
      roundTable(t, 0.85, 0.74);
      for (const k of [0, 2.1, 4.2]) chair(t.at(Math.sin(k) * 1.25, 0, Math.cos(k) * 1.25, k + Math.PI));
      deskLamp(t.at(0, 0.74, 0));
      t.box('iplain', 0.36, 0.06, 0.26, 0.4, 0.74, 0.2, BLUE, 0.4);
    }
    armchair(new At(b, ox - 1.6, oy, oz - 2.4, 0.5), BLUE);
    armchair(new At(b, ox + 1.6, oy, oz - 2.4, -0.5), BLUE);
    table(new At(b, ox, oy, oz - 2.0), 1.1, 0.6, 0.45);
    // 天球儀
    {
      const p = new At(b, ox + 3.2, oy, oz + 0.6);
      p.cyl('iplain', 0.05, 0.3, 0.9, 0, 0, 0, 8, BRONZE);
      p.sphere('iplain', 0.4, 0, 1.35, 0, NIGHT);
      for (const rx of [0, 1.0, 2.1]) p.geo('iplain', new THREE.TorusGeometry(0.5, 0.018, 5, 22), 0, 1.35, 0, GOLD, 0, rx, rx * 0.6);
    }
    const dd = ring(Math.PI - 0.62, r - 0.05);
    door(dd, 1.4, 2.6);
    ravenDorm = { pos: [dd.x, oy, dd.z], face: -0.62, name: '雷文克勞交誼廳' };
    registerScene({
      id: 'ravenclawCommon',
      name: '雷文克勞交誼廳',
      intro: '城堡西側塔頂寬敞通風的圓廳，穹頂上畫滿了星星。進門得先答對門環出的謎題。',
      box: box3(ox - r - 0.5, oy - 1, oz - r - 0.5, ox + r + 0.5, oy + h + 7, oz + r + 0.5),
      lights: [
        { pos: [ox, oy + 5.4, oz], intensity: 230, dist: 28, color: 0xe6ecff },
        { pos: [ox, oy + 2.2, oz - 5], intensity: 50, dist: 12, color: 0xbfd0ff },
      ],
      spawn: [ox, oy, oz + 6, Math.PI],
      pocket: true,
      ambient: 0.6,
      group: b.build('ravenclawCommon', M),
    });
    link(DOORS.ravenclaw, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '雷文克勞交誼廳' });
  }
  roundDorm({
    id: 'ravenclawDorm',
    name: '雷文克勞寢室',
    intro: '塔樓上的寢室，天藍色絲綢被褥，窗外的風聲整夜不停。',
    pocketIndex: 12,
    seed: 723,
    cover: col(0.06, 0.14, 0.5),
    tint: col(1.05, 1.08, 1.18),
    trim: BRONZE,
    from: ravenDorm,
    lightColor: 0xe6ecff,
    ambient: 0.5,
  });

  // ================================================================ 赫夫帕夫交誼廳
  let huffDorm: DoorEnd;
  {
    const [ox, oy, oz] = pocketOrigin(13);
    const b = new Builder(724);
    const r = 9.5;
    const h = 4.2;
    const YEL = col(0.9, 0.62, 0.07);
    const HONEY = col(1.3, 1.08, 0.74);
    const DARK = col(0.06, 0.055, 0.05);
    const LWOOD = col(1.15, 0.9, 0.6);
    roundRoom(b, ox, oy, oz, r, h, HONEY, 1.6);
    const ring = ringOf(b, ox, oy, oz);
    const dp = ring(0, r - 0.05);
    barrelDoor(dp);
    // 入口旁堆著的酒桶
    for (const [a, yy] of [[0.28, 0], [0.4, 0], [0.34, 0.95], [-0.3, 0]] as const) {
      const p = ring(a, r - 0.75, yy);
      p.cyl('iwood', 0.42, 0.42, 0.95, 0, 0, 0, 12, LWOOD);
      for (const k of [0.15, 0.75]) p.cyl('iplain', 0.44, 0.44, 0.06, 0, k, 0, 12, IRON);
    }
    // 高處的圓窗，看出去是草地與蒲公英
    for (const a of [0.9, 1.5, 2.1, -0.9, -1.5, -2.1]) {
      const p = ring(a, r - 0.16);
      p.geo('iwin', new THREE.CircleGeometry(0.75, 20), 0, 2.75, 0, col(0.1, 0, 0));
      p.geo('iwood', new THREE.TorusGeometry(0.78, 0.09, 6, 24), 0, 2.75, 0.02, LWOOD);
      p.box('iwood', 1.5, 0.05, 0.05, 0, 2.725, 0.03, LWOOD);
      p.box('iwood', 0.05, 1.5, 0.05, 0, 2.0, 0.03, LWOOD);
      // 窗台上垂下來的植物
      p.box('iwood', 1.5, 0.06, 0.3, 0, 1.78, 0.14, LWOOD);
      for (let k = 0; k < 3; k++) {
        plant(p.at(-0.5 + k * 0.5, 1.84, 0.14), 0.7);
        if (k !== 1) p.cyl('iplain', 0.02, 0.01, 0.7, -0.5 + k * 0.5, 1.1, 0.28, 4, LEAF[k]);
      }
    }
    // 壁爐：木雕的爐架，上方掛著海加．赫夫帕夫的畫像
    const fp = ring(Math.PI, r - 0.2);
    fireplace(fp, 2.4, HONEY);
    fp.box('iwood', 4.4, 0.16, 1.1, 0, 2.9, 0.5, LWOOD);
    portrait(fp.at(0, 3.15, 0.6), 0.75, 0.9);
    b.cyl('iplain', 3.4, 3.4, 0.02, ox, oy, oz - r + 4.2, 28, DARK);
    b.cyl('iplain', 3.1, 3.1, 0.025, ox, oy, oz - r + 4.2, 28, YEL);
    sofa(new At(b, ox, oy, oz - r + 5.5, Math.PI), 2.6, YEL);
    sofa(new At(b, ox - 3.0, oy, oz - r + 3.6, Math.PI / 2 + 0.25), 2.0, DARK);
    armchair(new At(b, ox + 2.8, oy, oz - r + 3.4, -Math.PI / 2 - 0.3), YEL);
    roundTable(new At(b, ox, oy, oz - r + 3.8), 0.7, 0.45, LWOOD);
    // 圓桌與坐墊
    for (const [a, d] of [[0.75, 4.6], [-0.75, 4.6], [1.6, 5.6], [-1.6, 5.6]]) {
      const t = ring(a, d);
      roundTable(t, 0.8, 0.7, LWOOD);
      for (const k of [0, 1.57, 3.14, 4.71]) pouf(t.at(Math.sin(k + 0.5) * 1.2, 0, Math.cos(k + 0.5) * 1.2), k % 3 < 1 ? YEL : DARK);
      plant(t.at(0, 0.7, 0), 0.8);
    }
    // 靠牆的架子：銅鍋與仙人掌
    for (const a of [1.2, 1.8, -1.2, -1.8]) {
      const p = ring(a, r - 0.4);
      for (let k = 0; k < 2; k++) {
        p.box('iwood', 1.7, 0.05, 0.4, 0, 0.55 + k * 0.6, 0, LWOOD);
        for (let i = 0; i < 4; i++) {
          if ((i + k) % 2) plant(p.at(-0.6 + i * 0.4, 0.6 + k * 0.6, 0), 0.6);
          else p.cyl('iplain', 0.13, 0.1, 0.16, -0.6 + i * 0.4, 0.6 + k * 0.6, 0, 8, COPPER);
        }
      }
      for (const s of [-1, 1]) p.box('iwood', 0.06, 1.2, 0.4, s * 0.85, 0, 0, LWOOD);
    }
    // 從天花板垂下的吊盆與銅燈
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785 + 0.3;
      const d = i % 2 ? 3.2 : 5.6;
      const x = ox + Math.sin(a) * d;
      const z = oz + Math.cos(a) * d;
      const top = h + 1.6 * (1 - d / r);
      b.cyl('iplain', 0.008, 0.008, top - 3.1, x, oy + 3.1, z, 4, IRON);
      if (i % 2) {
        b.cyl('iplain', 0.2, 0.1, 0.22, x, oy + 2.9, z, 8, COPPER);
        b.sphere('iglow', 0.11, x, oy + 2.86, z, col(4.2, 2.6, 0.8), 1, 6);
      } else {
        b.sphere('iplain', 0.3, x, oy + 2.95, z, LEAF[i % 3], 0.8, 7);
        for (let k = 0; k < 3; k++) b.cyl('iplain', 0.02, 0.008, 0.6, x + Math.cos(k * 2.1) * 0.2, oy + 2.3, z + Math.sin(k * 2.1) * 0.2, 4, LEAF[k]);
      }
    }
    // 黃黑相間的掛飾
    for (const a of [0.55, -0.55, 2.55, -2.55]) tapestry(ring(a, r - 0.2, 1.0), 1.2, 2.4, a > 0 ? YEL : DARK, a > 0 ? DARK : YEL);
    // 通往寢室的圓門
    const dd = ring(2.82, r - 0.05);
    barrelDoor(dd, 1.15);
    barrelDoor(ring(-2.82, r - 0.05), 1.15);
    huffDorm = { pos: [dd.x, oy, dd.z], face: 2.82 + Math.PI, name: '赫夫帕夫交誼廳' };
    registerScene({
      id: 'hufflepuffCommon',
      name: '赫夫帕夫交誼廳',
      intro: '廚房旁低矮的圓形地窖，圓窗外是草地。到處是植物、銅器和蜂蜜色的木頭。',
      box: box3(ox - r - 0.5, oy - 1, oz - r - 0.5, ox + r + 0.5, oy + h + 2, oz + r + 0.5),
      lights: [
        { pos: [ox, oy + 2.9, oz + 1], intensity: 150, dist: 22, color: 0xffd9a0 },
        { pos: [ox, oy + 1.5, oz - r + 2.2], intensity: 90, dist: 14, color: 0xff9a50 },
      ],
      spawn: [ox, oy, oz + 5.5, Math.PI],
      pocket: true,
      ambient: 0.5,
      group: b.build('hufflepuffCommon', M),
    });
    link(DUNGEON_DOORS.hufflepuff, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '赫夫帕夫交誼廳' });
  }
  roundDorm({
    id: 'hufflepuffDorm',
    name: '赫夫帕夫寢室',
    intro: '圓門後的寢室：拼布被子、銅製的暖床器，溫暖得像個洞穴。',
    pocketIndex: 14,
    seed: 725,
    cover: col(0.85, 0.58, 0.07),
    tint: col(1.3, 1.08, 0.74),
    trim: col(0.06, 0.055, 0.05),
    from: huffDorm,
    h: 4.2,
    lightColor: 0xffd9a0,
    ambient: 0.4,
    roundDoor: true,
    extra: (b, ring) => {
      for (let i = 0; i < 5; i++) {
        const a = ((i + 1) / 6) * Math.PI * 2;
        // 拼布被子上的方塊
        const p = ring(a, 6.6 - 1.35);
        for (let k = 0; k < 6; k++) p.box('iplain', 0.33, 0.012, 0.33, -0.34 + (k % 3) * 0.34, 0.76, 0.1 + Math.floor(k / 3) * 0.4, [col(0.06, 0.055, 0.05), col(0.6, 0.2, 0.08), col(0.25, 0.4, 0.12)][k % 3]);
        plant(ring(a - 0.36, 6.05), 1.1);
      }
    },
  });

  // ================================================================ 史萊哲林交誼廳
  let slyDorm: DoorEnd;
  {
    const [ox, oy, oz] = pocketOrigin(15);
    const b = new Builder(726);
    const w = 15;
    const d = 26;
    const h = 5.6;
    const x0 = ox - w / 2;
    const x1 = ox + w / 2;
    const z0 = oz - d / 2;
    const z1 = oz + d / 2;
    const STONE = col(0.56, 0.74, 0.64);
    const GREEN = col(0.03, 0.2, 0.09);
    const LEATHER = col(0.03, 0.035, 0.03);
    const LAKE = col(0.08, 0.62, 0.4);
    room(b, { x0, x1, z0, z1, y: oy, h, t: 0.3, shell: false, ceil: h, itint: STONE, ceilKey: 'istone' });
    const dp = new At(b, ox, oy, z1, Math.PI);
    door(dp, 1.7, 3);
    // 拱頂的肋與石柱
    for (let i = 0; i < 4; i++) {
      const z = z0 + 3.5 + i * 6.3;
      b.box('istone', w, 0.5, 0.6, ox, oy + h - 0.5, z, 0, STONE);
      for (const s of [-1, 1]) {
        b.box('istone', 0.7, h, 0.7, ox + s * (w / 2 - 0.35), oy, z, 0, STONE);
        // 柱上的蛇形雕飾與骷髏
        b.sphere('iplain', 0.2, ox + s * (w / 2 - 0.82), oy + 3.5, z, WHITE, 1.1, 7);
        b.add('iplain', new THREE.TorusGeometry(0.28, 0.05, 5, 14, Math.PI * 1.5), new THREE.Matrix4().makeTranslation(ox + s * (w / 2 - 0.74), oy + 2.7, z), STEEL);
      }
    }
    // 看進湖底的窗：幽幽的綠光
    const lakeWin = (p: At, ww: number, hh: number) => {
      p.box('iglow', ww, hh, 0.04, 0, 0, 0.03, LAKE);
      p.box('istone', ww + 0.5, 0.3, 0.3, 0, -0.3, 0.1, STONE);
      p.box('istone', ww + 0.5, 0.3, 0.3, 0, hh, 0.1, STONE);
      for (const s of [-1, 0, 1]) p.box('istone', s ? 0.25 : 0.1, hh, s ? 0.3 : 0.12, (s * (ww + 0.25)) / 2, 0, 0.1, STONE);
      p.box('istone', ww, 0.1, 0.12, 0, hh * 0.62, 0.1, STONE);
      // 窗外的水草
      const rng = p.b.rng;
      for (let k = 0; k < 5; k++) p.box('iplain', 0.07, hh * (0.3 + rng() * 0.5), 0.01, (rng() - 0.5) * (ww - 0.3), 0, 0.055, col(0.0, 0.05, 0.03));
    };
    for (let i = 0; i < 3; i++) {
      const z = z0 + 6.65 + i * 6.3;
      lakeWin(new At(b, x0, oy + 1.3, z, Math.PI / 2), 3.0, 3.0);
      lakeWin(new At(b, x1, oy + 1.3, z, -Math.PI / 2), 3.0, 3.0);
    }
    // 壁爐：精雕的爐架，上方是盤繞的銀蛇
    const fp = new At(b, ox, oy, z0 + 0.1, 0);
    fireplace(fp, 3.2, col(0.75, 0.9, 0.82));
    for (const s of [-1, 1]) fp.cyl('istone', 0.2, 0.24, 2.4, s * 2.5, 0, 0.75, 8, col(0.75, 0.9, 0.82));
    fp.geo('iplain', new THREE.TorusGeometry(0.5, 0.07, 6, 18, Math.PI * 1.4), 0.25, 4.3, 0.63, STEEL, 0, 0, 0.6);
    fp.geo('iplain', new THREE.TorusGeometry(0.5, 0.07, 6, 18, Math.PI * 1.4), -0.25, 3.55, 0.63, STEEL, 0, 0, 0.6 + Math.PI);
    fp.sphere('iplain', 0.11, 0.62, 4.72, 0.63, STEEL, 0.8, 6);
    // 爐前：黑色皮沙發與綠色地毯
    b.box('iplain', 7.5, 0.02, 6, ox, oy, z0 + 5, 0, LEATHER);
    b.box('iplain', 7.0, 0.025, 5.5, ox, oy, z0 + 5, 0, GREEN);
    sofa(new At(b, ox, oy, z0 + 6.8, Math.PI), 3.0, LEATHER);
    sofa(new At(b, ox - 3.1, oy, z0 + 4.2, Math.PI / 2), 2.4, LEATHER);
    sofa(new At(b, ox + 3.1, oy, z0 + 4.2, -Math.PI / 2), 2.4, LEATHER);
    table(new At(b, ox, oy, z0 + 4.4), 1.6, 0.8, 0.45, col(0.4, 0.38, 0.36));
    // 高背椅圍著的長桌
    {
      const t = new At(b, ox - 2.2, oy, oz + 5.5, Math.PI / 2);
      table(t, 4.4, 1.2, 0.78, col(0.4, 0.38, 0.36));
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
        const c = t.at(-1.65 + i * 1.1, 0, s * 0.95, s > 0 ? Math.PI : 0);
        chair(c, col(0.4, 0.38, 0.36));
        c.box('iwood', 0.44, 0.6, 0.05, 0, 1.05, -0.2, col(0.4, 0.38, 0.36));
      }
      for (const lx of [-1.2, 1.2]) {
        t.cyl('iplain', 0.06, 0.1, 0.3, lx, 0.78, 0, 6, STEEL);
        t.sphere('iglow', 0.07, lx, 1.16, 0, GREENLAMP, 1.3, 6);
      }
    }
    // 巫師棋桌與扶手椅
    {
      const t = new At(b, ox + 3.6, oy, oz + 3.2);
      roundTable(t, 0.6, 0.66, col(0.4, 0.38, 0.36));
      armchair(t.at(0, 0, -1.2), GREEN);
      armchair(t.at(0, 0, 1.2, Math.PI), GREEN);
    }
    bookshelf(new At(b, ox + 4.6, oy, z1 - 0.3, Math.PI), 4, 3.4, false, col(0.4, 0.38, 0.36));
    // 綠銀相間的掛毯
    for (const s of [-1, 1]) for (const z of [z0 + 3.5 + 6.3 * 3 + 2.2]) tapestry(new At(b, ox + s * (w / 2), oy + 1.2, z, (-s * Math.PI) / 2), 1.8, 3.2, GREEN, STEEL);
    for (const x of [-4.6, -2.6]) tapestry(new At(b, ox + x, oy + 1.2, z1, Math.PI), 1.5, 3.2, GREEN, STEEL);
    for (const x of [-5.4, 5.4]) tapestry(new At(b, ox + x, oy + 1.2, z0, 0), 1.6, 3.2, GREEN, STEEL);
    // 用鐵鍊吊著的綠色圓燈
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const x = ox + s * 3.2;
      const z = z0 + 6.65 + i * 6.3;
      b.cyl('iplain', 0.012, 0.012, 1.7, x, oy + h - 2.2, z, 4, IRON);
      b.sphere('iglow', 0.2, x, oy + h - 2.4, z, GREENLAMP.clone().multiplyScalar(0.55), 1.1, 8);
      b.cyl('iplain', 0.22, 0.14, 0.1, x, oy + h - 2.3, z, 8, IRON);
    }
    const dd = new At(b, x1, oy, z0 + 2.2, -Math.PI / 2);
    door(dd, 1.5, 2.8);
    slyDorm = { pos: [dd.x, oy, dd.z], face: -Math.PI / 2, name: '史萊哲林交誼廳' };
    const lights: SceneLight[] = [
      { pos: [ox, oy + 3.4, oz - 3], intensity: 90, dist: 22, color: 0x7fe6aa },
      { pos: [ox, oy + 3.4, oz + 7], intensity: 90, dist: 22, color: 0x7fe6aa },
      { pos: [ox, oy + 1.5, z0 + 2.2], intensity: 80, dist: 14, color: 0xffa060 },
    ];
    registerScene({
      id: 'slytherinCommon',
      name: '史萊哲林交誼廳',
      intro: '黑湖底下狹長的地窖。窗外是湖水，整個房間浸在一片晃動的綠光裡。',
      box: box3(x0, oy - 1, z0, x1, oy + h, z1),
      lights,
      spawn: [ox, oy, z1 - 4, Math.PI],
      pocket: true,
      zone: 'dungeon',
      ambient: 0.05,
      group: b.build('slytherinCommon', M),
      // 湖水的波光
      animate: (t) => {
        lights[0].intensity = 90 + Math.sin(t * 1.3) * 18 + Math.sin(t * 3.1) * 8;
        lights[1].intensity = 90 + Math.sin(t * 1.1 + 2) * 18 + Math.sin(t * 2.7) * 8;
      },
    });
    link(DUNGEON_DOORS.slytherin, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '史萊哲林交誼廳' });
  }
  // ---- 史萊哲林寢室
  {
    const [ox, oy, oz] = pocketOrigin(16);
    const b = new Builder(727);
    const w = 11;
    const d = 15;
    const h = 4.6;
    const x0 = ox - w / 2;
    const x1 = ox + w / 2;
    const z0 = oz - d / 2;
    const z1 = oz + d / 2;
    const STONE = col(0.56, 0.74, 0.64);
    const GREEN = col(0.03, 0.22, 0.1);
    const WOODK = col(0.4, 0.38, 0.36);
    room(b, { x0, x1, z0, z1, y: oy, h, t: 0.3, shell: false, ceil: h, itint: STONE, ceilKey: 'istone' });
    const dp = new At(b, ox, oy, z1, Math.PI);
    door(dp, 1.5, 2.8);
    b.box('iplain', 3, 0.02, 11, ox, oy, oz - 0.5, 0, GREEN);
    // 五張掛著綠色絲綢帷幔的四柱床
    const beds: [number, number][] = [[-1, -4.6], [-1, -0.6], [-1, 3.4], [1, -4.6], [1, -0.6]];
    for (const [s, z] of beds) {
      const p = new At(b, ox + s * (w / 2 - 1.3), oy, oz + z, (-s * Math.PI) / 2);
      bed(p, GREEN, true, WOODK);
      trunk(p.at(0, 0, 1.5));
      const n = p.at(0.95, 0, -0.75);
      n.box('iwood', 0.5, 0.6, 0.45, 0, 0, 0, WOODK);
      n.cyl('iplain', 0.04, 0.06, 0.12, 0, 0.6, 0, 6, STEEL);
      n.sphere('iglow', 0.06, 0, 0.8, 0, GREENLAMP.clone().multiplyScalar(0.5), 1.2, 6);
    }
    // 北牆的大窗，外面是湖底
    {
      const p = new At(b, ox, oy + 1.1, z0, 0);
      p.box('iglow', 4.4, 2.8, 0.04, 0, 0, 0.03, col(0.08, 0.62, 0.4));
      for (const s of [-1, -0.33, 0.33, 1]) p.box('istone', 0.14, 2.8, 0.14, s * 2.2, 0, 0.1, STONE);
      for (const yy of [-0.2, 1.7, 2.8]) p.box('istone', 4.7, 0.2, 0.2, 0, yy, 0.1, STONE);
      for (let k = 0; k < 7; k++) p.box('iplain', 0.07, 0.6 + ((k * 7) % 5) * 0.3, 0.01, -1.9 + k * 0.62, 0, 0.055, col(0, 0.05, 0.03));
    }
    tapestry(new At(b, x1, oy + 1.2, oz + 4.2, -Math.PI / 2), 1.8, 2.9, GREEN, STEEL);
    for (const z of [-3, 3]) {
      b.cyl('iplain', 0.012, 0.012, 1.3, ox, oy + h - 1.3, oz + z, 4, IRON);
      b.sphere('iglow', 0.18, ox, oy + h - 1.5, oz + z, GREENLAMP.clone().multiplyScalar(0.55), 1.1, 8);
    }
    torch(b, x1, oy + 2.6, oz + 6.3, -Math.PI / 2);
    const lights: SceneLight[] = [
      { pos: [ox, oy + 3, oz - 3], intensity: 80, dist: 18, color: 0x7fe6aa },
      { pos: [ox, oy + 3, oz + 3.5], intensity: 60, dist: 16, color: 0xbfe6c0 },
    ];
    registerScene({
      id: 'slytherinDorm',
      name: '史萊哲林寢室',
      intro: '湖底下的寢室。銀色的燈籠掛在天花板上，夜裡聽得見湖水拍打窗戶。',
      box: box3(x0, oy - 1, z0, x1, oy + h, z1),
      lights,
      spawn: [ox, oy, z1 - 3, Math.PI],
      pocket: true,
      zone: 'dungeon',
      ambient: 0.05,
      group: b.build('slytherinDorm', M),
      animate: (t) => {
        lights[0].intensity = 80 + Math.sin(t * 1.2) * 16 + Math.sin(t * 2.9) * 7;
      },
    });
    link(slyDorm, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '史萊哲林寢室' });
  }
}
