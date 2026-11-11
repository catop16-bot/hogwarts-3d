import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { LANDMARKS, LANDMARK_MAP, type Landmark } from './data';
import type { CameraRig } from '../camera/controls';
import type { PostFX } from '../fx/postfx';

(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

interface Entry {
  data: Landmark;
  meshes: THREE.Mesh[];
  anchor: THREE.Vector3;
  label?: HTMLElement;
}

/** 地標的滑鼠拾取、外框高亮、標籤定位與鏡頭聚焦 */
export class LandmarkSystem {
  readonly entries = new Map<string, Entry>();
  hovered: string | null = null;
  selected: string | null = null;
  labelsVisible = true;
  onSelect?: (l: Landmark | null) => void;
  onHover?: (l: Landmark | null, x: number, y: number) => void;

  private pick: THREE.Mesh[] = [];
  private owner = new Map<THREE.Object3D, string>();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down = { x: 0, y: 0, t: 0 };
  private lastMove = 0;
  private v = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
    private rig: CameraRig,
    private post: PostFX,
  ) {
    (this.raycaster as any).firstHitOnly = true;
    for (const data of LANDMARKS) {
      this.entries.set(data.id, { data, meshes: [], anchor: new THREE.Vector3(data.pos[0], data.pos[1] + data.radius * 0.55 + 6, data.pos[2]) });
    }
    dom.addEventListener('pointermove', (e) => this.onMove(e));
    dom.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    dom.addEventListener('pointerup', (e) => {
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      if (this.rig.mode !== 'walk' && moved < 5 && performance.now() - this.down.t < 450 && e.button === 0) {
        const id = this.raycast(e.clientX, e.clientY);
        if (id) this.select(id);
      }
    });
    dom.addEventListener('pointerleave', () => this.setHover(null, 0, 0));
  }

  /** 把一個群組登記為某地標的可點擊模型 */
  register(id: string, obj: THREE.Object3D) {
    const entry = this.entries.get(id);
    if (!entry) return;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      entry.meshes.push(m);
      if (m.name.endsWith(':window') || m.name.endsWith(':lamp')) return;
      (m.geometry as any).computeBoundsTree?.();
      this.pick.push(m);
      this.owner.set(m, id);
    });
  }

  private raycast(cx: number, cy: number): string | null {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pick, false);
    if (!hits.length) return null;
    let best = hits[0];
    for (const h of hits) if (h.distance < best.distance) best = h;
    return this.owner.get(best.object) || null;
  }

  private onMove(e: PointerEvent) {
    if (e.buttons !== 0) return;
    const now = performance.now();
    if (now - this.lastMove < 45) return;
    this.lastMove = now;
    if (this.rig.mode === 'tour' || this.rig.mode === 'walk') return this.setHover(null, 0, 0);
    this.setHover(this.raycast(e.clientX, e.clientY), e.clientX, e.clientY);
  }

  setHover(id: string | null, x: number, y: number) {
    if (id !== this.hovered) {
      this.hovered = id;
      this.refreshOutline();
      this.dom.style.cursor = id ? 'pointer' : '';
    }
    this.onHover?.(id ? LANDMARK_MAP.get(id)! : null, x, y);
  }

  select(id: string | null, fly = true) {
    this.selected = id;
    this.refreshOutline();
    const data = id ? LANDMARK_MAP.get(id)! : null;
    if (data && fly) this.rig.flyTo(new THREE.Vector3(...data.pos), data.radius, data.az, data.el ?? 0.3);
    this.onSelect?.(data);
  }

  private refreshOutline() {
    const set = new Set<THREE.Object3D>();
    for (const id of [this.hovered, this.selected]) {
      if (!id) continue;
      for (const m of this.entries.get(id)!.meshes) if (!m.name.endsWith(':lamp')) set.add(m);
    }
    this.post.outline.selection.set(Array.from(set) as any);
  }

  /** 每幀更新浮動標籤的螢幕位置 */
  updateLabels(width: number, height: number) {
    const cam = this.camera;
    for (const e of this.entries.values()) {
      const el = e.label;
      if (!el) continue;
      if (!this.labelsVisible) {
        el.style.display = 'none';
        continue;
      }
      this.v.copy(e.anchor).project(cam);
      const dist = cam.position.distanceTo(e.anchor);
      const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.05 && Math.abs(this.v.y) < 1.05 && dist < 5200 && dist > e.data.radius * 1.2;
      if (!visible) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      const x = (this.v.x * 0.5 + 0.5) * width;
      const y = (-this.v.y * 0.5 + 0.5) * height;
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      const fade = THREE.MathUtils.clamp(1.25 - dist / 4200, 0.35, 1);
      el.style.opacity = String(e.data.id === this.selected ? 1 : fade);
      el.classList.toggle('active', e.data.id === this.selected || e.data.id === this.hovered);
      el.classList.toggle('compact', dist > (e.data.category === 'castle' ? 420 : 2600));
      el.style.zIndex = String(100000 - Math.round(dist));
    }
  }
}
