import * as THREE from 'three';
import { U, patchMaterial, GLSL_BUMP } from '../core/globals';
import { SkyU } from '../environment/sky';
import type { MatKey } from './kit';

/** 鐘樓時鐘的時間（小時），由主迴圈更新 */
export const ClockU = { uHour: { value: 12 } };

const SNOW = /* glsl */ `
  float snowMask(vec3 N, vec3 P, float lo, float hi){
    float n = noiseTex(P.xz / 7.0 + P.y * 0.07).r;
    return uSnow * smoothstep(lo, hi, N.y + (n - 0.5) * 0.3);
  }`;

function stone() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, vertexColors: true });
  return patchMaterial(mat, {
    key: 'stone',
    fragPars: /* glsl */ `
      ${GLSL_BUMP}
      ${SNOW}
      float gH; float gSn;
      vec2 ashlar(vec2 uv){
        float rowH = 0.62;
        float row = floor(uv.y / rowH);
        float bw = 1.0 + hash11(row * 7.31) * 0.55;
        float x = uv.x / bw + hash11(row + 3.7) * 7.0;
        float c = floor(x);
        vec2 f = vec2(fract(x), fract(uv.y / rowH));
        float e = min(min(f.x, 1.0 - f.x) * bw, min(f.y, 1.0 - f.y) * rowH);
        return vec2(smoothstep(0.012, 0.055, e), hash21(vec2(c, row)));
      }`,
    fragColor: /* glsl */ `
      {
        vec3 N = normalize(vWNormal);
        vec3 w = pow(abs(N), vec3(7.0));
        w /= (w.x + w.y + w.z);
        vec2 a = ashlar(vWPos.zy) * w.x + ashlar(vWPos.xy) * w.z + ashlar(vWPos.xz * 0.9) * w.y;
        float dist = length(vViewPosition);
        float lod = clamp(1.0 - dist / 300.0, 0.0, 1.0);
        float m = mix(0.9, a.x, lod);
        float rnd = mix(0.5, a.y, lod);
        vec3 base = mix(vec3(0.215, 0.195, 0.165), vec3(0.34, 0.31, 0.265), rnd);
        float big = noiseTex(vec2(vWPos.x + vWPos.z, vWPos.y) / 27.0).r;
        float big2 = noiseTex(vec2(vWPos.x - vWPos.z, vWPos.y * 1.3) / 71.0).g;
        base *= 0.72 + 0.4 * big + 0.22 * big2;
        // 雨水沖刷的直條髒汙
        float streak = noiseTex(vec2((vWPos.x + vWPos.z) * 0.085, vWPos.y * 0.017)).b;
        base *= mix(0.74, 1.05, smoothstep(0.2, 0.75, streak));
        // 屋簷與腰線下方較暗
        base *= 0.9 + 0.1 * smoothstep(0.0, 0.5, noiseTex(vec2(vWPos.y * 0.11, 0.3)).a);
        base *= mix(0.5, 1.0, m);
        // 青苔與地衣
        float moss = smoothstep(0.6, 0.85, noiseTex(vWPos.xz / 33.0 + vWPos.y / 51.0).a) * (0.45 + 0.55 * N.y);
        base = mix(base, vec3(0.085, 0.105, 0.045), moss * 0.55);
        base *= vColor.rgb;
        gSn = snowMask(N, vWPos, 0.45, 0.8);
        base = mix(base, vec3(0.80, 0.85, 0.93), gSn);
        base = mix(base, vec3(0.7, 0.75, 0.82), uSnow * 0.16 * big * (1.0 - gSn));
        base *= 1.0 - 0.3 * uWet * (1.0 - gSn);
        diffuseColor.rgb = base;
        gH = (m * 0.07 + rnd * 0.035) * lod + big * 0.05;
      }`,
    fragRough: /* glsl */ `roughnessFactor = mix(0.93, 0.5, uWet * (1.0 - gSn));`,
    fragNormal: /* glsl */ `normal = perturbBump(-vViewPosition, normal, gH * (1.0 - gSn * 0.8), faceDirection);`,
  });
}

function roof() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.05, vertexColors: true, side: THREE.DoubleSide });
  return patchMaterial(mat, {
    key: 'roof',
    fragPars: /* glsl */ `
      ${GLSL_BUMP}
      ${SNOW}
      float gH; float gSn;`,
    fragColor: /* glsl */ `
      {
        vec3 N = normalize(vWNormal);
        vec3 tg = normalize(cross(N, vec3(0.0, 1.0, 0.0)) + 1e-4);
        float u = dot(vWPos, tg);
        float rowH = 0.42;
        float row = floor(vWPos.y / rowH);
        float fy = fract(vWPos.y / rowH);
        float x = u / 0.55 + hash11(row) * 3.0;
        float fx = fract(x);
        float rnd = hash21(vec2(floor(x), row));
        float dist = length(vViewPosition);
        float lod = clamp(1.0 - dist / 220.0, 0.0, 1.0);
        float edge = smoothstep(0.0, 0.16, fy) * smoothstep(0.0, 0.07, min(fx, 1.0 - fx));
        edge = mix(0.88, edge, lod);
        vec3 base = mix(vec3(0.055, 0.072, 0.085), vec3(0.105, 0.125, 0.14), mix(0.5, rnd, lod));
        float big = noiseTex(vec2(vWPos.x + vWPos.z, vWPos.y) / 19.0).g;
        base *= 0.7 + 0.6 * big;
        base *= mix(0.55, 1.0, edge);
        float lichen = smoothstep(0.62, 0.86, noiseTex(vWPos.xz / 13.0 + vWPos.y / 9.0).b);
        base = mix(base, vec3(0.13, 0.15, 0.09), lichen * 0.4);
        base *= vColor.rgb;
        gSn = snowMask(N, vWPos, 0.16, 0.5);
        base = mix(base, vec3(0.82, 0.87, 0.95), gSn);
        base *= 1.0 - 0.25 * uWet * (1.0 - gSn);
        diffuseColor.rgb = base;
        gH = (edge * 0.05 + rnd * 0.03) * lod;
      }`,
    fragRough: /* glsl */ `roughnessFactor = mix(0.7, 0.32, uWet * (1.0 - gSn));`,
    fragNormal: /* glsl */ `normal = perturbBump(-vViewPosition, normal, gH * (1.0 - gSn), faceDirection);`,
  });
}

function wood() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0, vertexColors: true });
  return patchMaterial(mat, {
    key: 'wood',
    fragPars: SNOW + 'float gSn;',
    fragColor: /* glsl */ `
      {
        vec3 N = normalize(vWNormal);
        float grain = noiseTex(vec2(vWPos.x + vWPos.z, vWPos.y * 0.12) * 0.9).r;
        float grain2 = noiseTex(vec2(vWPos.x - vWPos.z, vWPos.y) * 0.21).g;
        vec3 base = mix(vec3(0.075, 0.05, 0.03), vec3(0.16, 0.115, 0.07), grain) * (0.75 + 0.5 * grain2);
        base *= vColor.rgb;
        gSn = snowMask(N, vWPos, 0.4, 0.75);
        base = mix(base, vec3(0.82, 0.87, 0.95), gSn);
        base *= 1.0 - 0.3 * uWet * (1.0 - gSn);
        diffuseColor.rgb = base;
      }`,
  });
}

function matte() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, vertexColors: true });
  return patchMaterial(mat, {
    key: 'matte',
    fragPars: SNOW,
    fragColor: /* glsl */ `
      {
        vec3 N = normalize(vWNormal);
        float n = noiseTex(vWPos.xz / 5.0 + vWPos.y / 7.0).r;
        diffuseColor.rgb *= 0.85 + 0.3 * n;
        float sn = snowMask(N, vWPos, 0.5, 0.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.87, 0.95), sn);
      }`,
  });
}

function cloth() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
  return patchMaterial(mat, {
    key: 'cloth',
    vertexMain: /* glsl */ `
      {
        float ph = position.x * 0.35 + position.z * 0.27 + position.y * 0.4;
        float sway = sin(uTime * (1.4 + uWind * 2.0) + ph) * (0.05 + uWind * 0.22);
        transformed += normal * sway * smoothstep(0.0, 1.0, uv.y);
      }`,
    fragColor: /* glsl */ `
      {
        // 學院色與奶油色相間的方格
        vec2 g = floor(vec2((vWPos.x + vWPos.z) / 2.4, vWPos.y / 2.4));
        float chk = mod(g.x + g.y, 2.0);
        vec3 alt = mix(vec3(0.62, 0.58, 0.46), diffuseColor.rgb * 0.45, 0.25);
        diffuseColor.rgb = mix(diffuseColor.rgb, alt, chk);
        diffuseColor.rgb *= 0.8 + 0.3 * noiseTex(vWPos.xy / 6.0).r;
      }`,
  });
}

function lamp() {
  // 燈籠、燭光：夜裡才亮
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = U.uNight;
    shader.uniforms.uTime = U.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight; uniform float uTime; varying vec3 vLP;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float fl = 0.82 + 0.18 * sin(uTime * 7.0 + floor(vLP.x * 0.7) * 3.1 + floor(vLP.z * 0.7) * 5.3);
         diffuseColor.rgb *= mix(0.05, 7.0 * fl, smoothstep(0.15, 0.7, uNight));`,
      );
  };
  mat.customProgramCacheKey = () => 'lamp';
  return mat;
}

function glass() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.1, vertexColors: true });
  return patchMaterial(mat, {
    key: 'glass',
    uniforms: { uZenith: SkyU.uZenith, uHorizon: SkyU.uHorizon },
    fragPars: 'uniform vec3 uZenith; uniform vec3 uHorizon;' + SNOW,
    fragColor: /* glsl */ `
      {
        vec3 N = normalize(vWNormal);
        // 玻璃格線
        vec3 q = fract(vWPos / 1.5);
        float bars = step(q.x, 0.06) + step(q.y, 0.06) + step(q.z, 0.06);
        vec3 sky = mix(uHorizon, uZenith, 0.4);
        vec3 gl = mix(vec3(0.05, 0.09, 0.08), sky * 0.9, 0.55) * vColor.rgb;
        diffuseColor.rgb = mix(gl, vec3(0.5, 0.52, 0.5), min(bars, 1.0));
        float sn = snowMask(N, vWPos, 0.3, 0.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.87, 0.95), sn);
      }`,
    fragEmissive: /* glsl */ `totalEmissiveRadiance += vec3(0.5, 0.75, 0.35) * 0.12 * uNight;`,
  });
}

function windowMat() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return patchMaterial(mat, {
    key: 'window',
    uniforms: { uLit: U.uLit, uWindowTint: U.uWindowTint, uHallTint: U.uHallTint, uZenith: SkyU.uZenith, uHour: ClockU.uHour },
    vertexPars: /* glsl */ `attribute vec3 aWin; varying vec3 vWin; varying vec2 vWUv;`,
    vertexMain: /* glsl */ `vWin = aWin; vWUv = uv;`,
    fragPars: /* glsl */ `
      varying vec3 vWin; varying vec2 vWUv;
      uniform float uLit; uniform vec3 uWindowTint; uniform vec3 uHallTint; uniform vec3 uZenith; uniform float uHour;
      float gGlass; float gLitK; vec3 gTint;
      float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
    `,
    fragColor: /* glsl */ `
      {
        float seed = vWin.x; float asp = vWin.y; float type = vWin.z;
        vec2 p = vec2(vWUv.x - 0.5, vWUv.y);       // x: -0.5..0.5, y: 0..1
        vec2 pm = vec2(p.x, p.y * asp);            // 以窗寬為單位
        vec3 frame = vec3(0.27, 0.245, 0.21);
        vec3 colr = frame; gGlass = 0.0; gLitK = 0.0; gTint = uWindowTint;
        if (type > 1.5 && type < 2.5) {
          // 鐘面
          vec2 c = vec2(p.x, (p.y - 0.5) * asp) * 2.0;
          float r = length(c);
          if (r > 1.0) discard;
          float ang = atan(c.x, c.y);
          float ring = smoothstep(0.86, 0.9, r) + (1.0 - smoothstep(0.035, 0.05, abs(r - 0.7)));
          float ticks = step(0.7, r) * step(r, 0.86) * step(abs(fract(ang / 6.2831853 * 12.0 + 0.5) - 0.5), 0.07);
          float hAng = uHour / 12.0 * 6.2831853;
          float mAng = fract(uHour) * 6.2831853;
          float hands = 1.0 - smoothstep(0.03, 0.045, sdSeg(c, vec2(0.0), vec2(sin(hAng), cos(hAng)) * 0.42));
          hands = max(hands, 1.0 - smoothstep(0.02, 0.032, sdSeg(c, vec2(0.0), vec2(sin(mAng), cos(mAng)) * 0.64)));
          hands = max(hands, 1.0 - smoothstep(0.06, 0.075, r));
          float metal = clamp(ring + ticks + hands, 0.0, 1.0);
          colr = mix(vec3(0.5, 0.48, 0.4), vec3(0.04, 0.035, 0.03), metal);
          gGlass = 1.0 - metal; gLitK = 0.55; gTint = vec3(1.0, 0.85, 0.6);
        } else if (type > 4.5) {
          // 玫瑰窗
          vec2 c = vec2(p.x, (p.y - 0.5) * asp) * 2.0;
          float r = length(c);
          if (r > 1.0) discard;
          float ang = atan(c.x, c.y);
          float spokes = step(abs(fract(ang / 6.2831853 * 12.0) - 0.5), 0.42) ;
          float rings = step(0.1, abs(r - 0.45)) * step(0.06, abs(r - 0.18));
          float g = spokes * rings * step(r, 0.9);
          colr = mix(frame, vec3(0.03, 0.04, 0.06), g);
          gGlass = g; gLitK = 0.42; gTint = uHallTint;
        } else {
          float archH = min(0.866, asp * 0.6);
          float yA = asp - archH;
          float inside = step(abs(pm.x), 0.5);
          float border = 0.5 - abs(pm.x);
          if (pm.y > yA && type < 2.5 || pm.y > yA && type > 3.5) {
            vec2 q = vec2(abs(pm.x) + 0.5, (pm.y - yA) * (0.866 / archH));
            float d = 1.0 - length(q);
            inside *= step(0.0, d);
            border = min(border, d);
          }
          if (inside < 0.5) discard;
          border = min(border, pm.y);
          if (type > 3.5) {
            // 木門
            float plank = smoothstep(0.0, 0.03, abs(fract(pm.x * 5.0) - 0.5) - 0.44);
            colr = mix(vec3(0.07, 0.045, 0.025), vec3(0.03, 0.02, 0.012), plank);
            float studs = step(length(fract(pm * vec2(5.0, 2.5)) - 0.5), 0.07);
            colr = mix(colr, vec3(0.02), studs);
            colr = mix(frame, colr, smoothstep(0.05, 0.08, border));
          } else if (type > 2.5) {
            // 箭孔：深色凹洞
            colr = mix(frame * 0.8, vec3(0.012, 0.012, 0.014), smoothstep(0.1, 0.2, border));
          } else {
            float fw = type > 0.5 ? 0.055 : 0.11;
            float g = smoothstep(fw, fw + 0.02, border);
            // 直櫺與橫檔
            float mullN = type > 0.5 ? 3.0 : 2.0;
            float mw = type > 0.5 ? 0.02 : 0.038;
            float mull = step(mw, abs(fract((pm.x + 0.5) * mullN + 0.5) - 0.5) / mullN);
            float th = type > 0.5 ? 0.9 : 0.75;
            float tr = step(mw, abs(fract(pm.y / th + 0.5) - 0.5) * th);
            // 高窗上半部的花格
            if (type > 0.5 && pm.y > yA) {
              vec2 q = vec2(abs(pm.x) - 0.25, pm.y - yA - 0.12);
              float circ = abs(length(q) - 0.2);
              mull = min(mull, step(0.025, circ));
            }
            g *= mull * tr;
            // 菱形鉛條
            vec2 dq = fract(vec2(pm.x + pm.y, pm.x - pm.y) * 7.0);
            float lead = step(0.1, dq.x) * step(0.1, dq.y);
            vec3 glassC = mix(vec3(0.015, 0.02, 0.028), uZenith * 0.35 + 0.01, 0.5) * mix(0.6, 1.0, lead);
            colr = mix(frame, glassC, g);
            gGlass = g * mix(0.75, 1.0, lead);
            if (type > 0.5) { gLitK = 0.42; gTint = uHallTint; }
            else { gLitK = step(hash11(seed * 91.7), uLit) * (0.55 + 0.45 * hash11(seed * 13.1)); gTint = uWindowTint * mix(vec3(1.0, 0.85, 0.7), vec3(1.0, 1.0, 0.92), hash11(seed * 5.3)); }
          }
        }
        diffuseColor.rgb = colr;
      }`,
    fragRough: /* glsl */ `roughnessFactor = mix(0.9, 0.18, gGlass);`,
    fragEmissive: /* glsl */ `
      {
        float flick = 0.9 + 0.1 * sin(uTime * (3.0 + vWin.x * 5.0) + vWin.x * 60.0);
        float inner = 0.55 + 0.45 * noiseTex(vWUv * vec2(0.37, 0.61) + vWin.x * 7.0).r;
        totalEmissiveRadiance += gTint * gGlass * gLitK * uNight * flick * inner * 5.2;
      }`,
  });
}

// ------------------------------------------------------------------ 室內材質
function istone() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0, vertexColors: true });
  return patchMaterial(mat, {
    key: 'istone',
    fragPars: /* glsl */ `
      ${GLSL_BUMP}
      float gH; float gFloor;
      vec2 ashlarI(vec2 uv){
        float rowH = 0.62;
        float row = floor(uv.y / rowH);
        float bw = 1.0 + hash11(row * 7.31) * 0.55;
        float x = uv.x / bw + hash11(row + 3.7) * 7.0;
        vec2 f = vec2(fract(x), fract(uv.y / rowH));
        float e = min(min(f.x, 1.0 - f.x) * bw, min(f.y, 1.0 - f.y) * rowH);
        return vec2(smoothstep(0.01, 0.045, e), hash21(vec2(floor(x), row)));
      }
      vec2 flags(vec2 uv){
        vec2 c = floor(uv / 1.3);
        vec2 f = fract(uv / 1.3);
        float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 1.3;
        return vec2(smoothstep(0.012, 0.04, e), hash21(c));
      }`,
    fragColor: /* glsl */ `
      {
        vec3 N = normalize(vWNormal);
        vec3 w = pow(abs(N), vec3(7.0));
        w /= (w.x + w.y + w.z);
        vec2 a = ashlarI(vWPos.zy) * w.x + ashlarI(vWPos.xy) * w.z + flags(vWPos.xz) * w.y;
        float big = noiseTex(vec2(vWPos.x + vWPos.z, vWPos.y) / 23.0).r;
        float fine = noiseTex(vWPos.xz * 0.9 + vWPos.y * 0.7).g;
        vec3 base = mix(vec3(0.27, 0.245, 0.205), vec3(0.40, 0.365, 0.31), a.y);
        base *= (0.78 + 0.34 * big) * (0.9 + 0.2 * fine) * mix(0.62, 1.0, a.x);
        diffuseColor.rgb = base * vColor.rgb;
        gFloor = w.y * step(0.0, N.y);
        gH = a.x * 0.05 + a.y * 0.02 + fine * 0.012;
      }`,
    fragRough: /* glsl */ `roughnessFactor = mix(0.9, 0.42, gFloor);`,
    fragNormal: /* glsl */ `normal = perturbBump(-vViewPosition, normal, gH, faceDirection);`,
  });
}

function iwood() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, vertexColors: true });
  return patchMaterial(mat, {
    key: 'iwood',
    fragColor: /* glsl */ `
      {
        vec3 N = abs(normalize(vWNormal));
        // 木紋沿著最長的水平方向延伸
        vec2 g = N.y > 0.5 ? vWPos.xz : (N.x > N.z ? vWPos.zy : vWPos.xy);
        float grain = noiseTex(vec2(g.x * 0.07, g.y * 1.3)).r;
        float grain2 = noiseTex(g * 0.31).g;
        vec3 base = mix(vec3(0.11, 0.065, 0.035), vec3(0.24, 0.15, 0.08), grain) * (0.8 + 0.4 * grain2);
        diffuseColor.rgb = base * vColor.rgb;
      }`,
  });
}

function iplain() {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
}

function iglow() {
  // 燭火、火盆：室內永遠亮著
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vLP;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.rgb *= 0.8 + 0.2 * sin(uTime * 8.0 + floor(vLP.x * 1.3) * 3.1 + floor(vLP.z * 1.3) * 5.3 + floor(vLP.y) * 1.7);`,
      );
  };
  mat.customProgramCacheKey = () => 'iglow';
  return mat;
}

function iwin() {
  // 從室內看出去的窗：顯示天光，頂點色的 r 帶著高寬比
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uZenith = SkyU.uZenith;
    shader.uniforms.uHorizon = SkyU.uHorizon;
    shader.uniforms.uNight = U.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uZenith; uniform vec3 uHorizon; uniform float uNight; varying vec2 vWUv;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           float asp = vColor.r * 10.0;
           vec2 pm = vec2(vWUv.x - 0.5, vWUv.y * asp);
           float archH = min(0.866, asp * 0.6);
           float yA = asp - archH;
           float border = 0.5 - abs(pm.x);
           if (pm.y > yA) {
             vec2 q = vec2(abs(pm.x) + 0.5, (pm.y - yA) * (0.866 / archH));
             float d = 1.0 - length(q);
             if (d < 0.0) discard;
             border = min(border, d);
           }
           border = min(border, pm.y);
           float g = smoothstep(0.05, 0.07, border);
           float mull = step(0.02, abs(fract((pm.x + 0.5) * 3.0 + 0.5) - 0.5) / 3.0);
           float tr = step(0.02, abs(fract(pm.y / 0.9 + 0.5) - 0.5) * 0.9);
           g *= mull * tr;
           vec2 dq = fract(vec2(pm.x + pm.y, pm.x - pm.y) * 7.0);
           float lead = step(0.1, dq.x) * step(0.1, dq.y);
           vec3 sky = mix(uHorizon, uZenith, 0.35 + 0.3 * vWUv.y) * 1.35 + vec3(0.004, 0.006, 0.012);
           diffuseColor.rgb = mix(vec3(0.05, 0.045, 0.04) * (1.0 - 0.8 * uNight), sky * mix(0.72, 1.0, lead), g);
         }`,
      );
  };
  mat.customProgramCacheKey = () => 'iwin';
  return mat;
}

let cache: Record<MatKey, THREE.Material> | null = null;
export function getMaterials(): Record<MatKey, THREE.Material> {
  if (!cache) {
    cache = { stone: stone(), roof: roof(), wood: wood(), window: windowMat(), matte: matte(), cloth: cloth(), lamp: lamp(), glass: glass(), istone: istone(), iwood: iwood(), iplain: iplain(), iglow: iglow(), iwin: iwin() };
  }
  return cache;
}
