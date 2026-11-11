import * as THREE from 'three';
import { Builder, col } from '../kit';
import { getMaterials } from '../materials';
import { room, pane, torch, landingDoor, GOLD, IRON, FIRE, DARKWOOD, MARBLE, IWARM } from '../interiors';
import { At, door, bookshelf, table, chair, fireplace, chandelier, armour, cauldron, potionShelf, STEEL, WHITE, BLACK } from './kit';
import { registerScene, link, box3, pocketOrigin, type DoorEnd, type SceneLight } from './registry';
import { DOORS, honeydukesDoor } from './doors';
import { DUNGEON_DOORS } from './classrooms';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const COPPER = col(0.75, 0.33, 0.14);
const JUNK = [col(0.5, 0.42, 0.34), col(0.38, 0.3, 0.24), col(0.62, 0.52, 0.4), col(0.3, 0.26, 0.24), col(0.45, 0.3, 0.2)];
const BOOKC = [col(0.3, 0.05, 0.04), col(0.05, 0.16, 0.08), col(0.06, 0.08, 0.25), col(0.28, 0.17, 0.06)];

export function buildSecretPockets() {
  const M = getMaterials();

  // ================================================================ 萬應室（藏物間）
  {
    const [ox, oy, oz] = pocketOrigin(17);
    const b = new Builder(730);
    const w = 30;
    const d = 46;
    const h = 15;
    const x0 = ox - w / 2;
    const x1 = ox + w / 2;
    const z0 = oz - d / 2;
    const z1 = oz + d / 2;
    room(b, { x0, x1, z0, z1, y: oy, h, t: 0.3, shell: false, ceil: h, itint: IWARM, ceilKey: 'istone' });
    const dp = new At(b, ox, oy, z1, Math.PI);
    door(dp, 2, 3.4);
    // 大教堂般的柱列與高窗
    for (let i = 0; i < 5; i++) {
      const z = z0 + 5 + i * 9;
      for (const s of [-1, 1]) {
        b.cyl('istone', 0.65, 0.8, h, ox + s * 7.5, oy, z, 10, IWARM);
        b.box('istone', 1.9, 0.5, 1.9, ox + s * 7.5, oy, z, 0, IWARM);
        pane(b, 2.2, 6.5, ox + (s * w) / 2, oy + 6.5, z + 4.5 > z1 - 2 ? z - 4.5 : z + 4.5, (-s * Math.PI) / 2);
      }
      b.box('istone', w, 0.7, 0.7, ox, oy + h - 0.7, z, 0, IWARM);
    }
    // 堆積如山的雜物：歷代學生藏在這裡的東西
    const rng = b.rng;
    for (let gx = -13; gx <= 13; gx += 3.25) {
      for (let gz = z0 + 3; gz <= z1 - 7; gz += 3.4) {
        if (Math.abs(gx) < 2.6) continue;
        // 留一條橫向的走道
        if (Math.abs(gz - (oz - 4)) < 2) continue;
        const px = ox + gx + (rng() - 0.5) * 0.8;
        const pz = gz + (rng() - 0.5) * 0.8;
        const H = 2 + rng() * (Math.abs(gx) > 9 ? 8.5 : 5.5);
        let y = 0;
        let spread = 1.1;
        while (y < H) {
          const bw = 0.8 + rng() * 1.6;
          const bh = 0.45 + rng() * 1.0;
          const bd = 0.6 + rng() * 1.1;
          const kind = rng();
          const tint = JUNK[Math.floor(rng() * JUNK.length)];
          const x = px + (rng() - 0.5) * spread;
          const z = pz + (rng() - 0.5) * spread;
          const p = new At(b, x, oy + y, z, rng() * Math.PI);
          const key = y < 2 ? 'iwood' : 'iplain';
          if (kind < 0.55) p.box(key, bw, bh, bd, 0, 0, 0, tint);
          else if (kind < 0.7) {
            // 一疊書
            for (let k = 0; k < 5; k++) p.box('iplain', 0.5, bh / 5, 0.36, 0, (k * bh) / 5, 0, BOOKC[(k + Math.floor(y * 3)) % 4], k * 0.5);
          } else if (kind < 0.82) {
            p.box(key, bw, 0.08, bd, 0, bh - 0.08, 0, tint);
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('iplain', 0.08, bh, 0.08, sx * (bw / 2 - 0.1), 0, sz * (bd / 2 - 0.1), tint);
          } else if (kind < 0.9) p.cyl(key, 0.4, 0.4, bh, 0, 0, 0, 10, tint);
          else p.box(key, bw * 0.6, bh * 1.6, 0.4, 0, 0, 0, tint);
          y += bh * (0.75 + rng() * 0.25);
          spread = Math.max(0.3, spread * 0.85);
        }
        // 堆頂上認得出來的東西
        const top = new At(b, px, oy + y, pz, rng() * 6.28);
        const t = rng();
        if (t < 0.2) chair(top, JUNK[1]);
        else if (t < 0.32) cauldron(top, 1, undefined, false);
        else if (t < 0.42) {
          top.cyl('iplain', 0.22, 0.22, 0.03, 0, 0, 0, 10, GOLD);
          for (let k = 0; k < 8; k++) top.cyl('iplain', 0.008, 0.008, 0.55, Math.cos(k * 0.785) * 0.2, 0, Math.sin(k * 0.785) * 0.2, 4, GOLD);
          top.geo('iplain', new THREE.ConeGeometry(0.22, 0.15, 10), 0, 0.62, 0, GOLD);
        } else if (t < 0.5) {
          top.cyl('iplain', 0.04, 0.2, 0.5, 0, 0, 0, 8, COPPER);
          top.sphere('iplain', 0.3, 0, 0.75, 0, col(0.1, 0.2, 0.3));
        } else if (t < 0.56) top.sphere('iglow', 0.14, 0, 0.2, 0, col(1.2, 1.5, 2.2));
      }
    }
    // 走道邊的幾件東西
    armour(new At(b, ox - 2.9, oy, z1 - 5, Math.PI / 2));
    bookshelf(new At(b, ox + 3.2, oy, z1 - 4.5, -Math.PI / 2 + 0.2), 2.2, 3.4);
    // 消失櫃
    {
      const p = new At(b, ox + 3.1, oy, oz - 8, -Math.PI / 2);
      p.box('iwood', 1.5, 3.1, 1.0, 0, 0, 0, col(0.12, 0.11, 0.11));
      p.box('iplain', 1.7, 0.2, 1.2, 0, 3.1, 0, col(0.12, 0.11, 0.11));
      p.geo('iplain', new THREE.ConeGeometry(0.75, 0.6, 4), 0, 3.6, 0, col(0.12, 0.11, 0.11), Math.PI / 4);
      for (const s of [-1, 1]) p.box('iplain', 0.62, 2.6, 0.03, s * 0.34, 0.25, 0.51, col(0.2, 0.17, 0.15));
      for (const s of [-1, 1]) p.sphere('iplain', 0.04, s * 0.07, 1.5, 0.55, GOLD);
    }
    // 戴著冠冕的半身像
    {
      const p = new At(b, ox - 3.0, oy, oz - 14, Math.PI / 2);
      p.box('iwood', 1.0, 1.4, 0.8, 0, 0, 0, JUNK[3]);
      p.cyl('iplain', 0.26, 0.32, 0.45, 0, 1.4, 0, 10, WHITE);
      p.sphere('iplain', 0.2, 0, 2.08, 0, WHITE, 1.2);
      p.sphere('iplain', 0.24, 0, 2.2, -0.04, col(0.3, 0.28, 0.25), 0.9);
      p.geo('iplain', new THREE.TorusGeometry(0.19, 0.022, 5, 16), 0, 2.36, 0, STEEL, 0, Math.PI / 2);
      p.sphere('iglow', 0.045, 0, 2.44, 0.19, col(0.5, 1.2, 4.5), 1.4, 6);
    }
    for (const z of [-14, 2, 16]) chandelier(b, ox, oy + 9.5, oz + z, 2, 14, 5.5);
    registerScene({
      id: 'requirement',
      name: '萬應室',
      intro: '只有真正需要的人才找得到。這一間是歷代學生藏東西的地方，雜物堆得像一座城市。',
      box: box3(x0, oy - 1, z0, x1, oy + h, z1),
      lights: [
        { pos: [ox, oy + 9, oz - 14], intensity: 230, dist: 34 },
        { pos: [ox, oy + 9, oz + 2], intensity: 230, dist: 34 },
        { pos: [ox, oy + 9, oz + 16], intensity: 230, dist: 34 },
      ],
      spawn: [ox, oy, z1 - 4, Math.PI],
      pocket: true,
      ambient: 0.4,
      group: b.build('requirement', M),
    });
    link(landingDoor(5), { pos: [dp.x, oy, dp.z], face: Math.PI, name: '萬應室' });
  }

  // ================================================================ 愛哭鬼麥朵的廁所
  let sinks: DoorEnd;
  {
    const [ox, oy, oz] = pocketOrigin(18);
    const b = new Builder(731);
    const w = 11;
    const d = 13;
    const h = 5.4;
    const x0 = ox - w / 2;
    const x1 = ox + w / 2;
    const z0 = oz - d / 2;
    const z1 = oz + d / 2;
    const PALE = col(1.0, 1.08, 1.08);
    const PORC = col(0.9, 0.9, 0.86);
    room(b, { x0, x1, z0, z1, y: oy, h, t: 0.3, shell: false, ceil: h, itint: PALE, ceilKey: 'istone' });
    const dp = new At(b, ox + 3, oy, z1, Math.PI);
    door(dp, 1.7, 3);
    for (let i = 0; i < 3; i++) pane(b, 1.6, 2.6, ox - 3.4 + i * 3.4, oy + 2.2, z0, 0);
    // 中央一圈洗手台
    const sx = ox + 1.2;
    const sz = oz - 1;
    b.cyl('istone', 0.62, 0.7, 3.3, sx, oy, sz, 6, PALE);
    b.cyl('istone', 0.95, 0.62, 0.4, sx, oy + 3.3, sz, 6, PALE);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const p = new At(b, sx + Math.sin(a) * 0.62, oy, sz + Math.cos(a) * 0.62, a);
      p.cyl('iwood', 0.16, 0.2, 0.8, 0, 0, 0.42, 8, PORC);
      p.cyl('iplain', 0.42, 0.26, 0.24, 0, 0.8, 0.42, 12, PORC);
      p.cyl('iplain', 0.33, 0.33, 0.02, 0, 1.03, 0.42, 12, col(0.25, 0.3, 0.3));
      p.box('iplain', 0.5, 0.95, 0.03, 0, 1.5, 0.02, col(0.22, 0.3, 0.33));
      p.box('iplain', 0.58, 1.03, 0.02, 0, 1.46, 0.01, GOLD);
      // 水龍頭；其中一個側面刻著一條小蛇，而且從來不出水
      p.cyl('iplain', 0.02, 0.02, 0.2, 0, 1.04, 0.14, 5, k === 0 ? COPPER : GOLD);
      p.geo('iplain', new THREE.CylinderGeometry(0.018, 0.018, 0.2, 5), 0, 1.24, 0.22, k === 0 ? COPPER : GOLD, 0, Math.PI / 2);
      if (k === 0) p.geo('iplain', new THREE.TorusGeometry(0.035, 0.01, 4, 10, Math.PI * 1.5), 0.035, 1.12, 0.14, col(0.1, 0.5, 0.2), Math.PI / 2);
    }
    sinks = { pos: [sx + Math.sin(Math.PI / 6) * 1.25, oy, sz + Math.cos(Math.PI / 6) * 1.25], face: Math.PI / 6, name: '愛哭鬼麥朵的廁所', sign: false };
    // 靠西牆的一排隔間
    for (let i = 0; i < 5; i++) {
      const z = z0 + 1.2 + i * 2.1;
      b.box('iwood', 2.0, 2.3, 0.07, x0 + 1.0, oy + 0.15, z - 1.05, 0, DARKWOOD);
      if (i === 4) continue;
      const p = new At(b, x0, oy, z, Math.PI / 2);
      const ajar = i === 2 ? 0.9 : i === 0 ? 0.25 : 0;
      p.at(-0.95, 0, 2.0, ajar).box('iwood', 1.6, 2.0, 0.06, 0.8, 0.25, 0, DARKWOOD);
      p.box('iplain', 0.5, 0.42, 0.6, 0, 0, 0.5, PORC);
      p.box('iplain', 0.5, 0.5, 0.2, 0, 0.42, 0.22, PORC);
      p.cyl('iplain', 0.03, 0.03, 1.6, 0, 0.9, 0.1, 5, COPPER);
      p.box('iplain', 0.5, 0.3, 0.22, 0, 2.5, 0.14, PORC);
    }
    // 地上的積水
    for (const [px, pz, r] of [[1.5, 3.2, 1.3], [-0.5, 1.2, 0.8], [3.4, -3.2, 1.0], [0.2, -4.4, 0.7]]) b.cyl('iplain', r, r, 0.012, ox + px, oy, oz + pz, 14, col(0.06, 0.1, 0.11));
    for (const z of [-3, 3.5]) torch(b, x1, oy + 3, oz + z, -Math.PI / 2);
    registerScene({
      id: 'myrtle',
      name: '愛哭鬼麥朵的廁所',
      intro: '二樓這間女生廁所老是淹水，沒人想用。仔細看看那些水龍頭，其中一個刻著蛇。',
      box: box3(x0, oy - 1, z0, x1, oy + h, z1),
      lights: [{ pos: [ox - 0.5, oy + 4.4, oz + 2.5], intensity: 120, dist: 20, color: 0xdcecff }],
      spawn: [ox + 3, oy, z1 - 3, Math.PI],
      pocket: true,
      ambient: 0.5,
      group: b.build('myrtle', M),
    });
    link(DOORS.myrtle, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '愛哭鬼麥朵的廁所' });
  }

  // ================================================================ 密室
  {
    const [ox, oy, oz] = pocketOrigin(19);
    const b = new Builder(732);
    const w = 20;
    const d = 66;
    const h = 13;
    const x0 = ox - w / 2;
    const x1 = ox + w / 2;
    const z0 = oz - d / 2;
    const z1 = oz + d / 2;
    const STONE = col(0.5, 0.64, 0.57);
    const DARK = col(0.34, 0.44, 0.4);
    const EYE = col(0.4, 3.6, 1.2);
    room(b, { x0, x1, z0, z1, y: oy, h, t: 0.3, shell: false, ceil: h, itint: STONE, ceilKey: 'istone' });
    // 入口：盤著蛇的圓形閘門
    const dp = new At(b, ox, oy, z1, Math.PI);
    dp.geo('iplain', new THREE.CylinderGeometry(1.6, 1.6, 0.2, 28), 0, 1.7, 0.1, STEEL, 0, Math.PI / 2);
    dp.geo('istone', new THREE.TorusGeometry(1.8, 0.24, 6, 28), 0, 1.7, 0.1, DARK);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      dp.geo('iplain', new THREE.TorusGeometry(0.42, 0.06, 5, 12, Math.PI * 1.3), Math.cos(a) * 0.95, 1.7 + Math.sin(a) * 0.95, 0.22, col(0.2, 0.45, 0.3), 0, 0, a);
    }
    dp.sphere('iplain', 0.2, 0, 1.7, 0.24, col(0.2, 0.45, 0.3));
    // 中央的走道略高，兩側是積水
    b.box('istone', 6.4, 0.25, d - 12, ox, oy, oz + 3, 0, STONE);
    for (const s of [-1, 1]) b.box('iplain', 6.4, 0.03, d - 1, ox + s * 6.6, oy, oz, 0, col(0.01, 0.06, 0.045));
    // 兩排張著嘴的石蛇
    for (let i = 0; i < 8; i++) {
      const z = z1 - 7 - i * 6;
      for (const s of [-1, 1]) {
        const p = new At(b, ox + s * 4.6, oy, z, (-s * Math.PI) / 2);
        p.cyl('istone', 0.6, 0.85, 7.5, 0, 0, 0, 8, DARK);
        p.box('istone', 2.0, 0.6, 2.0, 0, 0, 0, DARK);
        // 蛇頭往走道探出
        p.sphere('iplain', 0.8, 0, 7.8, 0.35, DARK, 0.7);
        p.geo('iplain', new THREE.ConeGeometry(0.62, 1.7, 6), 0, 7.75, 1.4, DARK, 0, Math.PI / 2);
        p.geo('iplain', new THREE.ConeGeometry(0.5, 1.3, 6), 0, 7.1, 1.2, DARK, 0, Math.PI / 2 + 0.45);
        for (const e of [-1, 1]) {
          p.sphere('iglow', 0.09, e * 0.42, 8.0, 0.9, EYE, 1, 6);
          p.geo('iplain', new THREE.ConeGeometry(0.05, 0.4, 4), e * 0.2, 7.3, 1.9, WHITE, 0, Math.PI);
        }
      }
      if (i % 2 === 0) b.box('istone', w, 0.8, 0.8, ox, oy + h - 0.8, z, 0, DARK);
    }
    // 盡頭：薩拉札．史萊哲林的巨大石像
    {
      const p = new At(b, ox, oy, z0 + 0.2, 0);
      const FACE = col(0.62, 0.74, 0.68);
      p.box('istone', 9.5, h, 1.6, 0, 0, 0.8, DARK);
      p.sphere('iplain', 3.6, 0, 8.2, 1.9, FACE, 1.15, 16);
      // 眉骨、鼻子、眼窩
      p.box('iplain', 5.2, 0.5, 0.8, 0, 9.3, 4.9, FACE);
      p.geo('iplain', new THREE.ConeGeometry(0.6, 2.2, 4), 0, 8.1, 5.4, FACE, Math.PI / 4, 0.25);
      for (const s of [-1, 1]) {
        p.sphere('iplain', 0.55, s * 1.3, 8.7, 4.95, BLACK, 0.7, 8);
        // 垂到地面的長髮
        p.cyl('iplain', 0.9, 0.6, 9.5, s * 3.7, 0, 2.2, 8, FACE);
      }
      // 張開的嘴：蛇妖就是從這裡出來的
      p.box('iplain', 2.2, 1.7, 0.4, 0, 5.2, 5.05, BLACK);
      p.geo('iplain', new THREE.TorusGeometry(1.25, 0.2, 5, 14), 0, 6.05, 5.0, FACE, 0, 0, 0);
      // 鬍子一路垂到腳邊
      p.cyl('iplain', 2.6, 1.3, 5.2, 0, 0, 3.6, 10, FACE);
      for (let k = -2; k <= 2; k++) p.box('iplain', 0.16, 5.0, 0.2, k * 0.7, 0.1, 5.6 - Math.abs(k) * 0.5, DARK);
      p.box('istone', 9, 0.5, 3.4, 0, 0, 7.2, STONE);
    }
    // 蛇妖的骨骸
    {
      const n = 46;
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = ox + 5.6 + Math.sin(t * 7) * 1.6;
        const z = z0 + 14 + t * 30;
        const r = 0.28 * Math.sin(t * Math.PI * 0.9 + 0.3) + 0.08;
        const p = V(x, oy + 0.3 + r, z);
        b.sphere('iplain', r, p.x, p.y, p.z, WHITE, 0.9, 6);
        if (i % 2 === 0 && i > 2 && i < n - 8) for (const s of [-1, 1]) b.rod('iplain', p, V(x + s * 0.75, oy + 0.1, z + 0.15), 0.035, WHITE, 4, 0.012);
        if (prev) b.rod('iplain', prev, p, 0.07, WHITE, 5);
        prev = p;
      }
      const hd = new At(b, ox + 5.9, oy, z0 + 12.6, Math.PI + 0.3);
      hd.sphere('iplain', 0.6, 0, 0.7, 0, WHITE, 0.75, 9);
      hd.geo('iplain', new THREE.ConeGeometry(0.5, 1.5, 6), 0, 0.65, 0.9, WHITE, 0, Math.PI / 2);
      for (const e of [-1, 1]) {
        hd.geo('iplain', new THREE.ConeGeometry(0.06, 0.55, 4), e * 0.22, 0.25, 1.3, WHITE, 0, Math.PI);
        hd.sphere('iplain', 0.13, e * 0.33, 0.85, 0.3, BLACK, 1, 6);
      }
    }
    const lights: SceneLight[] = [
      { pos: [ox, oy + 7, z1 - 12], intensity: 150, dist: 32, color: 0x66e0a0 },
      { pos: [ox, oy + 7, oz], intensity: 150, dist: 32, color: 0x66e0a0 },
      { pos: [ox, oy + 6, z0 + 11], intensity: 190, dist: 32, color: 0x8ff0c0 },
    ];
    registerScene({
      id: 'chamber',
      name: '密室',
      intro: '薩拉札．史萊哲林留在城堡底下的密室。兩排石蛇盡頭是他的巨大石像，蛇妖曾經睡在裡面。',
      box: box3(x0, oy - 1, z0, x1, oy + h, z1),
      lights,
      spawn: [ox, oy + 0.25, z1 - 9, Math.PI],
      pocket: true,
      ambient: 0.04,
      group: b.build('chamber', M),
      animate: (t) => {
        for (let i = 0; i < 3; i++) lights[i].intensity = (i === 2 ? 190 : 150) + Math.sin(t * 0.9 + i * 2) * 20;
      },
    });
    link(sinks, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '密室' });
  }

  // ================================================================ 廚房
  {
    const [ox, oy, oz] = pocketOrigin(20);
    const b = new Builder(733);
    const w = 18;
    const d = 36;
    const h = 7.5;
    const x0 = ox - w / 2;
    const x1 = ox + w / 2;
    const z0 = oz - d / 2;
    const z1 = oz + d / 2;
    const BRICK = col(1.2, 0.95, 0.8);
    const rng = b.rng;
    room(b, { x0, x1, z0, z1, y: oy, h, t: 0.3, shell: false, ceil: h, itint: BRICK });
    const dp = new At(b, ox, oy, z1, Math.PI);
    door(dp, 1.7, 3);
    // 門的背面是那幅水果畫（搔一搔梨子才會開）
    dp.box('iplain', 1.9, 0.12, 0.08, 0, 3.05, 0.16, GOLD);
    for (let i = 0; i < 4; i++) b.box('iwood', w, 0.4, 0.4, ox, oy + h - 0.4, z0 + 5 + i * 8.6, 0, DARKWOOD);
    // 四張長桌，位置正對著樓上大廳的四張學院桌
    const FOOD = [col(0.7, 0.45, 0.15), col(0.75, 0.3, 0.05), col(0.5, 0.08, 0.05), col(0.3, 0.45, 0.1), col(0.85, 0.75, 0.5)];
    for (const x of [-5.7, -1.9, 1.9, 5.7]) {
      const t = new At(b, ox + x, oy, oz + 3, Math.PI / 2);
      t.box('iwood', 22, 0.1, 1.2, 0, 0.78, 0);
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) t.box('iwood', 0.14, 0.78, 0.14, -10 + i * 4, 0, s * 0.45);
      for (let i = 0; i < 26; i++) {
        const lx = -10.4 + i * 0.83;
        const lz = (rng() - 0.5) * 0.5;
        const k = rng();
        if (k < 0.3) {
          t.cyl('iplain', 0.26, 0.2, 0.03, lx, 0.88, lz, 10, GOLD);
          t.sphere('iplain', 0.17, lx, 0.95, lz, FOOD[Math.floor(rng() * 5)], 0.7, 7);
        } else if (k < 0.45) t.box('iplain', 0.42, 0.14, 0.2, lx, 0.88, lz, FOOD[4], rng());
        else if (k < 0.6) {
          t.cyl('iplain', 0.15, 0.11, 0.12, lx, 0.88, lz, 8, COPPER);
          for (let j = 0; j < 3; j++) t.sphere('iplain', 0.06, lx + Math.cos(j * 2.1) * 0.06, 1.02, lz + Math.sin(j * 2.1) * 0.06, [FOOD[2], FOOD[3], col(0.8, 0.6, 0.1)][j], 1, 5);
        } else if (k < 0.7) t.cyl('iplain', 0.06, 0.08, 0.26, lx, 0.88, lz, 6, GOLD);
        else if (k < 0.78) t.sphere('iplain', 0.2, lx, 1.02, lz, col(0.85, 0.4, 0.05), 0.8, 8);
      }
    }
    // 北牆的大壁爐，爐上吊著大鍋
    const fp = new At(b, ox, oy, z0 + 0.1, 0);
    fireplace(fp, 5.2, BRICK);
    cauldron(fp.at(-1.2, 0.2, 0.75), 1.5, col(1.6, 0.9, 0.3), false);
    cauldron(fp.at(1.2, 0.2, 0.75), 1.5, col(0.9, 1.4, 0.4), false);
    // 橫在爐前的備餐桌
    {
      const t = new At(b, ox, oy, z0 + 5.2);
      table(t, 9, 1.3, 0.85);
      for (let i = 0; i < 9; i++) {
        t.cyl('iplain', 0.3, 0.3, 0.03, -3.8 + i * 0.95, 0.85, 0, 12, WHITE);
        if (i % 2) t.sphere('iplain', 0.2, -3.8 + i * 0.95, 0.96, 0, FOOD[i % 5], 0.6, 7);
        else t.cyl('iplain', 0.22, 0.24, 0.14, -3.8 + i * 0.95, 0.88, 0, 12, FOOD[4]);
      }
    }
    // 東牆：一整排爐灶與銅鍋
    for (let i = 0; i < 6; i++) {
      const p = new At(b, x1 - 0.55, oy, z0 + 6 + i * 4.4, -Math.PI / 2);
      p.box('istone', 3.6, 0.95, 1.0, 0, 0, 0, BRICK);
      p.box('iplain', 1.0, 0.4, 0.05, 0, 0.2, 0.5, BLACK);
      for (let k = 0; k < 3; k++) p.sphere('iglow', 0.1, -0.25 + k * 0.25, 0.32, 0.46, FIRE, 1.5, 5);
      for (const lx of [-1.1, 0, 1.1]) {
        const s = 0.8 + rng() * 0.5;
        p.cyl('iplain', 0.3 * s, 0.26 * s, 0.34 * s, lx, 0.95, 0, 10, COPPER);
        if (rng() < 0.5) p.cyl('iglow', 0.26 * s, 0.26 * s, 0.01, lx, 0.95 + 0.33 * s, 0, 10, col(0.9, 0.5, 0.15));
      }
      // 牆上掛的鍋與長柄勺
      p.box('iwood', 3.4, 0.1, 0.08, 0, 2.6, -0.42, DARKWOOD);
      for (let k = 0; k < 6; k++) {
        const lx = -1.4 + k * 0.56;
        if (k % 2) {
          p.geo('iplain', new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), lx, 2.2, -0.36, COPPER, 0, Math.PI / 2);
          p.box('iplain', 0.04, 0.3, 0.03, lx, 2.38, -0.36, IRON);
        } else {
          p.box('iplain', 0.03, 0.55, 0.03, lx, 2.0, -0.36, IRON);
          p.sphere('iplain', 0.07, lx, 1.98, -0.36, COPPER, 0.6, 6);
        }
      }
    }
    // 西牆：碗櫃、酒桶與麵粉袋
    for (let i = 0; i < 4; i++) {
      const p = new At(b, x0 + 0.35, oy, z0 + 6.5 + i * 6.4, Math.PI / 2);
      p.box('iwood', 3.4, 1.0, 0.6, 0, 0, 0, DARKWOOD);
      p.box('iwood', 3.4, 2.3, 0.08, 0, 1.0, -0.25, DARKWOOD);
      for (let r = 0; r < 3; r++) {
        p.box('iwood', 3.4, 0.05, 0.4, 0, 1.6 + r * 0.6, -0.08, DARKWOOD);
        for (let k = 0; k < 9; k++) p.geo('iplain', new THREE.CylinderGeometry(0.14, 0.14, 0.02, 10), -1.45 + k * 0.36, 1.8 + r * 0.6, -0.14, r === 1 ? GOLD : WHITE, 0, Math.PI / 2 - 0.25);
      }
      const q = new At(b, x0 + 0.7, oy, z0 + 9.7 + i * 6.4);
      if (i < 3) {
        q.cyl('iwood', 0.5, 0.5, 1.1, 0, 0, 0, 12, col(0.9, 0.7, 0.45));
        q.cyl('iplain', 0.52, 0.52, 0.06, 0, 0.2, 0, 12, IRON);
        q.cyl('iplain', 0.52, 0.52, 0.06, 0, 0.85, 0, 12, IRON);
        q.sphere('iplain', 0.4, 0.4, 0.3, 1.0, col(0.75, 0.7, 0.58), 0.75, 8);
        q.sphere('iplain', 0.36, 0.2, 0.28, 1.7, col(0.75, 0.7, 0.58), 0.75, 8);
      }
    }
    // 從樑上垂下來的香腸、火腿與乾燥香草
    for (let i = 0; i < 4; i++) for (let k = 0; k < 7; k++) {
      const x = ox - 6.6 + k * 2.2;
      const z = z0 + 5 + i * 8.6;
      const len = 0.6 + rng() * 0.6;
      b.cyl('iplain', 0.006, 0.006, len, x, oy + h - 0.4 - len, z, 4, IRON);
      if (k % 3 === 0) b.sphere('iplain', 0.2, x, oy + h - 0.6 - len, z, col(0.5, 0.18, 0.14), 1.5, 7);
      else if (k % 3 === 1) b.cyl('iplain', 0.2, 0.05, 0.45, x, oy + h - 0.85 - len, z, 6, col(0.2, 0.32, 0.1));
      else b.cyl('iplain', 0.05, 0.05, 0.6, x, oy + h - 1.0 - len, z, 6, col(0.45, 0.12, 0.08));
    }
    for (const z of [-7, 6]) chandelier(b, ox, oy + 5.2, oz + z, 1.8, 12, 2);
    registerScene({
      id: 'kitchens',
      name: '廚房',
      intro: '就在大廳正下方。家庭小精靈把菜擺上這四張長桌，樓上的學院桌就會出現一樣的菜。',
      box: box3(x0, oy - 1, z0, x1, oy + h, z1),
      lights: [
        { pos: [ox, oy + 4.8, oz - 7], intensity: 210, dist: 28 },
        { pos: [ox, oy + 4.8, oz + 7], intensity: 210, dist: 28 },
        { pos: [ox, oy + 1.6, z0 + 2.4], intensity: 110, dist: 16, color: 0xff8a40 },
      ],
      spawn: [ox, oy, z1 - 3.5, Math.PI],
      pocket: true,
      zone: 'dungeon',
      ambient: 0.3,
      group: b.build('kitchens', M),
    });
    link(DUNGEON_DOORS.kitchens, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '廚房' });
  }

  // ================================================================ 獨眼女巫的密道
  let tunnelEnd: DoorEnd;
  {
    const [ox, oy, oz] = pocketOrigin(21);
    const b = new Builder(734);
    const L = 46;
    const h = 2.8;
    const z0 = oz - L / 2;
    const z1 = oz + L / 2;
    const EARTH = col(0.5, 0.4, 0.3);
    const rng = b.rng;
    room(b, { x0: ox - 1.3, x1: ox + 1.3, z0, z1, y: oy, h, t: 0.3, shell: false, ceil: h, itint: EARTH, ceilKey: 'istone' });
    // 雕像這一頭：滑下來的石槽
    const dp = new At(b, ox, oy, z1, Math.PI);
    dp.box('iplain', 1.3, 2.0, 0.08, 0, 0.3, 0.05, BLACK);
    dp.geo('istone', new THREE.BoxGeometry(1.5, 0.2, 1.3), 0, 0.3, 0.55, col(0.7, 0.7, 0.68), 0, -0.45);
    // 支撐的木架、凸出的石塊與樹根
    for (let z = z0 + 3; z < z1 - 2; z += 4.6) {
      for (const s of [-1, 1]) b.box('iwood', 0.18, h, 0.18, ox + s * 1.18, oy, z, 0, DARKWOOD);
      b.box('iwood', 2.6, 0.18, 0.2, ox, oy + h - 0.2, z, 0, DARKWOOD);
    }
    for (let i = 0; i < 70; i++) {
      const s = rng() < 0.5 ? -1 : 1;
      const z = z0 + 1 + rng() * (L - 2);
      const y = rng() * h;
      b.sphere('iplain', 0.18 + rng() * 0.3, ox + s * 1.32, oy + y, z, EARTH.clone().multiplyScalar(0.6 + rng() * 0.5), 0.8, 6);
      if (i % 6 === 0) b.rod('iplain', V(ox + s * 1.3, oy + h, z), V(ox + s * (0.6 + rng() * 0.5), oy + h - 0.6 - rng() * 0.8, z + rng() - 0.5), 0.04, col(0.2, 0.14, 0.08), 4, 0.01);
    }
    // 掛在木架上的兩盞油燈
    for (const z of [oz + 8, oz - 9]) {
      b.cyl('iplain', 0.08, 0.1, 0.2, ox + 1.0, oy + 2.0, z, 6, IRON);
      b.sphere('iglow', 0.07, ox + 1.0, oy + 2.12, z, FIRE, 1.4, 5);
    }
    // 另一頭：磨得發亮的石階通往頭頂的活板門
    for (let k = 0; k < 4; k++) b.box('istone', 2.6, 0.25 * (k + 1), 0.32, ox, oy, z0 + 1.2 - k * 0.32, 0, col(0.7, 0.7, 0.68));
    b.box('iwood', 1.3, 0.08, 1.2, ox, oy + h - 0.1, z0 + 1.0, 0, col(0.9, 0.7, 0.45));
    b.box('iplain', 0.2, 0.05, 0.06, ox, oy + h - 0.14, z0 + 1.5, 0, IRON);
    tunnelEnd = { pos: [ox, oy, z0 + 0.6], face: 0, name: '獨眼女巫的密道', sign: false };
    registerScene({
      id: 'witchPassage',
      name: '獨眼女巫的密道',
      intro: '雕像駝背後面的土隧道，又窄又長，一路通到活米村。暗的話按 Q 點亮魔杖。',
      box: box3(ox - 1.3, oy - 1, z0, ox + 1.3, oy + h, z1),
      lights: [
        { pos: [ox + 0.6, oy + 2.0, oz + 8], intensity: 40, dist: 15, color: 0xff9a55 },
        { pos: [ox + 0.6, oy + 2.0, oz - 9], intensity: 40, dist: 15, color: 0xff9a55 },
      ],
      spawn: [ox, oy, z1 - 3, Math.PI],
      pocket: true,
      zone: 'passage',
      ambient: 0.03,
      group: b.build('witchPassage', M),
    });
    link(DOORS.witch, { pos: [dp.x, oy, dp.z], face: Math.PI, name: '獨眼女巫的密道' });
  }

  // ================================================================ 蜂蜜公爵的地窖
  {
    const [ox, oy, oz] = pocketOrigin(22);
    const b = new Builder(735);
    const w = 10;
    const d = 9;
    const h = 3.9;
    const x0 = ox - w / 2;
    const x1 = ox + w / 2;
    const z0 = oz - d / 2;
    const z1 = oz + d / 2;
    const rng = b.rng;
    const CANDY = [col(0.85, 0.2, 0.4), col(0.2, 0.6, 0.7), col(0.9, 0.7, 0.15), col(0.5, 0.25, 0.7), col(0.3, 0.7, 0.3), col(0.9, 0.4, 0.1)];
    room(b, { x0, x1, z0, z1, y: oy, h, t: 0.3, shell: false, ceil: h, itint: col(1.1, 1.0, 0.9) });
    for (let i = 0; i < 3; i++) b.box('iwood', w, 0.25, 0.25, ox, oy + h - 0.25, z0 + 1.6 + i * 2.9, 0, DARKWOOD);
    // 通往店面的樓梯與門
    const dp = new At(b, ox + 3, oy, z0, 0);
    door(dp, 1.4, 2.6);
    for (let k = 0; k < 2; k++) dp.box('iwood', 2.0 - k * 0.3, 0.14, 0.9 - k * 0.4, 0, k * 0.14 - 0.14, 0.5 - k * 0.2, DARKWOOD);
    // 地板上的活板門
    const tx = ox - 2.6;
    const tz = oz + 2.2;
    b.box('iwood', 1.3, 0.04, 1.3, tx, oy, tz, 0, col(0.9, 0.7, 0.45));
    for (const s of [-1, 1]) b.box('iplain', 1.3, 0.045, 0.08, tx, oy, tz + s * 0.45, 0, IRON);
    // 一箱箱、一桶桶的糖果
    const crate = (x: number, z: number, y = 0, s = 1) => {
      const p = new At(b, x, oy + y, z, (rng() - 0.5) * 0.4);
      p.box('iwood', 0.9 * s, 0.7 * s, 0.9 * s, 0, 0, 0, col(0.95, 0.78, 0.55));
      p.box('iplain', 0.92 * s, 0.1, 0.92 * s, 0, 0.3 * s, 0, col(0.6, 0.45, 0.3));
      p.box('iplain', 0.5 * s, 0.3 * s, 0.01, 0, 0.2 * s, 0.46 * s, CANDY[Math.floor(rng() * 6)]);
      return p;
    };
    for (const [x, z] of [[-4.2, -3.6], [-3.2, -3.7], [-4.2, -2.6], [0.2, -3.7], [-0.8, -3.6], [4.2, 1.2], [4.2, 2.3], [3.2, 3.6], [4.2, 3.6]]) {
      crate(ox + x, oz + z);
      if (rng() < 0.6) {
        const top = crate(ox + x, oz + z, 0.7, 0.85);
        // 沒蓋上的箱子裡露出糖果
        if (rng() < 0.6) for (let k = 0; k < 9; k++) top.sphere('iplain', 0.09, -0.24 + (k % 3) * 0.24, 0.62, -0.24 + Math.floor(k / 3) * 0.24, CANDY[k % 6], 1, 5);
      }
    }
    for (const [x, z] of [[-1.6, 3.6], [-0.5, 3.7], [0.7, 3.6], [-4.3, 0.2]]) {
      b.cyl('iwood', 0.45, 0.45, 1.0, ox + x, oy, oz + z, 12, col(0.9, 0.7, 0.45));
      for (const k of [0.15, 0.8]) b.cyl('iplain', 0.47, 0.47, 0.06, ox + x, oy + k, oz + z, 12, IRON);
    }
    // 靠牆的架子：一罐罐糖果
    potionShelf(new At(b, x1 - 0.3, oy, oz - 2, -Math.PI / 2), 4, 5, col(0.95, 0.78, 0.55));
    {
      const p = new At(b, x0 + 0.3, oy, oz + 2.4, Math.PI / 2);
      for (let r = 0; r < 4; r++) {
        p.box('iwood', 2.6, 0.05, 0.45, 0, 0.5 + r * 0.6, 0, col(0.95, 0.78, 0.55));
        for (let k = 0; k < 6; k++) {
          p.cyl('iplain', 0.12, 0.12, 0.3, -1.05 + k * 0.42, 0.55 + r * 0.6, 0, 8, col(0.7, 0.8, 0.82));
          p.cyl('iplain', 0.105, 0.105, 0.2, -1.05 + k * 0.42, 0.57 + r * 0.6, 0, 8, CANDY[(k + r) % 6]);
          p.cyl('iplain', 0.125, 0.125, 0.04, -1.05 + k * 0.42, 0.85 + r * 0.6, 0, 8, GOLD);
        }
      }
      for (const s of [-1, 1]) p.box('iwood', 0.06, 2.9, 0.45, s * 1.3, 0, 0, col(0.95, 0.78, 0.55));
    }
    // 油燈
    b.cyl('iplain', 0.01, 0.01, 0.8, ox, oy + h - 1.05, oz, 4, IRON);
    b.cyl('iplain', 0.14, 0.1, 0.22, ox, oy + h - 1.3, oz, 8, COPPER);
    b.sphere('iglow', 0.09, ox, oy + h - 1.34, oz, FIRE, 1.3, 6);
    registerScene({
      id: 'honeydukes',
      name: '蜂蜜公爵的地窖',
      intro: '活米村糖果店的地窖，堆滿一箱箱的貨。地板上那扇活板門底下，就是通往城堡的密道。',
      box: box3(x0, oy - 1, z0, x1, oy + h, z1),
      lights: [{ pos: [ox, oy + 2.4, oz], intensity: 110, dist: 16, color: 0xffc080 }],
      spawn: [ox, oy, oz + 0.5, Math.PI],
      pocket: true,
      zone: 'passage',
      ambient: 0.15,
      group: b.build('honeydukes', M),
    });
    link(tunnelEnd, { pos: [tx, oy, tz - 1.9], face: 0, name: '蜂蜜公爵的地窖', sign: false });
    link(honeydukesDoor(), { pos: [dp.x, oy, dp.z], face: 0, name: '蜂蜜公爵的地窖' });
  }
  void MARBLE;
}
