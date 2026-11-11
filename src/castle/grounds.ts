import * as THREE from 'three';
import { Builder, col, mat4 } from './kit';
import { getMaterials } from './materials';
import { heightAt, getPaths, getPath, STAMPS, WATER, type BuiltPath } from '../world/heightfield';
import { patchMaterial, makeRng } from '../core/globals';
import type { Built } from './castle';
import { honeydukesDoor, towerDoor } from './scenes/doors';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const IRON = col(0.04, 0.04, 0.045);
const LAMP = col(1, 0.6, 0.22);
const THATCH = col(2.3, 1.6, 1.0);
const PLASTER = col(1.35, 1.3, 1.2);
const HOUSE_COLORS = [col(0.42, 0.025, 0.025), col(0.03, 0.2, 0.07), col(0.035, 0.08, 0.36), col(0.7, 0.5, 0.04)];

/** 沿路徑取樣：回傳弧長 s 處的位置與方向 */
export function samplePath(p: BuiltPath, s: number, out: THREE.Vector3, dir?: THREE.Vector3) {
  const f = THREE.MathUtils.clamp(s / p.spacing, 0, p.n - 1.001);
  const i = Math.floor(f);
  const t = f - i;
  out.set(THREE.MathUtils.lerp(p.x[i], p.x[i + 1], t), THREE.MathUtils.lerp(p.h[i], p.h[i + 1], t), THREE.MathUtils.lerp(p.z[i], p.z[i + 1], t));
  if (dir) dir.set(p.x[i + 1] - p.x[i], p.h[i + 1] - p.h[i], p.z[i + 1] - p.z[i]).normalize();
  return out;
}

// ------------------------------------------------------------------ 道路與鐵道
function buildPathRibbons() {
  const group = new THREE.Group();
  group.name = 'paths';
  const mat = patchMaterial(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    {
      key: 'path',
      vertexPars: 'varying vec2 vPUv;',
      vertexMain: 'vPUv = uv;',
      fragPars: 'varying vec2 vPUv;',
      fragColor: /* glsl */ `
        {
          float n = noiseTex(vWPos.xz / 4.3).r;
          float n2 = noiseTex(vWPos.xz / 19.0).g;
          float edge = abs(vPUv.x - 0.5) * 2.0;
          if (edge > 0.72 + n * 0.28) discard;
          vec3 c = diffuseColor.rgb * (0.7 + 0.5 * n) * (0.8 + 0.3 * n2);
          // 鐵道：枕木
          if (vColor.b > vColor.r) {
            float sl = step(0.55, fract(vPUv.y / 0.75)) * step(edge, 0.5);
            c = mix(c, vec3(0.05, 0.035, 0.025), sl * 0.85);
          } else {
            // 車轍
            float rut = smoothstep(0.08, 0.0, abs(edge - 0.38));
            c *= 1.0 - rut * 0.25;
          }
          float sn = uSnow * smoothstep(0.25, 0.7, n2 + n * 0.4 + (vColor.b > vColor.r ? -0.1 : 0.15));
          c = mix(c, vec3(0.8, 0.85, 0.93), sn * 0.85);
          c *= 1.0 - 0.35 * uWet * (1.0 - sn);
          diffuseColor.rgb = c;
        }`,
    },
  );
  for (const p of getPaths()) {
    const pos: number[] = [];
    const uv: number[] = [];
    const colr: number[] = [];
    const idx: number[] = [];
    const rail = p.def.kind === 'rail';
    const w = rail ? 5.2 : p.def.width * 1.25;
    const c = rail ? [0.2, 0.2, 0.22] : p.def.kind === 'road' ? [0.19, 0.16, 0.12] : [0.17, 0.14, 0.1];
    let vi = 0;
    let prevOk = false;
    for (let i = 0; i < p.n; i++) {
      const onBridge = p.bridgeIdx && i > p.bridgeIdx[0] && i < p.bridgeIdx[1];
      const a = Math.max(0, i - 1);
      const b = Math.min(p.n - 1, i + 1);
      let dx = p.x[b] - p.x[a];
      let dz = p.z[b] - p.z[a];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const px = -dz;
      const pz = dx;
      const lx = p.x[i] + px * (w / 2);
      const lz = p.z[i] + pz * (w / 2);
      const rx = p.x[i] - px * (w / 2);
      const rz = p.z[i] - pz * (w / 2);
      const lift = rail ? 0.25 : 0.14;
      const ly = onBridge ? p.h[i] - 0.25 : Math.max(heightAt(lx, lz), heightAt(p.x[i], p.z[i])) + lift;
      const ry = onBridge ? p.h[i] - 0.25 : Math.max(heightAt(rx, rz), heightAt(p.x[i], p.z[i])) + lift;
      pos.push(lx, ly, lz, rx, ry, rz);
      uv.push(0, i * p.spacing, 1, i * p.spacing);
      colr.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      if (prevOk) idx.push(vi - 2, vi, vi - 1, vi - 1, vi, vi + 1);
      prevOk = true;
      vi += 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.name = `path:${p.def.name}`;
    group.add(mesh);
  }
  return group;
}

export interface GroundsHandles {
  pumpkins: THREE.InstancedMesh;
  pumpkinSpots: THREE.Vector3[];
  hutChimney: THREE.Vector3;
  villageChimneys: THREE.Vector3[];
  owleryTop: THREE.Vector3;
  pitchCenter: THREE.Vector3;
  stationEnd: number; // 火車停靠時車頭所在的弧長
  xmasSpots: THREE.Vector3[];
}

export function buildGrounds(): { built: Built[]; extras: THREE.Object3D[]; handles: GroundsHandles } {
  const M = getMaterials();
  const built: Built[] = [];
  const extras: THREE.Object3D[] = [buildPathRibbons()];
  const done = (id: string, b: Builder) => built.push({ id, group: b.build(id, M) });
  const rng = makeRng(555);

  // ================================================================ 貓頭鷹屋
  const ow = STAMPS.owlery;
  const owY = heightAt(ow.x, ow.z);
  {
    const b = new Builder(41);
    b.roundTower({ x: ow.x, z: ow.z, y: owY, r: 6.4, h: 27, roofH: 14, rows: 0, per: 0, top: 'corbel', found: 12, tint: col(0.92, 0.9, 0.88) });
    // 給貓頭鷹進出的成排拱窗（沒有玻璃）
    for (let row = 0; row < 5; row++) {
      const n = 9;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + row * 0.35;
        b.window(1.0, 2.4, ow.x + Math.sin(a) * 6.3, owY + 4 + row * 4.4, ow.z + Math.cos(a) * 6.3, a, 3, 0.08);
      }
    }
    // 通往入口的石階
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const sx = THREE.MathUtils.lerp(-140, ow.x + 5.2, t);
      const sz = THREE.MathUtils.lerp(-362, ow.z + 5.2, t);
      b.box('stone', 2.6, 1.4, 1.5, sx, heightAt(sx, sz) - 0.9, sz, 0.6);
    }
    b.window(1.8, 3.2, ow.x + Math.sin(0.78) * 6.4, owY, ow.z + Math.cos(0.78) * 6.4, 0.78, 4, 0.1);
    done('owlery', b);
  }

  // ================================================================ 海格的小屋與南瓜田
  const hg = STAMPS.hagrid;
  const hgY = heightAt(hg.x, hg.z);
  const pumpkinSpots: THREE.Vector3[] = [];
  {
    const b = new Builder(42);
    const HS = col(0.95, 0.9, 0.82);
    // 兩間相連的圓形石屋
    b.cyl('stone', 6.6, 6.9, 6 + 3, hg.x, hgY - 3, hg.z, 10, HS);
    b.cone('roof', 7.9, 8.5, hg.x, hgY + 5.6, hg.z, 10, THATCH);
    b.cyl('stone', 4.6, 4.8, 5 + 3, hg.x + 8.2, hgY - 3, hg.z + 3.5, 10, HS);
    b.cone('roof', 5.7, 6.5, hg.x + 8.2, hgY + 4.7, hg.z + 3.5, 10, THATCH);
    b.box('stone', 2.0, 15, 2.0, hg.x - 4.2, hgY - 1, hg.z - 3.6, 0.3, HS);
    b.box('stone', 2.4, 0.5, 2.4, hg.x - 4.2, hgY + 14, hg.z - 3.6, 0.3, HS);
    b.window(2.4, 3.6, hg.x + Math.sin(2.6) * 6.7, hgY, hg.z + Math.cos(2.6) * 6.7, 2.6, 4, 0.1);
    for (const a of [0.4, 1.5, 3.9, 5.2]) b.window(1.2, 1.5, hg.x + Math.sin(a) * 6.75, hgY + 2.1, hg.z + Math.cos(a) * 6.75, a, 0, 0.08);
    for (const a of [0.2, 1.9]) b.window(1.0, 1.3, hg.x + 8.2 + Math.sin(a) * 4.75, hgY + 1.9, hg.z + 3.5 + Math.cos(a) * 4.75, a, 0, 0.08);
    b.sphere('lamp', 0.25, hg.x + Math.sin(2.95) * 7.0, hgY + 3.2, hg.z + Math.cos(2.95) * 7.0, LAMP);
    // 門前的石階與木桶
    b.box('stone', 3.4, 0.4, 2.2, hg.x + Math.sin(2.6) * 8, hgY - 0.1, hg.z + Math.cos(2.6) * 8, 2.6, HS);
    b.cyl('wood', 0.6, 0.55, 1.2, hg.x + 3.5, hgY, hg.z - 7.2, 8);
    b.cyl('wood', 0.6, 0.55, 1.2, hg.x + 4.9, hgY, hg.z - 7.0, 8);
    // 南瓜田的木柵欄
    const px = hg.x - 22;
    const pz = hg.z + 6;
    const pw = 22;
    const pd = 16;
    for (let i = 0; i <= 10; i++) {
      for (const [fx, fz] of [[px - pw / 2 + (i / 10) * pw, pz - pd / 2], [px - pw / 2 + (i / 10) * pw, pz + pd / 2], [px - pw / 2, pz - pd / 2 + (i / 10) * pd], [px + pw / 2, pz - pd / 2 + (i / 10) * pd]]) {
        const fy = heightAt(fx, fz);
        b.beam('wood', V(fx, fy - 0.3, fz), V(fx + (b.rng() - 0.5) * 0.2, fy + 1.2, fz), 0.14);
      }
    }
    for (const [x0, z0, x1, z1] of [[px - pw / 2, pz - pd / 2, px + pw / 2, pz - pd / 2], [px - pw / 2, pz + pd / 2, px + pw / 2, pz + pd / 2], [px - pw / 2, pz - pd / 2, px - pw / 2, pz + pd / 2], [px + pw / 2, pz - pd / 2, px + pw / 2, pz + pd / 2]]) {
      b.beam('wood', V(x0, heightAt(x0, z0) + 0.9, z0), V(x1, heightAt(x1, z1) + 0.9, z1), 0.09);
      b.beam('wood', V(x0, heightAt(x0, z0) + 0.45, z0), V(x1, heightAt(x1, z1) + 0.45, z1), 0.09);
    }
    for (let i = 0; i < 18; i++) {
      const x = px - pw / 2 + 2 + b.rng() * (pw - 4);
      const z = pz - pd / 2 + 2 + b.rng() * (pd - 4);
      pumpkinSpots.push(V(x, heightAt(x, z), z));
    }
    // 稻草人
    const sx = px + 2;
    const sz = pz - 1;
    const sy = heightAt(sx, sz);
    b.beam('wood', V(sx, sy, sz), V(sx, sy + 2.6, sz), 0.1);
    b.beam('wood', V(sx - 1, sy + 2.0, sz), V(sx + 1, sy + 2.0, sz), 0.08);
    b.sphere('matte', 0.3, sx, sy + 2.8, sz, col(0.6, 0.5, 0.25));
    b.cone('matte', 0.4, 0.7, sx, sy + 3.0, sz, 6, col(0.05, 0.04, 0.05));
    done('hagrid', b);
  }
  const pumpkinGeo = new THREE.SphereGeometry(1, 10, 7);
  pumpkinGeo.scale(1, 0.78, 1);
  const pumpkinColors = new Float32Array(pumpkinGeo.attributes.position.count * 3).fill(1);
  pumpkinGeo.setAttribute('color', new THREE.BufferAttribute(pumpkinColors, 3));
  const pumpkins = new THREE.InstancedMesh(pumpkinGeo, M.matte, pumpkinSpots.length);
  for (let i = 0; i < pumpkinSpots.length; i++) pumpkins.setColorAt(i, new THREE.Color(0.75 + rng() * 0.15, 0.27 + rng() * 0.1, 0.03));
  pumpkins.castShadow = true;
  pumpkins.receiveShadow = true;
  pumpkins.frustumCulled = false;
  pumpkins.name = 'pumpkins';
  extras.push(pumpkins);

  // ================================================================ 石圈
  {
    const b = new Builder(43);
    const sc = STAMPS.stoneCircle;
    const ST = col(0.72, 0.72, 0.74);
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      const r = 15 + (b.rng() - 0.5) * 1.5;
      const x = sc.x + Math.sin(a) * r;
      const z = sc.z + Math.cos(a) * r;
      const h = 3.2 + b.rng() * 2.6;
      const g = new THREE.DodecahedronGeometry(1, 0);
      g.scale(0.75 + b.rng() * 0.4, h, 0.45 + b.rng() * 0.25);
      b.add('stone', g, mat4(x, heightAt(x, z) + h * 0.55, z, a + (b.rng() - 0.5) * 0.5, (b.rng() - 0.5) * 0.16, (b.rng() - 0.5) * 0.16), ST);
    }
    const g = new THREE.DodecahedronGeometry(1, 0);
    g.scale(2.4, 0.55, 1.5);
    b.add('stone', g, mat4(sc.x + 1, heightAt(sc.x, sc.z) + 0.3, sc.z - 1, 0.6), ST);
    for (let i = 0; i < 3; i++) {
      const g2 = new THREE.DodecahedronGeometry(1, 0);
      g2.scale(0.8, 0.5, 2.6);
      const x = sc.x + (b.rng() - 0.5) * 30;
      const z = sc.z + (b.rng() - 0.5) * 30;
      b.add('stone', g2, mat4(x, heightAt(x, z) + 0.25, z, b.rng() * 3), ST);
    }
    done('stoneCircle', b);
  }

  // ================================================================ 魁地奇球場
  const pt = STAMPS.pitch;
  const ptY = heightAt(pt.x, pt.z);
  {
    const b = new Builder(44);
    // 場地：橢圓草皮與兩端的沙地
    const field = new THREE.CircleGeometry(1, 48);
    field.rotateX(-Math.PI / 2);
    field.scale(78, 1, 30);
    b.add('matte', field, mat4(pt.x, ptY + 0.18, pt.z), col(0.09, 0.2, 0.05));
    const GOLD = col(0.7, 0.55, 0.16);
    for (const s of [1, -1]) {
      const sand = new THREE.CircleGeometry(9, 20);
      sand.rotateX(-Math.PI / 2);
      b.add('matte', sand, mat4(pt.x + s * 62, ptY + 0.24, pt.z), col(0.5, 0.42, 0.26));
      // 三根球門柱
      [[-7, 10], [0, 14.5], [7, 10]].forEach(([dz, h]) => {
        b.cyl('matte', 0.14, 0.2, h, pt.x + s * 62, ptY, pt.z + dz, 6, GOLD);
        const ring = new THREE.TorusGeometry(1.25, 0.11, 6, 20);
        ring.rotateY(Math.PI / 2);
        b.add('matte', ring, mat4(pt.x + s * 62, ptY + h + 1.25, pt.z + dz), GOLD);
      });
    }
    // 環繞球場的看台高塔
    const towers = 16;
    for (let i = 0; i < towers; i++) {
      const a = (i / towers) * Math.PI * 2 + 0.2;
      const x = pt.x + Math.cos(a) * 96;
      const z = pt.z + Math.sin(a) * 47;
      const h = 22 + ((i * 7) % 5) * 2.2;
      const face = Math.atan2(pt.x - x, pt.z - z);
      const c = HOUSE_COLORS[i % 4];
      const gy = heightAt(x, z);
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.beam('wood', V(x + dx * 1.15, gy - 1, z + dz * 1.15), V(x + dx, gy + h, z + dz), 0.4);
      b.add('cloth', new THREE.BoxGeometry(6.6, h - 2, 6.6), mat4(x, gy + 1 + (h - 2) / 2, z, face), c);
      b.box('wood', 8.4, 0.4, 8.4, x, gy + h, z, face);
      for (const [dx, dz] of [[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8]]) {
        const cs = Math.cos(face);
        const sn = Math.sin(face);
        b.beam('wood', V(x + dx * cs + dz * sn, gy + h, z - dx * sn + dz * cs), V(x + dx * cs + dz * sn, gy + h + 4.2, z - dx * sn + dz * cs), 0.22);
      }
      b.box('wood', 8.4, 1.2, 0.2, x + Math.sin(face) * 4.1, gy + h + 0.4, z + Math.cos(face) * 4.1, face);
      const roofG = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
      roofG.rotateY(Math.PI / 4);
      roofG.scale(9.4, 5.5, 9.4);
      b.add('cloth', roofG, mat4(x, gy + h + 4.2 + 2.75, z, face), c);
      b.cyl('matte', 0.05, 0.08, 4, x, gy + h + 9.6, z, 5, IRON);
      b.add('cloth', new THREE.PlaneGeometry(2.6, 1.5), mat4(x + 1.3, gy + h + 12.6, z, 0), c);
    }
    // 塔與塔之間的低看台；最靠近小徑終點的那一段留作球場入口
    const trail = getPath('pitch');
    const gate = { i: -1, d: 1e9 };
    if (trail) {
      const ex = trail.x[trail.n - 1];
      const ez = trail.z[trail.n - 1];
      for (let i = 0; i < towers; i++) {
        const am = ((i + 0.5) / towers) * Math.PI * 2 + 0.2;
        const d = Math.hypot(pt.x + Math.cos(am) * 96 - ex, pt.z + Math.sin(am) * 47 - ez);
        if (d < gate.d) {
          gate.d = d;
          gate.i = i;
        }
      }
    }
    for (let i = 0; i < towers; i++) {
      const a0 = (i / towers) * Math.PI * 2 + 0.2;
      const a1 = ((i + 1) / towers) * Math.PI * 2 + 0.2;
      const x0 = pt.x + Math.cos(a0) * 96;
      const z0 = pt.z + Math.sin(a0) * 47;
      const x1 = pt.x + Math.cos(a1) * 96;
      const z1 = pt.z + Math.sin(a1) * 47;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      const len = Math.hypot(x1 - x0, z1 - z0) - 8;
      const ry = Math.atan2(-(z1 - z0), x1 - x0);
      const gy = heightAt(mx, mz);
      if (i === gate.i) {
        // 入口：兩根門柱撐著一面橫幅
        const cs = Math.cos(ry);
        const sn = Math.sin(ry);
        for (const s of [-1, 1]) b.box('wood', 0.5, 7.5, 0.5, mx + s * cs * 3.2, gy - 0.5, mz - s * sn * 3.2, ry);
        b.add('cloth', new THREE.BoxGeometry(6.9, 1.6, 0.12), mat4(mx, gy + 6.1, mz, ry), GOLD);
        for (const s of [-1, 1]) {
          const w = (len - 7) / 2;
          const ox = s * (3.5 + w / 2);
          b.box('wood', w, 7, 4.5, mx + ox * cs, gy - 1, mz - ox * sn, ry);
          b.add('cloth', new THREE.BoxGeometry(w, 4.5, 4.7), mat4(mx + ox * cs, gy + 2.2, mz - ox * sn, ry), HOUSE_COLORS[(i + 2) % 4]);
        }
        continue;
      }
      b.box('wood', len, 7, 4.5, mx, gy - 1, mz, ry);
      b.add('cloth', new THREE.BoxGeometry(len, 4.5, 4.7), mat4(mx, gy + 2.2, mz, ry), HOUSE_COLORS[(i + 2) % 4]);
    }
    done('quidditch', b);
  }

  // ================================================================ 活米村
  const villageChimneys: THREE.Vector3[] = [];
  {
    const b = new Builder(45);
    const road = getPath('road');
    // 找出道路穿過村子的那一段
    const hs = STAMPS.hogsmeade;
    const p = new THREE.Vector3();
    const d = new THREE.Vector3();
    const house = (x: number, z: number, ry: number, big = false) => {
      const w = (big ? 15 : 8) + b.rng() * (big ? 5 : 4);
      const dd = (big ? 9 : 6.5) + b.rng() * 2;
      const h = (big ? 9 : 4.6) + b.rng() * (big ? 3 : 2.4);
      const y = heightAt(x, z);
      const tint = b.rng() < 0.55 ? PLASTER : col(0.95 + b.rng() * 0.2, 0.9 + b.rng() * 0.15, 0.82 + b.rng() * 0.1);
      const lean = (b.rng() - 0.5) * 0.06;
      b.wing({ x, z, y, w, d: dd, h, ry: ry + lean, roofH: dd * (0.75 + b.rng() * 0.3), rows: big ? 3 : h > 6 ? 2 : 1, spacing: 3.1, winW: 1.0, winH: 1.5, winY: big ? 0 : 1.3, tint, found: 5, chimneys: 0 });
      // 歪斜的煙囪
      const cx = x + (b.rng() - 0.5) * w * 0.5;
      const cz = z + (b.rng() - 0.5) * 2;
      const ch = h + dd * 0.8 + 1.5;
      b.beam('stone', V(cx, y + h - 1, cz), V(cx + (b.rng() - 0.5) * 0.5, y + ch, cz + (b.rng() - 0.5) * 0.5), 1.0, tint);
      villageChimneys.push(V(cx, y + ch + 0.3, cz));
      // 門
      const fx = x + Math.sin(ry) * (dd / 2);
      const fz = z + Math.cos(ry) * (dd / 2);
      b.window(1.3, 2.3, fx + Math.cos(ry) * (w * 0.3), y, fz - Math.sin(ry) * (w * 0.3), ry, 4, 0.1);
      if (b.rng() < 0.4) b.sphere('lamp', 0.2, fx + Math.sin(ry) * 0.5, y + 2.9, fz + Math.cos(ry) * 0.5, LAMP);
    };
    let bigCount = 0;
    for (let s = 0; s < road.length; s += 11.5) {
      samplePath(road, s, p, d);
      const dist = Math.hypot(p.x - hs.x, p.z - hs.z);
      if (dist > 215) continue;
      for (const side of [1, -1]) {
        if (b.rng() < 0.13) continue;
        const off = 10.5 + b.rng() * 3;
        const x = p.x + d.z * side * off;
        const z = p.z - d.x * side * off;
        const big = dist < 70 && bigCount < 3 && b.rng() < 0.3;
        if (big) bigCount++;
        house(x, z, Math.atan2(-side * d.z, side * d.x), big);
      }
    }
    // 後排零星的房舍
    for (let i = 0; i < 26; i++) {
      const a = b.rng() * Math.PI * 2;
      const r = 50 + b.rng() * 150;
      const x = hs.x + Math.cos(a) * r;
      const z = hs.z + Math.sin(a) * r;
      samplePath(road, 0, p);
      let near = Infinity;
      for (let s = 0; s < road.length; s += 12) {
        samplePath(road, s, p);
        near = Math.min(near, Math.hypot(p.x - x, p.z - z));
      }
      if (near < 30) continue;
      house(x, z, b.rng() * Math.PI * 2);
    }
    // 沿街的路燈
    for (let ss = 0; ss < road.length; ss += 28) {
      samplePath(road, ss, p, d);
      if (Math.hypot(p.x - hs.x, p.z - hs.z) > 200) continue;
      const x = p.x + d.z * 4.6;
      const z = p.z - d.x * 4.6;
      const y = heightAt(x, z);
      b.cyl('matte', 0.07, 0.1, 3.6, x, y, z, 5, IRON);
      b.sphere('lamp', 0.28, x, y + 3.8, z, LAMP);
    }
    // 蜂蜜公爵的地窖口
    {
      const hd = honeydukesDoor();
      towerDoor(b, hd, 1.6, 2.6, 2.2, PLASTER);
      const nx = Math.sin(hd.face);
      const nz = Math.cos(hd.face);
      b.gable('roof', null, 3.4, 2.8, 1.5, hd.pos[0] - nx * 1.1, hd.pos[1] + 4.4, hd.pos[2] - nz * 1.1, hd.face);
      b.box('cloth', 2.6, 0.12, 0.9, hd.pos[0] + nx * 0.45, hd.pos[1] + 2.9, hd.pos[2] + nz * 0.45, hd.face, col(0.75, 0.25, 0.45));
      b.sphere('lamp', 0.2, hd.pos[0] + nx * 0.6, hd.pos[1] + 3.3, hd.pos[2] + nz * 0.6, LAMP);
    }
    done('hogsmeade', b);
  }

  // ================================================================ 活米村車站
  const rail = getPath('rail');
  const stationEnd = rail.length - 26;
  {
    const b = new Builder(46);
    const p = new THREE.Vector3();
    const d = new THREE.Vector3();
    samplePath(rail, rail.length - 75, p, d);
    const ry = Math.atan2(-d.z, d.x);
    const sideX = d.z;
    const sideZ = -d.x; // 月台在鐵道的東南側
    const side = sideZ > 0 ? 1 : -1;
    const px = p.x + sideX * side * 6.2;
    const pz = p.z + sideZ * side * 6.2;
    b.box('stone', 110, 3.2, 7, px, p.y - 2.2, pz, ry, col(0.85, 0.83, 0.8));
    // 月台雨棚
    for (let i = -4; i <= 4; i++) {
      const cx = px + d.x * i * 10 + sideX * side * 1.2;
      const cz = pz + d.z * i * 10 + sideZ * side * 1.2;
      b.cyl('matte', 0.13, 0.16, 4.2, cx, p.y + 1, cz, 6, col(0.3, 0.05, 0.04));
      if ((i + 4) % 2 === 0) b.sphere('lamp', 0.26, cx - sideX * side * 1.6, p.y + 4.5, cz - sideZ * side * 1.6, LAMP);
    }
    b.gable('roof', null, 84, 6.4, 1.3, px + sideX * side * 0.6, p.y + 5.2, pz + sideZ * side * 0.6, ry, 0.5, col(1.4, 0.9, 0.8));
    // 車站小屋
    const sx = px + sideX * side * 9;
    const sz = pz + sideZ * side * 9;
    b.wing({ x: sx, z: sz, y: p.y + 0.6, w: 26, d: 8, h: 5, ry, roofH: 4.6, rows: 1, spacing: 3.6, winW: 1.2, winH: 2, winY: 1.4, tint: PLASTER, found: 6, chimneys: 2 });
    b.box('matte', 5, 0.9, 0.2, px, p.y + 3.6, pz, ry, col(0.3, 0.05, 0.04));
    // 鐵軌盡頭的止衝擋
    samplePath(rail, rail.length - 3, p, d);
    b.box('wood', 0.8, 1.6, 3.4, p.x, p.y, p.z, ry);
    // 湖邊的小碼頭
    const dk = STAMPS.dock;
    for (let i = 0; i < 9; i++) {
      const x = dk.x + 4 + i * 2.1;
      b.box('wood', 2, 0.2, 3.6, x, WATER + 1.1, dk.z + 6, 0.12);
      if (i % 2 === 0) for (const s of [1.6, -1.6]) b.cyl('wood', 0.14, 0.14, 4, x, WATER - 2.4, dk.z + 6 + s, 5);
    }
    b.cyl('matte', 0.07, 0.07, 3.2, dk.x + 20, WATER + 1.2, dk.z + 7.6, 5, IRON);
    b.sphere('lamp', 0.28, dk.x + 20, WATER + 4.5, dk.z + 7.6, LAMP);
    done('station', b);
  }

  // ================================================================ 尖叫屋
  {
    const b = new Builder(47);
    const sh = STAMPS.shack;
    const y = heightAt(sh.x, sh.z);
    const WD = col(0.72, 0.7, 0.7);
    const RD = col(1.5, 1.2, 1.1);
    b.box('wood', 10, 5.2, 8, sh.x, y - 0.6, sh.z, 0.1, WD);
    b.add('wood', new THREE.BoxGeometry(9, 4.6, 7.4), mat4(sh.x + 0.4, y + 6.8, sh.z - 0.2, 0.2, 0.03, 0.05), WD);
    b.add('wood', new THREE.BoxGeometry(6.4, 4.2, 6), mat4(sh.x + 0.9, y + 11, sh.z + 0.3, 0.05, -0.04, 0.09), WD);
    b.gable('roof', 'wood', 7.2, 6.4, 4.6, sh.x + 1.1, y + 13.0, sh.z + 0.3, 0.05, 0.6, RD, WD);
    b.gable('roof', 'wood', 4.4, 5.2, 3.2, sh.x - 3.4, y + 8.8, sh.z - 0.2, 0.2 + Math.PI / 2, 0.4, RD, WD);
    b.box('wood', 4.6, 3.4, 5.6, sh.x - 6.4, y - 0.5, sh.z + 0.6, 0.02, WD);
    b.gable('roof', 'wood', 4.8, 5.8, 2.4, sh.x - 6.4, y + 2.9, sh.z + 0.6, 0.02 + Math.PI / 2, 0.4, RD, WD);
    b.beam('stone', V(sh.x + 3, y + 4, sh.z - 2), V(sh.x + 3.7, y + 19, sh.z - 1.6), 1.2, col(0.7, 0.68, 0.66));
    // 釘死的窗戶
    for (let i = 0; i < 12; i++) {
      const a = Math.floor(b.rng() * 4) * (Math.PI / 2) + 0.1;
      const lvl = Math.floor(b.rng() * 3);
      const half = lvl === 2 ? 3.1 : 4.2;
      const off = (b.rng() - 0.5) * 5;
      const wx = sh.x + Math.sin(a) * half + Math.cos(a) * off;
      const wz = sh.z + Math.cos(a) * half - Math.sin(a) * off;
      b.window(1.0, 1.7, wx, y + 1.2 + lvl * 4.6, wz, a, 3, 0.25);
      b.beam('wood', V(wx - Math.cos(a) * 0.7, y + 1.6 + lvl * 4.6, wz + Math.sin(a) * 0.7).addScaledVector(V(Math.sin(a), 0, Math.cos(a)), 0.32), V(wx + Math.cos(a) * 0.7, y + 2.4 + lvl * 4.6, wz - Math.sin(a) * 0.7).addScaledVector(V(Math.sin(a), 0, Math.cos(a)), 0.32), 0.14, WD);
    }
    // 殘破的圍籬
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2;
      if (b.rng() < 0.2) continue;
      const fx = sh.x + Math.cos(a) * 20;
      const fz = sh.z + Math.sin(a) * 17;
      const fy = heightAt(fx, fz);
      b.beam('wood', V(fx, fy - 0.3, fz), V(fx + (b.rng() - 0.5) * 0.6, fy + 1.3 + b.rng() * 0.4, fz + (b.rng() - 0.5) * 0.6), 0.13, WD);
    }
    done('shack', b);
  }

  // ================================================================ 鐵道高架橋與鐵軌
  {
    const b = new Builder(48);
    const [i0, i1] = rail.bridgeIdx!;
    const ST = col(0.86, 0.84, 0.82);
    const stride = 2; // 每兩個取樣點（16 公尺）一跨
    for (let i = i0; i < i1; i += stride) {
      const j = Math.min(i + stride, i1);
      const a = V(rail.x[i], 0, rail.z[i]);
      const c = V(rail.x[j], 0, rail.z[j]);
      const topY = (rail.h[i] + rail.h[j]) / 2 - 0.3;
      const span = a.distanceTo(c);
      const R = (span - 2.6) / 2;
      const springY = topY - R - 2.0;
      b.archWall('stone', a, c, topY, springY, 1, 2.6, 5.2, 0, ST);
      const g = heightAt(a.x, a.z) - 3;
      if (springY - g > 0.5) {
        const ry = Math.atan2(-(c.z - a.z), c.x - a.x);
        b.box('stone', 2.6, springY - g, 5.2, a.x, g, a.z, ry, ST);
        b.box('stone', 3.4, (springY - g) * 0.5, 6.2, a.x, g, a.z, ry, ST);
      }
      const mid = new THREE.Vector3().addVectors(a, c).multiplyScalar(0.5);
      const ry = Math.atan2(-(c.z - a.z), c.x - a.x);
      for (const s of [2.5, -2.5]) b.box('stone', span, 1.0, 0.4, mid.x + Math.sin(ry) * s, topY, mid.z + Math.cos(ry) * s, ry, ST);
    }
    // 鐵軌（兩條鋼軌）
    for (let i = 0; i < rail.n - 1; i++) {
      const a = V(rail.x[i], rail.h[i], rail.z[i]);
      const c = V(rail.x[i + 1], rail.h[i + 1], rail.z[i + 1]);
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const l = Math.hypot(dx, dz);
      const px = -dz / l;
      const pz = dx / l;
      const onBridge = i >= i0 && i < i1;
      for (const s of [0.72, -0.72]) {
        const ya = onBridge ? a.y : Math.max(heightAt(a.x, a.z), a.y - 0.6) + 0.42;
        const yc = onBridge ? c.y : Math.max(heightAt(c.x, c.z), c.y - 0.6) + 0.42;
        b.beam('matte', V(a.x + px * s, ya, a.z + pz * s), V(c.x + px * s, yc, c.z + pz * s), 0.13, col(0.12, 0.11, 0.11));
      }
    }
    done('railViaduct', b);
  }

  // 聖誕樹的位置（庭院）
  const xmasSpots = [V(-120, 70, 82), V(190, 70, -40), V(30, 70, 30)];

  return {
    built,
    extras,
    handles: {
      pumpkins,
      pumpkinSpots,
      hutChimney: V(hg.x - 4.2, hgY + 14.8, hg.z - 3.6),
      villageChimneys,
      owleryTop: V(ow.x, owY + 30, ow.z),
      pitchCenter: V(pt.x, ptY, pt.z),
      stationEnd,
      xmasSpots,
    },
  };
}
