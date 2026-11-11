import * as THREE from 'three';
import { heightAt, normalAt, onPath, sdPoly, PLATEAU, WATER } from './heightfield';
import { U, makeRng } from '../core/globals';
import type { CollisionWorld } from '../player/collision';

const CELL = 8;
const RADIUS = 44;
const PER_CELL = 60;
const MAX = Math.ceil(((RADIUS * 2) / CELL + 2) ** 2) * PER_CELL;

/** 近景的草叢：只在鏡頭附近幾十公尺內生成，隨風擺動，冬天積雪 */
export class Grass {
  readonly mesh: THREE.InstancedMesh;
  private cells = new Map<string, Float32Array>();
  private cx = Infinity;
  private cz = Infinity;
  private m4 = new THREE.Matrix4();

  constructor(private world: CollisionWorld) {
    // 一叢：七片交錯的草葉
    const blades: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.PlaneGeometry(0.11, 1, 1, 3);
      g.translate(0, 0.5, 0);
      const pos = g.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const y = pos.getY(k);
        pos.setX(k, pos.getX(k) * (1 - y * 0.85));
        pos.setZ(k, y * y * 0.18);
      }
      const a = (i / 7) * Math.PI * 2 + i * 0.7;
      g.rotateY(a);
      g.translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
      g.scale(1, 0.75 + ((i * 37) % 10) / 20, 1);
      blades.push(g);
    }
    const geo = mergeAll(blades);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uTime: U.uTime, uWind: U.uWind, uGrass: U.uGrass, uSnow: U.uSnow });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; uniform float uSnow; varying float vH;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vH = position.y;
           #ifdef USE_INSTANCING
           vec3 ip = instanceMatrix[3].xyz;
           float sway = sin(uTime * 2.1 + ip.x * 0.31 + ip.z * 0.27) * 0.5 + sin(uTime * 3.7 + ip.x * 0.9) * 0.25;
           transformed.x += sway * (0.08 + uWind * 0.22) * position.y * position.y;
           transformed.z += cos(uTime * 1.7 + ip.z * 0.4) * (0.04 + uWind * 0.12) * position.y * position.y;
           transformed.y *= 1.0 - uSnow * 0.55;
           #endif`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uGrass; uniform float uSnow; varying float vH;')
        // 雙面的草葉：背面不要把法線翻過去，否則一半的葉子會是黑的
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           vec3 gc = mix(uGrass * 0.7, uGrass * vec3(1.3, 1.25, 0.9), vH) * diffuseColor.rgb;
           diffuseColor.rgb = mix(gc, vec3(0.92, 0.94, 0.98), uSnow * smoothstep(0.3, 0.9, vH));`,
        );
    };
    mat.customProgramCacheKey = () => 'grass';
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3).fill(1), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.name = 'grass';
  }

  /** 草叢跟著鏡頭走；鏡頭在高空（室內的獨立場景、飛很高）時不畫 */
  update(cam: THREE.Vector3) {
    const ground = heightAt(cam.x, cam.z);
    const far = cam.y - ground > 70 || cam.y > 1000;
    this.mesh.visible = !far;
    if (far) return;
    const gx = Math.floor(cam.x / CELL);
    const gz = Math.floor(cam.z / CELL);
    if (gx === this.cx && gz === this.cz) return;
    this.cx = gx;
    this.cz = gz;
    const n = Math.ceil(RADIUS / CELL);
    const keep = new Set<string>();
    let count = 0;
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    const colors = this.mesh.instanceColor!.array as Float32Array;
    for (let j = -n; j <= n; j++) {
      for (let i = -n; i <= n; i++) {
        if (i * i + j * j > (n + 0.5) * (n + 0.5)) continue;
        const key = `${gx + i},${gz + j}`;
        keep.add(key);
        let data = this.cells.get(key);
        if (!data) {
          data = this.fill(gx + i, gz + j);
          this.cells.set(key, data);
        }
        const k = data.length / 19;
        for (let q = 0; q < k && count < MAX; q++) {
          arr.set(data.subarray(q * 19, q * 19 + 16), count * 16);
          colors.set(data.subarray(q * 19 + 16, q * 19 + 19), count * 3);
          count++;
        }
      }
    }
    for (const key of this.cells.keys()) if (!keep.has(key)) this.cells.delete(key);
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }

  /** 一格裡的草叢：避開道路、水邊、陡坡、城堡的台地與任何建築的地板 */
  private fill(ci: number, cj: number) {
    const rng = makeRng(ci * 7919 + cj * 104729 + 17);
    const out: number[] = [];
    const nrm = new THREE.Vector3();
    for (let q = 0; q < PER_CELL; q++) {
      const x = (ci + rng()) * CELL;
      const z = (cj + rng()) * CELL;
      const s = 0.28 + rng() * 0.32;
      const h = heightAt(x, z);
      if (h < WATER + 0.8 || h > 260) continue;
      if (normalAt(x, z, 1.2, nrm).y < 0.86) continue;
      if (onPath(x, z) < 1.2) continue;
      if (Math.abs(x) < 520 && Math.abs(z) < 520 && sdPoly(x, z, PLATEAU) < 4) continue;
      const f = this.world.floorBelow(x, h + 1.4, z, 1.45);
      if (f != null && f > h - 0.6) continue;
      this.m4.compose(_p.set(x, h - 0.04, z), _q.setFromAxisAngle(_up, rng() * Math.PI * 2), _s.set(s * 1.2, s, s * 1.2));
      out.push(...this.m4.elements);
      const t = 0.75 + rng() * 0.4;
      out.push(t, t * (0.95 + rng() * 0.1), t * (0.85 + rng() * 0.2));
    }
    return new Float32Array(out);
  }
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function mergeAll(gs: THREE.BufferGeometry[]) {
  let total = 0;
  for (const g of gs) total += g.index ? g.index.count : g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  let o = 0;
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    // 法線一律朝上：草葉的亮度跟地面一致，不會因為側面背光變成黑色的刺
    for (let k = 0; k < g.attributes.position.count; k++) nrm.set([0, 1, 0], (o + k) * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}
