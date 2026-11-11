import * as THREE from 'three';
import type { Environment } from '../../environment/environment';
import { U } from '../../core/globals';
import { SCENES, PORTALS, SIGNS, type SceneDef, type PortalDef } from './registry';

const POOL = 6;
const _v = new THREE.Vector3();

/** 管理室內場景：目前所在的場景、燈光池、口袋場景的顯示、傳送門與門牌 */
export class SceneManager {
  readonly group = new THREE.Group();
  active: SceneDef | null = null;
  onEnter?: (s: SceneDef) => void;
  /** 延遲建造的場景建好之後（用來加入碰撞） */
  onBuilt?: (g: THREE.Object3D) => void;
  private pool: THREE.PointLight[] = [];
  private cand: { l: SceneDef['lights'][number]; d: number; k: number }[] = [];

  constructor() {
    this.group.name = 'scenes';
    // 點光源的數量一變，所有材質都得重新編譯，所以固定一組輪流使用
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight(0xffb878, 0, 30, 1.6);
      this.pool.push(l);
      this.group.add(l);
    }
    for (const s of SCENES) {
      if (s.group) {
        this.group.add(s.group);
        if (s.pocket) s.group.visible = false;
      }
    }
    for (const sign of SIGNS) this.group.add(makeSign(sign.text, sign.pos, sign.ry));
  }

  /** 延遲建造的場景：第一次需要時才生成 */
  ensure(s: SceneDef | null) {
    if (!s || s.group || !s.build) return;
    const g = s.build();
    s.build = undefined;
    s.group = g;
    if (s.pocket) g.visible = false;
    this.group.add(g);
    this.onBuilt?.(g);
  }

  /** 傳送前先把目的地的場景建好，角色才有地板可以站 */
  prepare(x: number, y: number, z: number) {
    this.ensure(this.sceneAt(_v.set(x, y + 0.5, z)));
  }

  sceneAt(p: THREE.Vector3): SceneDef | null {
    for (const s of SCENES) if (s.box.containsPoint(p)) return s;
    return null;
  }

  nearestPortal(p: THREE.Vector3): PortalDef | null {
    let best: PortalDef | null = null;
    let bd = 2.4 * 2.4;
    for (const q of PORTALS) {
      const dy = p.y - q.pos[1];
      if (dy < -1.5 || dy > 2.5) continue;
      const d = (p.x - q.pos[0]) ** 2 + (p.z - q.pos[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  update(dt: number, time: number, cam: THREE.Vector3, player: THREE.Vector3 | null, env: Environment) {
    const camAny = this.sceneAt(cam);
    const camScene = camAny && !camAny.outdoor ? camAny : null;
    const here = player ? (this.sceneAt(player) ?? camAny) : camAny;
    this.ensure(here);
    if (here !== this.active) {
      this.active = here;
      if (here && here.name) this.onEnter?.(here);
    }
    env.indoor += ((camScene ? 1 : 0) - env.indoor) * Math.min(1, dt * 3);
    env.indoorAmbient = camScene?.ambient ?? 0.42;
    env.sunScale = camScene?.pocket ? 0 : 1;
    env.weather.group.visible = !camScene;

    // 口袋場景只在有人在裡面時顯示
    for (const s of SCENES) {
      if (s.pocket && s.group) s.group.visible = s === camScene || s === here;
      if (s.animate && (!s.pocket || s.group?.visible)) s.animate(time);
    }

    // 燈光：鏡頭所在的那一區全亮；其餘鄰近場景只留一點從門口透出的光（沒有陰影，會穿牆）
    const cand = this.cand;
    cand.length = 0;
    for (const s of SCENES) {
      if (s.pocket && s !== camScene && s !== here) continue;
      const near = s.box.distanceToPoint(cam);
      if (near > 40) continue;
      const lit = (o: SceneDef | null) => !!o && (s === o || (!!s.zone && s.zone === o.zone));
      const k = (lit(camScene) || lit(here) ? 1 : 0.06) * (1 + ((s.nightScale ?? 1) - 1) * U.uNight.value);
      for (const l of s.lights) cand.push({ l, d: _v.set(l.pos[0], l.pos[1], l.pos[2]).distanceToSquared(cam) / (k * k), k });
    }
    cand.sort((a, b) => a.d - b.d);
    for (let i = 0; i < POOL; i++) {
      const p = this.pool[i];
      const c = cand[i];
      if (!c) {
        p.intensity = 0;
        continue;
      }
      p.position.set(c.l.pos[0], c.l.pos[1], c.l.pos[2]);
      p.color.setHex(c.l.color ?? 0xffb878);
      p.distance = c.l.dist;
      p.intensity = c.l.intensity * c.k;
    }
  }
}

/** 門上方的名牌：用畫布把文字畫成貼圖 */
function makeSign(text: string, pos: [number, number, number], ry: number) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#1a120a';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#b8944a';
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 112);
  g.fillStyle = '#e2c98a';
  g.font = '600 62px "Noto Serif TC", "Songti TC", "PMingLiU", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68, 470);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.y = ry;
  m.name = 'sign';
  return m;
}
