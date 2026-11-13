import * as THREE from 'three';
import { heightAt, forestDensity, getPaths, WATER } from '../world/heightfield';
import { SCENES, PORTALS, type SceneDef } from '../castle/scenes/registry';
import { LANDMARKS } from '../landmarks/data';

interface MapViewDef {
  label: string;
  cx: number;
  cz: number;
  half: number;
}
const VIEWS: Record<'castle' | 'grounds', MapViewDef> = {
  castle: { label: '城堡', cx: 0, cz: -30, half: 240 },
  grounds: { label: '全區', cx: -420, cz: -560, half: 1080 },
};
const SIZE = 1024;

interface Marker {
  x: number;
  z: number;
  scenes: SceneDef[];
}

export interface MapDeps {
  renderer: THREE.WebGLRenderer;
  /** 城堡與校園建築的根節點（用來畫出建築的平面輪廓） */
  buildings: THREE.Object3D;
  getPlayer: () => { x: number; z: number; yaw: number; active: boolean };
  travel: (to: [number, number, number, number]) => void;
}

/** 羊皮紙風格的地圖：地形、湖、森林、道路、建築輪廓，加上每個場景的入口 */
export class MapView {
  readonly el: HTMLElement;
  private img: HTMLImageElement;
  private layer: HTMLElement;
  private me: HTMLElement;
  private pop: HTMLElement;
  private view: 'castle' | 'grounds' = 'castle';
  private cache: Partial<Record<'castle' | 'grounds', string>> = {};
  private markers: Marker[] | null = null;
  open = false;

  constructor(private d: MapDeps) {
    this.el = document.createElement('div');
    this.el.className = 'panel mapview hidden';
    this.el.innerHTML = `
      <div class="map-head">
        <h3>霍格沃茲地圖</h3>
        <div class="row">${(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((k) => `<button class="chip mv" data-mv="${k}">${VIEWS[k].label}</button>`).join('')}</div>
        <button class="chip map-close" title="關閉 (M)">✕</button>
      </div>
      <div class="map-body"><img alt="霍格沃茲地圖" /><div class="map-layer"></div><div class="map-me"></div><div class="map-pop hidden"></div></div>
      <p class="note">金色圓點是可以進去的地方，點一下就能直接前往；紅色箭頭是你。按 M 開關地圖。</p>`;
    this.img = this.el.querySelector('img')!;
    this.layer = this.el.querySelector('.map-layer')!;
    this.me = this.el.querySelector('.map-me')!;
    this.pop = this.el.querySelector('.map-pop')!;
    this.el.querySelectorAll<HTMLElement>('.mv').forEach((b) => (b.onclick = () => this.show(b.dataset.mv as 'castle' | 'grounds')));
    (this.el.querySelector('.map-close') as HTMLElement).onclick = () => this.toggle(false);
    this.layer.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('.map-dot');
      if (!t) return;
      this.openPop(this.markers![parseInt(t.dataset.i!)], t);
    });
    this.pop.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sc]');
      if (!b) return;
      const s = SCENES.find((x) => x.id === b.dataset.sc);
      if (!s) return;
      this.toggle(false);
      this.d.travel(s.spawn);
    });
  }

  toggle(on = !this.open) {
    this.open = on;
    this.el.classList.toggle('hidden', !on);
    if (on) this.show(this.view);
    else this.pop.classList.add('hidden');
  }

  private show(v: 'castle' | 'grounds') {
    this.view = v;
    this.el.querySelectorAll<HTMLElement>('.mv').forEach((b) => b.classList.toggle('on', b.dataset.mv === v));
    if (!this.cache[v]) this.cache[v] = this.paint(VIEWS[v]);
    this.img.src = this.cache[v]!;
    this.pop.classList.add('hidden');
    this.placeMarkers();
    this.update();
  }

  /** 每一幀：更新玩家的位置與朝向 */
  update() {
    if (!this.open) return;
    const p = this.d.getPlayer();
    const v = VIEWS[this.view];
    const u = (p.x - (v.cx - v.half)) / (2 * v.half);
    const w = (p.z - (v.cz - v.half)) / (2 * v.half);
    const inside = p.active && u >= 0 && u <= 1 && w >= 0 && w <= 1;
    this.me.style.display = inside ? '' : 'none';
    if (inside) {
      this.me.style.left = `${u * 100}%`;
      this.me.style.top = `${w * 100}%`;
      // 朝 +Z（南）是畫面下方；yaw 0 = +Z
      this.me.style.transform = `translate(-50%, -50%) rotate(${180 - (p.yaw * 180) / Math.PI}deg)`;
    }
  }

  // ------------------------------------------------------------ 入口
  private computeMarkers(): Marker[] {
    const inPocket = (x: number, y: number, z: number) => SCENES.find((s) => s.pocket && s.box.containsPoint(_v.set(x, y + 0.5, z))) ?? null;
    const memo = new Map<SceneDef, [number, number] | null>();
    const locate = (s: SceneDef, depth = 0): [number, number] | null => {
      if (memo.has(s)) return memo.get(s)!;
      if (depth > 6) return null;
      memo.set(s, null);
      let best: [number, number] | null = null;
      // 先找從真實世界直接通進來的門，找不到再找從其他獨立場景來的
      for (const pass of [0, 1]) {
        for (const p of PORTALS) {
          if (!s.box.containsPoint(_v.set(p.to[0], p.to[1] + 0.5, p.to[2]))) continue;
          const from = inPocket(p.pos[0], p.pos[1], p.pos[2]);
          if (pass === 0 && !from) best = [p.pos[0], p.pos[2]];
          else if (pass === 1 && from && from !== s) best = locate(from, depth + 1);
          if (best) break;
        }
        if (best) break;
      }
      memo.set(s, best);
      return best;
    };
    const out: Marker[] = [];
    for (const s of SCENES) {
      if (!s.name) continue;
      const at: [number, number] | null = s.pocket ? locate(s) : [(s.box.min.x + s.box.max.x) / 2, (s.box.min.z + s.box.max.z) / 2];
      if (!at) continue;
      // 位置很近的入口合成一個點
      const m = out.find((o) => Math.hypot(o.x - at[0], o.z - at[1]) < 6);
      if (m) m.scenes.push(s);
      else out.push({ x: at[0], z: at[1], scenes: [s] });
    }
    return out;
  }

  private placeMarkers() {
    if (!this.markers) this.markers = this.computeMarkers();
    const v = VIEWS[this.view];
    this.layer.innerHTML = this.markers
      .map((m, i) => {
        const u = (m.x - (v.cx - v.half)) / (2 * v.half);
        const w = (m.z - (v.cz - v.half)) / (2 * v.half);
        if (u < 0 || u > 1 || w < 0 || w > 1) return '';
        const title = m.scenes.map((s) => s.name).join('、');
        return `<button class="map-dot${m.scenes.length > 1 ? ' many' : ''}" data-i="${i}" style="left:${u * 100}%;top:${w * 100}%" title="${title}">${m.scenes.length > 1 ? m.scenes.length : ''}</button>`;
      })
      .join('');
  }

  private openPop(m: Marker, dot: HTMLElement) {
    this.pop.innerHTML = `<div class="map-pop-list">${m.scenes.map((s) => `<button data-sc="${s.id}"><b>${s.name}</b><span>前往 ›</span></button>`).join('')}</div>`;
    this.pop.style.left = dot.style.left;
    this.pop.style.top = dot.style.top;
    this.pop.classList.remove('hidden');
  }

  // ------------------------------------------------------------ 繪製
  private paint(v: MapViewDef): string {
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(SIZE, SIZE);
    const px = img.data;
    const N = 340;
    const cell = (2 * v.half) / N;
    // 地形：羊皮紙底色 + 山影，水面偏藍，禁忌森林偏綠
    const H = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = heightAt(v.cx - v.half + i * cell, v.cz - v.half + j * cell);
    const terr = new Uint8ClampedArray(N * N * 3);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const h = H[j * (N + 1) + i];
        const dx = H[j * (N + 1) + i + 1] - h;
        const dz = H[(j + 1) * (N + 1) + i] - h;
        const shade = Math.max(0.55, Math.min(1.15, 1 + (-dx - dz) / cell * 0.35));
        let r = 222;
        let gg = 203;
        let b = 160;
        if (h < WATER) {
          const deep = Math.min(1, (WATER - h) / 25);
          r = 150 - deep * 40;
          gg = 160 - deep * 30;
          b = 150 - deep * 10;
        } else {
          const x = v.cx - v.half + (i + 0.5) * cell;
          const z = v.cz - v.half + (j + 0.5) * cell;
          const f = forestDensity(x, z);
          const t = Math.min(1, f.forbidden + f.wood * 0.7);
          r = r * (1 - t * 0.35) * shade;
          gg = gg * (1 - t * 0.22) * shade;
          b = b * (1 - t * 0.45) * shade;
          // 等高線
          if (Math.floor(h / 20) !== Math.floor(H[j * (N + 1) + i + 1] / 20) || Math.floor(h / 20) !== Math.floor(H[(j + 1) * (N + 1) + i] / 20)) {
            r *= 0.88;
            gg *= 0.86;
            b *= 0.82;
          }
        }
        const k = (j * N + i) * 3;
        terr[k] = r;
        terr[k + 1] = gg;
        terr[k + 2] = b;
      }
    }
    // 建築輪廓：從正上方用正交相機畫一張剪影
    const mask = this.silhouette(v);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const i = Math.min(N - 1, Math.floor((x / SIZE) * N));
        const j = Math.min(N - 1, Math.floor((y / SIZE) * N));
        const k = (j * N + i) * 3;
        const o = (y * SIZE + x) * 4;
        // 渲染目標的 y 軸朝上
        const m = mask[((SIZE - 1 - y) * SIZE + x) * 4];
        const bld = m < 128;
        px[o] = bld ? 92 : terr[k];
        px[o + 1] = bld ? 66 : terr[k + 1];
        px[o + 2] = bld ? 48 : terr[k + 2];
        px[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // 道路與小徑
    const scale = SIZE / (2 * v.half);
    for (const p of getPaths()) {
      g.strokeStyle = p.def.kind === 'rail' ? 'rgba(60,40,30,0.85)' : 'rgba(120,90,55,0.8)';
      g.lineWidth = Math.max(1.2, p.def.width * scale * (p.def.kind === 'rail' ? 0.5 : 0.8));
      if (p.def.kind === 'rail') g.setLineDash([6, 4]);
      else g.setLineDash([]);
      g.beginPath();
      for (let i = 0; i < p.n; i++) {
        const X = (p.x[i] - (v.cx - v.half)) * scale;
        const Y = (p.z[i] - (v.cz - v.half)) * scale;
        if (i === 0) g.moveTo(X, Y);
        else g.lineTo(X, Y);
      }
      g.stroke();
    }
    g.setLineDash([]);
    // 紙張的暗角
    const grad = g.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.75);
    grad.addColorStop(0, 'rgba(60,40,20,0)');
    grad.addColorStop(1, 'rgba(60,40,20,0.35)');
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    // 地名：城堡圖標出城堡裡的建築，全區圖只標城堡外的地方
    {
      const placed: [number, number, number, number][] = [];
      const castle = v.half < 500;
      const list = LANDMARKS.filter((l) => {
        const far = Math.hypot(l.pos[0] + 20, l.pos[2] + 10) > 230;
        return castle ? !far : far;
      }).map((l) => ({ name: l.name, x: l.pos[0], z: l.pos[2], big: l.radius }));
      if (!castle) list.push({ name: '霍格沃茲城堡', x: 0, z: -20, big: 999 });
      list.sort((a, b) => b.big - a.big);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const l of list) {
        const X = (l.x - (v.cx - v.half)) * scale;
        const Y = (l.z - (v.cz - v.half)) * scale;
        if (X < 30 || X > SIZE - 30 || Y < 20 || Y > SIZE - 20) continue;
        const fs = castle ? 19 : l.big === 999 ? 26 : 21;
        g.font = `700 ${fs}px "Noto Serif TC", "Songti TC", serif`;
        const w = g.measureText(l.name).width + 8;
        const box: [number, number, number, number] = [X - w / 2, Y - fs / 2 - 14, X + w / 2, Y + fs / 2 - 14];
        if (placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
        placed.push(box);
        g.lineWidth = 5;
        g.strokeStyle = 'rgba(244, 232, 200, 0.92)';
        g.strokeText(l.name, X, Y - 14);
        g.fillStyle = '#3a2412';
        g.fillText(l.name, X, Y - 14);
      }
      g.textAlign = 'start';
      g.textBaseline = 'alphabetic';
    }
    // 方位與比例尺
    g.fillStyle = 'rgba(60,40,25,0.85)';
    g.font = '600 26px "Noto Serif TC", serif';
    g.fillText('北', SIZE - 52, 44);
    g.beginPath();
    g.moveTo(SIZE - 40, 54);
    g.lineTo(SIZE - 48, 76);
    g.lineTo(SIZE - 32, 76);
    g.fill();
    const meters = v.half > 500 ? 500 : 100;
    g.fillRect(28, SIZE - 36, meters * scale, 4);
    g.font = '500 18px "Noto Serif TC", serif';
    g.fillText(`${meters} 公尺`, 28, SIZE - 46);
    return cv.toDataURL('image/jpeg', 0.86);
  }

  private silhouette(v: MapViewDef) {
    const r = this.d.renderer;
    const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { depthBuffer: true });
    const cam = new THREE.OrthographicCamera(-v.half, v.half, v.half, -v.half, 1, 3000);
    cam.position.set(v.cx, 1500, v.cz);
    cam.up.set(0, 0, -1);
    cam.lookAt(v.cx, 0, v.cz);
    cam.updateMatrixWorld();
    const tmp = new THREE.Scene();
    tmp.background = new THREE.Color(1, 1, 1);
    tmp.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    const b = this.d.buildings;
    const parent = b.parent;
    const wasVisible = b.visible;
    b.visible = true;
    tmp.add(b);
    const prevTarget = r.getRenderTarget();
    const prevShadow = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    r.setRenderTarget(rt);
    r.render(tmp, cam);
    const out = new Uint8Array(SIZE * SIZE * 4);
    r.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, out);
    r.setRenderTarget(prevTarget);
    r.shadowMap.autoUpdate = prevShadow;
    parent?.add(b);
    b.visible = wasVisible;
    rt.dispose();
    (tmp.overrideMaterial as THREE.Material).dispose();
    return out;
  }
}

const _v = new THREE.Vector3();
