// professions.js - 职业数据
// 退休老者修仙传 - 12种退休职业

const professions = [
  {
    id: 'retired_police',
    name: '退休警察',
    description: '昔日维护治安，今朝踏入仙途。常年追捕练就的敏锐直觉与坚韧体魄，令其在修仙之路上亦能穷追不舍。',
    baseStats: { str: 14, dex: 15, con: 16, wis: 10 },
    primaryBonus: { type: '追击伤害', value: 0.10, label: '追击伤害+10%' },
    secondaryBonus: { type: '体力恢复', value: 0.05, label: '体力恢复+5%' }
  },
  {
    id: 'retired_soldier',
    name: '退休军人',
    description: '半生戎马，铁血铸魂。军旅生涯锻造的钢铁意志与强悍体魄，使其在仙途之中岿然不动、坚如磐石。',
    baseStats: { str: 16, dex: 14, con: 14, wis: 11 },
    primaryBonus: { type: '防御', value: 0.10, label: '防御+10%' },
    secondaryBonus: { type: 'HP上限', value: 0.05, label: 'HP上限+5%' }
  },
  {
    id: 'retired_doctor',
    name: '退休医生',
    description: '悬壶济世数十载，仁心仁术未曾改。医者通晓人体经络，转而修仙，于丹药炼制与疗伤之道颇有心得。',
    baseStats: { str: 10, dex: 10, con: 12, wis: 23 },
    primaryBonus: { type: '治疗效果', value: 0.10, label: '治疗效果+10%' },
    secondaryBonus: { type: '炼丹成功率', value: 0.05, label: '炼丹成功率+5%' }
  },
  {
    id: 'retired_teacher',
    name: '退休教师',
    description: '桃李满天下，传道授业解惑。数十年教书育人所积之智慧，使其领悟功法事半功倍，悟性远超常人。',
    baseStats: { str: 10, dex: 10, con: 12, wis: 23 },
    primaryBonus: { type: '功法修炼速度', value: 0.10, label: '功法修炼速度+10%' },
    secondaryBonus: { type: '悟性成长', value: 0.05, label: '悟性成长+5%' }
  },
  {
    id: 'retired_programmer',
    name: '退休程序员',
    description: '键盘之上码万行，逻辑之中寻真章。多年编程所锻之缜密思维，令其善于洞察玄机、破解迷局。',
    baseStats: { str: 8, dex: 12, con: 10, wis: 25 },
    primaryBonus: { type: 'Bug发现率', value: 0.10, label: 'Bug发现率+10%' },
    secondaryBonus: { type: '解谜线索', value: 0.05, label: '解谜线索+5%' }
  },
  {
    id: 'retired_worker',
    name: '退休工人',
    description: '厂房之中磨砺半生，筋骨强健力大无穷。转修仙道后，一身蛮力化为修炼根基，负重前行亦不觉苦。',
    baseStats: { str: 18, dex: 10, con: 16, wis: 11 },
    primaryBonus: { type: '力道成长', value: 0.10, label: '力道成长+10%' },
    secondaryBonus: { type: '负重', value: 0.05, label: '负重+5%' }
  },
  {
    id: 'retired_chef',
    name: '退休厨师',
    description: '锅铲之间见真功，烟火之中悟大道。烹饪之道与炼丹异曲同工，食材调理之法亦可化为修炼助力。',
    baseStats: { str: 12, dex: 10, con: 14, wis: 19 },
    primaryBonus: { type: '食物效果', value: 0.10, label: '食物效果+10%' },
    secondaryBonus: { type: '体力上限', value: 0.05, label: '体力上限+5%' }
  },
  {
    id: 'retired_merchant',
    name: '退休商人',
    description: '商海沉浮数十载，精于算计通达世故。踏入仙途后，于灵石交易、资源置换之上依然精明过人。',
    baseStats: { str: 10, dex: 14, con: 10, wis: 21 },
    primaryBonus: { type: '银两获取', value: 0.10, label: '银两获取+10%' },
    secondaryBonus: { type: '交易税', value: -0.05, label: '交易税-5%' }
  },
  {
    id: 'retired_athlete',
    name: '退休运动员',
    description: '赛场之上争分夺秒，退役之后犹存矫健。敏捷身手与强劲体魄使其在仙途之中身轻如燕、进退自如。',
    baseStats: { str: 14, dex: 18, con: 14, wis: 9 },
    primaryBonus: { type: '速度', value: 0.10, label: '速度+10%' },
    secondaryBonus: { type: '闪避', value: 0.05, label: '闪避+5%' }
  },
  {
    id: 'retired_artist',
    name: '退休艺术家',
    description: '丹青妙笔绘山河，心灵手巧悟天机。艺术家独有的感知力使其更容易与天地灵气产生共鸣，偶遇奇缘。',
    baseStats: { str: 10, dex: 14, con: 10, wis: 21 },
    primaryBonus: { type: '奇遇概率', value: 0.10, label: '奇遇概率+10%' },
    secondaryBonus: { type: '道心成长', value: 0.05, label: '道心成长+5%' }
  },
  {
    id: 'retired_farmer',
    name: '退休农民',
    description: '躬耕田亩半辈子，脚踏黄土接地气。农人顺应天时之智慧，使其寿元绵长，采集灵草亦得心应手。',
    baseStats: { str: 16, dex: 8, con: 18, wis: 13 },
    primaryBonus: { type: '采集效率', value: 0.10, label: '采集效率+10%' },
    secondaryBonus: { type: '寿命', value: 0.05, label: '寿命+5%' }
  },
  {
    id: 'freelance',
    name: '无业自由',
    description: '无所拘束、随心所欲。既无职业之累，亦无俗务缠身，反而心境澄明，修炼之时各属性略有裨益。',
    baseStats: { str: 12, dex: 12, con: 12, wis: 19 },
    primaryBonus: { type: '全属性', value: 0.03, label: '全属性+3%' },
    secondaryBonus: null
  }
];

module.exports = professions;
