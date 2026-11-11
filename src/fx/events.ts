import * as THREE from 'three';
import { Builder, col, mat4 } from '../castle/kit';
import { getMaterials } from '../castle/materials';
import { samplePath, type GroundsHandles } from '../castle/grounds';
import { getPath, WATER, type BuiltPath } from '../world/heightfield';
import { U, makeRng, smoothstep } from '../core/globals';
import { dayOfYearFrom } from '../environment/timeSystem';
import type { Environment } from '../environment/environment';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ 煙霧粒子
class Smoke {
  readonly points: THREE.Points;
  private n = 500;
  private pos: Float32Array;
  private data: Float32Array; // age, life, size, bright
  private vel: Float32Array;
  private cursor = 0;
  private mat: THREE.ShaderMaterial;
  constructor() {
    this.pos = new Float32Array(this.n * 3);
    this.data = new Float32Array(this.n * 4);
    this.vel = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n; i++) this.data[i * 4] = 1e9;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aData', new THREE.BufferAttribute(this.data, 4));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 600 }, uLight: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: /* glsl */ `
        attribute vec4 aData; uniform float uScale; varying float vA; varying float vB;
        void main(){
          float t = clamp(aData.x / aData.y, 0.0, 1.0);
          vec4 mv = viewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aData.z * (0.5 + 2.2 * t) * uScale / max(-mv.z, 1.0);
          vA = (aData.x < aData.y ? 1.0 : 0.0) * smoothstep(0.0, 0.12, t) * (1.0 - t);
          vB = aData.w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLight; varying float vA; varying float vB;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float a = (1.0 - smoothstep(0.15, 0.5, length(c))) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uLight * vB, a * 0.5);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 40;
    this.points.userData.noReflect = true;
  }
  emit(p: THREE.Vector3, vx: number, vy: number, vz: number, life: number, size: number, bright: number) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.data[i * 4] = 0;
    this.data[i * 4 + 1] = life;
    this.data[i * 4 + 2] = size;
    this.data[i * 4 + 3] = bright;
  }
  update(dt: number, wind: number, light: THREE.Color, pixelHeight: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.data[i * 4] > this.data[i * 4 + 1]) continue;
      this.data[i * 4] += dt;
      this.vel[i * 3] += (2 + wind * 7 - this.vel[i * 3]) * dt * 0.4;
      this.vel[i * 3 + 1] *= 1 - dt * 0.15;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.aData as THREE.BufferAttribute).needsUpdate = true;
    this.mat.uniforms.uLight.value.copy(light);
    this.mat.uniforms.uScale.value = pixelHeight;
  }
}

// ------------------------------------------------------------------ 霍格沃茲特快車
function buildTrain() {
  const M = getMaterials();
  const cars: THREE.Group[] = [];
  const RED = col(0.42, 0.025, 0.03);
  const BLACK = col(0.03, 0.03, 0.035);
  const GOLD = col(0.7, 0.55, 0.16);
  {
    const b = new Builder(91);
    const boiler = new THREE.CylinderGeometry(1.2, 1.2, 7, 14);
    boiler.rotateZ(Math.PI / 2);
    b.add('matte', boiler, mat4(1.2, 2.7, 0), RED);
    const smokebox = new THREE.CylinderGeometry(1.26, 1.26, 1.3, 14);
    smokebox.rotateZ(Math.PI / 2);
    b.add('matte', smokebox, mat4(5.2, 2.7, 0), BLACK);
    b.cyl('matte', 0.32, 0.38, 1.3, 5.2, 3.8, 0, 8, BLACK);
    b.cyl('matte', 0.42, 0.34, 0.25, 5.2, 5.05, 0, 8, GOLD);
    b.sphere('matte', 0.55, 2.2, 3.9, 0, GOLD, 0.8);
    b.box('matte', 2.8, 3.0, 2.8, -3.6, 1.4, 0, 0, RED);
    b.box('matte', 3.2, 0.25, 3.1, -3.6, 4.4, 0, 0, BLACK);
    b.box('matte', 10.5, 0.7, 2.5, 0.6, 0.9, 0, 0, BLACK);
    for (let i = 0; i < 3; i++) {
      for (const s of [1.3, -1.3]) {
        const w = new THREE.CylinderGeometry(0.95, 0.95, 0.25, 14);
        w.rotateX(Math.PI / 2);
        b.add('matte', w, mat4(-1.4 + i * 2.2, 0.95, s), col(0.3, 0.03, 0.03));
      }
    }
    for (const s of [1.3, -1.3]) {
      const w = new THREE.CylinderGeometry(0.5, 0.5, 0.25, 10);
      w.rotateX(Math.PI / 2);
      b.add('matte', w, mat4(4.6, 0.5, s), BLACK);
    }
    b.sphere('lamp', 0.3, 6.0, 2.0, 0, col(1, 0.8, 0.5));
    b.box('matte', 0.2, 0.5, 2.6, 6.2, 0.6, 0, 0, RED);
    cars.push(b.build('train-engine', M));
  }
  {
    const b = new Builder(92);
    b.box('matte', 5.6, 2.3, 2.7, 0, 1.3, 0, 0, RED);
    b.box('matte', 5.0, 0.4, 2.2, 0, 3.5, 0, 0, BLACK);
    b.box('matte', 5.8, 0.7, 2.4, 0, 0.7, 0, 0, BLACK);
    cars.push(b.build('train-tender', M));
  }
  for (let c = 0; c < 5; c++) {
    const b = new Builder(93 + c);
    b.box('matte', 19, 2.5, 2.8, 0, 1.2, 0, 0, col(0.3, 0.03, 0.035));
    const roof = new THREE.CylinderGeometry(1.5, 1.5, 19.2, 10, 1, false, 0, Math.PI);
    roof.rotateZ(Math.PI / 2);
    roof.rotateX(-Math.PI / 2);
    roof.scale(1, 0.35, 0.96);
    b.add('matte', roof, mat4(0, 3.7, 0), col(0.12, 0.12, 0.13));
    b.box('matte', 18, 0.6, 2.2, 0, 0.6, 0, 0, BLACK);
    b.windowRow(16, 12, 1.0, 0.95, 0, 2.3, 1.4, 0, 0);
    b.windowRow(16, 12, 1.0, 0.95, 0, 2.3, -1.4, Math.PI, 0);
    cars.push(b.build(`train-coach${c}`, M));
  }
  const offsets = [0, -9.2, -22.5, -42.5, -62.5, -82.5, -102.5];
  return { cars, offsets };
}

function buildBoat(seed: number) {
  const b = new Builder(seed);
  const hull = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  hull.scale(0.9, 0.6, 2.4);
  b.add('wood', hull, mat4(0, 0.5, 0), col(0.8, 0.7, 0.6));
  b.cyl('matte', 0.04, 0.04, 1.7, 0, 0.3, 2.0, 5, col(0.04, 0.04, 0.04));
  b.sphere('lamp', 0.2, 0, 2.1, 2.0, col(1, 0.62, 0.25));
  for (let i = 0; i < 4; i++) {
    const z = 1.0 - i * 0.75;
    const x = (i % 2 ? 0.3 : -0.3);
    b.cyl('matte', 0.2, 0.26, 0.7, x, 0.25, z, 6, col(0.03, 0.03, 0.04));
    b.sphere('matte', 0.16, x, 1.1, z, col(0.5, 0.36, 0.28), 1, 6);
  }
  return b.build('boat', getMaterials());
}

function buildXmasTree(p: THREE.Vector3) {
  const b = new Builder(300 + Math.round(p.x));
  const rng = makeRng(Math.round(p.x * 3 + p.z));
  b.cyl('wood', 0.35, 0.45, 2, p.x, p.y, p.z, 6);
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = 3.6 - 2.9 * t;
    const y = p.y + 1.4 + t * 8;
    b.cone('matte', r, 3.2 - t, p.x, y, p.z, 9, col(0.03, 0.12 + t * 0.04, 0.04), i * 0.5);
    const n = Math.round(9 - 5 * t);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + i;
      const c = [col(1, 0.75, 0.3), col(1, 0.2, 0.15), col(0.5, 0.8, 1), col(1, 0.9, 0.6)][Math.floor(rng() * 4)];
      b.sphere('lamp', 0.14, p.x + Math.cos(a) * r * 0.86, y + 0.35, p.z + Math.sin(a) * r * 0.86, c, 1, 5);
    }
  }
  b.sphere('lamp', 0.32, p.x, p.y + 12.4, p.z, col(1, 0.85, 0.4), 1, 6);
  return b.build('xmas', getMaterials());
}

/** 所有會動的小巧思：火車、新生小船、貓頭鷹、炊煙、巨烏賊、節慶佈置、魁地奇球員 */
export class WorldEvents {
  readonly group = new THREE.Group();
  /** 目前正在發生的事（給介面顯示提示） */
  active: string[] = [];
  private smoke = new Smoke();
  private train = buildTrain();
  private rail: BuiltPath;
  private trainGroup = new THREE.Group();
  private boats: THREE.Group[] = [];
  private boatCurve: THREE.CatmullRomCurve3;
  private boatGroup = new THREE.Group();
  private owls: THREE.InstancedMesh;
  private owlMat: THREE.ShaderMaterial;
  private squid = new THREE.Group();
  private squidPhase = 0;
  private xmas = new THREE.Group();
  private jack = new THREE.Group();
  private players: THREE.InstancedMesh;
  private snitch: THREE.Mesh;
  private lastPumpkinDay = -1;
  private emitAcc = 0;
  private rng = makeRng(31337);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private d = new THREE.Vector3();

  constructor(private h: GroundsHandles) {
    const M = getMaterials();
    this.rail = getPath('rail');
    this.group.add(this.smoke.points);
    this.train.cars.forEach((c) => this.trainGroup.add(c));
    this.group.add(this.trainGroup);

    // 新生的小船：從車站旁的碼頭出發，穿過高架橋下，抵達船屋
    this.boatCurve = new THREE.CatmullRomCurve3([V(-312, 0, -650), V(-306, 0, -420), V(-300, 0, -180), V(-290.5, 0, 20), V(-290.5, 0, 110), V(-262, 0, 176), V(-206, 0, 178)]);
    for (let i = 0; i < 14; i++) {
      const bt = buildBoat(200 + i);
      this.boats.push(bt);
      this.boatGroup.add(bt);
    }
    this.group.add(this.boatGroup);

    // 貓頭鷹
    const og = new THREE.BufferGeometry();
    const op = [0, 0, 0.35, 0, 0, -0.35, 0.9, 0, 0, 0, 0, 0.35, -0.9, 0, 0, 0, 0, -0.35];
    const ow = [0, 0, 1, 0, -1, 0];
    og.setAttribute('position', new THREE.Float32BufferAttribute(op, 3));
    og.setAttribute('aWing', new THREE.Float32BufferAttribute(ow, 1));
    this.owlMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uTime: U.uTime, uColor: { value: new THREE.Color(0.5, 0.45, 0.4) } },
      vertexShader: /* glsl */ `
        attribute float aWing; uniform float uTime;
        void main(){
          vec3 p = position;
          float seed = instanceMatrix[3][0] * 0.13 + instanceMatrix[3][2] * 0.07;
          p.y += abs(aWing) * sin(uTime * 7.0 + seed) * 0.55;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    });
    this.owls = new THREE.InstancedMesh(og, this.owlMat, 26);
    this.owls.frustumCulled = false;
    this.group.add(this.owls);

    // 巨烏賊的觸手
    const squidMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.06, 0.05), roughness: 0.35 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([V(0, -6, 0), V(Math.cos(a) * 1.5, 1, Math.sin(a) * 1.5), V(Math.cos(a) * 4, 6, Math.sin(a) * 4), V(Math.cos(a) * 7.5, 7, Math.sin(a) * 7.5), V(Math.cos(a) * 9.5, 4, Math.sin(a) * 9.5)]);
      const tube = new THREE.TubeGeometry(curve, 20, 0.9, 7, false);
      const pos = tube.attributes.position as THREE.BufferAttribute;
      const uv = tube.attributes.uv as THREE.BufferAttribute;
      const c = new THREE.Vector3();
      for (let k = 0; k < pos.count; k++) {
        const t = uv.getX(k);
        curve.getPointAt(Math.min(t, 1), c);
        const s = 1 - 0.85 * t;
        pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * s, c.y + (pos.getY(k) - c.y) * s, c.z + (pos.getZ(k) - c.z) * s);
      }
      tube.computeVertexNormals();
      const mesh = new THREE.Mesh(tube, squidMat);
      mesh.castShadow = true;
      this.squid.add(mesh);
    }
    this.squid.position.set(-360, -14, 360);
    this.group.add(this.squid);

    // 聖誕樹
    h.xmasSpots.forEach((s) => this.xmas.add(buildXmasTree(s)));
    this.group.add(this.xmas);

    // 萬聖節的南瓜燈
    {
      const b = new Builder(400);
      h.pumpkinSpots.forEach((s) => b.sphere('lamp', 0.35, s.x, s.y + 1.25, s.z, col(1, 0.45, 0.08), 1, 6));
      this.jack.add(b.build('jack', M));
      this.group.add(this.jack);
    }

    // 魁地奇球員
    const pg = new THREE.BoxGeometry(0.5, 0.5, 1.9);
    const pc = new Float32Array(pg.attributes.position.count * 3).fill(1);
    pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    this.players = new THREE.InstancedMesh(pg, M.matte, 14);
    for (let i = 0; i < 14; i++) this.players.setColorAt(i, i < 7 ? new THREE.Color(0.5, 0.03, 0.03) : new THREE.Color(0.03, 0.25, 0.08));
    this.players.frustumCulled = false;
    this.group.add(this.players);
    this.snitch = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.5, 1) }));
    this.group.add(this.snitch);
  }

  /** 火車沿鐵道的弧長位置；回傳 null 表示不在場 */
  private trainState(doy: number, hour: number): { s: number; moving: boolean; dir: number } | null {
    const end = this.h.stationEnd;
    const start = this.rail.length * 0.2;
    const day = Math.floor(doy);
    const arrivals = [dayOfYearFrom(9, 1), dayOfYearFrom(1, 5)];
    const departures = [dayOfYearFrom(12, 20), dayOfYearFrom(6, 30)];
    for (const a of arrivals) {
      if (day === a && hour >= 17.25) {
        const k = (hour - 17.25) / 0.7;
        if (k < 1) return { s: start + (end - start) * (1 - Math.pow(1 - k, 1.6)), moving: true, dir: 1 };
        return { s: end, moving: false, dir: 1 };
      }
      if (day === (a + 1) % 365 && hour < 9) return { s: end, moving: false, dir: 1 };
    }
    for (const dp of departures) {
      if (day === dp && hour >= 8) {
        const k = (hour - 11) / 0.7;
        if (k < 0) return { s: end, moving: false, dir: 1 };
        if (k < 1) return { s: end - (end - start) * Math.pow(k, 1.6), moving: true, dir: 1 };
      }
    }
    return null;
  }

  update(dt: number, env: Environment, camera: THREE.Camera, pixelHeight: number) {
    const time = env.time;
    const doy = time.doy;
    const hour = time.hour;
    const day = Math.floor(doy);
    const t = U.uTime.value;
    const active: string[] = [];
    const wind = env.weather.cur.wind;
    const { p, d, m, q } = this;

    // ---- 火車
    const ts = this.trainState(doy, hour);
    this.trainGroup.visible = !!ts;
    if (ts) {
      this.train.cars.forEach((car, i) => {
        samplePath(this.rail, ts.s + this.train.offsets[i], p, d);
        car.position.set(p.x, p.y + 0.35, p.z);
        car.rotation.set(0, Math.atan2(-d.z, d.x), 0);
        car.rotation.z = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
        car.rotation.order = 'YXZ';
      });
      if (ts.moving) active.push('霍格沃茲特快車行駛中');
    }

    // ---- 新生小船（9 月 1 日 19:00 起）
    const boatK = day === dayOfYearFrom(9, 1) ? (hour - 19) / 0.85 : -1;
    this.boatGroup.visible = boatK > -0.02 && boatK < 1.25;
    if (this.boatGroup.visible) {
      active.push('一年級新生正在渡湖');
      this.boats.forEach((bt, i) => {
        const u = THREE.MathUtils.clamp(boatK - Math.floor(i / 2) * 0.022, 0, 1);
        this.boatCurve.getPointAt(u, p);
        this.boatCurve.getTangentAt(u, d);
        const side = (i % 2 ? 1 : -1) * 2.6;
        bt.position.set(p.x - d.z * side, WATER + 0.05 + Math.sin(t * 1.3 + i) * 0.08, p.z + d.x * side);
        bt.rotation.set(Math.sin(t * 1.1 + i * 2) * 0.03, Math.atan2(d.x, d.z), Math.sin(t * 0.9 + i) * 0.04);
      });
    }

    // ---- 貓頭鷹：清晨與黃昏最活躍
    const dusk = Math.max(1 - Math.abs(env.time.sunElevation - 2) / 10, 0);
    const owlCount = Math.round(4 + 22 * Math.min(1, dusk) * (env.weather.cur.rain > 0.3 ? 0.2 : 1));
    this.owls.count = owlCount;
    const top = this.h.owleryTop;
    for (let i = 0; i < owlCount; i++) {
      const r = 14 + (i % 7) * 7 + Math.sin(t * 0.2 + i) * 4;
      const sp = (0.35 + (i % 5) * 0.06) * (i % 2 ? 1 : -1);
      const a = t * sp + i * 1.7;
      p.set(top.x + Math.cos(a) * r, top.y + 2 + (i % 6) * 3.2 + Math.sin(t * 0.5 + i * 2) * 3, top.z + Math.sin(a) * r);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -a + (sp > 0 ? Math.PI : 0));
      m.compose(p, q, new THREE.Vector3(1.1, 1.1, 1.1));
      this.owls.setMatrixAt(i, m);
    }
    this.owls.instanceMatrix.needsUpdate = true;
    this.owlMat.uniforms.uColor.value.setRGB(0.5, 0.45, 0.4).multiplyScalar(0.08 + env.lightLevel * 0.6);
    if (dusk > 0.6) active.push('貓頭鷹成群繞著貓頭鷹屋飛行');

    // ---- 炊煙與蒸氣
    this.emitAcc += dt;
    if (this.emitAcc > 0.09) {
      this.emitAcc = 0;
      const r = this.rng;
      this.smoke.emit(this.h.hutChimney, (r() - 0.5) * 0.4, 1.6 + r(), (r() - 0.5) * 0.4, 7 + r() * 3, 1.6, 0.75);
      const cold = time.season.w > 0.3 || hour > 17 || hour < 8;
      if (cold && this.h.villageChimneys.length) {
        for (let k = 0; k < 2; k++) {
          const c = this.h.villageChimneys[Math.floor(r() * this.h.villageChimneys.length)];
          this.smoke.emit(c, (r() - 0.5) * 0.3, 1.2 + r(), (r() - 0.5) * 0.3, 6 + r() * 3, 1.3, 0.8);
        }
      }
      if (ts) {
        const e = this.train.cars[0];
        p.set(5.2, 5.4, 0).applyMatrix4(e.matrixWorld);
        const n = ts.moving ? 4 : 1;
        for (let k = 0; k < n; k++) this.smoke.emit(p, (r() - 0.5) * 1.5, 4 + r() * 3, (r() - 0.5) * 1.5, ts.moving ? 9 : 4, ts.moving ? 3.4 : 1.6, 1.0);
      }
    }
    const light = new THREE.Color().copy(env.hemi.color).multiplyScalar(0.35).add(env.sun.color.clone().multiplyScalar(env.sun.intensity * 0.22));
    this.smoke.update(dt, wind, light, pixelHeight);

    // ---- 巨烏賊：春夏晴朗的白天偶爾浮出水面
    const warm = time.season.y + time.season.x * 0.6;
    const calm = warm > 0.5 && env.dayLight > 0.7 && env.weather.cur.rain < 0.1 && time.ice < 0.05;
    this.squidPhase = (this.squidPhase + dt / 80) % 1;
    const up = calm ? smoothstep(0.0, 0.06, this.squidPhase) * (1 - smoothstep(0.24, 0.3, this.squidPhase)) : 0;
    this.squid.visible = up > 0.001;
    if (this.squid.visible) {
      this.squid.position.y = -15 + up * 13;
      this.squid.rotation.y = t * 0.12;
      this.squid.children.forEach((c, i) => {
        c.rotation.z = Math.sin(t * 0.7 + i * 1.3) * 0.12;
        c.rotation.x = Math.cos(t * 0.6 + i * 2.1) * 0.12;
      });
      if (up > 0.5) active.push('巨烏賊在黑湖曬太陽');
    }

    // ---- 節慶
    const xmasOn = doy >= dayOfYearFrom(12, 1) || doy < dayOfYearFrom(1, 7);
    this.xmas.visible = xmasOn;
    if (xmasOn) active.push('聖誕佈置');
    const halloween = day === dayOfYearFrom(10, 31);
    this.jack.visible = halloween;
    U.uHallTint.value.setRGB(1.0, halloween ? 0.42 : 0.78, halloween ? 0.1 : 0.42);
    if (halloween) active.push('萬聖節晚宴');

    // ---- 南瓜隨季節長大
    if (day !== this.lastPumpkinDay) {
      this.lastPumpkinDay = day;
      const grow = doy > dayOfYearFrom(11, 6) || doy < dayOfYearFrom(6, 20) ? 0 : 0.18 + 0.82 * smoothstep(dayOfYearFrom(6, 20), dayOfYearFrom(10, 25), doy);
      const rr = makeRng(9);
      this.h.pumpkinSpots.forEach((s, i) => {
        const sc = grow * (0.55 + rr() * 0.9) * 1.15;
        m.compose(p.set(s.x, s.y + sc * 0.6, s.z), q.identity(), new THREE.Vector3(sc, sc, sc));
        this.h.pumpkins.setMatrixAt(i, m);
      });
      this.h.pumpkins.instanceMatrix.needsUpdate = true;
    }

    // ---- 魁地奇比賽日
    const matchDays = [dayOfYearFrom(11, 9), dayOfYearFrom(2, 22), dayOfYearFrom(5, 24)];
    const match = matchDays.includes(day) && hour > 10.5 && hour < 13.5;
    this.players.visible = match;
    this.snitch.visible = match;
    if (match) {
      active.push('魁地奇比賽進行中');
      const c = this.h.pitchCenter;
      for (let i = 0; i < 14; i++) {
        const sp = 0.25 + (i % 5) * 0.045;
        const ph = i * 2.1;
        const x = c.x + Math.sin(t * sp + ph) * (40 + (i % 3) * 14);
        const z = c.z + Math.sin(t * sp * 1.7 + ph * 1.3) * (18 + (i % 4) * 3);
        const y = c.y + 12 + (i % 4) * 4 + Math.sin(t * sp * 2.3 + ph) * 5;
        const dx = Math.cos(t * sp + ph) * sp * 45;
        const dz = Math.cos(t * sp * 1.7 + ph * 1.3) * sp * 1.7 * 20;
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(dx, dz));
        m.compose(p.set(x, y, z), q, new THREE.Vector3(1, 1, 1));
        this.players.setMatrixAt(i, m);
      }
      this.players.instanceMatrix.needsUpdate = true;
      this.snitch.position.set(c.x + Math.sin(t * 1.9) * 50, c.y + 16 + Math.sin(t * 3.1) * 9, c.z + Math.cos(t * 2.6) * 22);
    }
    void camera;
    this.active = active;
  }
}
