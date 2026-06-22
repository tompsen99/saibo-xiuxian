// maps.js - 地图数据
// 退休老者修仙传 - 新手村地图

const maps = {
  newbie_village: {
    id: 'newbie_village',
    name: '新手村',
    description: '一处偏远安宁的小村落，村口立着一块石碑，上书"平安村"三字。此地灵气稀薄，却也少有妖兽侵扰，正是初入仙途者安身修行之所。',
    rooms: [
      {
        id: 'village_square',
        name: '村中心广场',
        description: '广场中央矗立着一棵古槐，枝繁叶茂，树荫如盖。树下设有石桌石凳，供村民歇息闲谈。广场四周青石铺地，偶有孩童嬉戏其间。北面是村长小屋，东面传来叮叮当当的打铁声，西面飘来阵阵药香，南面竹林沙沙作响。',
        exits: {
          north: 'village_chief',
          south: 'bamboo_forest',
          east: 'blacksmith',
          west: 'herb_shop',
          up: null,
          down: null
        },
        npcs: [],
        monsters: []
      },
      {
        id: 'village_chief',
        name: '村长小屋',
        description: '一间古朴的木屋，门前挂着一副对联："平安二字值千金，和顺百年添百福。"屋内陈设简朴，一张旧书案上堆满了村务文书。村长端坐于案后，目光和蔼而深邃。',
        exits: {
          north: null,
          south: 'village_square',
          east: null,
          west: null,
          up: null,
          down: null
        },
        npcs: ['chief'],
        monsters: []
      },
      {
        id: 'blacksmith',
        name: '铁匠铺',
        description: '铺内炉火通红，热浪扑面。墙上挂满了各式铁器——锄头、柴刀、铁锤，亦有几柄未开锋的长剑。铁匠赤膊抡锤，汗珠飞溅间，铁胚渐成器形。角落里堆着几块黑黝黝的矿石。',
        exits: {
          north: null,
          south: null,
          east: null,
          west: 'village_square',
          up: null,
          down: null
        },
        npcs: ['blacksmith'],
        monsters: []
      },
      {
        id: 'herb_shop',
        name: '药铺',
        description: '药铺不大，却摆满了大大小小的瓶瓶罐罐。空气中弥漫着草药的清苦香气，墙壁上悬挂着晾干的灵草。药商正在柜台后细细研磨药粉，见有客人来，微微颔首。',
        exits: {
          north: null,
          south: null,
          east: 'village_square',
          west: null,
          up: null,
          down: null
        },
        npcs: ['herbmerchant'],
        monsters: []
      },
      {
        id: 'training_ground',
        name: '练功场',
        description: '一片开阔的沙地，四周立着几个木人桩和草靶。地面被踩得结实平整，角落里摆着几块大小不一的练功石。微风拂过，扬起少许沙尘。此地乃村民强身健体之处，亦可供初学者练习拳脚。',
        exits: {
          north: null,
          south: null,
          east: 'bamboo_forest',
          west: null,
          up: null,
          down: null
        },
        npcs: [],
        monsters: []
      },
      {
        id: 'bamboo_forest',
        name: '竹林',
        description: '翠竹成林，遮天蔽日。林间小径蜿蜒曲折，脚下落叶沙沙。阳光透过竹叶洒下斑驳光影，偶有飞鸟掠过。此地远离村落，常有野兔、野鸡出没，亦是猎户们常来之处。往北可回村中广场，往东可达练功场。',
        exits: {
          north: 'village_square',
          south: null,
          east: null,
          west: 'training_ground',
          up: null,
          down: null
        },
        npcs: [],
        monsters: [
          {
            name: '野兔',
            hp: 30,
            attack: 5,
            defense: 2,
            exp: 10,
            silver: 3,
            dropRate: 0.15
          },
          {
            name: '野鸡',
            hp: 45,
            attack: 8,
            defense: 3,
            exp: 15,
            silver: 5,
            dropRate: 0.12
          }
        ]
      }
    ]
  }
};

module.exports = maps;
