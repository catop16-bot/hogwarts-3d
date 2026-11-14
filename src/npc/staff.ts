import { type NpcDef, staffDay, say, work, free, anyPractice } from './common';
import { astronomyNight, lupinGone, lupinSick, matchOn, HOUSE_NAMES } from './schedule';

/** 第 2 批的教職員。大廳教師席：0 海格、1 維克多、2 巴布林、3 芽菜、4 麥教授、5 鄧不利多、6 孚立維、7 石內卜、8 路平、9 辛尼區、10 胡奇 */
export const STAFF: NpcDef[] = [
  {
    id: 'flitwick',
    name: '孚立維教授',
    title: '符咒學教授・雷文克勞導師',
    model: 'flitwick',
    kind: 'staff',
    routine: (c) =>
      staffDay('flitwick', c, {
        chair: 6,
        special: (c) => (c.weekday === 4 && c.hour >= 19.5 && c.hour < 21.5 && !c.holiday ? free('duelling', 'stand', '在決鬥社當裁判', 'arms_crossed') : undefined),
        work: () => work('charms', 'board', '在符咒學教室準備教材', 'read'),
        evening: () => work('charms', 'seat', '在教室裡看書', 'sit_read'),
      }),
    lines: (k) =>
      say(k, {
        curfew: ['哎呀，這麼晚了！快回去吧，我就當作沒看到。'],
        teach: ['手腕放鬆，輕輕一轉——對，就是這樣！', '發音要清楚，咒語唸錯一個音，羽毛可能會著火喔。'],
        work: ['你好你好！今天想學什麼咒語？', '我年輕的時候可是決鬥冠軍呢，呵呵。'],
        free: ['決鬥第一課：先學會怎麼鞠躬。', '動作要快，但心要靜。'],
        meal: ['今天的南瓜汁特別香。'],
        byHouse: (h) => (h === 2 ? '雷文克勞的同學，交誼廳的門謎今天你答出來了嗎？' : null),
      }),
  },
  {
    id: 'sprout',
    name: '芽菜教授',
    title: '藥草學教授・赫夫帕夫導師',
    model: 'sprout',
    kind: 'staff',
    routine: (c) =>
      staffDay('sprout', c, {
        chair: 3,
        work: (c) => (c.hour < 12.5 ? work('greenhouse', 'board', '在溫室照顧植物', 'stir') : work('pottingShed', 'stand', '在盆栽棚換盆', 'stir')),
        evening: () => free('staffRoom', 'seat', '在教職員休息室喝茶', 'sit_talk'),
      }),
    lines: (k) =>
      say(k, {
        curfew: ['晚上的溫室可不歡迎訪客。快回寢室去。'],
        teach: ['耳罩戴好！我數到三再拔。', '澆水別澆太多，牠們會撒嬌的。'],
        work: ['小心那盆，牠今天心情不太好。', '要不要幫我搬一下這袋龍糞肥？'],
        free: ['坐吧，茶還熱著。'],
        byHouse: (h) => (h === 1 ? '赫夫帕夫的孩子，最近還好嗎？' : null),
      }),
  },
  {
    id: 'lupin',
    name: '路平教授',
    title: '黑魔法防禦術教授',
    model: 'lupin',
    kind: 'staff',
    routine: (c) =>
      staffDay('lupin', c, {
        chair: 8,
        // 滿月：當晚不在城堡；白天在醫院廂房休息，課由石內卜代
        special: (c) => (lupinGone(c) ? null : lupinSick(c) ? free('hospital', 'seat', '身體不適，在醫院廂房休息', 'sit_read') : undefined),
        work: () => work('dadaOffice', 'seat', '在辦公室裡改作業', 'sit_read'),
        evening: () => work('dadaOffice', 'stand', '在辦公室泡茶', 'idle'),
      }),
    lines: (k) =>
      say(k, {
        curfew: ['夜裡的城堡很美，但也不是每個角落都安全。我陪你走回去吧。'],
        teach: ['別怕，牠只是模仿你心裡害怕的東西而已。', '想一件讓你真心發笑的事，然後大聲唸出來。'],
        work: ['要喝杯茶嗎？我這裡只剩茶包了。', '有什麼想問的，隨時可以來找我。'],
        free: ['我今天有點累……沒事，老毛病了。', '巧克力是好東西，什麼時候都用得上。'],
        meal: ['多吃一點，下午的課要用到體力。'],
      }),
  },
  {
    id: 'trelawney',
    name: '崔老妮教授',
    title: '占卜學教授',
    model: 'trelawney',
    kind: 'staff',
    routine: (c) =>
      staffDay('trelawney', c, {
        chair: null,
        work: () => work('divination', 'seat', '在占卜學教室看茶葉', 'sit_read'),
        evening: () => work('trelawneyStore', 'stand', '在儲藏室整理水晶球', 'read'),
        until: 25,
        from: 9,
      }),
    lines: (k) =>
      say(k, {
        curfew: ['啊……我早就看見你會在這個時候出現了。'],
        teach: ['別用眼睛看，用你的內在之眼……看見了嗎？', '杯底的茶葉……是一隻鳥？不，也許是一頂帽子。'],
        work: ['親愛的，你的氣場今天有點混濁。', '我感覺得到，你這個月要小心有翅膀的東西。', '下樓？我很少下樓。下面的世界太吵了。'],
      }),
  },
  {
    id: 'sinistra',
    name: '辛尼區教授',
    title: '天文學教授',
    model: 'sinistra',
    kind: 'staff',
    routine: (c) =>
      staffDay('sinistra', c, {
        chair: 9,
        special: (c) => (astronomyNight(c) ? { scene: 'astronomyDeck', at: 'board', pose: 'teach', doing: '在天文塔上天文學', tag: 'teach', subject: 'As' } : undefined),
        work: (c) => (c.hour < 13 ? work('starCharts', 'stand', '在星圖室整理星圖', 'read') : work('astronomyQuarters', 'seat', '在宿舍裡計算星位', 'sit_read')),
        evening: () => work('astronomyDeck', 'stand', '在觀星台調望遠鏡', 'hands_back'),
        until: 25,
        from: 8.5,
      }),
    lines: (k) =>
      say(k, {
        curfew: ['今晚雲很少，適合看星星——不過你該去睡了。'],
        teach: ['先找到北極星，其他的星座都會跟著出現。', '記下木星衛星的位置，下週要考。'],
        work: ['今晚的星象很清楚，要不要上來看看？', '天文塔的風很大，記得多穿一件。'],
      }),
  },
  {
    id: 'hooch',
    name: '胡奇夫人',
    title: '飛行課老師・魁地奇裁判',
    model: 'hooch',
    kind: 'staff',
    routine: (c) =>
      staffDay('hooch', c, {
        chair: 10,
        special: (c) => (matchOn(c) ? { at: 'fly:20', pose: 'broom', doing: '在當魁地奇比賽的裁判', tag: 'event' } : anyPractice(c) ? work(undefined, 'out:pitch', '在場邊看球隊練習', 'arms_crossed') : undefined),
        work: () => work('broomStore', 'stand', '在掃帚儲藏室修掃帚', 'stir'),
        evening: () => free('staffRoom', 'seat', '在教職員休息室休息', 'sit'),
      }),
    lines: (k) =>
      say(k, {
        curfew: ['宵禁了。掃帚收好，人也收好。'],
        work: ['掃帚尾巴要常修，飛起來才會直。', '腳踩穩、身體前傾，別一上去就往後倒。'],
        free: ['姿勢太僵了！放鬆肩膀！', '誰再犯規，就給我下來跑球場一圈。'],
      }),
  },
  {
    id: 'pomfrey',
    name: '龐芮夫人',
    title: '醫院廂房護士',
    model: 'pomfrey',
    kind: 'staff',
    routine: (c) =>
      staffDay('pomfrey', c, {
        chair: null,
        special: (c) => (matchOn(c) ? work(undefined, 'out:pitch', '在球場邊待命', 'arms_crossed') : undefined),
        work: (c) => (c.hour < 14 ? { scene: 'hospital', at: 'patrol', pose: 'idle', doing: '在醫院廂房巡病床', tag: 'work' } : work('pomfreyStore', 'stand', '在藥品室調藥', 'stir')),
        evening: () => work('hospital', 'seat', '在醫院廂房值夜', 'sit_read'),
        until: 24,
      }),
    lines: (k) =>
      say(k, {
        curfew: ['你不舒服嗎？不是的話就快回去睡覺。'],
        work: ['病人需要休息，探病時間只有十分鐘。', '把這個喝了。味道很差，但很有效。', '又是魁地奇摔下來的？我早就說那項運動太危險了。'],
      }),
  },
  {
    id: 'pince',
    name: '朋夫人',
    title: '圖書館館長',
    model: 'pince',
    kind: 'staff',
    routine: (c) =>
      staffDay('pince', c, {
        chair: null,
        work: (c) => (c.hour >= 14 && c.hour < 16 ? work('bookRepair', 'stand', '在書籍修補室補書', 'read') : work('library', 'stand', '在圖書館巡書架', 'read')),
        until: 21.5,
        from: 7.5,
      }),
    lines: (k) =>
      say(k, {
        curfew: ['圖書館已經關了。'],
        work: ['在圖書館裡不准吃東西、不准大聲說話、不准折書角。', '那本書要還了。今天。', '禁書區要有教授簽名的條子才能進去。'],
      }),
  },
  {
    id: 'filch',
    name: '飛七',
    title: '霍格沃茲管理員',
    model: 'filch',
    kind: 'staff',
    routine: (c) =>
      staffDay('filch', c, {
        chair: null,
        special: (c) =>
          c.hour >= 20.5 || c.hour < 1.5
            ? { scene: c.hour >= 23 || c.hour < 1.5 ? 'staircase' : 'corridor', at: 'patrol', pose: 'hands_back', doing: '提著燈巡夜', tag: 'patrol' }
            : c.hour < 6.5
              ? null
              : undefined,
        work: (c) => (c.hour < 12 ? work('filch', 'seat', '在辦公室翻違規紀錄', 'sit_read') : work('entrance', 'stand', '在入口大廳盯著學生', 'hands_back')),
        until: 25.5,
      }),
    lines: (k) =>
      say(k, {
        curfew: ['抓到了！宵禁之後在走廊上閒晃——跟我到辦公室去。', '拿樂絲太太，我們又有客人了。'],
        work: ['鞋子上的泥巴！你看看你踩了一地！', '別以為我不知道是誰在走廊上放糞彈。', '以前的處罰可嚴格多了……'],
      }),
  },
  {
    id: 'vector',
    name: '維克多教授',
    title: '算命學教授',
    model: 'vector',
    kind: 'staff',
    routine: (c) =>
      staffDay('vector', c, {
        chair: 1,
        work: () => work('arithmancy', 'seat', '在算命學教室排數字表', 'sit_read'),
        evening: () => free('staffRoom', 'seat', '在教職員休息室', 'sit_read'),
      }),
    lines: (k) =>
      say(k, {
        curfew: ['數字不會說謊：現在已經過了宵禁。'],
        teach: ['把名字換成數字，再看它們彼此的關係。', '這一題的答案是七。永遠先檢查七。'],
        work: ['算命學不是猜，是計算。', '格蘭傑小姐的作業又寫了兩倍長。'],
      }),
  },
  {
    id: 'babbling',
    name: '巴布林教授',
    title: '古代魔文教授',
    model: 'babbling',
    kind: 'staff',
    routine: (c) =>
      staffDay('babbling', c, {
        chair: 2,
        work: () => work('runes', 'seat', '在古代魔文教室翻譯石板', 'sit_read'),
        evening: () => free('staffRoom', 'seat', '在教職員休息室', 'sit_read'),
      }),
    lines: (k) =>
      say(k, {
        curfew: ['這麼晚了……回去吧，魔文明天還在。'],
        teach: ['這個符號倒過來寫，意思就完全相反了。', '查魔文字典的時候，記得連註腳一起看。'],
        work: ['我在翻一塊很老的石板，上面好像是一份食譜。', '學魔文最需要的是耐心。'],
      }),
  },
  {
    id: 'burbage',
    name: '布巴吉教授',
    title: '麻瓜研究教授',
    model: 'burbage',
    kind: 'staff',
    routine: (c) =>
      staffDay('burbage', c, {
        chair: null,
        work: () => work('muggleStudies', 'seat', '在麻瓜研究學教室', 'sit_read'),
        evening: () => free('staffRoom', 'seat', '在教職員休息室', 'sit_talk'),
      }),
    lines: (k) =>
      say(k, {
        curfew: ['麻瓜小孩這時候也該上床睡覺了。你也一樣。'],
        teach: ['麻瓜沒有魔法，所以他們發明了好多聰明的東西。', '這叫插頭。不，它不會咬人。'],
        work: ['你見過電扶梯嗎？那可真是了不起的發明。', '麻瓜的生活比我們想像的有趣多了。'],
      }),
  },
  {
    id: 'slughorn',
    name: '史拉轟教授',
    title: '前魔藥學教授（客座）・鼻涕蟲社主人',
    model: 'slughorn',
    kind: 'staff',
    routine: (c) =>
      staffDay('slughorn', c, {
        chair: null,
        special: (c) => (c.weekday === 4 && c.hour >= 19.5 && c.hour < 22 && !c.holiday ? free('slugClub', 'stand', '在鼻涕蟲社的聚會上招呼客人', 'talk') : undefined),
        work: () => free('staffRoom', 'seat', '在教職員休息室吃鳳梨糖', 'sit_talk'),
        from: 8,
      }),
    lines: (k) =>
      say(k, {
        curfew: ['哎呀，這麼晚還在外面？下次聚會我再寄邀請函給你。'],
        free: ['來來來，嘗一塊糖漬鳳梨！', '我教過的學生裡，有好幾位現在可是大人物喔。', '星期五晚上我辦個小聚會，你也來吧？'],
        byHouse: (h) => (h === 3 ? '史萊哲林的？好極了，好極了。' : null),
      }),
  },
  {
    id: 'lockhart',
    name: '洛哈',
    title: '客座講師・暢銷書作家',
    model: 'lockhart',
    kind: 'staff',
    routine: (c) =>
      staffDay('lockhart', c, {
        chair: null,
        special: (c) => (c.weekday === 4 && c.hour >= 19.5 && c.hour < 21.5 && !c.holiday ? free('duelling', 'stand', '在決鬥社示範咒語', 'cast') : undefined),
        work: () => free('trophyRoom', 'stand', '在獎盃室欣賞自己的獎盃', 'hands_back'),
        from: 9,
      }),
    lines: (k) =>
      say(k, {
        curfew: ['宵禁了？哈哈，規則是給一般人定的——不過你還是回去吧。'],
        free: ['要簽名嗎？我剛好帶了孔雀羽毛筆。', '這座獎盃？那是我在國外打敗一隻女妖得到的，故事很長。', '我的新書下個月出版，記得去買。'],
      }),
  },
  {
    id: 'rosmerta',
    name: '羅斯默塔夫人',
    title: '三根掃帚酒館老闆娘',
    model: 'rosmerta',
    kind: 'staff',
    routine: (c) => (c.hour >= 9 && c.hour < 23 ? work(undefined, 'out:broomsticks', '在三根掃帚門口招呼客人', c.hogsmeade ? 'talk' : 'idle') : null),
    lines: (k) =>
      say(k, {
        work: ['進來坐吧，奶油啤酒剛溫好。', '今天學生特別多，你要的位子我幫你留著。', `${HOUSE_NAMES[k.house]}的孩子們最愛點熱的蜂蜜酒——當然，是不含酒精的那種。`],
      }),
  },
];
