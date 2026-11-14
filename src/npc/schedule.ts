import type { TimeSystem } from '../environment/timeSystem';
import { monthDayFrom } from '../environment/timeSystem';

/** NPC 會用到的動作片段（tools/blender/rig.py 的 NPC_ACTIONS） */
export type Clip =
  | 'idle' | 'walk' | 'run' | 'broom' | 'sit' | 'sit_talk' | 'sit_read' | 'talk' | 'teach' | 'wave' | 'cast'
  | 'stir' | 'read' | 'sleep' | 'float' | 'arms_crossed' | 'hands_back'
  // 動物
  | 'fly' | 'graze' | 'lie';

/** 某個時刻某人該在的地方 */
export interface Slot {
  /** 場景 id（SCENES）；省略表示在戶外 */
  scene?: string;
  /**
   * 位置：'seat' 場景裡的座位、'bed' 床、'board' 黑板前、'work' 大釜或花台前、'stand' 場景裡的空地、'patrol' 在場景裡來回走、
   * 'out:名稱' 戶外地點（places.ts）、'fly:編號' 沿魁地奇路線飛、'follow:角色' 跟在某人旁邊、
   * 'circle:名稱' 在某處上空盤旋（places.ts 的 CIRCLES）、'perch' 棲架、其餘是手動錨點 id（例如 greatHall.staff.5）
   */
  at: string;
  pose?: Clip;
  /** 人物清單與對話裡的說明，例如「在上變形學」 */
  doing: string;
  /** 對白分類 */
  tag: 'meal' | 'class' | 'teach' | 'free' | 'evening' | 'sleep' | 'patrol' | 'work' | 'feast' | 'event';
  subject?: Subject;
}

export interface TimeCtx {
  hour: number;
  /** 0 = 星期一 … 6 = 星期日 */
  weekday: number;
  month: number;
  date: number;
  /** 月相：0 新月、0.5 滿月 */
  moon: number;
  holiday: 'christmas' | 'summer' | null;
  /** 當天的特別活動 */
  event: 'term' | 'halloween' | 'quidditch' | 'christmas' | null;
  /** 今天的魁地奇比賽（兩隊的學院） */
  match: Match | null;
  /** 這個星期六可以去活米村（隔週一次） */
  hogsmeade: boolean;
  /** 滿月前後（路平不在） */
  fullMoon: boolean;
}

export interface Match {
  month: number;
  day: number;
  teams: [number, number];
}
/** 魁地奇比賽日（與 fx/events.ts 的方塊球員同步） */
export const MATCHES: Match[] = [
  { month: 11, day: 9, teams: [0, 3] },
  { month: 2, day: 22, teams: [2, 1] },
  { month: 5, day: 24, teams: [0, 2] },
];

export const WEEKDAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

export function timeCtx(t: TimeSystem): TimeCtx {
  const day = Math.floor(t.t);
  const { month, day: date } = monthDayFrom(t.doy);
  // 讓 9 月 1 日落在星期日：開學晚宴之後隔天就上課
  const weekday = (((day + 1) % 7) + 7) % 7;
  const md = month * 100 + date;
  const holiday = md >= 1220 || md <= 105 ? 'christmas' : md >= 625 && md <= 831 ? 'summer' : null;
  const event = md === 901 ? 'term' : md === 1031 ? 'halloween' : md === 1109 ? 'quidditch' : md === 1225 ? 'christmas' : null;
  const match = MATCHES.find((m) => m.month === month && m.day === date) ?? null;
  const hogsmeade = weekday === 5 && Math.floor(day / 7) % 2 === 0 && !holiday;
  // 月相直接由時間算（與 TimeSystem 相同公式），不必等下一幀更新
  const moon = (((t.t + 9) / 29.53) % 1 + 1) % 1;
  const fullMoon = Math.abs(moon - 0.5) < 0.04;
  return { hour: t.hour, weekday, month, date, moon, holiday, event, match, hogsmeade, fullMoon };
}

// ------------------------------------------------------------------ 一天的時段
export type Period = 'night' | 'wake' | 'breakfast' | 'morning' | 'class' | 'lunch' | 'free' | 'dinner' | 'evening';
/** 四堂課的開始與結束（小時） */
export const CLASS_TIMES: [number, number][] = [[9, 10.5], [10.75, 12.25], [13.5, 15], [15.15, 16.5]];

export function period(h: number): { p: Period; k: number } {
  if (h < 6.75 || h >= 22.5) return { p: 'night', k: -1 };
  if (h < 7) return { p: 'wake', k: -1 };
  if (h < 8.5) return { p: 'breakfast', k: -1 };
  for (let k = 0; k < CLASS_TIMES.length; k++) if (h >= CLASS_TIMES[k][0] && h < CLASS_TIMES[k][1]) return { p: 'class', k };
  if (h < 9) return { p: 'morning', k: -1 };
  if (h >= 12.25 && h < 13.5) return { p: 'lunch', k: -1 };
  if (h < 16.5) return { p: 'free', k: -1 };
  if (h < 18.5) return { p: 'free', k: -1 };
  if (h < 19.5) return { p: 'dinner', k: -1 };
  return { p: 'evening', k: -1 };
}

// ------------------------------------------------------------------ 課表
export type Subject = 'T' | 'C' | 'H' | 'Hi' | 'P' | 'D' | 'Cr' | 'Dv' | 'Ar' | 'Ru' | 'Mu' | 'As';
interface SubjectDef {
  name: string;
  scene?: string;
  /** 學生在教室裡的位置；溫室與魔藥學是站著的 */
  at: string;
  pose: Clip;
  teacher: string;
}
export const SUBJECTS: Record<Subject, SubjectDef> = {
  T: { name: '變形學', scene: 'transfiguration', at: 'seat', pose: 'sit', teacher: 'mcgonagall' },
  C: { name: '符咒學', scene: 'charms', at: 'seat', pose: 'sit', teacher: 'flitwick' },
  H: { name: '藥草學', scene: 'greenhouse', at: 'work', pose: 'idle', teacher: 'sprout' },
  Hi: { name: '魔法史', scene: 'history', at: 'seat', pose: 'sit_read', teacher: 'binns' },
  P: { name: '魔藥學', scene: 'potions', at: 'work', pose: 'stir', teacher: 'snape' },
  D: { name: '黑魔法防禦術', scene: 'dada', at: 'seat', pose: 'sit', teacher: 'lupin' },
  Cr: { name: '奇獸飼育學', at: 'out:hagridClass', pose: 'idle', teacher: 'hagrid' },
  Dv: { name: '占卜學', scene: 'divination', at: 'seat', pose: 'sit', teacher: 'trelawney' },
  // 選修課：只有高年級，具名學生裡只有妙麗修
  Ar: { name: '算命學', scene: 'arithmancy', at: 'seat', pose: 'sit', teacher: 'vector' },
  Ru: { name: '古代魔文', scene: 'runes', at: 'seat', pose: 'sit_read', teacher: 'babbling' },
  Mu: { name: '麻瓜研究', scene: 'muggleStudies', at: 'seat', pose: 'sit', teacher: 'burbage' },
  As: { name: '天文學', scene: 'astronomyDeck', at: 'stand', pose: 'idle', teacher: 'sinistra' },
};
/** 選修課的時間 [星期, 第幾堂] */
export const ELECTIVES: Partial<Record<Subject, [number, number][]>> = {
  Ar: [[0, 3], [2, 3], [4, 2]],
  Ru: [[1, 0], [3, 1], [4, 1]],
  Mu: [[0, 0], [2, 1], [4, 3]],
};
/** 天文學在星期三深夜（23:00–24:00）上，葛來分多和雷文克勞 */
export function astronomyNight(c: TimeCtx) {
  return c.weekday === 2 && c.hour >= 23 && !c.holiday;
}

type Day = (Subject | null)[];
/** 各學院平日的課表 [星期一..五][第 1..4 堂]；魔藥學與奇獸飼育學是葛來分多和史萊哲林一起上 */
export const TIMETABLE: Day[][] = [
  // 葛來分多
  [['T', 'C', 'H', 'Hi'], ['Dv', 'C', 'D', 'Cr'], ['H', 'T', 'Hi', null], ['D', null, 'P', 'Cr'], ['P', 'P', 'T', null]],
  // 赫夫帕夫
  [['C', 'T', 'H', 'D'], ['Hi', 'D', 'T', 'C'], ['H', 'C', 'D', null], ['T', 'C', 'H', 'Hi'], ['D', 'Hi', 'C', null]],
  // 雷文克勞
  [['D', 'Hi', 'T', 'H'], ['C', 'T', 'H', 'Hi'], ['T', 'Hi', 'C', null], ['C', 'D', 'T', 'H'], ['Hi', 'T', 'D', null]],
  // 史萊哲林
  [['P', 'P', 'D', 'C'], ['T', 'H', 'Hi', 'Cr'], ['C', 'D', 'T', null], ['Hi', 'T', 'P', 'Cr'], ['P', 'P', 'H', null]],
];

/** 這一堂這個學院上什麼課（週末、假期沒課） */
export function lessonOf(house: number, c: TimeCtx, k: number): Subject | null {
  if (c.weekday > 4 || c.holiday || k < 0) return null;
  return TIMETABLE[house]?.[c.weekday]?.[k] ?? null;
}

/** 這一堂某位教授在教哪些學院（選修課的 houses 是空的） */
export function teaching(teacher: string, c: TimeCtx, k: number): { subject: Subject; houses: number[] } | null {
  if (c.weekday > 4 || c.holiday || k < 0) return null;
  // 滿月隔天路平請病假，由石內卜代課
  const who = teacher === 'snape' && lupinSick(c) ? ['snape', 'lupin'] : teacher === 'lupin' && lupinSick(c) ? [] : [teacher];
  for (const [s, times] of Object.entries(ELECTIVES) as [Subject, [number, number][]][]) {
    if (who.includes(SUBJECTS[s].teacher) && times.some(([d, kk]) => d === c.weekday && kk === k)) return { subject: s, houses: [] };
  }
  let found: { subject: Subject; houses: number[] } | null = null;
  for (let h = 0; h < 4; h++) {
    const s = TIMETABLE[h][c.weekday][k];
    if (s && who.includes(SUBJECTS[s].teacher)) {
      found ??= { subject: s, houses: [] };
      found.houses.push(h);
    }
  }
  return found;
}

export const HOUSE_NAMES = ['葛來分多', '赫夫帕夫', '雷文克勞', '史萊哲林'];
export const COMMON_ROOMS = ['gryffindorCommon', 'hufflepuffCommon', 'ravenclawCommon', 'slytherinCommon'];
export const DORMS = ['gryffindorDorm', 'hufflepuffDorm', 'ravenclawDorm', 'slytherinDorm'];

// ------------------------------------------------------------------ 常用的時段安排
export interface StudentOpts {
  house: number;
  /** 大廳長凳上的座位號 */
  seat: number;
  /** 聖誕假期留校 */
  staysForChristmas?: boolean;
  /** 有沒有寢室可以睡（女生寢室沒有做） */
  dorm?: boolean;
  /** 下課與週末的去處 */
  free: (c: TimeCtx) => Slot;
  /** 晚上（晚餐後到熄燈）的去處；預設在交誼廳 */
  evening?: (c: TimeCtx) => Slot;
  /** 沒課的那一堂另外修的選修課 */
  electives?: Subject[];
  /** 魁地奇球員：[學院隊上的編號 0–6]；比賽時在天上飛 */
  quidditch?: number;
  /** 去活米村的日子會去 */
  hogsmeade?: boolean;
  /** 比賽日看台上的位置（同學院依序排） */
  stand?: number;
  /** 星期五晚上（19:30–21:30）的社團：決鬥社或鼻涕蟲社 */
  club?: 'duel' | 'slug';
}

/** 依學院對應到看台塔（塔的顏色依序是葛來分多、史萊哲林、雷文克勞、赫夫帕夫） */
const TOWER_OF = [0, 3, 2, 1];
export function standSpot(house: number, n: number) {
  // 每個學院有四座塔，每座六個位置
  const tower = TOWER_OF[house] + 4 * (Math.floor(n / 6) % 4);
  return `pitch.tower.${tower}.${n % 6}`;
}

/** 比賽進行中（10:30–13:30） */
export function matchOn(c: TimeCtx) {
  return !!c.match && c.hour > 10.5 && c.hour < 13.5;
}

/** 滿月：當晚（18:00–6:00）路平不在；白天在醫院廂房休息 */
export function lupinSick(c: TimeCtx) {
  return c.fullMoon && c.hour >= 6 && c.hour < 18;
}
export function lupinGone(c: TimeCtx) {
  return c.fullMoon && (c.hour >= 18 || c.hour < 6);
}

const meal = (house: number, seat: number, h: number): Slot => ({
  scene: 'greatHall',
  at: `greatHall.t${house}.${seat}`,
  pose: h > 12 && h < 14 ? 'sit_talk' : 'sit',
  doing: h < 10 ? '在大廳吃早餐' : h < 15 ? '在大廳吃午餐' : '在大廳吃晚餐',
  tag: 'meal',
});

/** 學生一天的作息 */
export function studentDay(c: TimeCtx, o: StudentOpts): Slot | null {
  if (c.holiday === 'summer') return null;
  if (c.holiday === 'christmas' && !o.staysForChristmas) return null;
  const h = c.hour;
  if (c.event === 'term' && h < 19.5) return null; // 還在特快車上
  if (feast(c)) return { scene: 'greatHall', at: `greatHall.t${o.house}.${o.seat}`, pose: 'sit_talk', doing: c.event === 'term' ? '在開學晚宴上' : c.event === 'halloween' ? '在萬聖節晚宴上' : '在聖誕大餐上', tag: 'feast' };
  if (matchOn(c)) {
    const m = c.match!;
    if (o.quidditch != null && m.teams.includes(o.house)) {
      const side = m.teams.indexOf(o.house);
      return { at: `fly:${side * 7 + o.quidditch}`, pose: 'broom', doing: `在${HOUSE_NAMES[o.house]}隊上比賽`, tag: 'event' };
    }
    return { at: standSpot(o.house, o.stand ?? 0), pose: 'wave', doing: '在看台上看魁地奇比賽', tag: 'event' };
  }
  const { p, k } = period(h);
  if (astronomyNight(c) && (o.house === 0 || o.house === 2)) return { scene: 'astronomyDeck', at: 'stand', pose: 'idle', doing: '在天文塔上天文學', tag: 'class', subject: 'As' };
  if (c.hogsmeade && o.hogsmeade !== false && h >= 10.5 && h < 16.5) return { at: 'out:hogsmeade', pose: 'talk', doing: '在活米村逛街', tag: 'free' };
  if (p === 'night') return o.dorm === false ? null : { scene: DORMS[o.house], at: 'bed', pose: 'sleep', doing: '在寢室睡覺', tag: 'sleep' };
  if (p === 'wake') return o.dorm === false ? null : { scene: COMMON_ROOMS[o.house], at: 'stand', doing: '剛起床', tag: 'free' };
  if (p === 'breakfast' || p === 'lunch' || p === 'dinner') return meal(o.house, o.seat, h);
  if (p === 'class') {
    let s = lessonOf(o.house, c, k);
    if (!s && o.electives) s = o.electives.find((e) => ELECTIVES[e]?.some(([d, kk]) => d === c.weekday && kk === k)) ?? null;
    if (s) {
      const d = SUBJECTS[s];
      return { scene: d.scene, at: d.at, pose: d.pose, doing: `在上${d.name}`, tag: 'class', subject: s };
    }
  }
  if (o.club && c.weekday === 4 && h >= 19.5 && h < 21.5 && !c.holiday) {
    return o.club === 'duel'
      ? { scene: 'duelling', at: 'stand', pose: 'cast', doing: '在決鬥社練習', tag: 'free' }
      : { scene: 'slugClub', at: 'stand', pose: 'talk', doing: '在鼻涕蟲社的聚會上', tag: 'free' };
  }
  if (p === 'evening') return o.evening?.(c) ?? { scene: COMMON_ROOMS[o.house], at: 'seat', pose: 'sit_talk', doing: `在${HOUSE_NAMES[o.house]}交誼廳`, tag: 'evening' };
  return o.free(c);
}

/** 教職員吃飯：大廳教師席；開學、萬聖節與聖誕節晚宴也在這裡。比賽時在教職員的看台 */
export function staffMeal(c: TimeCtx, chair: number): Slot | null {
  const { p } = period(c.hour);
  if (matchOn(c)) return { at: `pitch.tower.${chair < 6 ? 13 : 14}.${chair % 6}`, pose: 'idle', doing: '在看台上看魁地奇比賽', tag: 'event' };
  if (feast(c)) return { scene: 'greatHall', at: `greatHall.staff.${chair}`, pose: 'sit_talk', doing: '在教師席上參加晚宴', tag: 'feast' };
  if (p === 'breakfast' || p === 'lunch' || p === 'dinner') {
    return { scene: 'greatHall', at: `greatHall.staff.${chair}`, pose: p === 'lunch' ? 'sit_talk' : 'sit', doing: '在教師席用餐', tag: 'meal' };
  }
  return null;
}

/** 晚宴時段：開學（19:30–21:00）、萬聖節與聖誕節（18:30–21:00） */
export function feast(c: TimeCtx) {
  if (c.event === 'term') return c.hour >= 19.5 && c.hour < 21;
  if (c.event === 'halloween' || c.event === 'christmas') return c.hour >= 18.5 && c.hour < 21;
  return false;
}

/** 這位教授這一堂有沒有課；有的話回傳上課的位置 */
export function teachSlot(teacher: string, c: TimeCtx): Slot | null {
  const { p, k } = period(c.hour);
  if (p !== 'class') return null;
  const t = teaching(teacher, c, k);
  if (!t) return null;
  const d = SUBJECTS[t.subject];
  const who = t.houses.map((h) => HOUSE_NAMES[h]).join('和');
  if (!d.scene) return { at: d.at === 'out:hagridClass' ? 'out:hagridTeach' : d.at, pose: 'talk', doing: `在幫${who}上${d.name}`, tag: 'teach', subject: t.subject };
  if (!who) return { scene: d.scene, at: 'board', pose: 'teach', doing: `在上${d.name}（高年級選修）`, tag: 'teach', subject: t.subject };
  return { scene: d.scene, at: 'board', pose: 'teach', doing: `在幫${who}上${d.name}`, tag: 'teach', subject: t.subject };
}
