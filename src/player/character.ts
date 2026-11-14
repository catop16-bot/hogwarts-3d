import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HOUSES, type AnimState } from './houses';
import { ProceduralCharacter } from './character-procedural';

export { HOUSES, type HouseDef, type MoveMode, type AnimState } from './houses';

const sat = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

let cached: GLTF | null = null;

/** 預先載入 Blender 做的角色模型（tools/blender/student.py 產生）；失敗時改用程序化角色 */
export async function preloadCharacter() {
  try {
    cached = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/student.glb`);
  } catch (err) {
    console.warn('角色模型載入失敗，改用程序化角色', err);
    cached = null;
  }
}

interface CharacterImpl {
  readonly root: THREE.Group;
  lumos: boolean;
  setHouse(i: number): void;
  setLumos(on: boolean): void;
  animate(dt: number, s: AnimState): void;
}

const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _rq = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

type Group = 'loco' | 'air' | 'broom' | 'swim';

/** Blender 模型：骨架動畫片段在 AnimationMixer 裡依速度與狀態混合，再疊上程式算的傾斜與轉頭 */
class ModelCharacter implements CharacterImpl {
  readonly root = new THREE.Group();
  lumos = false;
  private model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private act: Record<string, THREE.AnimationAction> = {};
  private bones: Record<string, THREE.Object3D> = {};
  private broom: THREE.Object3D;
  private primary?: THREE.MeshStandardMaterial;
  private secondary?: THREE.MeshStandardMaterial;
  private tip: THREE.Mesh;
  private glow = new THREE.PointLight(0xcfe0ff, 0, 26, 1.3);
  private lumosPose: Record<string, THREE.Quaternion> = {};
  private gw: Record<Group, number> = { loco: 1, air: 0, broom: 0, swim: 0 };
  private phase = 0;
  private wasGrounded = true;
  private land = 0;
  private lean = 0;
  private look = 0;
  private lookCur = 0;
  private lookT = 0;
  private lumosW = 0;

  constructor(gltf: GLTF) {
    this.model = gltf.scene;
    this.root.rotation.order = 'YXZ';
    this.root.add(this.model);
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        // 骨架動畫會讓網格離開原本的包圍盒，不做視錐剔除
        m.frustumCulled = false;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          if (mat.name === 'house_primary') this.primary = mat as THREE.MeshStandardMaterial;
          if (mat.name === 'house_secondary') this.secondary = mat as THREE.MeshStandardMaterial;
        }
      }
      if (o.name) this.bones[o.name] = o;
    });
    this.broom = this.bones.broom;
    this.broom.visible = false;

    // 魔杖尖端的「路摸思」光球
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 8, 10) }));
    this.tip.visible = false;
    const tipNode = this.bones.wand_tip ?? this.bones.hand_R;
    tipNode.add(this.tip);
    tipNode.add(this.glow);

    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of gltf.animations) {
      if (clip.name === 'lumos') {
        // 舉杖照路只取右臂的姿勢，之後直接覆蓋到骨頭上
        for (const tr of clip.tracks) {
          const [node, prop] = tr.name.split('.');
          if (prop === 'quaternion' && /_R$/.test(node) && /arm|hand/.test(node)) {
            this.lumosPose[node] = new THREE.Quaternion().fromArray(tr.values as unknown as number[], 0);
          }
        }
        continue;
      }
      const a = this.mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(clip.name === 'idle' ? 1 : 0);
      this.act[clip.name] = a;
    }
    // 走與跑的時間由程式依步伐推進，兩者同相位才能平順混合
    for (const n of ['walk', 'run']) this.act[n]?.setEffectiveTimeScale(0);
    this.setHouse(0);
  }

  setHouse(i: number) {
    const h = HOUSES[i] ?? HOUSES[0];
    this.primary?.color.setHex(h.primary);
    this.secondary?.color.setHex(h.secondary);
  }

  setLumos(on: boolean) {
    this.lumos = on;
    this.tip.visible = on;
    this.glow.intensity = on ? 7 : 0;
  }

  private w(name: string, w: number) {
    this.act[name]?.setEffectiveWeight(w);
  }

  /** 以角色本身的軸（x 右、y 上、z 前）旋轉一根骨頭 */
  private turn(name: string, axis: THREE.Vector3, angle: number) {
    const b = this.bones[name];
    if (!b || !b.parent || Math.abs(angle) < 1e-4) return;
    this.root.getWorldQuaternion(_rq);
    _axis.copy(axis).applyQuaternion(_rq);
    _q.setFromAxisAngle(_axis, angle);
    b.parent.getWorldQuaternion(_pq);
    // 區域旋轉 = 父骨世界旋轉的反 × 世界旋轉 × 父骨世界旋轉
    _q.premultiply(_pq.clone().invert()).multiply(_pq);
    b.quaternion.premultiply(_q);
  }

  animate(dt: number, s: AnimState) {
    const k = 1 - Math.exp(-dt * 10);
    this.broom.visible = s.mode === 'broom';

    // 狀態群組：地面、空中、掃帚、游泳，之間交叉淡入
    const target: Group = s.mode === 'broom' ? 'broom' : s.mode === 'swim' ? 'swim' : s.grounded ? 'loco' : 'air';
    const kg = 1 - Math.exp(-dt * (target === 'broom' || target === 'swim' || this.gw.broom > 0.01 || this.gw.swim > 0.01 ? 5 : 12));
    for (const g of Object.keys(this.gw) as Group[]) this.gw[g] += ((g === target ? 1 : 0) - this.gw[g]) * kg;

    // 落地時膝蓋一彎、身體一沉
    const grounded = s.grounded || s.mode !== 'walk';
    if (grounded && !this.wasGrounded && s.mode === 'walk') this.land = Math.min(1, this.land + 0.6);
    this.wasGrounded = grounded;
    this.land = Math.max(0, this.land - dt * 3.2);
    const land = this.land * this.land;

    // 地面：待機、走、跑依速度混合；步伐相位由速度推進，大致貼合腳步
    const move = sat(s.speed / 1.5);
    const runW = sat((s.speed - 2.5) / 3);
    const stride = mix(1.5, 3.0, runW);
    const maxRate = mix(1.6, 2.4, runW);
    this.phase = (this.phase + dt * Math.min(maxRate, s.speed / stride) * (move > 0.02 ? 1 : 0)) % 1;
    for (const n of ['walk', 'run']) {
      const a = this.act[n];
      if (a) a.time = this.phase * a.getClip().duration;
    }
    const lo = this.gw.loco * (1 - land);
    this.w('idle', lo * (1 - move));
    this.w('walk', lo * move * (1 - runW));
    this.w('run', lo * move * runW);
    this.w('land', this.gw.loco * land);

    // 空中：上升時是起跳的姿勢，下墜時手腳張開
    const up = sat((s.vy + 2) / 5);
    this.w('jump', this.gw.air * up);
    this.w('fall', this.gw.air * (1 - up));
    this.w('broom', this.gw.broom);
    this.w('swim', this.gw.swim);

    this.mixer.update(dt);

    // 程式層：轉彎內傾、待機時轉頭看看四周、舉杖照路
    this.lean += (Math.max(-1, Math.min(1, (s.turn ?? 0) * 0.12)) * move - this.lean) * Math.min(1, dt * 6);
    this.lookT -= dt;
    if (this.lookT <= 0) {
      this.look = move > 0.1 ? 0 : (Math.random() - 0.5) * 1.1;
      this.lookT = 2 + Math.random() * 3;
    }
    this.lookCur += (this.look * (1 - move) - this.lookCur) * k * 0.5;
    this.model.updateMatrixWorld(true);
    this.turn('spine', Z, -this.lean * 0.45 * this.gw.loco);
    this.turn('head', Y, this.lookCur * this.gw.loco);
    this.turn('scarf_F_1', X, -sat(s.speed / 30) * 0.5 * this.gw.broom);

    this.lumosW += ((this.lumos && s.mode === 'walk' ? 1 : 0) - this.lumosW) * k;
    if (this.lumosW > 0.001) {
      for (const [n, q] of Object.entries(this.lumosPose)) this.bones[n]?.quaternion.slerp(q, this.lumosW * (n === 'hand_R' ? 1 : 0.92));
    }

    // 整個人的姿態：騎掃帚時俯仰與側傾、游泳時趴平、轉彎時微微內傾
    let rootX = 0;
    let rootZ = 0;
    if (s.mode === 'broom') {
      rootX = -Math.atan2(s.vy, Math.max(4, s.speed)) * 0.7;
      rootZ = s.bank;
    } else if (s.mode === 'swim') {
      rootX = 1.2;
    } else if (s.grounded) {
      rootZ = -this.lean * 0.22;
    }
    this.root.rotation.x += (rootX - this.root.rotation.x) * k * 0.6;
    this.root.rotation.z += (rootZ - this.root.rotation.z) * k * 0.6;
  }
}

/** 玩家角色：有 Blender 模型就用模型，否則退回程序化角色 */
export class Character {
  readonly root: THREE.Group;
  readonly usesModel: boolean;
  private impl: CharacterImpl;

  constructor() {
    this.impl = cached ? new ModelCharacter(cached) : new ProceduralCharacter();
    this.usesModel = !!cached;
    this.root = this.impl.root;
  }

  get lumos() {
    return this.impl.lumos;
  }

  setHouse(i: number) {
    this.impl.setHouse(i);
  }

  setLumos(on: boolean) {
    this.impl.setLumos(on);
  }

  animate(dt: number, s: AnimState) {
    this.impl.animate(dt, s);
  }
}
