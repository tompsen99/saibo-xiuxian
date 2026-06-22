// realms.js - 境界数据
// 退休老者修仙传 - 12大境界，每境界4小阶

const realms = [
  {
    id: 'lianqi',
    name: '练气',
    order: 1,
    subLevels: [
      { name: '初期', expRequired: 100, lifespan: 120, description: '感应天地灵气，引气入体，打通经脉之初关。' },
      { name: '中期', expRequired: 300, lifespan: 130, description: '灵气渐盈丹田，可御使低阶符箓，初步凝聚真气。' },
      { name: '后期', expRequired: 700, lifespan: 140, description: '真气充盈，经脉通畅，可施展基础法术，体质脱胎换骨。' },
      { name: '巅峰', expRequired: 1500, lifespan: 150, description: '练气圆满，丹田气海稳固，为筑基做好万全准备。' }
    ],
    description: '修仙之初阶，引天地灵气入体，淬炼经脉丹田。此境修士已非凡人，寿元可延至百余岁。'
  },
  {
    id: 'zhuji',
    name: '筑基',
    order: 2,
    subLevels: [
      { name: '初期', expRequired: 3000, lifespan: 170, description: '凝聚灵气构筑道基，丹田之中初现灵力漩涡。' },
      { name: '中期', expRequired: 6500, lifespan: 190, description: '道基渐稳，灵力运转自如，可驾驭飞剑短距御空。' },
      { name: '后期', expRequired: 14000, lifespan: 210, description: '道基稳固如磐，灵力质变，可施展中阶法术。' },
      { name: '巅峰', expRequired: 30000, lifespan: 240, description: '筑基圆满，道基浑厚无暇，具备冲击金丹之资。' }
    ],
    description: '构筑修仙之根基，乃修仙路上第一道天堑。筑基成功者，方可称得上真正的修士。'
  },
  {
    id: 'jindan',
    name: '金丹',
    order: 3,
    subLevels: [
      { name: '初期', expRequired: 60000, lifespan: 300, description: '道基凝聚为丹，丹田中浮现金色丹丸，灵力倍增。' },
      { name: '中期', expRequired: 130000, lifespan: 350, description: '金丹渐成，内蕴天地法则之力，可开辟洞府修炼。' },
      { name: '后期', expRequired: 280000, lifespan: 400, description: '金丹大成，蕴含法则之力愈浓，寿元大幅增长。' },
      { name: '巅峰', expRequired: 600000, lifespan: 500, description: '金丹圆满，丹中孕灵，元婴之象初现端倪。' }
    ],
    description: '凝聚天地灵气于一丹，灵力质变为金丹之力。金丹修士已可称霸一方，寿元可达数百年。'
  },
  {
    id: 'yuanying',
    name: '元婴',
    order: 4,
    subLevels: [
      { name: '初期', expRequired: 1200000, lifespan: 600, description: '金丹破碎，元婴化形而出，识海开辟，神识大增。' },
      { name: '中期', expRequired: 2600000, lifespan: 750, description: '元婴渐长，可离体而出，神识笼罩方圆百里。' },
      { name: '后期', expRequired: 5500000, lifespan: 900, description: '元婴凝实，神通广大，可施展大挪移之术。' },
      { name: '巅峰', expRequired: 12000000, lifespan: 1100, description: '元婴圆满，婴中蕴含化神之力，为化神做好准备。' }
    ],
    description: '金丹化婴，神识大开，修士可元神出窍。元婴修士已是修仙界之中坚力量。'
  },
  {
    id: 'huashen',
    name: '化神',
    order: 5,
    subLevels: [
      { name: '初期', expRequired: 25000000, lifespan: 1500, description: '元婴化为神魂，肉身与元神合一，踏入化神之境。' },
      { name: '中期', expRequired: 55000000, lifespan: 1800, description: '神魂凝练，可操控天地元气，呼风唤雨不在话下。' },
      { name: '后期', expRequired: 120000000, lifespan: 2200, description: '化神大成，领悟天地法则，一念之间风云变色。' },
      { name: '巅峰', expRequired: 260000000, lifespan: 2800, description: '化神圆满，对天地法则的领悟已达瓶颈，需更进一步。' }
    ],
    description: '元婴化为更高层次的神魂形态，修士开始触摸天地法则之力。化神修士举手投足间皆有莫大威能。'
  },
  {
    id: 'lianxu',
    name: '炼虚',
    order: 6,
    subLevels: [
      { name: '初期', expRequired: 550000000, lifespan: 3500, description: '感悟虚空之道，虚实之间自由转换，初窥空间法则。' },
      { name: '中期', expRequired: 1200000000, lifespan: 4200, description: '虚空之力渐深，可撕裂空间、跨越万里。' },
      { name: '后期', expRequired: 2600000000, lifespan: 5000, description: '炼虚大成，虚空与现实交融，神通诡谲莫测。' },
      { name: '巅峰', expRequired: 5500000000, lifespan: 6000, description: '炼虚圆满，虚空法则了然于胸，合体之基已备。' }
    ],
    description: '炼化虚空之力，领悟空间法则。炼虚修士可撕裂空间、穿梭虚空，已非凡俗之辈可比。'
  },
  {
    id: 'heti',
    name: '合体',
    order: 7,
    subLevels: [
      { name: '初期', expRequired: 12000000000, lifespan: 8000, description: '肉身与元神完美融合，天人合一之初步境界。' },
      { name: '中期', expRequired: 26000000000, lifespan: 10000, description: '合体之力圆满，肉身即是法宝，元神即是天地。' },
      { name: '后期', expRequired: 55000000000, lifespan: 13000, description: '合体大成，举手投足皆合天道，战力惊世骇俗。' },
      { name: '巅峰', expRequired: 120000000000, lifespan: 16000, description: '合体圆满，天地万物皆可为己用，大乘之门已开。' }
    ],
    description: '肉身与元神合一，天人合一之境。合体修士已可称为半步真仙，寿元以万年计。'
  },
  {
    id: 'dacheng',
    name: '大乘',
    order: 8,
    subLevels: [
      { name: '初期', expRequired: 260000000000, lifespan: 20000, description: '大乘之始，领悟大道至简之理，修为通天彻地。' },
      { name: '中期', expRequired: 550000000000, lifespan: 25000, description: '大乘之力圆满，可开辟小世界，自成一方天地。' },
      { name: '后期', expRequired: 1200000000000, lifespan: 32000, description: '大乘大成，万法归一，一念之间可造化万物。' },
      { name: '巅峰', expRequired: 2600000000000, lifespan: 40000, description: '大乘圆满，道果将成，天劫之兆已然显现。' }
    ],
    description: '万法归一、大道至简。大乘修士已立于修仙界之巅，寿元以数万年计，动辄翻江倒海。'
  },
  {
    id: 'dujie',
    name: '渡劫',
    order: 9,
    subLevels: [
      { name: '初期', expRequired: 5500000000000, lifespan: 50000, description: '天劫降临，九重雷劫淬炼肉身元神，劫后方得新生。' },
      { name: '中期', expRequired: 12000000000000, lifespan: 65000, description: '渡过三重天劫，肉身不灭，元神不朽，半步飞升。' },
      { name: '后期', expRequired: 26000000000000, lifespan: 80000, description: '渡过六重天劫，天地法则为己所用，近乎不朽。' },
      { name: '巅峰', expRequired: 55000000000000, lifespan: 100000, description: '九重天劫尽数渡过，飞升之门已然洞开。' }
    ],
    description: '天道降下天劫以考验修士。渡劫成功方可飞升，失败则灰飞烟灭。此乃修仙路上最凶险之境。'
  },
  {
    id: 'feisheng',
    name: '飞升',
    order: 10,
    subLevels: [
      { name: '初期', expRequired: 120000000000000, lifespan: 200000, description: '肉身飞升，踏入仙界之门，脱离凡尘俗世。' },
      { name: '中期', expRequired: 260000000000000, lifespan: 350000, description: '仙界立足，汲取仙灵之气，修为突飞猛进。' },
      { name: '后期', expRequired: 550000000000000, lifespan: 500000, description: '飞升圆满，仙体初成，可与低阶仙人比肩。' },
      { name: '巅峰', expRequired: 1200000000000000, lifespan: 800000, description: '飞升大成，彻底蜕变为仙人之体，寿元以百万年计。' }
    ],
    description: '渡过天劫、飞升仙界。飞升修士已非凡人，亦非普通修士，乃是真正的仙界新贵。'
  },
  {
    id: 'xianren',
    name: '仙人',
    order: 11,
    subLevels: [
      { name: '初期', expRequired: 2600000000000000, lifespan: 2000000, description: '成就仙人果位，掌握仙术神通，可号令天地之力。' },
      { name: '中期', expRequired: 5500000000000000, lifespan: 5000000, description: '仙人之力渐深，可开辟仙域，统领一方仙界。' },
      { name: '后期', expRequired: 12000000000000000, lifespan: 10000000, description: '仙人大成，举手投足皆有毁天灭地之威。' },
      { name: '巅峰', expRequired: 26000000000000000, lifespan: 20000000, description: '仙人圆满，距神尊之境仅一步之遥，触碰天道本源。' }
    ],
    description: '真正的仙人，寿元以千万年计。仙人一怒，伏尸百万；仙人一喜，泽被苍生。'
  },
  {
    id: 'shenzun',
    name: '神尊',
    order: 12,
    subLevels: [
      { name: '初期', expRequired: 55000000000000000, lifespan: 100000000, description: '踏入神尊之境，掌握一丝天道本源之力。' },
      { name: '中期', expRequired: 120000000000000000, lifespan: 500000000, description: '神尊之力圆满，可操控一界之天道法则。' },
      { name: '后期', expRequired: 260000000000000000, lifespan: 1000000000, description: '神尊大成，一念创世、一念灭世，近乎无所不能。' },
      { name: '巅峰', expRequired: 550000000000000000, lifespan: Infinity, description: '至高无上之境，与天道合一，永恒不灭，万古长存。' }
    ],
    description: '修仙之途的至高境界，与天道合一、永恒不灭。神尊之下皆蝼蚁，此乃万古修仙者之终极追求。'
  }
];

module.exports = realms;
