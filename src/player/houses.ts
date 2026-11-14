export interface HouseDef {
  id: string;
  name: string;
  primary: number;
  secondary: number;
}
export const HOUSES: HouseDef[] = [
  { id: 'gryffindor', name: '葛來分多', primary: 0x7a0d15, secondary: 0xd9a521 },
  { id: 'hufflepuff', name: '赫夫帕夫', primary: 0xe0a920, secondary: 0x151515 },
  { id: 'ravenclaw', name: '雷文克勞', primary: 0x12245e, secondary: 0x9aa3ad },
  { id: 'slytherin', name: '史萊哲林', primary: 0x17502c, secondary: 0xa9b0b4 },
];

export type MoveMode = 'walk' | 'broom' | 'swim';
export interface AnimState {
  speed: number; // 水平速度（公尺／秒）
  vy: number;
  grounded: boolean;
  mode: MoveMode;
  bank: number; // 飛行時的側傾
  /** 轉身的角速度（弧度／秒），用來讓身體往彎道內側傾 */
  turn?: number;
}

