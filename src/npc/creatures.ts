import { type NpcDef, say, work } from './common';
import { type Slot, type TimeCtx, feast, period, teachSlot } from './schedule';
import { STAFF } from './staff';

/** 第 3 批：學院幽靈、家庭小精靈、動物與奇獸 */

// ------------------------------------------------------------------ 幽靈
/** 大廳裡飄在各學院長桌尾端的位置（第 27 個座位） */
const tableEnd = (house: number) => `greatHall.t${house}.${house % 2 ? 53 : 52}`;

interface GhostOpts {
  house: number;
  day: (c: TimeCtx) => Slot;
  evening: (c: TimeCtx) => Slot;
  night: (c: TimeCtx) => Slot;
}
/** 學院幽靈：吃飯時間與晚宴飄在學院長桌旁，其餘時間在塔裡、走廊上遊蕩 */
function ghostDay(c: TimeCtx, o: GhostOpts): Slot {
  const { p } = period(c.hour);
  if (feast(c) || p === 'breakfast' || p === 'dinner') return { scene: 'greatHall', at: tableEnd(o.house), pose: 'float', doing: '飄在大廳的學院長桌旁', tag: feast(c) ? 'feast' : 'meal' };
  if (p === 'night') return o.night(c);
  if (p === 'evening') return o.evening(c);
  return o.day(c);
}
const drift = (scene: string, doing: string): Slot => ({ scene, at: 'stand', pose: 'float', doing, tag: 'free' });
const haunt = (scene: string, doing: string): Slot => ({ scene, at: 'patrol', pose: 'float', doing, tag: 'patrol' });

const GHOSTS: NpcDef[] = [
  {
    id: 'nick', name: '差點沒頭的尼克', title: '葛來分多的學院幽靈', model: 'nick', kind: 'ghost', ghost: true, hover: 0.25,
    routine: (c) => ghostDay(c, { house: 0, day: () => drift('gryffindorCommon', '在葛來分多交誼廳飄來飄去'), evening: () => haunt('corridor', '在一樓走廊散步'), night: () => drift('gryffindorStairs', '在葛來分多塔的樓梯間發呆') }),
    lines: (k) => say(k, {
      free: ['我生前可是一位爵士，請多指教。', '我的脖子？只差一點點就斷乾淨了，說來話長。', '今年的忌辰派對，你要不要來參加？'],
      meal: ['真羨慕你們還吃得到東西。', '葛來分多今年一定要拿到學院盃！'],
      patrol: ['晚安。別害怕，我只是路過——穿過去。'],
    }),
  },
  {
    id: 'friar', name: '胖修士', title: '赫夫帕夫的學院幽靈', model: 'friar', kind: 'ghost', ghost: true, hover: 0.25,
    routine: (c) => ghostDay(c, { house: 1, day: () => drift('hufflepuffCommon', '在赫夫帕夫交誼廳'), evening: () => haunt('dungeonCorridor', '在地窖走廊遊蕩'), night: () => drift('kitchens', '在廚房看小精靈做事') }),
    lines: (k) => say(k, {
      free: ['孩子，祝你今天一切順利。', '原諒別人，比記恨輕鬆多了。', '廚房的小精靈們都很善良，記得跟他們道謝。'],
      meal: ['多吃一點，長得壯壯的。'],
      patrol: ['迷路了嗎？赫夫帕夫的交誼廳就在前面右轉。'],
    }),
  },
  {
    id: 'baron', name: '血腥男爵', title: '史萊哲林的學院幽靈', model: 'baron', kind: 'ghost', ghost: true, hover: 0.3,
    routine: (c) => ghostDay(c, { house: 3, day: () => drift('slytherinCommon', '在史萊哲林交誼廳'), evening: () => haunt('dungeonCorridor', '在地窖走廊遊蕩'), night: () => haunt('staircase', '在大樓梯上遊蕩') }),
    lines: (k) => say(k, {
      free: ['……', '（他盯著你看了很久，一句話也沒說）'],
      meal: ['……'],
      patrol: ['（鎖鏈的聲音在走廊裡迴盪）'],
      byHouse: (h) => (h === 3 ? '……史萊哲林的。很好。' : null),
    }),
  },
  {
    id: 'greylady', name: '灰衣貴婦', title: '雷文克勞的學院幽靈', model: 'greylady', kind: 'ghost', ghost: true, hover: 0.3,
    routine: (c) => ghostDay(c, { house: 2, day: () => drift('library', '在圖書館的書架之間'), evening: () => drift('ravenclawCommon', '在雷文克勞交誼廳'), night: () => drift('ravenclawReading', '在雷文克勞閱覽室窗邊') }),
    lines: (k) => say(k, {
      free: ['……你想找什麼？', '有些東西，失去了就再也找不回來。', '智慧不是用來炫耀的。'],
      meal: ['（她安靜地飄著，沒有看任何人）'],
    }),
  },
  {
    id: 'myrtle', name: '愛哭鬼麥朵', title: '住在二樓女廁的幽靈', model: 'myrtle', kind: 'ghost', ghost: true, hover: 0.2,
    routine: (c) => (c.weekday % 2 === 1 && c.hour >= 20 && c.hour < 22 ? drift('prefectsBath', '躲在級長浴室的水龍頭裡') : drift('myrtle', '在她的廁所裡哭')),
    lines: (k) => say(k, {
      free: ['你是來嘲笑我的嗎？大家都這樣。', '嗚……沒有人會來這間廁所，除了要找我出氣的人。', '你知道我是怎麼死的嗎？……不想知道？哼。'],
    }),
  },
  {
    id: 'binns', name: '丙斯教授', title: '魔法史教授（幽靈）', model: 'binns', kind: 'ghost', ghost: true, hover: 0.15,
    routine: (c) => {
      const t = teachSlot('binns', c);
      if (t) return { ...t, pose: 'float' };
      return { scene: 'history', at: 'board', pose: 'float', doing: '在魔法史教室裡（他好像沒發現自己已經死了）', tag: 'work' };
    },
    lines: (k) => say(k, {
      teach: ['……於是，在西元一二八九年，妖精們第三次……', '……接下來我們要講的是，巫師議會的第十七次……'],
      work: ['嗯？你是……奧布萊特同學嗎？', '下課了嗎？我還沒講到重點。'],
    }),
  },
  {
    id: 'peeves', name: '皮皮鬼', title: '搗蛋的騷靈', model: 'peeves', kind: 'ghost', hover: 0.7,
    routine: (c) => {
      // 每 45 分鐘換一個地方搗蛋
      const spots: [string, string][] = [['corridor', '在一樓走廊丟粉筆'], ['staircase', '在大樓梯上扮鬼臉'], ['trophyRoom', '在獎盃室敲盔甲'], ['entrance', '在入口大廳亂唱歌'], ['library', '在圖書館弄亂書架'], ['dungeonCorridor', '在地窖走廊吹口哨']];
      const k = Math.floor(c.hour / 0.75 + c.weekday * 5) % spots.length;
      return { scene: spots[k][0], at: 'patrol', pose: 'float', doing: spots[k][1], tag: 'free' };
    },
    lines: (k) => say(k, {
      free: ['嘿嘿嘿！有個小可愛迷路囉！', '要不要來一顆水球？免費的！', '飛七來了！快跑——騙你的！'],
      patrol: ['嘿嘿嘿！有個小可愛迷路囉！', '要不要來一顆水球？免費的！'],
    }),
  },
];

// ------------------------------------------------------------------ 家庭小精靈
function elf(id: string, name: string, title: string, model: string, night: string, lines: string[]): NpcDef {
  return {
    id, name, title, model, kind: 'elf', speed: 1.1,
    routine: (c) => {
      const h = c.hour;
      // 宵禁後到各學院交誼廳打掃，其餘時間在廚房做菜
      if (h >= 23 || h < 4.5) return { scene: night, at: 'stand', pose: 'stir', doing: '趁大家睡覺時打掃', tag: 'work' };
      return work('kitchens', 'stand', h % 6 < 1.5 ? '在廚房準備下一餐' : '在廚房洗碗', 'stir');
    },
    lines: (k) => say(k, { work: lines }),
  };
}

const ELVES: NpcDef[] = [
  elf('dobby', '多比', '自由的家庭小精靈', 'dobby', 'gryffindorCommon', ['多比是自由的小精靈！多比自己選擇在這裡工作！', '您要喝點什麼嗎？多比可以馬上幫您準備。', '多比最近織了一雙新襪子，左右不一樣，多比很喜歡。']),
  elf('winky', '眨眨', '家庭小精靈', 'winky', 'hufflepuffCommon', ['眨眨……眨眨很好，不用管眨眨。', '好的家庭小精靈不該到處說話。']),
  elf('elf_a', '家庭小精靈', '在廚房工作的小精靈', 'elf_a', 'ravenclawCommon', ['需要什麼嗎？我們可以為您做點心！', '廚房正下方就是大廳，餐點會直接傳上去。']),
  elf('elf_b', '家庭小精靈', '在廚房工作的小精靈', 'elf_b', 'slytherinCommon', ['（他深深鞠了一躬，鼻子差點碰到地板）', '請問要不要來塊蛋糕？']),
  elf('elf_c', '家庭小精靈', '在廚房工作的小精靈', 'elf_c', 'gryffindorCommon', ['今晚是約克夏布丁和烤牛肉！', '請不要告訴別人您來過廚房喔。']),
];

// ------------------------------------------------------------------ 動物與奇獸
const animal = (d: Omit<NpcDef, 'kind'>): NpcDef => ({ ...d, kind: 'animal' });
const find = (id: string) => STAFF.find((s) => s.id === id);
/** 別人此刻的安排（寵物跟著主人） */
let rosterRef: NpcDef[] = [];
export function bindRoster(all: NpcDef[]) {
  rosterRef = all;
}
const slotOf = (id: string, c: TimeCtx) => (rosterRef.find((r) => r.id === id) ?? find(id))?.routine(c) ?? null;

/** 早上送信：7:10–7:50 貓頭鷹在大廳上空盤旋 */
const post = (c: TimeCtx) => c.hour >= 7.15 && c.hour < 7.85 && !c.holiday;
const owl = (id: string, model: string, name: string): NpcDef =>
  animal({
    id, name, title: '學校的貓頭鷹', model, speed: 0.5, stride: 0.3,
    routine: (c) => (post(c) ? { scene: 'greatHall', at: 'circle:greatHall', pose: 'fly', doing: '在大廳上空送信', tag: 'work' } : { scene: 'owlery', at: 'perch', pose: 'idle', doing: '停在貓頭鷹屋的棲木上', tag: 'free' }),
    lines: (k) => say(k, { free: ['（牠把頭轉了大半圈，盯著你看）', '（嗚——牠輕輕叫了一聲）'], work: ['（牠叼著一封信，從你頭上飛過）'] }),
  });

const ANIMALS: NpcDef[] = [
  animal({
    id: 'hedwig', name: '嘿美', title: '哈利的雪梟', model: 'hedwig', speed: 0.5, stride: 0.3,
    routine: (c) => (post(c) ? { scene: 'greatHall', at: 'circle:greatHall', pose: 'fly', doing: '在大廳上空送信', tag: 'work' } : { scene: 'owlery', at: 'perch', pose: 'idle', doing: '停在貓頭鷹屋的棲木上', tag: 'free' }),
    lines: (k) => say(k, { free: ['（嘿美輕輕啄了一下你的手指，好像在問有沒有信要寄）', '（她把頭埋進翅膀裡，裝作沒看見你）'], work: ['（她叼著一封信，優雅地飛過長桌）'] }),
  }),
  owl('owl1', 'owl_a', '褐色的貓頭鷹'),
  owl('owl2', 'owl_b', '倉鴞'),
  owl('owl3', 'owl_a', '褐色的貓頭鷹'),
  owl('owl4', 'owl_b', '倉鴞'),
  animal({
    id: 'norris', name: '拿樂絲太太', title: '飛七的貓', model: 'norris', speed: 1.6, stride: 0.45,
    routine: (c) => (slotOf('filch', c) ? { at: 'follow:filch', pose: 'sit', doing: '跟在飛七腳邊', tag: 'patrol' } : { scene: 'filch', at: 'stand', pose: 'lie', doing: '在飛七的辦公室打盹', tag: 'free' }),
    lines: (k) => say(k, { free: ['（她用一雙燈泡似的黃眼睛盯著你）'], patrol: ['（她盯著你看了一眼，好像要去跟飛七告狀）', '（喵——）'] }),
  }),
  animal({
    id: 'crookshanks', name: '歪腿', title: '妙麗的貓', model: 'crookshanks', speed: 1.5, stride: 0.5,
    routine: (c) => (slotOf('hermione', c)?.scene === 'gryffindorCommon' ? { at: 'follow:hermione', pose: 'sit', doing: '窩在妙麗旁邊', tag: 'free' } : { scene: 'gryffindorCommon', at: 'seat', pose: 'lie', doing: '霸佔交誼廳的扶手椅', tag: 'free' }),
    lines: (k) => say(k, { free: ['（歪腿瞇起眼睛，尾巴慢慢地甩了兩下）', '（牠聞了聞你的袍子，好像在找什麼）'] }),
  }),
  animal({
    id: 'scabbers', name: '斑斑', title: '榮恩的老鼠', model: 'scabbers', speed: 1.2, stride: 0.15,
    routine: (c) => {
      const r = slotOf('ron', c);
      return r && (r.scene === 'gryffindorCommon' || r.scene === 'gryffindorDorm') ? { at: 'follow:ron', pose: 'sit', doing: '在榮恩腳邊', tag: 'free' } : { scene: 'gryffindorDorm', at: 'bed', pose: 'lie', doing: '縮在榮恩的床上睡覺', tag: 'free' };
    },
    lines: (k) => say(k, { free: ['（斑斑一溜煙鑽到了床底下）', '（牠在睡覺，少了一根腳趾的爪子動了一下）'] }),
  }),
  animal({
    id: 'trevor', name: '吹寶', title: '奈威的蟾蜍', model: 'trevor', speed: 0.3, stride: 0.1,
    routine: (c) => {
      // 吹寶常常不見，每天跑去不同的地方
      const day = Math.floor(c.weekday + c.month * 31 + c.date);
      const where: Slot[] = [
        { scene: 'greenhouse', at: 'stand', pose: 'idle', doing: '躲在溫室的花盆旁', tag: 'free' },
        { scene: 'corridor', at: 'stand', pose: 'idle', doing: '在一樓走廊的角落', tag: 'free' },
        { at: 'out:lakeside', pose: 'idle', doing: '在湖邊曬太陽', tag: 'free' },
        { scene: 'gryffindorCommon', at: 'stand', pose: 'idle', doing: '在交誼廳的地毯上', tag: 'free' },
      ];
      return where[day % where.length];
    },
    lines: (k) => say(k, { free: ['（呱。）', '（吹寶又跑出來了，奈威一定在找牠）'] }),
  }),
  animal({
    id: 'fawkes', name: '佛客使', title: '鄧不利多的鳳凰', model: 'fawkes', speed: 0.5, stride: 0.3,
    routine: () => ({ scene: 'headmasterOffice', at: 'perch', pose: 'idle', doing: '停在校長室的棲架上', tag: 'free' }),
    lines: (k) => say(k, { free: ['（佛客使輕輕鳴叫，那聲音讓你心裡暖了起來）', '（一根金紅色的羽毛飄落在地上）'] }),
  }),
  animal({
    id: 'fang', name: '牙牙', title: '海格的獵犬', model: 'fang', speed: 1.8, stride: 1.0,
    routine: (c) => {
      const h = slotOf('hagrid', c);
      return h && (!h.scene || h.scene === 'hagrid') ? { at: 'follow:hagrid', pose: 'lie', doing: '跟在海格身邊', tag: 'free' } : { scene: 'hagrid', at: 'stand', pose: 'lie', doing: '在小屋裡等海格回來', tag: 'free' };
    },
    lines: (k) => say(k, { free: ['（牙牙把頭靠在你膝蓋上，口水滴了一地）', '（汪！牠興奮地搖著尾巴）', '（牠看起來很兇，其實是個膽小鬼）'] }),
  }),
  animal({
    id: 'buckbeak', name: '巴嘴', title: '鷹馬', model: 'buckbeak', speed: 1.5, stride: 1.8,
    routine: (c) => ({ at: 'out:paddock', pose: c.hour < 6 || c.hour >= 21 ? 'lie' : Math.floor(c.hour) % 2 ? 'graze' : 'idle', doing: '拴在海格的小屋旁', tag: 'free' }),
    lines: (k) => say(k, { free: ['（巴嘴用橘色的眼睛盯著你。也許你該先鞠個躬？）', '（你鞠了個躬，巴嘴也慢慢屈膝回禮）', '（牠拍了拍翅膀，甩掉身上的露水）'] }),
  }),
  ...[0, 1, 2].map((i) =>
    animal({
      id: `thestral${i}`, name: '夜騏', title: '只有見過死亡的人才看得見的飛馬', model: 'thestral', speed: 1.4, stride: 1.8,
      routine: (c: TimeCtx) => ({ at: 'out:thestrals', pose: c.hour < 6 || c.hour >= 22 ? 'lie' : (i + Math.floor(c.hour)) % 3 ? 'graze' : 'idle', doing: '在禁忌森林邊緣吃草', tag: 'free' }),
      lines: (k) => say(k, { free: ['（骨瘦如柴的黑色身影，白色的眼睛沒有瞳孔……牠靜靜地看著你）', '（牠低頭聞了聞你的手，似乎不怕人）'] }),
    }),
  ),
  animal({
    id: 'firenze', name: '翡冷翠', title: '人馬・占卜學教授', model: 'firenze', speed: 1.6, stride: 1.8,
    routine: (c) =>
      c.weekday < 5 && !c.holiday && c.hour >= 9 && c.hour < 16.5
        ? { scene: 'classroom11', at: 'stand', pose: 'idle', doing: '在第十一號教室觀察星象', tag: 'work' }
        : { at: 'out:forestDeep', pose: c.hour >= 22 || c.hour < 6 ? 'lie' : 'idle', doing: '在禁忌森林裡', tag: 'free' },
    lines: (k) => say(k, {
      work: ['星辰的運行比人類的預言誠實得多。', '今晚的星星排得很不尋常。', '躺下來，看看天花板上的星空。'],
      free: ['森林不歡迎太多好奇的訪客，年輕人。', '人馬族不為巫師效力，我只是選擇在這裡教書。'],
    }),
  }),
];

export const CREATURES: NpcDef[] = [...GHOSTS, ...ELVES, ...ANIMALS];
