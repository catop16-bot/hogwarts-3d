import * as THREE from 'three';

export interface SceneLight {
  pos: [number, number, number];
  intensity: number;
  dist: number;
  color?: number;
}
export interface SceneDef {
  id: string;
  /** 顯示名稱；留空表示只是連接用的空間，不列入清單 */
  name: string;
  intro: string;
  box: THREE.Box3;
  lights: SceneLight[];
  /** 「前往…」的落腳處：x, y, z, 面向 */
  spawn: [number, number, number, number];
  /** 蓋在遠處高空的獨立場景：平時隱藏，沒有陽光，不能騎掃帚 */
  pocket?: boolean;
  /** 同一區的場景彼此相通，燈光一起亮 */
  zone?: string;
  /** 天光的比例（預設 0.42） */
  ambient?: number;
  /** 露天的場景：照常有陽光與雨雪，只是列入清單 */
  outdoor?: boolean;
  group?: THREE.Object3D;
  animate?: (time: number) => void;
}
export interface PortalDef {
  pos: [number, number, number];
  label: string;
  /** 目的地：x, y, z, 面向 */
  to: [number, number, number, number];
}
export interface SignDef {
  text: string;
  pos: [number, number, number];
  ry: number;
}

export const SCENES: SceneDef[] = [];
export const PORTALS: PortalDef[] = [];
export const SIGNS: SignDef[] = [];

export const box3 = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  new THREE.Box3(new THREE.Vector3(Math.min(x0, x1), y0, Math.min(z0, z1)), new THREE.Vector3(Math.max(x0, x1), y1, Math.max(z0, z1)));

export function registerScene(s: SceneDef) {
  SCENES.push(s);
  return s;
}

export interface DoorEnd {
  /** 門所在的牆面位置（地板高度） */
  pos: [number, number, number];
  /** 門朝向房間內的方向（也是從這扇門走出來時的面向） */
  face: number;
  /** 這一側的房間名稱 */
  name: string;
  /** 是否在門上方掛名牌（寫的是門後的場景） */
  sign?: boolean;
}

/** 把兩扇門連起來：走到其中一扇前按互動鍵，就會從另一扇走出來 */
export function link(a: DoorEnd, b: DoorEnd) {
  const stand = (d: DoorEnd): [number, number, number] => [d.pos[0] + Math.sin(d.face) * 1.9, d.pos[1], d.pos[2] + Math.cos(d.face) * 1.9];
  const sa = stand(a);
  const sb = stand(b);
  PORTALS.push({ pos: sa, label: b.name, to: [sb[0], sb[1], sb[2], b.face] });
  PORTALS.push({ pos: sb, label: a.name, to: [sa[0], sa[1], sa[2], a.face] });
  for (const [d, other] of [[a, b], [b, a]] as const) {
    if (d.sign === false) continue;
    SIGNS.push({ text: other.name, pos: [d.pos[0] + Math.sin(d.face) * 0.12, d.pos[1] + 3.75, d.pos[2] + Math.cos(d.face) * 0.12], ry: d.face });
  }
}

/** 口袋場景的原點：排在遠處高空，彼此隔開 */
export function pocketOrigin(k: number): [number, number, number] {
  return [5000 + (k % 8) * 400, 3000, 5000 + Math.floor(k / 8) * 400];
}
