import * as THREE from 'three';

/** 可重現的亂數（mulberry32） */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const saturate = (v: number) => clamp(v, 0, 1);
export function smoothstep(a: number, b: number, v: number) {
  const t = saturate((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** 可無縫拼接的 FBM 雜訊貼圖，四個通道各自獨立 */
function makeNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let c = 0; c < 4; c++) {
    const rng = makeRng(1234 + c * 977);
    const acc = new Float32Array(size * size);
    let amp = 1;
    for (let oct = 0; oct < 6; oct++) {
      const cells = 4 << oct;
      const grid = new Float32Array(cells * cells);
      for (let i = 0; i < grid.length; i++) grid[i] = rng();
      for (let y = 0; y < size; y++) {
        const fy = (y / size) * cells;
        const y0 = Math.floor(fy);
        const ty = fy - y0;
        const sy = ty * ty * (3 - 2 * ty);
        const ya = y0 % cells;
        const yb = (y0 + 1) % cells;
        for (let x = 0; x < size; x++) {
          const fx = (x / size) * cells;
          const x0 = Math.floor(fx);
          const tx = fx - x0;
          const sx = tx * tx * (3 - 2 * tx);
          const xa = x0 % cells;
          const xb = (x0 + 1) % cells;
          const v =
            lerp(lerp(grid[ya * cells + xa], grid[ya * cells + xb], sx), lerp(grid[yb * cells + xa], grid[yb * cells + xb], sx), sy);
          acc[y * size + x] += v * amp;
        }
      }
      amp *= 0.5;
    }
    // 拉開對比：把 2%~98% 的範圍映射到 0..1，方便著色器取閾值
    const sorted = Float32Array.from(acc).sort();
    const lo = sorted[Math.floor(sorted.length * 0.02)];
    const hi = sorted[Math.floor(sorted.length * 0.98)];
    for (let i = 0; i < acc.length; i++) data[i * 4 + c] = Math.round(saturate((acc[i] - lo) / (hi - lo)) * 255);
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** 所有材質共用的 uniform（以參考共享，改一處全部生效） */
export const U = {
  uTime: { value: 0 },
  uSnow: { value: 0 }, // 積雪量 0..1
  uSnowLine: { value: 900 }, // 高山雪線高度
  uWet: { value: 0 }, // 雨後濕潤 0..1
  uWind: { value: 0.3 },
  uNight: { value: 0 }, // 夜晚程度 0..1
  uLit: { value: 0 }, // 窗戶點燈比例 0..1
  uWindowTint: { value: new THREE.Color(1.0, 0.72, 0.36) },
  uHallTint: { value: new THREE.Color(1.0, 0.78, 0.42) },
  uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
  uFoliage: { value: new THREE.Vector4(0, 1, 0, 0) }, // 春、夏、秋、冬 權重
  uGrass: { value: new THREE.Color(0.25, 0.33, 0.12) },
  uNoise: { value: makeNoiseTexture() },
  uMask: { value: null as THREE.Texture | null }, // 世界遮罩（森林等）
  uIce: { value: 0 },
};

/** 給 three 內建材質打補丁的共用 GLSL：世界座標、雜訊 */
export const GLSL_COMMON = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform float uSnow;
uniform float uSnowLine;
uniform float uWet;
uniform float uWind;
uniform float uNight;
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec4 noiseTex(vec2 uv){ return texture2D(uNoise, uv); }
`;

type PatchOpts = {
  key: string;
  uniforms?: Record<string, { value: any }>;
  vertexPars?: string;
  vertexMain?: string; // 在 begin_vertex 之後（可改 transformed）
  fragPars?: string;
  fragColor?: string; // 在 color_fragment 之後（可改 diffuseColor）
  fragNormal?: string; // 在 normal_fragment_maps 之後（可改 normal）
  fragRough?: string; // 在 roughnessmap_fragment 之後（可改 roughnessFactor）
  fragEmissive?: string; // 在 emissivemap_fragment 之後（可改 totalEmissiveRadiance）
};

/**
 * 在 three 內建材質上注入程式碼，同時提供 vWPos / vWNormal（世界座標與世界法線）。
 */
export function patchMaterial<T extends THREE.Material>(mat: T, o: PatchOpts): T {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uNoise: U.uNoise,
      uTime: U.uTime,
      uSnow: U.uSnow,
      uSnowLine: U.uSnowLine,
      uWet: U.uWet,
      uWind: U.uWind,
      uNight: U.uNight,
      ...(o.uniforms || {}),
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
varying vec3 vWNormal;
${GLSL_COMMON}
${o.vertexPars || ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
${o.vertexMain || ''}
#ifdef USE_INSTANCING
  vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  vWNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWNormal = normalize(mat3(modelMatrix) * objectNormal);
#endif`,
      );
    let fs = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vWPos;
varying vec3 vWNormal;
${GLSL_COMMON}
${o.fragPars || ''}`,
    );
    if (o.fragColor) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${o.fragColor}`);
    if (o.fragNormal) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${o.fragNormal}`);
    if (o.fragRough) fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${o.fragRough}`);
    if (o.fragEmissive) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${o.fragEmissive}`);
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => o.key;
  return mat;
}

/** 由導數推算凹凸法線（不需要切線空間） */
export const GLSL_BUMP = /* glsl */ `
vec3 perturbBump(vec3 surfPos, vec3 surfNorm, float h, float faceDir){
  vec2 dH = vec2(dFdx(h), dFdy(h));
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;
