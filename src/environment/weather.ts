import * as THREE from 'three';
import { U, makeRng, lerp } from '../core/globals';
import type { TimeSystem } from './timeSystem';

export type WeatherKind = 'clear' | 'partly' | 'overcast' | 'mist' | 'rain' | 'storm' | 'snow';

export interface WeatherParams {
  cloud: number;
  density: number; // 雲層厚度（越厚越暗）
  fog: number;
  rain: number;
  snow: number;
  wind: number;
}

export const WEATHER: Record<WeatherKind, WeatherParams & { name: string; icon: string }> = {
  clear: { name: '晴朗', icon: '☀', cloud: 0.16, density: 0.3, fog: 0.1, rain: 0, snow: 0, wind: 0.25 },
  partly: { name: '多雲', icon: '⛅', cloud: 0.46, density: 0.5, fog: 0.16, rain: 0, snow: 0, wind: 0.4 },
  overcast: { name: '陰天', icon: '☁', cloud: 0.96, density: 0.85, fog: 0.34, rain: 0, snow: 0, wind: 0.5 },
  mist: { name: '濃霧', icon: '🌫', cloud: 0.75, density: 0.6, fog: 1.0, rain: 0, snow: 0, wind: 0.08 },
  rain: { name: '下雨', icon: '🌧', cloud: 1.0, density: 0.95, fog: 0.52, rain: 1, snow: 0, wind: 0.7 },
  storm: { name: '雷暴', icon: '⛈', cloud: 1.0, density: 1.0, fog: 0.6, rain: 1.6, snow: 0, wind: 1.0 },
  snow: { name: '下雪', icon: '❄', cloud: 0.97, density: 0.8, fog: 0.62, rain: 0, snow: 1, wind: 0.32 },
};

const SEASON_ODDS: Record<string, [WeatherKind, number][]> = {
  春: [['clear', 0.25], ['partly', 0.3], ['overcast', 0.15], ['rain', 0.2], ['mist', 0.1]],
  夏: [['clear', 0.4], ['partly', 0.3], ['overcast', 0.1], ['rain', 0.12], ['storm', 0.08]],
  秋: [['clear', 0.15], ['partly', 0.25], ['overcast', 0.2], ['rain', 0.22], ['storm', 0.06], ['mist', 0.12]],
  冬: [['clear', 0.2], ['partly', 0.18], ['overcast', 0.2], ['snow', 0.32], ['mist', 0.1]],
};

export class Weather {
  kind: WeatherKind = 'partly';
  auto = true;
  readonly cur: WeatherParams = { ...WEATHER.partly };
  wetness = 0;
  snowAcc = 0;
  flash = 0;
  private nextChange = -1;
  private nextFlash = 3;
  private lastT = 0;
  private rng = makeRng(99);
  readonly group = new THREE.Group();
  private rainMat: THREE.ShaderMaterial;
  private snowMat: THREE.ShaderMaterial;
  onChange?: (k: WeatherKind) => void;
  onThunder?: () => void;

  constructor() {
    this.rainMat = this.makePrecip(9000, new THREE.Vector3(70, 50, 70), true);
    this.snowMat = this.makePrecip(8000, new THREE.Vector3(64, 40, 64), false);
  }

  private makePrecip(count: number, box: THREE.Vector3, rain: boolean) {
    const rng = makeRng(rain ? 5 : 6);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rng();
      pos[i * 3 + 1] = rng();
      pos[i * 3 + 2] = rng();
      seed[i] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uBox: { value: box },
        uVel: { value: new THREE.Vector3(0, -9, 0) },
        uTime: U.uTime,
        uAmount: { value: 0 },
        uLight: { value: 1 },
        uScale: { value: 600 },
      },
      vertexShader: /* glsl */ `
        uniform vec3 uCam, uBox, uVel; uniform float uTime, uAmount, uScale;
        attribute float aSeed; varying float vA; varying float vSeed;
        void main(){
          vec3 p = position * uBox + uVel * uTime * (0.75 + 0.5 * aSeed);
          ${rain ? '' : 'p.x += sin(uTime * (0.6 + aSeed) + aSeed * 40.0) * 0.9; p.z += cos(uTime * (0.5 + aSeed * 0.7) + aSeed * 23.0) * 0.9;'}
          p = mod(p - uCam, uBox) - uBox * 0.5;
          vec4 mv = viewMatrix * vec4(uCam + p, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = max(-mv.z, 0.5);
          gl_PointSize = ${rain ? '0.55' : '0.11'} * uScale / dist;
          vA = step(aSeed, uAmount) * (1.0 - smoothstep(${rain ? '22.0, 34.0' : '20.0, 32.0'}, length(p))) * smoothstep(0.6, 2.5, dist);
          vSeed = aSeed;
        }`,
      fragmentShader: rain
        ? /* glsl */ `
        uniform float uLight; uniform vec3 uVel; varying float vA; varying float vSeed;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          c.x += c.y * clamp(length(uVel.xz) / 14.0, 0.0, 0.5);
          float a = (1.0 - smoothstep(0.0, 0.02, abs(c.x))) * (1.0 - abs(c.y) * 2.0);
          if (a * vA < 0.01) discard;
          gl_FragColor = vec4(vec3(0.75, 0.82, 0.9) * uLight, a * vA * 0.32);
        }`
        : /* glsl */ `
        uniform float uLight; varying float vA; varying float vSeed;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float a = (1.0 - smoothstep(0.1, 0.5, length(c)));
          if (a * vA < 0.01) discard;
          gl_FragColor = vec4(vec3(0.95, 0.97, 1.0) * uLight, a * vA * 0.85);
        }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 50;
    pts.visible = false;
    pts.userData.noReflect = true;
    this.group.add(pts);
    return mat;
  }

  set(kind: WeatherKind, manual = true) {
    this.kind = kind;
    if (manual) this.auto = false;
    this.onChange?.(kind);
  }

  update(dt: number, time: TimeSystem, camera: THREE.Camera, lightLevel: number, pixelHeight: number) {
    // 自動天氣：每隔數個遊戲小時換一次
    if (this.auto) {
      if (this.nextChange < 0) this.nextChange = time.t + 0.3;
      if (time.t > this.nextChange || time.t < this.nextChange - 3) {
        const odds = SEASON_ODDS[time.seasonName];
        let r = this.rng();
        let pick: WeatherKind = odds[0][0];
        for (const [k, w] of odds) {
          if (r < w) {
            pick = k;
            break;
          }
          r -= w;
        }
        this.kind = pick;
        this.onChange?.(pick);
        this.nextChange = time.t + (time.seasonFast ? 12 + this.rng() * 20 : 0.14 + this.rng() * 0.3);
      }
    }
    const tg = WEATHER[this.kind];
    const k = 1 - Math.exp(-dt / 3.2);
    const c = this.cur;
    c.cloud = lerp(c.cloud, tg.cloud, k);
    c.density = lerp(c.density, tg.density, k);
    c.fog = lerp(c.fog, tg.fog, k);
    c.rain = lerp(c.rain, tg.rain, k);
    c.snow = lerp(c.snow, tg.snow, k);
    c.wind = lerp(c.wind, tg.wind, k);

    // 濕潤與積雪隨天氣累積（以遊戲時間計，另加即時下限讓變化看得見）
    const gh = Math.min(dt * Math.max(time.speed, 240) / 3600, 0.5); // 這一幀經過的遊戲小時
    this.wetness = Math.min(1, Math.max(0, this.wetness + (c.rain > 0.2 ? gh * 3.0 : -gh * 0.35)));
    const melt = time.seasonalSnow > 0.5 ? 0.02 : 0.25;
    this.snowAcc = Math.min(1, Math.max(0, this.snowAcc + (c.snow > 0.3 ? gh * 0.6 : -gh * melt)));
    // 跳到別的日期（或離開冬天）時，殘雪很快融掉
    if (Math.abs(time.t - this.lastT) > 0.5) {
      this.wetness = 0;
      if (time.seasonalSnow < 0.5 && this.kind !== 'snow') this.snowAcc = 0;
    }
    if (time.seasonalSnow < 0.3 && c.snow < 0.3) this.snowAcc = Math.max(0, this.snowAcc - dt * 0.12);
    this.lastT = time.t;

    // 閃電
    this.flash *= Math.exp(-dt * 9);
    if (this.kind === 'storm' && c.rain > 1.1) {
      this.nextFlash -= dt;
      if (this.nextFlash < 0) {
        this.flash = 1;
        this.nextFlash = this.rng() < 0.35 ? 0.12 + this.rng() * 0.2 : 2.5 + this.rng() * 7;
        this.onThunder?.();
      }
    }

    const cam = camera.position;
    const windX = 3 + c.wind * 9;
    const [rainPts, snowPts] = this.group.children as THREE.Points[];
    rainPts.visible = c.rain > 0.02;
    snowPts.visible = c.snow > 0.02;
    const scale = pixelHeight * 0.9;
    this.rainMat.uniforms.uCam.value.copy(cam);
    this.rainMat.uniforms.uVel.value.set(windX * 0.6, -19, windX * 0.25);
    this.rainMat.uniforms.uAmount.value = Math.min(1, c.rain * 0.65);
    this.rainMat.uniforms.uLight.value = 0.25 + lightLevel * 0.75;
    this.rainMat.uniforms.uScale.value = scale;
    this.snowMat.uniforms.uCam.value.copy(cam);
    this.snowMat.uniforms.uVel.value.set(windX * 0.25, -1.6, windX * 0.1);
    this.snowMat.uniforms.uAmount.value = Math.min(1, c.snow);
    this.snowMat.uniforms.uLight.value = 0.3 + lightLevel * 0.7;
    this.snowMat.uniforms.uScale.value = scale;
  }
}
