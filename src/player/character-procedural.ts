import * as THREE from 'three';
import { HOUSES, type AnimState } from './houses';

const sat = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 程序化的霍格沃茲學生（模型載不到時的備用）：長袍、學院圍巾、魔杖，動作全由程式計算 */
export class ProceduralCharacter {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private skirt!: THREE.Mesh;
  private tail = new THREE.Group();
  private broom = new THREE.Group();
  private arm: THREE.Group[] = [];
  private fore: THREE.Group[] = [];
  private thigh: THREE.Group[] = [];
  private shin: THREE.Group[] = [];
  private primary = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  private secondary = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  private tip!: THREE.Mesh;
  private glow = new THREE.PointLight(0xcfe0ff, 0, 26, 1.3);
  lumos = false;
  private phase = 0;
  private t = 0;
  private k = 1;
  private wasGrounded = true;
  private land = 0;
  private lean = 0;
  private look = 0;
  private lookT = 0;

  constructor() {
    const robe = new THREE.MeshStandardMaterial({ color: 0x3b3c48, roughness: 0.72, side: THREE.DoubleSide });
    const grey = new THREE.MeshStandardMaterial({ color: 0x4a4c52, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x33343a, roughness: 0.85 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.4 });
    const lip = new THREE.MeshStandardMaterial({ color: 0xa8625a, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a583, roughness: 0.75 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.75 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.8 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.6 });
    const straw = new THREE.MeshStandardMaterial({ color: 0x8a6a32, roughness: 0.95 });
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const pivot = (parent: THREE.Object3D, x: number, y: number, z: number) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };
    this.root.rotation.order = 'YXZ';
    this.root.add(this.body);

    // 腿
    for (const s of [-1, 1]) {
      const th = pivot(this.body, s * 0.088, 0.9, 0);
      add(th, new THREE.CylinderGeometry(0.078, 0.064, 0.44, 8), dark, 0, -0.21, 0);
      const sh = pivot(th, 0, -0.43, 0);
      add(sh, new THREE.CylinderGeometry(0.06, 0.05, 0.42, 8), dark, 0, -0.2, 0);
      add(sh, new THREE.BoxGeometry(0.1, 0.08, 0.27), shoe, 0, -0.43, 0.055);
      this.thigh.push(th);
      this.shin.push(sh);
    }

    // 長袍下襬：前方開衩
    const skirtGeo = new THREE.CylinderGeometry(0.175, 0.37, 0.84, 16, 3, true, 0.42, Math.PI * 2 - 0.84);
    skirtGeo.translate(0, -0.42, 0);
    this.skirt = add(this.body, skirtGeo, robe, 0, 1.04, 0);
    this.skirt.scale.z = 0.86;

    // 軀幹
    this.torso.position.set(0, 0.92, 0);
    this.body.add(this.torso);
    const chest = add(this.torso, new THREE.CylinderGeometry(0.205, 0.165, 0.56, 12), robe, 0, 0.3, 0);
    chest.scale.z = 0.7;
    const hips = add(this.torso, new THREE.CylinderGeometry(0.165, 0.175, 0.14, 12), grey, 0, 0.0, 0);
    hips.scale.z = 0.72;
    // 領口露出的毛衣、襯衫領與領帶
    add(this.torso, new THREE.BoxGeometry(0.1, 0.2, 0.02), grey, 0, 0.42, 0.139);
    for (const s of [-1, 1]) add(this.torso, new THREE.BoxGeometry(0.05, 0.03, 0.022), shirt, s * 0.03, 0.535, 0.132).rotation.z = s * 0.5;
    add(this.torso, new THREE.BoxGeometry(0.028, 0.17, 0.024), this.primary, 0, 0.43, 0.143);
    // 長袍開襟的學院色滾邊
    for (const s of [-1, 1]) {
      const trim = add(this.torso, new THREE.BoxGeometry(0.022, 0.5, 0.02), this.primary, s * 0.075, 0.3, 0.137);
      trim.rotation.z = s * -0.09;
    }
    const sh = add(this.torso, new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), robe, 0, 0.555, 0);
    sh.scale.set(1.12, 0.38, 0.72);
    // 兜帽
    // 兜帽垂在背後，內襯是學院色
    const hood = add(this.torso, new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), robe, 0, 0.5, -0.15);
    hood.scale.set(1.2, 1.15, 0.62);
    hood.rotation.x = -2.5;
    const lining = add(this.torso, new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), this.primary, 0, 0.515, -0.145);
    lining.scale.set(1.12, 1.05, 0.5);
    lining.rotation.x = -2.5;
    // 胸前的學院徽章
    add(this.torso, new THREE.BoxGeometry(0.075, 0.085, 0.012), this.primary, -0.12, 0.42, 0.13).rotation.y = -0.25;
    add(this.torso, new THREE.BoxGeometry(0.045, 0.05, 0.014), this.secondary, -0.12, 0.42, 0.135).rotation.y = -0.25;

    // 手臂
    for (const s of [-1, 1]) {
      const a = pivot(this.torso, s * 0.245, 0.52, 0);
      add(a, new THREE.CylinderGeometry(0.062, 0.066, 0.3, 8), robe, 0, -0.14, 0);
      const f = pivot(a, 0, -0.29, 0);
      add(f, new THREE.CylinderGeometry(0.066, 0.1, 0.27, 8, 1, true), robe, 0, -0.12, 0);
      add(f, new THREE.SphereGeometry(0.046, 8, 6), skin, 0, -0.29, 0);
      if (s === 1) {
        // 魔杖
        const w = add(f, new THREE.CylinderGeometry(0.006, 0.011, 0.34, 5), wood, 0, -0.31, 0.15);
        w.rotation.x = Math.PI / 2 - 0.25;
        // 魔杖尖端的「路摸思」光球
        this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 8, 10) }));
        this.tip.position.set(0, -0.355, 0.32);
        this.tip.visible = false;
        f.add(this.tip);
        this.glow.position.set(0, -0.2, 0.75);
        f.add(this.glow);
      }
      this.arm.push(a);
      this.fore.push(f);
    }

    // 頭
    this.head.position.set(0, 0.6, 0);
    this.torso.add(this.head);
    add(this.head, new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), skin, 0, 0.03, 0);
    const skull = add(this.head, new THREE.SphereGeometry(0.118, 16, 12), skin, 0, 0.185, 0);
    skull.scale.set(0.95, 1.1, 1);
    const cap = add(this.head, new THREE.SphereGeometry(0.127, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.215, -0.012);
    cap.scale.set(0.97, 1.08, 1.02);
    const back = add(this.head, new THREE.SphereGeometry(0.115, 12, 8), hair, 0, 0.17, -0.035);
    back.scale.set(0.98, 1.05, 0.9);
    cap.rotation.x = -0.12;
    for (const s of [-1, 1]) {
      // 眼白、瞳孔、眉毛與耳朵
      add(this.head, new THREE.SphereGeometry(0.019, 8, 6), white, s * 0.042, 0.195, 0.1).scale.set(1.2, 0.8, 0.6);
      add(this.head, new THREE.SphereGeometry(0.011, 6, 5), dark, s * 0.042, 0.195, 0.111);
      const brow = add(this.head, new THREE.BoxGeometry(0.04, 0.009, 0.01), hair, s * 0.043, 0.222, 0.108);
      brow.rotation.z = s * -0.12;
      add(this.head, new THREE.SphereGeometry(0.026, 8, 6), skin, s * 0.112, 0.18, -0.005).scale.set(0.5, 1, 0.8);
      // 鬢角的頭髮
      add(this.head, new THREE.BoxGeometry(0.03, 0.08, 0.06), hair, s * 0.105, 0.215, 0.02);
    }
    add(this.head, new THREE.SphereGeometry(0.016, 6, 5), skin, 0, 0.165, 0.118);
    add(this.head, new THREE.BoxGeometry(0.038, 0.009, 0.01), lip, 0, 0.128, 0.108);

    // 學院圍巾
    const wrap = add(this.torso, new THREE.TorusGeometry(0.082, 0.036, 8, 16), this.primary, 0, 0.6, 0.005);
    wrap.rotation.x = Math.PI / 2;
    this.tail.position.set(0.075, 0.585, 0.12);
    this.torso.add(this.tail);
    for (let i = 0; i < 7; i++) add(this.tail, new THREE.BoxGeometry(0.085, 0.066, 0.022), i % 2 ? this.secondary : this.primary, 0, -0.035 - i * 0.065, 0);
    // 另一端甩到背後：從後面看也認得出是哪個學院
    const back2 = new THREE.Group();
    back2.position.set(-0.08, 0.6, -0.2);
    back2.rotation.set(-0.12, 0, -0.08);
    this.torso.add(back2);
    for (let i = 0; i < 8; i++) add(back2, new THREE.BoxGeometry(0.09, 0.066, 0.022), i % 2 ? this.secondary : this.primary, 0, -0.035 - i * 0.065, 0);
    add(back2, new THREE.BoxGeometry(0.09, 0.03, 0.02), this.secondary, 0, -0.56, 0);

    // 飛天掃帚
    const stick = add(this.broom, new THREE.CylinderGeometry(0.017, 0.02, 1.7, 8), wood);
    stick.rotation.x = Math.PI / 2;
    stick.position.z = 0.2;
    const bristle = add(this.broom, new THREE.ConeGeometry(0.11, 0.62, 10, 1, true), straw);
    bristle.rotation.x = Math.PI / 2;
    bristle.position.z = -0.9;
    add(this.broom, new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8), wood, 0, 0, -0.62).rotation.x = Math.PI / 2;
    this.broom.position.set(0, 0.8, 0);
    this.broom.visible = false;
    this.body.add(this.broom);

    this.setHouse(0);
  }

  setHouse(i: number) {
    const h = HOUSES[i] ?? HOUSES[0];
    this.primary.color.setHex(h.primary);
    this.secondary.color.setHex(h.secondary);
  }

  setLumos(on: boolean) {
    this.lumos = on;
    this.tip.visible = on;
    this.glow.intensity = on ? 7 : 0;
  }

  private to(obj: THREE.Object3D, x: number, y = 0, z = 0) {
    const r = obj.rotation;
    r.x += (x - r.x) * this.k;
    r.y += (y - r.y) * this.k;
    r.z += (z - r.z) * this.k;
  }

  animate(dt: number, s: AnimState) {
    this.t += dt;
    const k = (this.k = 1 - Math.exp(-dt * 11));
    const [aL, aR] = this.arm;
    const [fL, fR] = this.fore;
    const [tL, tR] = this.thigh;
    const [sL, sR] = this.shin;
    const t = this.t;
    let bodyY = 0;
    let rootX = 0;
    let rootZ = 0;
    this.broom.visible = s.mode === 'broom';

    if (s.mode === 'broom') {
      const wob = Math.sin(t * 1.7) * 0.03;
      this.to(this.torso, 0.62, 0, 0);
      this.to(this.head, -0.5, 0, 0);
      this.to(tL, -1.05, 0, -0.16);
      this.to(tR, -1.05, 0, 0.16);
      this.to(sL, 1.9);
      this.to(sR, 1.9);
      this.to(aL, -1.0, 0, 0.3);
      this.to(aR, -1.0, 0, -0.3);
      this.to(fL, -0.35);
      this.to(fR, -0.35);
      this.to(this.skirt, 0.75);
      this.to(this.tail, 0.5 + sat(s.speed / 30) * 0.9);
      bodyY = -0.02 + wob;
      rootX = -Math.atan2(s.vy, Math.max(4, s.speed)) * 0.7;
      rootZ = s.bank;
    } else if (s.mode === 'swim') {
      const st = Math.sin(t * 3.2);
      this.to(this.torso, 0.1);
      this.to(this.head, -0.95);
      this.to(tL, 0.25 * st, 0, 0);
      this.to(tR, -0.25 * st, 0, 0);
      this.to(sL, 0.3 + 0.2 * st);
      this.to(sR, 0.3 - 0.2 * st);
      this.to(aL, -2.5 + 0.7 * st, 0, -0.3);
      this.to(aR, -2.5 - 0.7 * st, 0, 0.3);
      this.to(fL, -0.2);
      this.to(fR, -0.2);
      this.to(this.skirt, 0.1);
      this.to(this.tail, 0.2);
      rootX = 1.2;
      bodyY = Math.sin(t * 1.6) * 0.03;
    } else if (!s.grounded) {
      this.to(this.torso, 0.08);
      this.to(this.head, 0);
      this.to(tL, -0.7);
      this.to(tR, 0.25);
      this.to(sL, 1.0);
      this.to(sR, 0.5);
      this.to(aL, 0.2, 0, -0.9);
      this.to(aR, 0.2, 0, 0.9);
      this.to(fL, -0.4);
      this.to(fR, -0.4);
      this.to(this.skirt, s.vy < 0 ? -0.15 : 0.2);
      this.to(this.tail, s.vy < 0 ? -0.6 : 0.4);
    } else {
      // 落地時膝蓋一彎、身體一沉
      if (!this.wasGrounded) this.land = Math.min(1, this.land + 0.6);
      this.land = Math.max(0, this.land - dt * 3.2);
      const land = this.land * this.land;
      const run = sat((s.speed - 3) / 4.5);
      const amp = sat(s.speed / 2);
      if (amp > 0.02) this.phase += dt * (3.4 + s.speed * 1.15);
      const sw = Math.sin(this.phase);
      const cw = Math.cos(this.phase);
      const A = mix(0.5, 0.95, run) * amp;
      const K = mix(0.75, 1.55, run) * amp;
      const breath = Math.sin(t * 1.5) * 0.02 * (1 - amp);
      // 轉彎時往內側傾；站著不動時偶爾轉頭看看四周、重心左右換腳
      this.lean += (Math.max(-1, Math.min(1, (s.turn ?? 0) * 0.12)) * amp - this.lean) * Math.min(1, dt * 6);
      this.lookT -= dt;
      if (this.lookT <= 0) {
        this.look = amp > 0.1 ? 0 : (Math.random() - 0.5) * 1.1;
        this.lookT = 2 + Math.random() * 3;
      }
      const sway = Math.sin(t * 0.7) * (1 - amp);
      this.to(this.torso, mix(0.02, 0.2, run) * amp + breath * 0.4 + land * 0.35, sw * 0.14 * amp, -this.lean * 0.5 + sway * 0.025);
      this.to(this.head, -mix(0, 0.12, run) * amp - land * 0.2, -sw * 0.08 * amp + this.look * (1 - amp), this.lean * 0.3);
      this.to(tL, -sw * A - land * 0.55 + sway * 0.04);
      this.to(tR, sw * A - land * 0.55 - sway * 0.04);
      this.to(sL, Math.max(0, cw) * K + 0.05 * amp + land * 1.0);
      this.to(sR, Math.max(0, -cw) * K + 0.05 * amp + land * 1.0);
      const AA = mix(0.4, 1.0, run) * amp;
      this.to(aL, sw * AA + breath, 0, -0.07);
      this.to(fL, -(0.12 + run * 1.1 * amp) - Math.max(0, sw) * 0.3 * amp);
      if (this.lumos) {
        // 舉著發光的魔杖照路
        this.to(aR, -0.75 - sw * 0.08 * amp, 0, 0.12);
        this.to(fR, -0.95);
      } else {
        this.to(aR, -sw * AA * 0.85 + breath, 0, 0.07);
        this.to(fR, -(0.2 + run * 1.0 * amp) - Math.max(0, -sw) * 0.3 * amp);
      }
      this.to(this.skirt, amp * 0.08 + run * 0.2);
      this.to(this.tail, amp * 0.15 + run * 0.5 + sw * 0.08 * amp, 0, cw * 0.1 * amp);
      bodyY = -Math.abs(cw) * mix(0.02, 0.05, run) * amp - land * 0.16 + sway * 0.004;
      rootZ = -this.lean * 0.22;
    }
    this.wasGrounded = s.grounded || s.mode !== 'walk';
    this.body.position.y += (bodyY - this.body.position.y) * k;
    this.root.rotation.x += (rootX - this.root.rotation.x) * k * 0.6;
    this.root.rotation.z += (rootZ - this.root.rotation.z) * k * 0.6;
  }
}
