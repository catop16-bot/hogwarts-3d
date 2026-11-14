import { type Slot, type TimeCtx, period, staffMeal, studentDay, teachSlot, feast, HOUSE_NAMES, SUBJECTS } from './schedule';
import { type NpcDef, free, work, practice } from './common';
import { STAFF } from './staff';
import { STUDENTS } from './students';
import { CREATURES, bindRoster } from './creatures';
import { CROWD } from './crowd';

export type { NpcDef, TalkCtx } from './common';

/** 下課時三人組常去的地方 */
function trioFree(c: TimeCtx, who: 'harry' | 'ron'): Slot {
  const h = c.hour;
  const weekend = c.weekday >= 5;
  if (weekend && c.weekday === 5 && h >= 10 && h < 12.25) return free('hagrid', 'seat', '在海格的小屋喝茶', 'sit_talk');
  const p = who === 'harry' ? practice(c, 0, 0) : null;
  if (p) return p;
  if (h >= 16.5 && h < 18.5 && who === 'ron') return free('gryffindorCommon', 'seat', '在交誼廳下巫師棋', 'sit_talk');
  return free(undefined, 'out:quad', '在中庭跟朋友聊天', 'talk');
}

const CORE: NpcDef[] = [
  // ---------------------------------------------------------------- 學生
  {
    id: 'harry',
    name: '哈利波特',
    title: '葛來分多學生・魁地奇搜捕手',
    model: 'harry',
    kind: 'student',
    house: 0,
    routine: (c) => studentDay(c, { house: 0, seat: 10, stand: 0, quidditch: 0, club: 'duel', staysForChristmas: true, free: (c) => trioFree(c, 'harry') }),
    lines: ({ slot, house, curfew }) => {
      if (curfew) return ['噓——小聲一點，飛七就在附近。', '你也睡不著？我常常半夜想到處走走。'];
      if (slot.tag === 'sleep') return ['……（他睡得很熟，眼鏡還放在枕頭旁邊）'];
      if (slot.tag === 'class') return ['下課再聊，教授在看這邊了。', '你筆記抄到哪裡了？借我看一下。'];
      if (slot.tag === 'meal' || slot.tag === 'feast') return ['坐下來一起吃吧，今天的約克夏布丁很好吃。', '剛剛貓頭鷹送信來，又是海格約我們去喝茶。'];
      if (slot.doing.includes('魁地奇')) return ['木透說下一場比賽之前每天都要練。', '騎掃帚的時候，什麼煩惱都會忘掉。'];
      return [
        house === 0 ? '嘿！晚點交誼廳見。' : `你是${HOUSE_NAMES[house]}的吧？下次球場上見。`,
        '海格說他最近又養了什麼新的動物……我有點擔心。',
        '如果你在城堡裡迷路了，按 M 看地圖。我一年級的時候也常迷路。',
      ];
    },
  },
  {
    id: 'ron',
    name: '榮恩衛斯理',
    title: '葛來分多學生・哈利最好的朋友',
    model: 'ron',
    kind: 'student',
    house: 0,
    routine: (c) => studentDay(c, { house: 0, seat: 11, stand: 1, club: 'duel', staysForChristmas: true, free: (c) => trioFree(c, 'ron') }),
    lines: ({ slot, house, curfew }) => {
      if (curfew) return ['你瘋了嗎？這麼晚還在外面，被石內卜抓到就完了。'];
      if (slot.tag === 'sleep') return ['……（他翻了個身，嘴裡嘟囔著什麼蜘蛛）'];
      if (slot.subject === 'P') return ['我的藥水又變成綠色了，應該是藍色才對吧？', '小聲點，他最喜歡找葛來分多扣分。'];
      if (slot.tag === 'class') return ['這堂課好長……還有多久下課？', '妙麗一定又寫了三卷羊皮紙。'];
      if (slot.tag === 'meal' || slot.tag === 'feast') return ['（嘴裡塞滿雞腿）嗯？你要不要也來一點？', '要是每天都有這麼多布丁就好了。'];
      if (slot.doing.includes('巫師棋')) return ['要下一盤嗎？我先說，我很少輸。', '騎士走這裡……將軍！'];
      return [
        house === 3 ? '史萊哲林的？……好吧，你看起來不像馬份那麼討厭。' : '你有沒有看到斑斑？牠又跑不見了。',
        '弗雷和喬治說活米村的蜂蜜公爵新出了一種糖，吃了會飄起來。',
      ];
    },
  },
  {
    id: 'hermione',
    name: '妙麗格蘭傑',
    title: '葛來分多學生・全年級第一名',
    model: 'hermione',
    kind: 'student',
    house: 0,
    routine: (c) =>
      studentDay(c, {
        house: 0,
        seat: 12,
        stand: 2,
        club: 'slug',
        dorm: false,
        electives: ['Ar', 'Ru', 'Mu'],
        free: (c) => (c.weekday === 5 && c.hour >= 10 && c.hour < 12.25 ? free('hagrid', 'seat', '在海格的小屋喝茶', 'sit_talk') : free('library', 'seat', '在圖書館讀書', 'sit_read')),
        evening: (c) => (c.hour < 21 ? free('library', 'seat', '在圖書館寫作業', 'sit_read') : { scene: 'gryffindorCommon', at: 'seat', pose: 'sit_read', doing: '在交誼廳看書', tag: 'evening' }),
      }),
    lines: ({ slot, house, curfew }) => {
      if (curfew) return ['現在已經過了宵禁！要是被抓到，我們學院又要被扣分了。'];
      if (slot.doing.includes('圖書館')) return ['噓，平斯夫人會把我們趕出去的。', '我在找一本講妖精叛亂的書，可是被借走了。', '作業不是應該早點寫完嗎？'];
      if (slot.tag === 'class') return [`${SUBJECTS[slot.subject ?? 'T'].name}的課本第一章你讀了嗎？很重要喔。`, '先別說話，我在做筆記。'];
      if (slot.tag === 'meal' || slot.tag === 'feast') return ['吃飯也可以複習呀，我把重點寫在這張紙上了。', '家庭小精靈煮這些菜，有拿到應得的報酬嗎？'];
      return [house === 0 ? '有什麼不會的地方可以問我。' : `${HOUSE_NAMES[house]}的作業應該跟我們差不多吧？`, '下週就要考試了，你複習了嗎？'];
    },
  },

  // ---------------------------------------------------------------- 教職員
  {
    id: 'dumbledore',
    name: '鄧不利多',
    title: '霍格沃茲校長',
    model: 'dumbledore',
    kind: 'staff',
    routine: (c) => {
      const h = c.hour;
      if (feast(c) && h < (c.event === 'term' ? 19.75 : 18.75)) return { scene: 'greatHall', at: 'greatHall.lectern', pose: 'talk', doing: '在大廳致詞', tag: 'feast' };
      const m = staffMeal(c, 5);
      if (m) return m;
      if (c.weekday === 1 && h >= 20 && h < 21) return free('entrance', 'stand', '在入口大廳散步', 'hands_back');
      if (c.weekday === 4 && h >= 22.5 && h < 23.5) return free('erised', 'stand', '站在意若思鏡前', 'hands_back');
      if (h >= 1 && h < 6.5) return null;
      if (period(h).p === 'class' || (h >= 9 && h < 18.5)) return work('headmasterOffice', 'seat', '在校長室辦公', 'sit_read');
      return work('headmasterOffice', 'stand', '在校長室裡看書', 'read');
    },
    lines: ({ slot, house, curfew }) => {
      if (curfew) return ['這麼晚還在城堡裡散步？夜裡的走廊確實別有一番風景……不過明天上課可別打瞌睡。'];
      if (slot.tag === 'feast') return ['吃吧！在說太多話之前，先讓大家好好享用。', '又是新的一年，每一年都有新的故事。'];
      if (slot.doing.includes('意若思鏡')) return ['這面鏡子給不了知識，也給不了真相。別在它面前待太久。', '你在鏡子裡看到了什麼？……不，不用告訴我。'];
      if (slot.doing.includes('校長室')) return ['檸檬雪寶？我最近很喜歡麻瓜的這種糖。', '佛客使今天心情不錯。', `${HOUSE_NAMES[house]}的同學，有什麼事都可以來找我。`];
      return ['早安——或者晚安，看你從哪裡來。', '城堡裡每一條走廊都值得多走一次。'];
    },
  },
  {
    id: 'mcgonagall',
    name: '麥教授',
    title: '副校長・變形學教授・葛來分多導師',
    model: 'mcgonagall',
    kind: 'staff',
    routine: (c) => {
      const h = c.hour;
      const m = staffMeal(c, 4);
      if (m) return m;
      const t = teachSlot('mcgonagall', c);
      if (t) return t;
      if (h >= 21 && h < 22.5) return { scene: 'corridor', at: 'patrol', pose: 'hands_back', doing: '在一樓走廊巡夜', tag: 'patrol' };
      if (h >= 22.5 || h < 6.5) return null;
      return work('mcgonagall', 'seat', '在辦公室批改作業', 'sit_read');
    },
    lines: ({ slot, house, curfew }) => {
      if (curfew) return [house === 0 ? '宵禁時間在外遊蕩，葛來分多扣五分。現在立刻回塔上去。' : `${HOUSE_NAMES[house]}扣五分。回你的寢室去，馬上。`];
      if (slot.tag === 'teach') return ['今天練習把茶杯變成老鼠。尾巴還是瓷做的，就不算完成。', '專心。變形學最怕的就是心不在焉。'];
      if (slot.tag === 'work') return ['作業放在桌上就可以了。', '我看得出來你很努力。不過字可以寫整齊一點。'];
      return ['有事嗎？', '在走廊上用跑的，是想撞到誰嗎？'];
    },
  },
  {
    id: 'snape',
    name: '石內卜',
    title: '魔藥學教授・史萊哲林導師',
    model: 'snape',
    kind: 'staff',
    routine: (c) => {
      const h = c.hour;
      const m = staffMeal(c, 7);
      if (m) return m;
      const t = teachSlot('snape', c);
      if (t) return { ...t, at: 'board', pose: 'arms_crossed' };
      if (h >= 20 && h < 23.5) return { scene: 'dungeonCorridor', at: 'patrol', pose: 'hands_back', doing: '在地窖走廊巡夜', tag: 'patrol' };
      if (h >= 23.5 || h < 6.5) return null;
      if (h >= 16.5) return work('potions', 'board', '在教室裡批改報告', 'arms_crossed');
      return work('ingredients', 'stand', '在魔藥材料儲藏室整理藥材', 'stir');
    },
    lines: ({ slot, house, curfew }) => {
      if (curfew) return [house === 3 ? '……回交誼廳去。這次我就當沒看到。' : `宵禁之後在地窖閒晃。${HOUSE_NAMES[house]}扣十分。`];
      if (slot.tag === 'teach') return ['攪拌的方向錯一次，整鍋就只能倒掉。', '材料照順序放。我不想再看到誰的大釜融掉。'];
      if (slot.doing.includes('儲藏室')) return ['未經允許進入儲藏室……你最好有很好的理由。', '別碰那個罐子。'];
      return house === 3 ? ['有什麼需要的，到我的辦公室來。'] : ['擋在路中間，是打算讓我繞過去嗎？', '……有事？'];
    },
  },
  {
    id: 'hagrid',
    name: '海格',
    title: '鑰匙與場地看守人・奇獸飼育學教授',
    model: 'hagrid',
    kind: 'staff',
    routine: (c) => {
      const h = c.hour;
      if (c.event === 'term' && h >= 17.2 && h < 18.9) return work(undefined, 'out:station', '在車站接一年級新生', 'wave');
      if (c.event === 'term' && h >= 18.9 && h < 19.5) return work(undefined, 'out:boathouse', '帶新生坐船到船屋', 'wave');
      const m = staffMeal(c, 0);
      if (m) return m;
      const t = teachSlot('hagrid', c);
      if (t) return t;
      if (h >= 22 || h < 6) return { scene: 'hagrid', at: 'bed', pose: 'sleep', doing: '在小屋裡睡覺', tag: 'sleep' };
      if (h >= 19.5) return free('hagrid', 'seat', '在小屋裡喝茶', 'sit');
      return work(undefined, 'out:hagridYard', '在小屋前照顧南瓜');
    },
    lines: ({ slot, house, curfew }) => {
      if (slot.tag === 'sleep') return ['……（打呼聲大得連窗戶都在震）'];
      if (curfew) return ['這麼晚了還在外面亂跑？快回城堡去，禁忌森林可不是開玩笑的。'];
      if (slot.doing.includes('新生')) return ['新生往這邊走！別擠，人人都有船坐。', '小心腳下，湖水晚上冷得很。'];
      if (slot.tag === 'teach') return ['今天要看的這些小傢伙很溫和——大部分的時候啦。', '慢慢靠近，先鞠躬，等牠回禮。'];
      if (slot.doing.includes('喝茶')) return ['進來坐，水剛滾。要不要吃塊岩石餅？', '牙牙，不准舔客人！'];
      return [house === 0 ? '哈利他們剛剛才來過。' : `${HOUSE_NAMES[house]}的？歡迎歡迎，有空來喝茶。`, '今年的南瓜長得特別好，萬聖節一定很壯觀。', '禁忌森林裡最近不太平靜……你可別自己跑進去。'];
    },
  },
];

/** 所有具名角色 */
export const ROSTER: NpcDef[] = [...CORE, ...STAFF, ...STUDENTS, ...CREATURES, ...CROWD];
bindRoster(ROSTER);
