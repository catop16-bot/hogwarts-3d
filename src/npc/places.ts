import { STAMPS } from '../world/heightfield';

/** 戶外的地點：x, z 與面向；高度由 NPC 系統往下找地面。ring：多人時排成面向中心的半圓，cluster 則依學院分成幾個小圈聊天 */
export interface OutPlace {
  x: number;
  z: number;
  face: number;
  /** 多人時：繞著 (cx, cz) 排成面向中心的半圓 */
  ring?: { cx: number; cz: number; r: number; from: number; to: number; cluster?: boolean };
  name: string;
}

const H = STAMPS.hagrid;
const HM = STAMPS.hogsmeade;
const ST = STAMPS.station;
const BH = STAMPS.boathouse;
const PI = Math.PI;

/** 盤旋：在某個場景或戶外上空繞圈（早上送信的貓頭鷹）；高度是相對場景入口的地板 */
export interface Circle {
  scene?: string;
  cx: number;
  cz: number;
  y: number;
  r: number;
}
export const CIRCLES: Record<string, Circle> = {
  greatHall: { scene: 'greatHall', cx: -108, cz: 112, y: 9, r: 11 },
};

export const PLACES: Record<string, OutPlace> = {
  hagridYard: { x: H.x - 12, z: H.z - 9, face: -2.3, name: '海格的小屋前' },
  hagridTeach: { x: H.x - 17, z: H.z - 15, face: -2.4, name: '海格的小屋旁的空地' },
  // 上奇獸飼育學的學生：圍在海格前面
  hagridClass: { x: H.x - 20, z: H.z - 18, face: 0.75, ring: { cx: H.x - 17, cz: H.z - 15, r: 3.6, from: -2.4 - 1.1, to: -2.4 + 1.1 }, name: '海格的小屋旁的空地' },
  station: { x: ST.x + 4, z: ST.z + 12, face: PI, name: '活米村車站' },
  boathouse: { x: BH.x + 12, z: BH.z + 2, face: -PI / 2, name: '船屋外' },
  pitch: { x: STAMPS.pitch.x + 6, z: STAMPS.pitch.z + 20, face: PI, name: '魁地奇球場' },
  // 活米村：三根掃帚門口附近的廣場
  hogsmeade: { x: HM.x + 4, z: HM.z + 6, face: 0, ring: { cx: HM.x, cz: HM.z + 2, r: 6, from: -Math.PI, to: Math.PI, cluster: true }, name: '活米村' },
  broomsticks: { x: HM.x - 3, z: HM.z - 4, face: 0.6, name: '三根掃帚門口' },
  // 露娜常去的地方：湖邊與禁忌森林邊緣
  lakeside: { x: BH.x + 28, z: BH.z - 8, face: PI, name: '黑湖邊' },
  forestEdge: { x: H.x + 26, z: H.z + 16, face: 0.9, name: '禁忌森林邊緣' },
  // 夜騏與翡冷翠：森林邊緣再往裡一點
  thestrals: { x: H.x + 34, z: H.z + 24, face: 0.9, ring: { cx: H.x + 34, cz: H.z + 24, r: 4, from: -Math.PI, to: Math.PI }, name: '禁忌森林邊緣' },
  forestDeep: { x: H.x + 30, z: H.z + 30, face: 2.4, name: '禁忌森林' },
  // 巴嘴拴在小屋旁的南瓜田邊
  paddock: { x: H.x - 4, z: H.z - 20, face: -1.2, name: '海格的小屋旁' },
  quad: { x: 24, z: 44, face: 0.4, ring: { cx: 22, cz: 42, r: 6, from: -PI, to: PI, cluster: true }, name: '中庭' },
};
