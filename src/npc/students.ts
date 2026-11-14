import { type NpcDef, type Say, say, free, practice } from './common';
import { type Slot, type StudentOpts, type TimeCtx, studentDay, HOUSE_NAMES } from './schedule';

type Opts = Omit<StudentOpts, 'house' | 'seat' | 'free'> & { free: (c: TimeCtx) => Slot };

function student(id: string, name: string, title: string, house: number, seat: number, o: Opts, lines: Say): NpcDef {
  return {
    id,
    name,
    title,
    model: id,
    kind: 'student',
    house,
    routine: (c) => studentDay(c, { ...o, house, seat }),
    lines: (k) => say(k, lines),
  };
}

const weekend = (c: TimeCtx) => c.weekday >= 5;
const quad = (pose: Slot['pose'] = 'talk') => free(undefined, 'out:quad', '在中庭跟朋友聊天', pose);
const common = (house: number, pose: Slot['pose'] = 'sit_talk'): Slot => ({ scene: ['gryffindorCommon', 'hufflepuffCommon', 'ravenclawCommon', 'slytherinCommon'][house], at: 'seat', pose, doing: `在${HOUSE_NAMES[house]}交誼廳`, tag: 'evening' });

/** 第 2 批的具名學生。看台號碼（stand）在同學院裡不重複；女生寢室沒有做，晚上不在 */
export const STUDENTS: NpcDef[] = [
  // ---------------------------------------------------------------- 葛來分多
  student('neville', '奈威・隆巴頓', '葛來分多學生・藥草學高手', 0, 14, {
    club: 'duel', stand: 3,
    free: (c) => (weekend(c) ? common(0, 'sit_read') : free('greenhouse', 'work', '在溫室幫芽菜教授澆水', 'stir')),
  }, {
    curfew: ['我……我只是在找吹寶！牠又不見了。'],
    class: ['我的魔藥好像又冒煙了……', '你知道今天要交哪一份作業嗎？我忘了。'],
    free: ['這株是會唱歌的含羞草，你聽！', '奶奶說我應該更有自信一點。', '你有看到一隻蟾蜍嗎？大概這麼大。'],
    meal: ['我把記憶球忘在寢室了……還是我根本沒帶？'],
  }),
  student('ginny', '金妮・衛斯理', '葛來分多學生・魁地奇追蹤手', 0, 20, {
    club: 'slug', stand: 6, quidditch: 4, dorm: false,
    free: (c) => practice(c, 0, 4) ?? (weekend(c) ? quad() : common(0)),
  }, {
    curfew: ['噓，別跟我哥說你在這裡看到我。'],
    free: ['想看我的蝙蝠魔咒嗎？弗雷和喬治都怕它。', '下一場比賽我一定要進球。', '我才不怕你，你這是在笑什麼？'],
    fly: ['（她從你頭上呼嘯而過）'],
  }),
  student('seamus', '西莫・斐尼干', '葛來分多學生', 0, 15, {
    club: 'duel', stand: 4,
    free: () => quad(),
  }, {
    curfew: ['我只是想試試看能不能把蠟燭變成……好吧，它又爆炸了。'],
    class: ['我發誓這次不會再炸掉了。', '……好像有點焦味？'],
    free: ['你有沒有聞到煙味？不是我，這次真的不是我。', '我老家在愛爾蘭，那邊的魁地奇才精采。'],
  }),
  student('dean', '丁・湯馬斯', '葛來分多學生', 0, 17, {
    stand: 5,
    free: () => quad(),
    evening: () => common(0, 'sit_read'),
  }, {
    curfew: ['我在畫星空的素描，從塔頂看出去超美。'],
    free: ['巫師的照片會動，畫起來比麻瓜的難多了。', '你喜歡足球嗎？就是麻瓜的魁地奇，只是不用飛。'],
  }),
  student('fred', '弗雷・衛斯理', '葛來分多學生・魁地奇打擊手', 0, 24, {
    stand: 7, quidditch: 2,
    free: (c) => practice(c, 0, 2) ?? (weekend(c) ? free('kitchens', 'stand', '在廚房跟小精靈要點心', 'talk') : free('corridor', 'stand', '在獨眼女巫雕像旁邊鬼鬼祟祟', 'talk')),
  }, {
    curfew: ['宵禁？那是給沒地圖的人遵守的。', '噓——我們沒來過這裡，對吧，喬治？'],
    free: ['要不要試吃新產品？保證只會讓你的舌頭變長一點點。', '我是弗雷。還是喬治？你猜。', '飛七的辦公室裡有個抽屜，裡面的東西可有意思了。'],
    fly: ['（他揮著球棒把搏格打飛）'],
  }),
  student('george', '喬治・衛斯理', '葛來分多學生・魁地奇打擊手', 0, 25, {
    stand: 8, quidditch: 3,
    free: (c) => practice(c, 0, 3) ?? (weekend(c) ? free('kitchens', 'stand', '在廚房跟小精靈要點心', 'talk') : free('corridor', 'stand', '在獨眼女巫雕像旁邊鬼鬼祟祟', 'talk')),
  }, {
    curfew: ['你也是夜遊派的？歡迎入會。'],
    free: ['我是喬治。這次真的是。大概吧。', '派西要是知道我們在做什麼，他會氣到頭髮冒煙。', '城堡裡至少有七條密道，我們找到了六條。'],
    fly: ['（他朝你揮了揮球棒）'],
  }),
  student('percy', '派西・衛斯理', '葛來分多級長', 0, 2, {
    stand: 9,
    free: () => free('prefects', 'seat', '在級長會議室寫報告', 'sit_read'),
    evening: (c) => (c.hour < 21 ? { scene: 'corridor', at: 'patrol', pose: 'hands_back', doing: '在一樓走廊做級長巡邏', tag: 'patrol' } : common(0, 'sit_read')),
  }, {
    curfew: ['我是級長，我有權利扣你的分數。現在立刻回去。'],
    class: ['上課時間請保持安靜。'],
    free: ['有任何問題都可以找級長。這就是級長存在的意義。', '我正在寫一份關於坩堝底部厚度標準的報告。', '你有看到我的級長徽章嗎？剛剛才擦亮的。'],
    patrol: ['巡邏中。請勿在走廊上奔跑。'],
  }),
  student('wood', '澳利佛・木透', '葛來分多魁地奇隊長・看守手', 0, 4, {
    stand: 10, quidditch: 1,
    free: (c) => practice(c, 0, 1) ?? free('broomStore', 'stand', '在掃帚儲藏室研究戰術', 'read'),
    evening: () => common(0, 'sit_read'),
  }, {
    curfew: ['我在想新的戰術，睡不著。你會飛嗎？'],
    free: ['今年我們一定要拿到魁地奇盃。一定。', '你看這個陣型：三個追蹤手呈三角形……', '下雨天也要練球。比賽可不會因為下雨就取消。'],
    fly: ['（他守在球門前大喊：「再來一次！」）'],
  }),

  // ---------------------------------------------------------------- 史萊哲林
  student('draco', '跩哥・馬份', '史萊哲林學生・魁地奇搜捕手', 3, 10, {
    club: 'duel', stand: 0, quidditch: 0,
    free: (c) => practice(c, 3, 0) ?? quad('arms_crossed'),
    evening: () => common(3),
  }, {
    curfew: ['等著吧，這件事我會記住的。'],
    class: ['這種課，我閉著眼睛都會。'],
    free: ['怎樣？有事嗎？', '我的掃帚是最新款的，你應該看得出來。'],
    fly: ['（他瞇著眼四處找金探子）'],
    byHouse: (h) => (h === 3 ? '至少你分對學院了。' : h === 0 ? '又是葛來分多的……' : null),
  }),
  student('crabbe', '文森・克拉', '史萊哲林學生・魁地奇打擊手', 3, 12, {
    club: 'duel', stand: 1, quidditch: 2,
    free: (c) => practice(c, 3, 2) ?? quad('idle'),
    evening: () => common(3, 'sit'),
  }, {
    free: ['……（他在嚼東西）', '跩哥說不要跟你講話。'],
    meal: ['……（他又拿了第三塊派）'],
    fly: ['（他用力揮棒，差點打到自己的隊友）'],
  }),
  student('goyle', '葛果・高爾', '史萊哲林學生・魁地奇打擊手', 3, 13, {
    club: 'duel', stand: 2, quidditch: 3,
    free: (c) => practice(c, 3, 3) ?? quad('idle'),
    evening: () => common(3, 'sit'),
  }, {
    free: ['……嗯？', '你有吃的嗎？'],
    meal: ['……（他看著你的盤子）'],
    fly: ['（他飛得有點歪）'],
  }),
  student('pansy', '潘西・帕金森', '史萊哲林學生', 3, 11, {
    stand: 3, dorm: false,
    free: () => quad(),
    evening: () => common(3),
  }, {
    free: ['你在看什麼？', '跩哥說的對，有些人就是不懂規矩。'],
    byHouse: (h) => (h === 3 ? '交誼廳的新沙發你坐過了嗎？' : null),
  }),

  // ---------------------------------------------------------------- 雷文克勞
  student('luna', '露娜・羅古德', '雷文克勞學生', 2, 8, {
    stand: 0, dorm: false,
    free: (c) => (weekend(c) ? free(undefined, 'out:forestEdge', '在禁忌森林邊緣看夜騏', 'idle') : free(undefined, 'out:lakeside', '在湖邊讀《謬論家》', 'read')),
    evening: () => free('ravenclawReading', 'seat', '在雷文克勞閱覽室', 'sit_read'),
  }, {
    curfew: ['晚上的空氣裡有好多騷擾虻，你沒感覺到嗎？'],
    free: ['你看得見牠們嗎？那些拉馬車的動物。沒關係，很多人看不見。', '我的鞋子又被藏起來了，不過到了期末總會找回來的。', '爸爸說，彎角鼾獸住在瑞典。總有一天我要去找。'],
    class: ['這堂課的教室裡好像有隱形的東西。'],
  }),
  student('cho', '張秋', '雷文克勞學生・魁地奇搜捕手', 2, 14, {
    club: 'slug', stand: 1, quidditch: 0, dorm: false,
    free: (c) => practice(c, 2, 0) ?? free('owlery', 'stand', '在貓頭鷹屋寄信', 'read'),
  }, {
    free: ['我在寄信回家，媽媽每週都要我報平安。', '下一場比賽我想好好表現。', '貓頭鷹屋的風好大……你也來寄信嗎？'],
    fly: ['（她輕巧地轉了個彎，追著一道金光）'],
  }),

  // ---------------------------------------------------------------- 赫夫帕夫
  student('cedric', '西追・迪哥里', '赫夫帕夫級長・魁地奇隊長', 1, 10, {
    stand: 0, quidditch: 0,
    free: (c) => practice(c, 1, 0) ?? quad(),
  }, {
    curfew: ['很晚了，我送你回交誼廳那一帶吧。'],
    free: ['比賽輸贏不重要，公平最重要。', '你需要幫忙嗎？赫夫帕夫的人都很好說話。', '我爸總是把我的成績拿去跟同事炫耀，有點尷尬。'],
    fly: ['（他朝看台揮了揮手）'],
  }),
  student('hannah', '漢娜・艾寶', '赫夫帕夫學生', 1, 12, {
    stand: 1, dorm: false,
    free: (c) => (weekend(c) ? quad() : free('library', 'seat', '在圖書館讀書', 'sit_read')),
  }, {
    free: ['我好緊張，下週就要考試了。', '赫夫帕夫的交誼廳就在廚房旁邊，晚上常常聞到烤麵包的味道。'],
  }),
  student('ernie', '阿尼・麥米蘭', '赫夫帕夫學生', 1, 13, {
    club: 'duel', stand: 2,
    free: () => quad('arms_crossed'),
  }, {
    free: ['每一科都很重要，所以我每一科都做三份筆記。', '我每天都會先複習再吃晚餐。這叫紀律。'],
  }),
  student('justin', '賈斯汀・方—列里', '赫夫帕夫學生', 1, 14, {
    club: 'duel', stand: 3,
    free: (c) => (weekend(c) ? quad() : free('library', 'seat', '在圖書館寫作業', 'sit_read')),
  }, {
    free: ['我的家人到現在還不太相信魔法是真的。', '麻瓜出身的我，第一次看到樓梯會移動時差點嚇死。'],
  }),
];
