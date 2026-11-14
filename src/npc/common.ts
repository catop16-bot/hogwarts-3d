import { type Slot, type TimeCtx, staffMeal, teachSlot, matchOn, HOUSE_NAMES } from './schedule';

export interface TalkCtx {
  slot: Slot;
  c: TimeCtx;
  /** 玩家的學院 */
  house: number;
  /** 宵禁時間（21:00 以後）玩家還在外面晃 */
  curfew: boolean;
}

export interface NpcDef {
  id: string;
  name: string;
  /** 角色定位 */
  title: string;
  /** public/models/npc/ 底下的模型檔名 */
  model: string;
  kind: 'staff' | 'student' | 'ghost' | 'elf' | 'animal';
  house?: number;
  /** 沒有名字的路人：不投影、動畫更新得比較慢、不列在人物清單裡 */
  crowd?: boolean;
  /** 半透明的幽靈材質 */
  ghost?: boolean;
  /** 離地飄浮的高度（幽靈、皮皮鬼） */
  hover?: number;
  /** 走路速度（公尺／秒）與一個步伐循環的距離；動物用 */
  speed?: number;
  stride?: number;
  /** 此刻在哪裡；null 表示不在城堡（放假回家、在沒做出來的地方睡覺） */
  routine: (c: TimeCtx) => Slot | null;
  lines: (k: TalkCtx) => string[];
}

export const free = (scene: string | undefined, at: string, doing: string, pose?: Slot['pose']): Slot => ({ scene, at, doing, pose, tag: 'free' });
export const work = (scene: string | undefined, at: string, doing: string, pose?: Slot['pose']): Slot => ({ scene, at, doing, pose, tag: 'work' });

// ------------------------------------------------------------------ 魁地奇
/** 各隊練球的日子：葛來分多三、五，史萊哲林二、四，雷文克勞一，赫夫帕夫星期六上午 */
const PRACTICE: Record<number, number[]> = { 0: [2, 4], 3: [1, 3], 2: [0], 1: [5] };
export function practice(c: TimeCtx, house: number, num: number): Slot | null {
  if (c.holiday || !PRACTICE[house].includes(c.weekday)) return null;
  const on = house === 1 ? c.hour >= 10 && c.hour < 12 : c.hour >= 16.5 && c.hour < 18.5;
  if (!on) return null;
  return { at: `fly:${30 + house * 7 + num}`, pose: 'broom', doing: `在練魁地奇（${HOUSE_NAMES[house]}隊）`, tag: 'free' };
}
/** 有沒有哪一隊在練球（胡奇夫人會在場邊） */
export function anyPractice(c: TimeCtx) {
  return [0, 1, 2, 3].some((h) => practice(c, h, 0));
}

// ------------------------------------------------------------------ 教職員一天的作息
export interface StaffOpts {
  /** 大廳教師席的椅子（0–10）；沒有的人不在大廳吃飯 */
  chair: number | null;
  /** 優先的特別安排：回傳 undefined 表示照平常 */
  special?: (c: TimeCtx) => Slot | null | undefined;
  /** 白天沒課時的去處 */
  work: (c: TimeCtx) => Slot;
  /** 晚餐後的去處（預設同白天） */
  evening?: (c: TimeCtx) => Slot;
  /** 幾點以後就寢（不在場）；可以超過 24 */
  until?: number;
  /** 幾點起床 */
  from?: number;
}

export function staffDay(id: string, c: TimeCtx, o: StaffOpts): Slot | null {
  const sp = o.special?.(c);
  if (sp !== undefined) return sp;
  if (o.chair != null) {
    const m = staffMeal(c, o.chair);
    if (m) return m;
  } else if (matchOn(c)) return null;
  const t = teachSlot(id, c);
  if (t) return t;
  const h = c.hour;
  const until = o.until ?? 23;
  const from = o.from ?? 6.5;
  const asleep = until >= 24 ? h >= until - 24 && h < from : h >= until || h < from;
  if (asleep) return null;
  if ((h >= 18.5 || h < from) && o.evening) return o.evening(c);
  return o.work(c);
}

// ------------------------------------------------------------------ 對白
export interface Say {
  curfew?: string[];
  sleep?: string[];
  class?: string[];
  teach?: string[];
  meal?: string[];
  feast?: string[];
  event?: string[];
  work?: string[];
  free?: string[];
  evening?: string[];
  patrol?: string[];
  hogsmeade?: string[];
  fly?: string[];
  /** 依玩家的學院多加一句 */
  byHouse?: (h: number) => string | null;
}

const DEFAULTS: Partial<Record<Slot['tag'] | 'hogsmeade' | 'fly', string[]>> = {
  sleep: ['……（睡得正熟）'],
  event: ['快看！他們飛得好快！', '這一球要是進了就領先了！'],
  hogsmeade: ['三根掃帚的奶油啤酒，冬天喝最暖了。', '蜂蜜公爵今天人好多。'],
  fly: ['（在天上飛，聽不到你說話）'],
};

export function say(k: TalkCtx, s: Say): string[] {
  if (k.curfew && s.curfew) return s.curfew;
  const tag = k.slot.tag;
  const d = k.slot.doing;
  let pick: string[] | undefined;
  if (d.includes('活米村')) pick = s.hogsmeade ?? DEFAULTS.hogsmeade;
  else if (k.slot.at.startsWith('fly:')) pick = s.fly ?? DEFAULTS.fly;
  else pick = s[tag] ?? (tag === 'feast' ? s.meal : tag === 'evening' ? s.free : tag === 'patrol' ? s.work : undefined) ?? DEFAULTS[tag] ?? s.free;
  pick ??= ['……'];
  const extra = s.byHouse?.(k.house);
  return extra && (tag === 'free' || tag === 'evening' || tag === 'work' || tag === 'meal') ? [...pick, extra] : pick;
}
