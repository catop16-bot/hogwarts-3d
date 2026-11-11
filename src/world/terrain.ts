import * as THREE from 'three';
import { U, patchMaterial, GLSL_BUMP } from '../core/globals';
import { heightAt, forestDensity } from './heightfield';

export const MASK_EXTENT = 3072; // 遮罩貼圖涵蓋 ±3072 公尺

interface Level {
  R: number;
  step: number;
  inner: number; // 內層半徑（0 表示沒有挖洞）
  lower: number; // 與內層重疊處往下壓的高度
  skirt: number;
}
const LEVELS: Level[] = [
  { R: 768, step: 3, inner: 0, lower: 0, skirt: 14 },
  { R: 3072, step: 16, inner: 768, lower: 5, skirt: 70 },
  { R: 13056, step: 64, inner: 3072, lower: 22, skirt: 0 },
];

function buildLevel(lv: Level) {
  const n = Math.round((2 * lv.R) / lv.step);
  const n1 = n + 1;
  const hs = new Float32Array(n1 * n1);
  const hole = lv.inner > 0 ? lv.inner - lv.step * 2 : -1;
  for (let j = 0; j < n1; j++) {
    const z = -lv.R + j * lv.step;
    for (let i = 0; i < n1; i++) {
      const x = -lv.R + i * lv.step;
      if (Math.abs(x) < hole && Math.abs(z) < hole) continue;
      hs[j * n1 + i] = heightAt(x, z);
    }
  }
  const skirtVerts = lv.skirt > 0 ? n1 * 4 : 0;
  const pos = new Float32Array((n1 * n1 + skirtVerts) * 3);
  const nor = new Float32Array((n1 * n1 + skirtVerts) * 3);
  const v = new THREE.Vector3();
  for (let j = 0; j < n1; j++) {
    const z = -lv.R + j * lv.step;
    for (let i = 0; i < n1; i++) {
      const x = -lv.R + i * lv.step;
      const k = j * n1 + i;
      const h = hs[k];
      const inOverlap = lv.inner > 0 && Math.abs(x) < lv.inner && Math.abs(z) < lv.inner;
      pos[k * 3] = x;
      pos[k * 3 + 1] = inOverlap ? h - lv.lower : h;
      pos[k * 3 + 2] = z;
      const hl = hs[j * n1 + Math.max(i - 1, 0)];
      const hr = hs[j * n1 + Math.min(i + 1, n)];
      const hd = hs[Math.max(j - 1, 0) * n1 + i];
      const hu = hs[Math.min(j + 1, n) * n1 + i];
      const sx = (i === 0 || i === n ? 1 : 2) * lv.step;
      const sz = (j === 0 || j === n ? 1 : 2) * lv.step;
      v.set(-(hr - hl) / sx, 1, -(hu - hd) / sz).normalize();
      nor[k * 3] = v.x;
      nor[k * 3 + 1] = v.y;
      nor[k * 3 + 2] = v.z;
    }
  }
  const idx: number[] = [];
  const cellHole = lv.inner > 0 ? lv.inner - lv.step : -1;
  for (let j = 0; j < n; j++) {
    const z0 = -lv.R + j * lv.step;
    const z1 = z0 + lv.step;
    for (let i = 0; i < n; i++) {
      const x0 = -lv.R + i * lv.step;
      const x1 = x0 + lv.step;
      if (Math.max(Math.abs(x0), Math.abs(x1)) <= cellHole && Math.max(Math.abs(z0), Math.abs(z1)) <= cellHole) continue;
      const a = j * n1 + i;
      const b = a + 1;
      const c = a + n1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  if (lv.skirt > 0) {
    // 邊緣往下延伸的裙邊，遮住與外層之間的縫隙
    let s = n1 * n1;
    const ring = (get: (t: number) => number, flip: boolean) => {
      const start = s;
      for (let t = 0; t < n1; t++) {
        const k = get(t);
        pos[s * 3] = pos[k * 3];
        pos[s * 3 + 1] = pos[k * 3 + 1] - lv.skirt;
        pos[s * 3 + 2] = pos[k * 3 + 2];
        nor[s * 3] = nor[k * 3];
        nor[s * 3 + 1] = nor[k * 3 + 1];
        nor[s * 3 + 2] = nor[k * 3 + 2];
        s++;
      }
      for (let t = 0; t < n; t++) {
        const a = get(t);
        const b = get(t + 1);
        const c = start + t;
        const d = start + t + 1;
        if (flip) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    };
    ring((t) => t, false); // 北
    ring((t) => n * n1 + t, true); // 南
    ring((t) => t * n1, true); // 西
    ring((t) => t * n1 + n, false); // 東
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

function buildMask() {
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    const z = ((j + 0.5) / size - 0.5) * 2 * MASK_EXTENT;
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size - 0.5) * 2 * MASK_EXTENT;
      const f = forestDensity(x, z);
      const k = (j * size + i) * 4;
      data[k] = Math.round(Math.min(1, f.forbidden + f.wood * 0.8) * 255);
      data[k + 1] = Math.round(f.forbidden * 255);
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** 湖床深度貼圖（給水面著色器判斷淺灘） */
export function buildDepthTexture() {
  const size = 512;
  const data = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    const z = ((j + 0.5) / size - 0.5) * 2 * MASK_EXTENT;
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size - 0.5) * 2 * MASK_EXTENT;
      data[j * size + i] = heightAt(x, z);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.FloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  return patchMaterial(mat, {
    key: 'terrain',
    uniforms: { uMask: U.uMask, uGrass: U.uGrass },
    fragPars: /* glsl */ `
      uniform sampler2D uMask; uniform vec3 uGrass;
      ${GLSL_BUMP}
      float gSnow; float gBump;`,
    fragColor: /* glsl */ `
      {
        vec3 N = normalize(vWNormal);
        float slope = 1.0 - N.y;
        vec2 p = vWPos.xz;
        float n1 = noiseTex(p / 37.0).r;
        float n2 = noiseTex(p / 173.0).g;
        float n3 = noiseTex(p / 9.0).b;
        float n4 = noiseTex(p / 800.0).a;
        float n5 = noiseTex(p / 2.7).r;
        vec2 muv = p / ${(MASK_EXTENT * 2).toFixed(1)} + 0.5;
        vec4 mask = texture2D(uMask, muv);
        float inMask = step(abs(muv.x - 0.5), 0.5) * step(abs(muv.y - 0.5), 0.5);
        float forest = mask.r * inMask;
        vec3 grass = uGrass * (0.5 + 0.6 * n2) * (0.8 + 0.3 * n5) * (0.75 + 0.4 * n4);
        grass = mix(grass, grass * vec3(1.25, 1.05, 0.6), n1 * 0.45);
        vec3 moor = mix(vec3(0.15, 0.115, 0.06), vec3(0.17, 0.10, 0.13), n1) * (0.7 + 0.6 * n3);
        float moorAmt = smoothstep(0.42, 0.66, n4 + n2 * 0.35) * smoothstep(55.0, 170.0, vWPos.y);
        vec3 col = mix(grass, moor, moorAmt * 0.75);
        col = mix(col, vec3(0.035, 0.04, 0.022) * (0.7 + 0.6 * n3), forest * 0.85);
        // 岩壁：水平的岩層紋理加上垂直裂隙
        float strata = noiseTex(vec2(vWPos.y / 11.0 + n2 * 0.6, (p.x + p.y) / 310.0)).r;
        float fract1 = noiseTex(vec2((p.x - p.y) / 23.0, vWPos.y / 70.0)).g;
        vec3 rock = mix(vec3(0.10, 0.098, 0.095), vec3(0.25, 0.235, 0.215), strata * 0.6 + n1 * 0.4) * (0.7 + 0.5 * n3);
        rock *= 0.72 + 0.5 * fract1;
        float rockAmt = smoothstep(0.2, 0.4, slope + (n1 - 0.5) * 0.16);
        col = mix(col, rock, rockAmt);
        col = mix(col, rock * 1.15, smoothstep(330.0, 720.0, vWPos.y + n2 * 160.0) * 0.8);
        float shore = 1.0 - smoothstep(0.2, 2.6, vWPos.y + n1 * 1.2);
        col = mix(col, vec3(0.13, 0.12, 0.10) * (0.55 + 0.9 * n3), shore * (1.0 - rockAmt));
        col *= mix(0.3, 1.0, smoothstep(-7.0, 0.3, vWPos.y));
        float snowAlt = smoothstep(uSnowLine - 90.0, uSnowLine + 130.0, vWPos.y + n2 * 130.0);
        float snowAmt = max(uSnow, snowAlt);
        gSnow = smoothstep(0.3, 0.55, snowAmt * (1.2 - slope * 2.0) - n4 * 0.3 + (n1 - 0.5) * 0.3) * step(0.25, vWPos.y);
        gSnow *= 1.0 - forest * 0.45;
        col = mix(col, vec3(0.80, 0.85, 0.93) * (0.8 + 0.14 * n5 + 0.16 * n2), gSnow);
        col *= 1.0 - 0.32 * uWet * (1.0 - gSnow);
        diffuseColor.rgb = col;
        gBump = (n1 * 0.5 + n3 * 0.3 + n5 * 0.2) * mix(1.0, 2.2, rockAmt) * (1.0 - gSnow * 0.7);
      }`,
    fragNormal: /* glsl */ `
      {
        float bd = length(vViewPosition);
        float bs = 1.6 / (1.0 + bd * 0.004);
        // 遠處改用大尺度雜訊，讓山體有稜線與溝壑
        float macro = (noiseTex(vWPos.xz / 420.0).g * 26.0 + noiseTex(vWPos.xz / 1300.0).r * 70.0) * smoothstep(600.0, 3200.0, bd) * (1.0 - gSnow * 0.5);
        normal = perturbBump(-vViewPosition, normal, gBump * bs + macro, faceDirection);
      }`,
    fragRough: /* glsl */ `roughnessFactor = mix(0.96, 0.55, uWet * (1.0 - gSnow)) ;`,
  });
}

export function buildTerrain() {
  const group = new THREE.Group();
  group.name = 'terrain';
  U.uMask.value = buildMask();
  const mat = createTerrainMaterial();
  LEVELS.forEach((lv, i) => {
    const mesh = new THREE.Mesh(buildLevel(lv), mat);
    mesh.receiveShadow = true;
    mesh.castShadow = i < 2;
    mesh.name = `terrain-${i}`;
    group.add(mesh);
  });
  return group;
}
