import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { Clip } from './schedule';

const BASE = `${import.meta.env.BASE_URL}models/npc/`;
const loader = new GLTFLoader();

let animsP: Promise<{ clips: THREE.AnimationClip[]; refHips: number }> | null = null;
const templates = new Map<string, Promise<Template>>();

interface Template {
  scene: THREE.Object3D;
  /** 身高比例（相對共用動畫的參考角色），用來縮放臀部位移 */
  hips: number;
  height: number;
  /** 動物自帶的動作片段（人形角色用共用的 anims.glb） */
  clips: THREE.AnimationClip[];
}

/** 共用動畫：tools/blender/build.py --anims 產生 */
function loadAnims() {
  animsP ??= loader.loadAsync(`${BASE}anims.glb`).then((g) => {
    let refHips = 0.9;
    g.scene.traverse((o) => {
      if (o.name === 'hips') refHips = o.position.length();
    });
    return { clips: g.animations, refHips };
  });
  return animsP;
}

const SHARED_MATS = {
  front: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }),
  double: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
};
/** 幽靈：半透明、自己會微微發光的銀藍色，不寫深度、不投影 */
const GHOST_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.6, metalness: 0, transparent: true, opacity: 0.34, depthWrite: false,
  emissive: new THREE.Color(0.16, 0.24, 0.34), side: THREE.DoubleSide,
});

/** 載入角色模型，把各材質的顏色寫進頂點色、合併成單面與雙面兩個網格（每人只要兩次繪製） */
function loadTemplate(key: string, ghost = false) {
  let p = templates.get(key);
  if (p) return p;
  p = loader.loadAsync(`${BASE}${key}.glb`).then((g) => {
    const meshes: THREE.SkinnedMesh[] = [];
    let hips = 0.95;
    g.scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
      if (o.name === 'hips') hips = o.position.length();
    });
    if (!meshes.length) throw new Error(`${key}: 沒有蒙皮網格`);
    const groups: Record<'front' | 'double', THREE.BufferGeometry[]> = { front: [], double: [] };
    for (const m of meshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const geo = m.geometry.clone();
      const n = geo.attributes.position.count;
      const c = new Float32Array(n * 3);
      // 幽靈只留明暗，染成淡淡的銀藍色
      const lum = 0.35 + 0.65 * (0.3 * mat.color.r + 0.59 * mat.color.g + 0.11 * mat.color.b) ** 0.5;
      const cr = ghost ? lum * 0.75 : mat.color.r;
      const cg = ghost ? lum * 0.85 : mat.color.g;
      const cb = ghost ? lum : mat.color.b;
      for (let i = 0; i < n; i++) {
        c[i * 3] = cr;
        c[i * 3 + 1] = cg;
        c[i * 3 + 2] = cb;
      }
      for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(name)) geo.deleteAttribute(name);
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      groups[mat.side === THREE.DoubleSide ? 'double' : 'front'].push(geo);
    }
    const first = meshes[0];
    const parent = first.parent!;
    for (const kind of ['front', 'double'] as const) {
      if (!groups[kind].length) continue;
      const merged = mergeGeometries(groups[kind], false);
      if (!merged) continue;
      const sm = new THREE.SkinnedMesh(merged, ghost ? GHOST_MAT : SHARED_MATS[kind]);
      sm.name = `body_${kind}`;
      sm.position.copy(first.position);
      sm.quaternion.copy(first.quaternion);
      sm.scale.copy(first.scale);
      sm.castShadow = !ghost;
      if (ghost) sm.renderOrder = 2;
      sm.receiveShadow = true;
      sm.bind(first.skeleton, first.bindMatrix);
      parent.add(sm);
    }
    for (const m of meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    const box = new THREE.Box3().setFromObject(g.scene);
    return { scene: g.scene, hips, height: box.max.y, clips: g.animations };
  });
  templates.set(key, p);
  return p;
}

/** 掃帚：握柄、綁繩與掃帚尾，用頂點色畫（與玩家的掃帚同尺寸：角色面向 +Z） */
let broomGeo: THREE.BufferGeometry | null = null;
function broomGeometry() {
  if (broomGeo) return broomGeo;
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: number) => {
    g = g.toNonIndexed();
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  };
  const handle = new THREE.CylinderGeometry(0.019, 0.017, 1.75, 8);
  handle.rotateX(Math.PI / 2);
  handle.translate(0, 0.8, 0.2);
  add(handle, 0x3a2414);
  const tie = new THREE.CylinderGeometry(0.046, 0.046, 0.09, 10);
  tie.rotateX(Math.PI / 2);
  tie.translate(0, 0.8, -0.62);
  add(tie, 0x3a2414);
  const tail = new THREE.CylinderGeometry(0.04, 0.115, 0.6, 12, 1, true);
  tail.rotateX(-Math.PI / 2);
  tail.translate(0, 0.8, -0.93);
  add(tail, 0x6a5026);
  broomGeo = mergeGeometries(parts, false)!;
  return broomGeo;
}

const scaledClips = new Map<string, Map<string, THREE.AnimationClip>>();
function clipsFor(ratio: number, clips: THREE.AnimationClip[]) {
  const key = ratio.toFixed(3);
  let m = scaledClips.get(key);
  if (m) return m;
  m = new Map();
  for (const c of clips) {
    const cc = c.clone();
    // 臀部的位移是參考角色的絕對位置：依身高等比縮放
    for (const tr of cc.tracks) if (tr.name === 'hips.position') for (let i = 0; i < tr.values.length; i++) tr.values[i] *= ratio;
    m.set(c.name, cc);
  }
  scaledClips.set(key, m);
  return m;
}

const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _rq = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** 一個 NPC 的模型與動畫 */
export class NpcBody {
  readonly root = new THREE.Group();
  readonly height: number;
  readonly scale: number;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private bones: Record<string, THREE.Object3D> = {};
  private walkPhase = 0;
  /** 轉頭（弧度，正 = 往左） */
  look = 0;
  private lookCur = 0;
  pose: Clip = 'idle';
  private broom: THREE.Mesh | null = null;
  private strideLen: number;

  constructor(t: Template, clips: Map<string, THREE.AnimationClip>, scale: number, stride?: number) {
    const model = SkeletonUtils.clone(t.scene);
    this.root.add(model);
    this.height = t.height;
    this.scale = scale;
    this.strideLen = stride ?? 1.5 * scale;
    model.traverse((o) => {
      if (o.name) this.bones[o.name] = o;
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) {
        // 姿勢會讓身體離開綁定時的範圍（躺下、坐下），包圍球給大一點
        sm.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, t.height * 0.45, 0), t.height * 0.85);
      }
    });
    this.mixer = new THREE.AnimationMixer(model);
    for (const [name, clip] of clips) this.actions.set(name, this.mixer.clipAction(clip));
    this.play('idle', 0);
  }

  has(name: string) {
    return this.actions.has(name);
  }

  /** 換動作，fade 秒內交叉淡入 */
  play(pose: Clip, fade = 0.35) {
    const a = this.actions.get(pose) ?? this.actions.get('idle')!;
    this.pose = pose;
    if (a === this.current) return;
    a.reset();
    a.setEffectiveWeight(1);
    a.play();
    // 同一個動作的多個人別同步，免得整排人一起點頭
    a.time = Math.random() * a.getClip().duration;
    if (this.current && fade > 0) this.current.crossFadeTo(a, fade, false);
    else if (this.current) this.current.stop();
    this.current = a;
    if (pose === 'walk') a.timeScale = 0;
    else a.timeScale = 1;
  }

  private shadow = true;
  /** 開關投影（遠處的人不投影） */
  setShadow(on: boolean) {
    if (on === this.shadow) return;
    this.shadow = on;
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !((o as THREE.Mesh).material as THREE.Material).transparent) o.castShadow = on;
    });
  }

  /** 騎掃帚時顯示掃帚 */
  setBroom(on: boolean) {
    if (on && !this.broom) {
      this.broom = new THREE.Mesh(broomGeometry(), SHARED_MATS.double);
      this.broom.scale.setScalar(this.scale);
      this.broom.castShadow = true;
      this.root.add(this.broom);
    }
    if (this.broom) this.broom.visible = on;
  }

  /** 走路：依移動距離推進步伐 */
  stride(dist: number) {
    const a = this.actions.get('walk');
    if (!a) return;
    this.walkPhase = (this.walkPhase + dist / this.strideLen) % 1;
    a.time = this.walkPhase * a.getClip().duration;
  }

  update(dt: number) {
    this.mixer.update(dt);
    // 轉頭看玩家：繞世界的上方向旋轉頭和脖子
    this.lookCur += (this.look - this.lookCur) * Math.min(1, dt * 4);
    if (Math.abs(this.lookCur) > 1e-3) {
      this.root.updateMatrixWorld(true);
      this.turn('neck', this.lookCur * 0.4);
      this.turn('head', this.lookCur * 0.6);
    }
  }

  private turn(name: string, angle: number) {
    const b = this.bones[name];
    if (!b?.parent) return;
    this.root.getWorldQuaternion(_rq);
    _axis.copy(UP).applyQuaternion(_rq);
    _q.setFromAxisAngle(_axis, angle);
    b.parent.getWorldQuaternion(_pq);
    _q.premultiply(_pq.clone().invert()).multiply(_pq);
    b.quaternion.premultiply(_q);
    b.updateMatrixWorld(true);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}

export interface BodyOpts {
  ghost?: boolean;
  /** 走一個步伐循環的距離（動物用） */
  stride?: number;
}

/** 建立某位角色的模型（第一次會下載模型檔）。動物用自己的動作片段 */
export async function createBody(key: string, o: BodyOpts = {}): Promise<NpcBody> {
  const t = await loadTemplate(key, o.ghost);
  if (t.clips.length) return new NpcBody(t, new Map(t.clips.map((c) => [c.name, c])), 1, o.stride ?? 0.5);
  const { clips, refHips } = await loadAnims();
  const ratio = t.hips / refHips;
  return new NpcBody(t, clipsFor(ratio, clips), t.hips / 0.95, o.stride);
}

/** 此模型有沒有某個動作 */
export function hasClip(b: NpcBody, name: string) {
  return b.has(name);
}
