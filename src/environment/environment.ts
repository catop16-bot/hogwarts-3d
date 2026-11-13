import * as THREE from 'three';
import { U, lerp, smoothstep, saturate } from '../core/globals';
import { TimeSystem } from './timeSystem';
import { Weather } from './weather';
import { SkyU, createSky } from './sky';

type Key = [number, number, number, number, number?];

const ZENITH: Key[] = [
  [-18, 0.0022, 0.0045, 0.013],
  [-10, 0.006, 0.012, 0.036],
  [-5, 0.02, 0.045, 0.12],
  [0, 0.055, 0.13, 0.33],
  [6, 0.085, 0.21, 0.5],
  [20, 0.08, 0.23, 0.6],
  [60, 0.065, 0.2, 0.58],
];
const HORIZON: Key[] = [
  [-18, 0.007, 0.012, 0.028],
  [-10, 0.018, 0.028, 0.06],
  [-5, 0.15, 0.1, 0.13],
  [-1, 0.56, 0.3, 0.17],
  [3, 0.66, 0.47, 0.34],
  [10, 0.56, 0.6, 0.68],
  [25, 0.46, 0.62, 0.82],
  [60, 0.42, 0.6, 0.84],
];
// r,g,b,intensity
const SUN: Key[] = [
  [-2.5, 1, 0.3, 0.08, 0],
  [0, 1, 0.36, 0.11, 0.8],
  [3, 1, 0.52, 0.23, 1.9],
  [8, 1, 0.72, 0.46, 2.7],
  [20, 1, 0.9, 0.76, 3.2],
  [50, 1, 0.96, 0.9, 3.5],
];

function sample(table: Key[], e: number, out: number[]) {
  if (e <= table[0][0]) {
    for (let i = 0; i < table[0].length - 1; i++) out[i] = table[0][i + 1]!;
    return out;
  }
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (e <= b[0]) {
      const t = (e - a[0]) / (b[0] - a[0]);
      for (let k = 1; k < a.length; k++) out[k - 1] = lerp(a[k]!, b[k]!, t);
      return out;
    }
  }
  const l = table[table.length - 1];
  for (let i = 0; i < l.length - 1; i++) out[i] = l[i + 1]!;
  return out;
}

/** 後製霧的參數 */
export const FogU = {
  uFogDensity: { value: 0.00005 },
  uFogHeightDensity: { value: 0.0006 },
  uFogHeightFalloff: { value: 0.02 },
  uExposure: { value: 1 },
  uFogTint: { value: new THREE.Color(1, 1, 1) },
};

export class Environment {
  readonly time = new TimeSystem();
  readonly weather = new Weather();
  readonly sky = createSky();
  readonly sun = new THREE.DirectionalLight(0xffffff, 3);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  readonly group = new THREE.Group();
  /** 真正的太陽方向與可見度（給光束特效） */
  readonly sunPos = new THREE.Vector3();
  sunVisible = 0;
  dayLight = 1; // 0 夜晚 .. 1 白天
  lightLevel = 1;
  shadowExtent = 400;
  /** true 時這一幀不移動陰影視錐（陰影貼圖也不重畫），用來隔幀更新陰影 */
  shadowHold = false;
  /** 鏡頭在室內的程度 0..1：室內不受天光直接照亮 */
  indoor = 0;
  /** 室內殘留的天光比例，以及陽光的倍率（獨立的室內場景沒有陽光） */
  indoorAmbient = 0.42;
  sunScale = 1;
  private tmp: number[] = [0, 0, 0, 0];
  private zen = new THREE.Color();
  private hor = new THREE.Color();
  private grey = new THREE.Color();
  private cloudOff = new THREE.Vector2();
  private readonly lightDir = new THREE.Vector3();

  constructor(shadowSize: number) {
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.sun.shadow.radius = 2.2;
    this.group.add(this.sky, this.sun, this.sun.target, this.hemi, this.weather.group);
    this.time.compute();
  }

  setShadowSize(size: number) {
    if (this.sun.shadow.mapSize.x === size) return;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null as any;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, focus: THREE.Vector3, viewDist: number, pixelHeight: number) {
    const time = this.time;
    time.update(dt);
    const e = time.sunElevation;
    const w = this.weather;
    this.dayLight = smoothstep(-8, 8, e);
    w.update(dt, time, camera, this.dayLight, pixelHeight);
    const c = w.cur;
    const cover = smoothstep(0.35, 1.0, c.cloud);
    const night = 1 - smoothstep(-12, -3, e);

    // ---- 天空顏色
    sample(ZENITH, e, this.tmp);
    this.zen.setRGB(this.tmp[0], this.tmp[1], this.tmp[2]);
    sample(HORIZON, e, this.tmp);
    this.hor.setRGB(this.tmp[0], this.tmp[1], this.tmp[2]);
    const dl = this.dayLight;
    const g = lerp(0.014, lerp(0.5, 0.2, saturate(c.density - 0.75) * 4 * (c.rain > 0.3 ? 1 : 0.3)), dl);
    this.grey.setRGB(g * 0.92, g * 0.97, g * 1.06);
    this.zen.lerp(this.grey.clone().multiplyScalar(0.8), cover * 0.9);
    this.hor.lerp(this.grey, cover * 0.85);
    // 霧氣讓地平線泛白
    const fogWhite = saturate(c.fog - 0.3) * dl;
    this.hor.lerp(new THREE.Color(g * 1.2, g * 1.22, g * 1.25), fogWhite * 0.6);
    SkyU.uZenith.value.copy(this.zen);
    SkyU.uHorizon.value.copy(this.hor);

    // ---- 太陽與月亮
    sample(SUN, e, this.tmp);
    const sunI = this.tmp[3] * (1 - 0.93 * cover);
    const moonUp = smoothstep(-2, 6, time.moonElevation);
    const moonI = 0.34 * (0.15 + 0.85 * time.moonIllum) * moonUp * (1 - smoothstep(-9, -4, e)) * (1 - 0.8 * cover);
    this.sunPos.copy(time.sunDir);
    SkyU.uSunPos.value.copy(time.sunDir);
    SkyU.uMoonPos.value.copy(time.moonDir);
    if (sunI >= moonI) {
      this.lightDir.copy(time.sunDir);
      this.sun.color.setRGB(this.tmp[0], this.tmp[1], this.tmp[2]);
      this.sun.intensity = sunI;
    } else {
      this.lightDir.copy(time.moonDir);
      this.sun.color.setRGB(0.5, 0.64, 1.0);
      this.sun.intensity = moonI;
    }
    // 光源太貼近地平線時稍微抬高，避免陰影拉得無限長
    if (this.lightDir.y < 0.06) {
      this.lightDir.y = 0.06;
      this.lightDir.normalize();
    }
    U.uSunDir.value.copy(this.lightDir);
    this.sunVisible = smoothstep(-3, 2, e) * (1 - cover * 0.95);
    SkyU.uSunGlow.value.setRGB(this.tmp[0], this.tmp[1] * 0.92, this.tmp[2] * 0.85).multiplyScalar(smoothstep(-7, 3, e) * (1 - cover * 0.9) * 0.9);
    SkyU.uSunDisc.value.setRGB(this.tmp[0], this.tmp[1], this.tmp[2]).multiplyScalar(26 * smoothstep(-1.5, 1, e) * (1 - smoothstep(0.3, 0.9, c.cloud)));
    SkyU.uMoonColor.value.setRGB(0.9, 0.95, 1.05).multiplyScalar(lerp(0.9, 1.5, night) * (1 - cover * 0.75));
    SkyU.uStars.value = night * (1 - smoothstep(0.2, 0.75, c.cloud)) * (1 - saturate(c.fog - 0.3));
    // 星空繞北天極旋轉
    const ang = (time.t * 2 * Math.PI * 366.25) / 365.25;
    const axis = new THREE.Vector3(0, Math.sin((57 * Math.PI) / 180), -Math.cos((57 * Math.PI) / 180));
    SkyU.uStarRot.value.setFromMatrix4(new THREE.Matrix4().makeRotationAxis(axis, -ang));
    // 極光：隆冬晴朗的深夜
    const winter = time.season.w;
    SkyU.uAurora.value = night * winter * (1 - smoothstep(0.15, 0.5, c.cloud)) * (0.55 + 0.45 * Math.sin(time.t * 1.7 + 1));
    SkyU.uCloud.value = c.cloud;
    SkyU.uCloudDensity.value = c.density;
    SkyU.uFlash.value = w.flash;
    // 雲的顏色
    const lit = SkyU.uCloudLit.value;
    const dark = SkyU.uCloudDark.value;
    const sunsetWarm = smoothstep(12, 0, e) * smoothstep(-8, -1, e);
    lit.setRGB(0.95, 0.95, 0.96).multiplyScalar(lerp(0.035, 0.95, dl));
    lit.lerp(new THREE.Color(1.3, 0.62, 0.3), sunsetWarm * 0.75 * (1 - cover));
    dark.copy(this.zen).multiplyScalar(0.55).lerp(this.grey.clone().multiplyScalar(lerp(0.75, 0.3, saturate(c.density - 0.5) * 2)), 0.75);
    if (night > 0.5) lit.lerp(new THREE.Color(0.1, 0.13, 0.2).multiplyScalar(0.3 + time.moonIllum * moonUp), 0.8);
    // 雲隨風飄移（以真實秒數推進，快轉時略加速）
    const drift = dt * (0.0012 + c.wind * 0.004) * (1 + Math.min(time.speed, 3600) / 900);
    this.cloudOff.x += drift;
    this.cloudOff.y += drift * 0.35;
    SkyU.uCloudOffset.value.copy(this.cloudOff);

    // ---- 環境光
    const flash = w.flash;
    this.hemi.color.copy(this.zen).multiplyScalar(1.5).add(this.hor.clone().multiplyScalar(0.9));
    this.hemi.color.add(new THREE.Color(0.022, 0.032, 0.07).multiplyScalar(night * (0.5 + 0.8 * time.moonIllum * moonUp)));
    this.hemi.groundColor.copy(this.hor).multiplyScalar(0.3).add(new THREE.Color(0.05, 0.045, 0.035).multiplyScalar(dl));
    this.hemi.intensity = (lerp(2.2, 0.95, dl) * (1 + cover * 0.9) + flash * 14) * lerp(1, this.indoorAmbient, this.indoor);
    this.sun.intensity *= this.sunScale;
    this.lightLevel = saturate(dl * (1 - cover * 0.5) + 0.06);

    // ---- 霧
    const hour = time.hour;
    const dawnMist = smoothstep(3.5, 6, hour) * (1 - smoothstep(7.5, 10, hour)) * (1 - c.wind) * (0.2 + 0.25 * time.season.z + 0.1 * time.season.x);
    const fog = c.fog + dawnMist;
    FogU.uFogDensity.value = lerp(0.000028, 0.0013, Math.pow(saturate(fog), 2.2)) + c.rain * 0.00018 + c.snow * 0.0005;
    FogU.uFogHeightDensity.value = lerp(0.00025, 0.0075, Math.pow(saturate(fog * 0.9 + dawnMist), 1.6));
    FogU.uFogHeightFalloff.value = lerp(0.028, 0.012, saturate(fog));
    FogU.uExposure.value = lerp(lerp(1.18, 2.1, night), 1.3, this.indoor) * (1 + flash * 0.6 * (1 - this.indoor));

    // ---- 共用 uniform
    U.uNight.value = saturate(1 - smoothstep(-5, 4, e) + cover * 0.35 * (c.density > 0.9 ? 1 : 0.4));
    const lateNight = hour < 5 ? 0.12 : hour < 8 ? lerp(0.12, 0.45, (hour - 5) / 3) : hour < 16 ? 0.4 : hour < 18 ? lerp(0.4, 0.9, (hour - 16) / 2) : hour < 22 ? 0.9 : lerp(0.9, 0.12, (hour - 22) / 2);
    U.uLit.value = lateNight;
    U.uWind.value = c.wind;
    U.uWet.value = w.wetness;
    U.uSnow.value = Math.min(1, Math.max(time.seasonalSnow * 0.9, w.snowAcc));
    U.uIce.value = time.ice;
    U.uFoliage.value.copy(time.season);
    const s = time.season;
    U.uSnowLine.value = s.x * 620 + s.y * 1400 + s.z * 900 + s.w * 240;
    U.uGrass.value.setRGB(
      s.x * 0.17 + s.y * 0.165 + s.z * 0.26 + s.w * 0.2,
      s.x * 0.3 + s.y * 0.25 + s.z * 0.24 + s.w * 0.19,
      s.x * 0.07 + s.y * 0.07 + s.z * 0.08 + s.w * 0.1,
    );

    // ---- 陰影視錐：跟著觀看焦點，範圍隨距離縮放並對齊貼圖格點
    if (this.shadowHold) return;
    const steps = Math.round(Math.log(Math.max(120, Math.min(1500, viewDist * 0.9))) / Math.log(1.35));
    const extent = Math.pow(1.35, steps);
    this.shadowExtent = extent;
    const cam = this.sun.shadow.camera;
    const texel = (extent * 2) / this.sun.shadow.mapSize.x;
    const dir = this.lightDir;
    const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const upL = new THREE.Vector3().crossVectors(dir, right);
    const rx = Math.round(focus.dot(right) / texel) * texel;
    const uy = Math.round(focus.dot(upL) / texel) * texel;
    const fz = focus.dot(dir);
    const center = new THREE.Vector3().addScaledVector(right, rx).addScaledVector(upL, uy).addScaledVector(dir, fz);
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).addScaledVector(dir, 2600);
    if (cam.right !== extent) {
      cam.left = -extent;
      cam.right = extent;
      cam.top = extent;
      cam.bottom = -extent;
      cam.near = 10;
      cam.far = 5200;
      cam.updateProjectionMatrix();
      this.sun.shadow.normalBias = Math.max(0.25, texel * 2.2);
    }
  }
}
