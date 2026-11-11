import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { groundAt } from '../world/heightfield';
import { smoothstep } from '../core/globals';

export type CameraMode = 'orbit' | 'fly' | 'tour' | 'walk';

/** 電影導覽的鏡位（位置、注視點），以平滑曲線串起來循環播放 */
const TOUR: [number, number, number, number, number, number][] = [
  [-900, 60, 760, -60, 95, 40],
  [-520, 28, 420, -90, 105, 80],
  [-300, 14, 250, -110, 100, 100],
  [-330, 120, 20, -100, 110, 40],
  [-260, 170, -220, -90, 130, -60],
  [-40, 210, -330, 0, 110, -20],
  [260, 150, -260, 120, 100, -30],
  [420, 96, -70, 190, 92, -45],
  [520, 60, 170, 300, 60, 40],
  [330, 80, 330, 60, 100, 60],
  [60, 190, 300, 0, 100, 20],
  [-240, 110, 330, -80, 100, 70],
  [-700, 150, 500, -150, 90, 40],
];

export class CameraRig {
  readonly controls: OrbitControls;
  mode: CameraMode = 'orbit';
  onModeChange?: (m: CameraMode) => void;
  /** 陰影與景深使用的焦點與觀看距離 */
  readonly focus = new THREE.Vector3();
  viewDist = 600;

  private tween: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; t: number; dur: number } | null = null;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private flySpeed = 60;
  private dragging = false;
  private tourT = 0;
  private tourPos: THREE.CatmullRomCurve3;
  private tourLook: THREE.CatmullRomCurve3;
  private lookTarget = new THREE.Vector3();
  userInteracted = false;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
  ) {
    const c = (this.controls = new OrbitControls(camera, dom));
    c.enableDamping = true;
    c.dampingFactor = 0.07;
    c.rotateSpeed = 0.55;
    c.zoomSpeed = 0.9;
    c.panSpeed = 0.9;
    c.minDistance = 18;
    c.maxDistance = 7000;
    c.maxPolarAngle = Math.PI * 0.515;
    c.screenSpacePanning = false;
    c.zoomToCursor = true;
    c.target.set(-40, 95, 30);
    camera.position.set(-640, 120, 560);
    c.addEventListener('start', () => {
      this.tween = null;
      this.userInteracted = true;
    });

    this.tourPos = new THREE.CatmullRomCurve3(TOUR.map((k) => new THREE.Vector3(k[0], k[1], k[2])), true, 'centripetal');
    this.tourLook = new THREE.CatmullRomCurve3(TOUR.map((k) => new THREE.Vector3(k[3], k[4], k[5])), true, 'centripetal');

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (this.mode === 'tour' && e.code !== 'KeyH') this.setMode('orbit');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('pointerdown', (e) => {
      if (this.mode === 'tour') this.setMode('orbit');
      if (this.mode === 'fly') {
        this.dragging = true;
        dom.setPointerCapture(e.pointerId);
      }
    });
    dom.addEventListener('pointerup', (e) => {
      this.dragging = false;
      if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (this.mode === 'fly' && this.dragging) {
        this.yaw -= e.movementX * 0.0028;
        this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0028, -1.5, 1.5);
      }
    });
    dom.addEventListener(
      'wheel',
      (e) => {
        if (this.mode === 'fly') {
          this.flySpeed = THREE.MathUtils.clamp(this.flySpeed * (e.deltaY < 0 ? 1.15 : 0.87), 4, 900);
          e.preventDefault();
        }
      },
      { passive: false },
    );
  }

  setMode(mode: CameraMode) {
    if (mode === this.mode) return;
    const cam = this.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    if (mode === 'fly') {
      this.yaw = Math.atan2(-dir.x, -dir.z);
      this.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      this.flySpeed = THREE.MathUtils.clamp(this.viewDist * 0.25, 15, 300);
    }
    if (mode === 'orbit') {
      // 把軌道中心放在視線前方的地面附近
      const d = this.mode === 'tour' ? cam.position.distanceTo(this.lookTarget) : this.mode === 'walk' ? Math.max(4, cam.position.distanceTo(this.focus)) : 220;
      this.controls.target.copy(cam.position).addScaledVector(dir, d);
    }
    if (mode === 'tour') {
      this.tourT = 0;
      this.tween = null;
    }
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
    this.onModeChange?.(mode);
  }

  /** 平滑飛到某個地標前方 */
  flyTo(target: THREE.Vector3, radius: number, az?: number, el = 0.32) {
    if (this.mode !== 'orbit') this.setMode('orbit');
    const cam = this.camera;
    const cur = new THREE.Vector3().subVectors(cam.position, this.controls.target);
    const a = az ?? Math.atan2(cur.x, cur.z);
    const dist = radius * 2.7 + 30;
    const p1 = new THREE.Vector3(
      target.x + Math.sin(a) * Math.cos(el) * dist,
      target.y + Math.sin(el) * dist,
      target.z + Math.cos(a) * Math.cos(el) * dist,
    );
    p1.y = Math.max(p1.y, groundAt(p1.x, p1.z) + 6);
    const travel = cam.position.distanceTo(p1);
    this.tween = {
      p0: cam.position.clone(),
      t0: this.controls.target.clone(),
      p1,
      t1: target.clone(),
      t: 0,
      dur: THREE.MathUtils.clamp(1.1 + travel / 900, 1.2, 3.2),
    };
  }

  update(dt: number) {
    const cam = this.camera;
    // 漫遊模式的鏡頭由角色控制器負責
    if (this.mode === 'walk') return;
    if (this.mode === 'orbit') {
      if (this.tween) {
        const tw = this.tween;
        tw.t = Math.min(1, tw.t + dt / tw.dur);
        const k = smoothstep(0, 1, tw.t);
        cam.position.lerpVectors(tw.p0, tw.p1, k);
        // 長距離移動時中途拉高，像空拍機一樣越過地形
        cam.position.y += Math.sin(Math.PI * k) * Math.min(260, tw.p0.distanceTo(tw.p1) * 0.12);
        this.controls.target.lerpVectors(tw.t0, tw.t1, k);
        if (tw.t >= 1) this.tween = null;
      }
      this.controls.update();
      const t = this.controls.target;
      const g = groundAt(t.x, t.z);
      if (t.y < g - 2) t.y = g - 2;
      this.focus.copy(t);
      this.viewDist = cam.position.distanceTo(t);
    } else if (this.mode === 'fly') {
      const k = this.keys;
      const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const u = (k.has('KeyE') || k.has('Space') ? 1 : 0) - (k.has('KeyQ') || k.has('KeyC') ? 1 : 0);
      const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 3.5 : 1;
      cam.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const rt = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const sp = this.flySpeed * boost * dt;
      cam.position.addScaledVector(fw, f * sp).addScaledVector(rt, r * sp);
      cam.position.y += u * sp;
      const h = cam.position.y - groundAt(cam.position.x, cam.position.z);
      this.viewDist = THREE.MathUtils.clamp(h * 2.2 + 140, 140, 1500);
      this.focus.copy(cam.position).addScaledVector(fw, Math.min(this.viewDist * 0.6, 400));
    } else {
      this.tourT = (this.tourT + dt / 150) % 1;
      this.tourPos.getPointAt(this.tourT, cam.position);
      this.tourLook.getPointAt(this.tourT, this.lookTarget);
      cam.lookAt(this.lookTarget);
      this.focus.copy(this.lookTarget);
      this.viewDist = cam.position.distanceTo(this.lookTarget);
    }
    const g = groundAt(cam.position.x, cam.position.z) + 2.5;
    if (cam.position.y < g) cam.position.y = g;
    cam.updateMatrixWorld();
  }
}
