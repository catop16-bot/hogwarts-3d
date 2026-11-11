import * as THREE from 'three';
import { U } from '../core/globals';

/** 天空與霧共用的 uniform */
export const SkyU = {
  uZenith: { value: new THREE.Color(0.08, 0.22, 0.55) },
  uHorizon: { value: new THREE.Color(0.5, 0.64, 0.8) },
  uSunDir: U.uSunDir, // 主光源方向（太陽或月亮）
  uSunPos: { value: new THREE.Vector3(0, 1, 0) }, // 真正的太陽方向
  uMoonPos: { value: new THREE.Vector3(0, -1, 0) },
  uSunGlow: { value: new THREE.Color(1, 0.8, 0.6) },
  uSunDisc: { value: new THREE.Color(8, 7, 6) },
  uMoonColor: { value: new THREE.Color(1.2, 1.3, 1.5) },
  uCloudLit: { value: new THREE.Color(1, 1, 1) },
  uCloudDark: { value: new THREE.Color(0.3, 0.33, 0.4) },
  uCloud: { value: 0.4 },
  uCloudDensity: { value: 0.8 },
  uStars: { value: 0 },
  uStarRot: { value: new THREE.Matrix3() },
  uAurora: { value: 0 },
  uFlash: { value: 0 },
  uTime: U.uTime,
  uNoise: U.uNoise,
  uCloudOffset: { value: new THREE.Vector2() },
};

const VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith, uHorizon, uSunPos, uMoonPos, uSunGlow, uSunDisc, uMoonColor, uCloudLit, uCloudDark;
uniform float uCloud, uCloudDensity, uStars, uAurora, uFlash, uTime;
uniform mat3 uStarRot;
uniform sampler2D uNoise;
uniform vec2 uCloudOffset;

float hash31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

float cloudNoise(vec2 uv){
  float n = texture2D(uNoise, uv * 0.11 + uCloudOffset).r * 0.5;
  n += texture2D(uNoise, uv * 0.31 + uCloudOffset * 1.7).g * 0.26;
  n += texture2D(uNoise, uv * 0.87 + uCloudOffset * 2.9).b * 0.15;
  n += texture2D(uNoise, uv * 2.3 + uCloudOffset * 4.3).a * 0.09;
  return n;
}

void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  float t = 1.0 - exp(-max(y, 0.0) * 5.0);
  vec3 col = mix(uHorizon, uZenith, t);
  col = mix(col, uHorizon * 0.55, (1.0 - smoothstep(-0.3, 0.0, y)));

  // 太陽光暈
  float sd = max(dot(d, uSunPos), 0.0);
  float horizonBoost = 1.0 + 2.0 * (1.0 - smoothstep(0.0, 0.35, abs(y)));
  col += uSunGlow * (pow(sd, 5.0) * 0.16 + pow(sd, 40.0) * 0.5 + pow(sd, 400.0) * 1.2) * horizonBoost;

  // 星空
  if (uStars > 0.01 && y > -0.05) {
    vec3 s = uStarRot * d;
    vec3 g = s * 190.0;
    vec3 id = floor(g);
    vec3 f = fract(g) - 0.5;
    float h = hash31(id);
    float star = step(0.9962, h) * (1.0 - smoothstep(0.0, 0.42, length(f)));
    float b = (h - 0.9962) / 0.0038;
    float tw = 0.75 + 0.25 * sin(uTime * (2.0 + b * 5.0) + h * 400.0);
    vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), fract(h * 91.7));
    col += tint * star * (0.25 + b * b * 2.2) * tw * uStars * smoothstep(-0.05, 0.15, y);
    // 淡淡的銀河
    float band = exp(-pow(dot(s, normalize(vec3(0.5, 0.2, 0.84))) * 3.2, 2.0));
    col += vec3(0.025, 0.03, 0.045) * band * texture2D(uNoise, s.xy * 1.5).r * uStars;
  }

  // 月亮（由太陽方向自然形成月相）
  float md = dot(d, uMoonPos);
  const float MR = 0.026;
  if (md > cos(MR * 1.05)) {
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonPos));
    vec3 up = cross(uMoonPos, right);
    vec2 p = vec2(dot(d, right), dot(d, up)) / sin(MR);
    float r2 = dot(p, p);
    if (r2 < 1.0) {
      float z = sqrt(1.0 - r2);
      vec3 n = normalize(p.x * right + p.y * up - z * uMoonPos);
      float lit = smoothstep(-0.05, 0.25, dot(n, uSunPos));
      float mare = texture2D(uNoise, p * 0.21 + 0.3).r * 0.5 + texture2D(uNoise, p * 0.6).g * 0.25;
      vec3 mc = uMoonColor * (0.55 + 0.6 * mare) * (lit * 0.98 + 0.02);
      float edge = (1.0 - smoothstep(0.9, 1.0, r2));
      col = mix(col, mc, edge * (0.15 + 0.85 * lit));
    }
  }
  float mg = max(md, 0.0);
  col += uMoonColor * 0.02 * pow(mg, 300.0);

  // 太陽圓盤
  col += uSunDisc * smoothstep(0.99986, 0.99995, sd);

  // 極光
  if (uAurora > 0.01 && y > 0.03) {
    float ang = atan(d.x, -d.z);
    float curtain = texture2D(uNoise, vec2(ang * 0.35 + uTime * 0.004, y * 0.25 + uTime * 0.002)).r;
    float rays = texture2D(uNoise, vec2(ang * 3.0 - uTime * 0.01, 0.37)).g;
    float north = smoothstep(-0.2, 0.7, -d.z);
    float band = smoothstep(0.52, 0.72, curtain) * smoothstep(0.03, 0.18, y) * (1.0 - smoothstep(0.25, 0.75, y));
    vec3 ac = mix(vec3(0.1, 1.0, 0.45), vec3(0.55, 0.2, 0.9), smoothstep(0.2, 0.6, y));
    col += ac * band * (0.4 + rays * 1.2) * north * uAurora * 0.22;
  }

  // 雲層
  if (y > -0.02) {
    vec2 cuv = d.xz / (max(y, 0.0) + 0.16);
    float c = cloudNoise(cuv);
    float thr = 1.02 - uCloud * 1.0;
    float cov = smoothstep(thr - 0.13, thr + 0.13, c);
    vec2 toSun = normalize(uSunDir().xz + 1e-4) * 0.22;
    float c2 = cloudNoise(cuv + toSun);
    float shade = clamp(0.5 + (c - c2) * 2.6, 0.0, 1.0);
    vec3 cc = mix(uCloudLit, uCloudDark, shade * (0.45 + 0.55 * uCloudDensity));
    cc += uSunGlow * pow(sd, 6.0) * 0.35 * (1.0 - cov * 0.6);
    cc += vec3(0.7, 0.8, 1.0) * uFlash * (0.4 + 0.6 * c);
    float fade = smoothstep(-0.02, 0.1, y);
    col = mix(col, cc, cov * fade * (0.55 + 0.45 * uCloudDensity));
  }
  col += vec3(0.5, 0.6, 0.8) * uFlash * 0.25;
  gl_FragColor = vec4(col, 1.0);
}`.replace('uSunDir()', '(uSunPos.y > -0.08 ? uSunPos : uMoonPos)');

export function createSky() {
  const geo = new THREE.SphereGeometry(1, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: SkyU as any,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';
  return mesh;
}

/**
 * 「施了魔法的天花板」用的材質：畫在室內的拱頂上，卻依視線方向顯示真正的天空，
 * 看起來就像屋頂消失了一樣。
 */
export function createCeilingSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: SkyU as any,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    fog: false,
  });
}

/** 後製霧使用的天空顏色近似（與天空球底色一致） */
export const GLSL_SKY_APPROX = /* glsl */ `
vec3 skyApprox(vec3 d, vec3 zenith, vec3 horizon, vec3 sunPos, vec3 sunGlow){
  float t = 1.0 - exp(-max(d.y, 0.0) * 5.0);
  vec3 col = mix(horizon, zenith, t);
  float sd = max(dot(d, sunPos), 0.0);
  float horizonBoost = 1.0 + 2.0 * (1.0 - smoothstep(0.0, 0.35, abs(d.y)));
  col += sunGlow * (pow(sd, 5.0) * 0.16 + pow(sd, 40.0) * 0.5) * horizonBoost;
  return col;
}`;
