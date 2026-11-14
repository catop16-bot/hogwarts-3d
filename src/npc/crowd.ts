import { type NpcDef, say, free } from './common';
import { type Slot, type TimeCtx, studentDay, COMMON_ROOMS, HOUSE_NAMES } from './schedule';

/** 第 4 批：沒有名字的路人學生。每個學院 12 人，共用 6 種外觀（tools/blender/specs.py 的 CROWD） */

/** 具名角色與幽靈已經佔用的長凳座位（見 roster.ts、students.ts、creatures.ts） */
const USED: Record<number, number[]> = {
  0: [2, 4, 10, 11, 12, 14, 15, 17, 20, 24, 25, 52],
  1: [10, 12, 13, 14, 53],
  2: [8, 14, 52],
  3: [10, 11, 12, 13, 53],
};
/** 看台號碼從具名學生之後接著排 */
const STAND0 = [11, 4, 2, 4];
const PER_HOUSE = 12;
const YEARS = ['一', '二', '三', '四', '五', '六', '七'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 下課時的去處：依人與星期變化 */
function wander(id: string, house: number, c: TimeCtx): Slot {
  const k = (hash(id) + c.weekday * 7 + Math.floor(c.hour / 2)) % 5;
  if (k === 0) return free('library', 'seat', '在圖書館讀書', 'sit_read');
  if (k === 1) return free('corridor', 'stand', '在一樓走廊', 'talk');
  if (k === 2) return { scene: COMMON_ROOMS[house], at: 'seat', pose: 'sit_talk', doing: '在交誼廳', tag: 'free' };
  return free(undefined, 'out:quad', '在中庭聊天', 'talk');
}

function crowdStudent(house: number, i: number, seat: number): NpcDef {
  const id = `crowd${house}_${i}`;
  const year = (hash(id) % 7) + 1;
  const female = (i % 6) % 2 === 1;
  return {
    id,
    name: `${HOUSE_NAMES[house]}的學生`,
    title: `${YEARS[year - 1]}年級`,
    model: `crowd_${house}_${i % 6}`,
    kind: 'student',
    house,
    crowd: true,
    routine: (c) =>
      studentDay(c, {
        house, seat, stand: STAND0[house] + i, dorm: !female, hogsmeade: year >= 3,
        free: (c) => wander(id, house, c),
      }),
    lines: (k) =>
      say(k, {
        curfew: ['噓！別讓飛七聽到。'],
        sleep: ['……（睡得正熟）'],
        class: ['（他們正專心抄筆記，沒空理你）', '（她低聲問你剛剛教授說了什麼）'],
        meal: ['（他們聊得正開心，朝你揮了揮手）', '（有人遞給你一盤烤馬鈴薯）'],
        free: ['（他們朝你點點頭，又繼續聊天）', `${HOUSE_NAMES[k.house] === HOUSE_NAMES[house] ? '嘿，同學院的！' : '你是哪個學院的？'}`],
        evening: ['（交誼廳裡很溫暖，有人在下巫師棋）'],
      }),
  };
}

export const CROWD: NpcDef[] = [];
for (let h = 0; h < 4; h++) {
  const freeSeats = Array.from({ length: 48 }, (_, j) => j).filter((j) => !USED[h].includes(j));
  for (let i = 0; i < PER_HOUSE; i++) {
    const seat = freeSeats[Math.round((i * (freeSeats.length - 1)) / (PER_HOUSE - 1))];
    CROWD.push(crowdStudent(h, i, seat));
  }
}
