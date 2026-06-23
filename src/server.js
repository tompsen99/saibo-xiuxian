const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const professions = require('./data/professions');
const realms = require('./data/realms');

// Configuration
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize data files if they don't exist
function initializeDataFiles() {
  if (!fs.existsSync(PLAYERS_FILE)) {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify({}, null, 2));
  }
  if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2));
  }
}

// Read JSON file
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Write JSON file
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// World data - maps and rooms
const WORLD_DATA = {
  maps: {
    '新手村': {
      name: '新手村',
      description: '你来到了新手村，这里是所有修仙者开始旅程的地方。村庄宁静祥和，远处可见青山环绕。',
      rooms: {
        '村口': {
          name: '村口',
          description: '村庄的入口处，一块石碑上刻着"新手村"三个大字。微风拂过，带来远处花草的清香。',
          exits: { north: '村广场', east: '集市', west: '修炼场', south: '竹林', southeast: '铁匠铺' }
        },
        '竹林': {
          name: '竹林',
          description: '翠竹成林，遮天蔽日。林间小径蜿蜒曲折，脚下落叶沙沙。阳光透过竹叶洒下斑驳光影，偶有飞鸟掠过。此地远离村落，常有野兔、野鸡出没。',
          exits: { north: '村口' },
          monsters: [
            { name: '野兔', hp: 30, maxHp: 30, attack: 5, defense: 2, exp: 10, silver: 3, dropRate: 0.15 },
            { name: '野鸡', hp: 45, maxHp: 45, attack: 8, defense: 3, exp: 15, silver: 5, dropRate: 0.12 }
          ]
        },
        '村广场': {
          name: '村广场',
          description: '村子的中心广场，地面铺着青石板。一座喷泉矗立中央，水声潺潺。周围坐着几位闲聊的村民。',
          exits: { south: '村口', north: '村长屋', east: '客栈', west: '药铺' }
        },
        '村长屋': {
          name: '村长屋',
          description: '村长的住所，屋内陈设简朴。村长坐在太师椅上，似乎在等待着什么人。',
          exits: { south: '村广场' }
        },
        '集市': {
          name: '集市',
          description: '热闹的集市，各种摊位琳琅满目。商贩们吆喝着招揽顾客，空气中弥漫着各种食物的香气。',
          exits: { west: '村口', north: '客栈' }
        },
        '客栈': {
          name: '客栈',
          description: '温馨的客栈，木质桌椅散发着淡淡的檀香。角落里坐着几位旅人，低声交谈着。',
          exits: { south: '集市', west: '村广场' }
        },
        '药铺': {
          name: '药铺',
          description: '药铺内摆满了各种药材，空气中弥漫着草药的清香。掌柜正在研磨草药。',
          exits: { east: '村广场' }
        },
        '铁匠铺': {
          name: '铁匠铺',
          description: '铁匠铺内炉火熊熊，铁匠正在敲打一块烧红的铁锭。墙上挂满了各种兵器和防具。',
          exits: { west: '村口' }
        },
        '修炼场': {
          name: '修炼场',
          description: '开阔的修炼场，地面平整。几位修士正在打坐修炼，空气中隐约有灵气流动。',
          exits: { east: '村口' }
        }
      }
    }
  }
};

// ===== SKILLS (功法) SYSTEM =====
const SKILLS_DATA = {
  basic_fist: {
    id: 'basic_fist',
    name: '基础拳法',
    type: 'active',
    damage: 15,
    spiritCost: 5,
    level: '凡阶下品',
    description: '最基础的拳法，朴实无华但胜在稳固。'
  },
  basic_sword: {
    id: 'basic_sword',
    name: '基础剑法',
    type: 'active',
    damage: 20,
    spiritCost: 8,
    level: '凡阶下品',
    description: '入门剑法，剑走轻灵，攻守兼备。'
  },
  basic_meditation: {
    id: 'basic_meditation',
    name: '吐纳术',
    type: 'passive',
    effect: 'spiritRecovery+2',
    level: '凡阶下品',
    description: '修仙入门功法，通过调息吐纳恢复灵力。'
  },
  basic_movement: {
    id: 'basic_movement',
    name: '轻功入门',
    type: 'passive',
    effect: 'dodge+5%',
    level: '凡阶下品',
    description: '基础轻功，提升身法闪避能力。'
  }
};

// ===== SECTS (门派) SYSTEM =====
const SECTS_DATA = {
  shaolin: {
    id: 'shaolin',
    name: '少林派',
    type: '正派',
    bonus: 'defense+10%',
    bonusDesc: '防御+10%',
    desc: '防御专精，拳法/棍法。天下武功出少林，以刚猛厚重见长。',
    minLevel: 3
  },
  wudang: {
    id: 'wudang',
    name: '武当派',
    type: '正派',
    bonus: 'spiritRecovery+15%',
    bonusDesc: '灵力恢复+15%',
    desc: '内功专精，剑法/太极。以柔克刚，内力绵长不绝。',
    minLevel: 3
  },
  xiaoyao: {
    id: 'xiaoyao',
    name: '逍遥派',
    type: '中立',
    bonus: 'exp+10%',
    bonusDesc: '经验+10%',
    desc: '奇遇最多，功法杂。逍遥自在，不受拘束，修炼速度更快。',
    minLevel: 3
  },
  emei: {
    id: 'emei',
    name: '峨眉派',
    type: '正派',
    bonus: 'healing+15%',
    bonusDesc: '治疗+15%',
    desc: '治疗辅助，剑法/掌法。峨眉弟子精通医术与剑法，攻守兼备。',
    minLevel: 3
  },
  huashan: {
    id: 'huashan',
    name: '华山派',
    type: '正派',
    bonus: 'attack+10%',
    bonusDesc: '攻击+10%',
    desc: '剑法专精，剑气攻击。华山剑法名震天下，攻击力超群。',
    minLevel: 3
  },
  kunlun: {
    id: 'kunlun',
    name: '昆仑派',
    type: '正派',
    bonus: 'spirit+15%',
    bonusDesc: '灵力+15%',
    desc: '远程攻击，内功深厚。昆仑弟子内力雄浑，灵力远超常人。',
    minLevel: 3
  },
  riyue: {
    id: 'riyue',
    name: '日月神教',
    type: '邪派',
    bonus: 'critRate+10%',
    bonusDesc: '暴击率+10%',
    desc: '高爆发，PK强。日月神教行事诡异，招式狠辣，暴击极高。',
    minLevel: 3
  },
  wudu: {
    id: 'wudu',
    name: '五毒教',
    type: '邪派',
    bonus: 'poisonDmg+15%',
    bonusDesc: '毒伤+15%',
    desc: '毒术专精，持续伤害。五毒教精通奇毒，令敌人防不胜防。',
    minLevel: 3
  },
  taohua: {
    id: 'taohua',
    name: '桃花岛',
    type: '中立',
    bonus: 'luck+10%',
    bonusDesc: '悟性+10%',
    desc: '阵法/音律，悟性加成。桃花岛主精通奇门遁甲，弟子悟性极高。',
    minLevel: 3
  }
};

// ===== PILLS (丹药) SYSTEM =====
const PILLS_DATA = {
  hp_pill: {
    id: 'hp_pill',
    name: '回血丹',
    effect: '恢复50点生命',
    price: 10,
    apply: (player) => {
      const healed = Math.min(50, player.maxHp - player.hp);
      player.hp = Math.min(player.maxHp, player.hp + 50);
      return `恢复了 ${healed} 点生命值。当前HP: ${player.hp}/${player.maxHp}`;
    }
  },
  spirit_pill: {
    id: 'spirit_pill',
    name: '回灵丹',
    effect: '恢复30点灵力',
    price: 15,
    apply: (player) => {
      const restored = Math.min(30, player.maxSpirit - player.spirit);
      player.spirit = Math.min(player.maxSpirit, player.spirit + 30);
      return `恢复了 ${restored} 点灵力。当前灵力: ${player.spirit}/${player.maxSpirit}`;
    }
  },
  stamina_pill: {
    id: 'stamina_pill',
    name: '体力丹',
    effect: '恢复50点体力',
    price: 20,
    apply: (player) => {
      const restored = Math.min(50, player.maxStamina - player.stamina);
      player.stamina = Math.min(player.maxStamina, player.stamina + 50);
      return `恢复了 ${restored} 点体力。当前体力: ${player.stamina}/${player.maxStamina}`;
    }
  },
  exp_pill: {
    id: 'exp_pill',
    name: '小培元丹',
    effect: '获得50经验',
    price: 50,
    apply: (player) => {
      const result = addExp(player, 50);
      let msg = '获得了 50 经验！';
      if (result.leveled) msg += `\n🎊 恭喜！你升级了！当前等级: ${player.level}`;
      if (result.realmChanged) msg += `\n✨ 突破成功！你的境界提升为: ${player.realm}`;
      return msg;
    }
  }
};

// ===== EQUIPMENT (装备) SYSTEM =====
const EQUIPMENT_DATA = {
  wooden_sword: {
    id: 'wooden_sword',
    name: '木剑',
    slot: 'weapon',
    attack: 5,
    price: 20,
    description: '一把普通的木剑，适合初学者。'
  },
  iron_sword: {
    id: 'iron_sword',
    name: '铁剑',
    slot: 'weapon',
    attack: 12,
    price: 80,
    description: '精铁打造的长剑，锋利耐用。'
  },
  cloth_armor: {
    id: 'cloth_armor',
    name: '布衣',
    slot: 'body',
    defense: 3,
    price: 15,
    description: '简单的布衣，聊胜于无。'
  },
  leather_armor: {
    id: 'leather_armor',
    name: '皮甲',
    slot: 'body',
    defense: 8,
    price: 60,
    description: '厚实的皮甲，提供不错的防护。'
  },
  straw_shoes: {
    id: 'straw_shoes',
    name: '草鞋',
    slot: 'feet',
    speed: 2,
    price: 10,
    description: '编织的草鞋，轻便舒适。'
  },
  iron_ring: {
    id: 'iron_ring',
    name: '铁戒指',
    slot: 'ring',
    str: 2,
    price: 30,
    description: '附有微弱灵力的铁戒指，提升力量。'
  }
};

// ===== SHOP ITEMS =====
const SHOP_ITEMS = {
  hp_pill: { id: 'hp_pill', name: '回血丹', type: 'pill', price: 10, desc: '恢复50点生命' },
  spirit_pill: { id: 'spirit_pill', name: '回灵丹', type: 'pill', price: 15, desc: '恢复30点灵力' },
  stamina_pill: { id: 'stamina_pill', name: '体力丹', type: 'pill', price: 20, desc: '恢复50点体力' },
  exp_pill: { id: 'exp_pill', name: '小培元丹', type: 'pill', price: 50, desc: '获得50经验' },
  wooden_sword: { id: 'wooden_sword', name: '木剑', type: 'equipment', price: 20, desc: '攻击+5' },
  cloth_armor: { id: 'cloth_armor', name: '布衣', type: 'equipment', price: 15, desc: '防御+3' }
};

// ===== ENCOUNTER SYSTEM =====
const ENCOUNTERS = [
  {
    id: 'master_guide', name: '高人指点', chance: 0.05,
    trigger: 'explore',
    text: '一位白发老者出现在你面前，指点了几句修炼心得...',
    apply: (ws, player) => {
      const { leveled, realmChanged } = addExp(player, 50);
      let msg = '获得 50 经验！';
      if (leveled) msg += '\n🎊 恭喜！你升级了！';
      if (realmChanged) msg += '\n✨ 境界突破！';
      // 30% chance to learn a random unlearned skill
      const unlearned = Object.keys(SKILLS_DATA).filter(id => !player.skills.some(s => s.id === id));
      if (unlearned.length > 0 && Math.random() < 0.3) {
        const newSkillId = unlearned[Math.floor(Math.random() * unlearned.length)];
        player.skills.push({ id: newSkillId, level: 1, exp: 0 });
        const sd = SKILLS_DATA[newSkillId];
        msg += `\n📜 领悟了新功法【${sd.name}】！`;
      }
      return msg;
    }
  },
  {
    id: 'ancient_ruins', name: '上古遗迹', chance: 0.03,
    trigger: 'explore',
    text: '你发现了一处上古遗迹，里面有些宝物...',
    apply: (ws, player) => {
      const { leveled, realmChanged } = addExp(player, 100);
      const equipIds = Object.keys(EQUIPMENT_DATA);
      const randomEquipId = equipIds[Math.floor(Math.random() * equipIds.length)];
      player.equipmentBag.push({ id: randomEquipId });
      const ed = EQUIPMENT_DATA[randomEquipId];
      let msg = `获得 100 经验，发现【${ed.name}】！`;
      if (leveled) msg += '\n🎊 恭喜！你升级了！';
      if (realmChanged) msg += '\n✨ 境界突破！';
      return msg;
    }
  },
  {
    id: 'inner_demon', name: '心魔考验', chance: 0.04,
    trigger: 'idle',
    text: '你的心魔出现了！输入 /战斗心魔 或 /逃跑',
    apply: (ws, player) => {
      player.pendingEncounter = 'inner_demon';
      return '输入 /战斗心魔 或 /逃跑';
    }
  },
  {
    id: 'traveling_merchant', name: '路遇商人', chance: 0.06,
    trigger: 'explore',
    text: '一位行商路过，向你推销丹药...',
    apply: (ws, player) => {
      return '商人出售: 回血丹(5灵石), 回灵丹(8灵石), 体力丹(10灵石)。\n输入 /商人购买 <丹药ID> [数量] 以折扣价购买。';
    }
  },
  {
    id: 'lucky_event', name: '天降福缘', chance: 0.02,
    trigger: 'both',
    text: '天上掉下一块灵石砸中了你的头！',
    apply: (ws, player) => {
      const { leveled, realmChanged } = addExp(player, 200);
      player.silver += 100;
      let msg = '获得 200 经验和 100 灵石！';
      if (leveled) msg += '\n🎊 恭喜！你升级了！';
      if (realmChanged) msg += '\n✨ 境界突破！';
      return msg;
    }
  }
];

// Random encounter check
function checkEncounter(ws, player, triggerType) {
  for (const enc of ENCOUNTERS) {
    if (enc.trigger !== triggerType && enc.trigger !== 'both') continue;
    if (Math.random() < enc.chance) {
      const rewardMsg = enc.apply(ws, player);
      if (!player.encounterLog) player.encounterLog = [];
      player.encounterLog.unshift({
        name: enc.name, time: new Date().toISOString(), message: enc.text
      });
      if (player.encounterLog.length > 10) player.encounterLog.length = 10;
      sendToClient(ws, {
        type: 'encounter',
        data: { encounter: enc.name, text: enc.text, reward: rewardMsg }
      });
      return enc;
    }
  }
  return null;
}

// ===== QUESTS (任务) SYSTEM =====
const QUESTS_DATA = {
  q_first_steps: {
    id: 'q_first_steps',
    name: '初入修仙',
    type: 'main',
    description: '修仙之路始于足下，提升到3级',
    requirement: { type: 'level', target: 3 },
    reward: { exp: 100, silver: 50 },
    prereq: null
  },
  q_bamboo_trial: {
    id: 'q_bamboo_trial',
    name: '竹林历练',
    type: 'main',
    description: '在竹林中击败5只怪物',
    requirement: { type: 'kill_bamboo', target: 5 },
    reward: { exp: 200, pills: { hp_pill: 5 } },
    prereq: 'q_first_steps'
  },
  q_join_sect: {
    id: 'q_join_sect',
    name: '加入门派',
    type: 'main',
    description: '拜入门派，开始正式修炼',
    requirement: { type: 'join_sect', target: 1 },
    reward: { exp: 150, silver: 100 },
    prereq: null
  },
  dq_daily_cultivate: {
    id: 'dq_daily_cultivate',
    name: '每日修炼',
    type: 'daily',
    description: '修炼功法3次',
    requirement: { type: 'practice_skill', target: 3 },
    reward: { exp: 30, silver: 10 },
    prereq: null
  },
  dq_daily_combat: {
    id: 'dq_daily_combat',
    name: '每日战斗',
    type: 'daily',
    description: '击杀3只怪物',
    requirement: { type: 'kill_any', target: 3 },
    reward: { exp: 50, silver: 20 },
    prereq: null
  },
  // Cyber quest: Admin Watch
  q_admin_watch: {
    id: 'q_admin_watch',
    name: '世界异常',
    type: 'main',
    description: '你感觉到了这个世界的异常...探索竹林寻找真相',
    requirement: { type: 'explore_bamboo', target: 1 },
    reward: { exp: 150, silver: 50, special: 'admin_watch' },
    prereq: null
  }
};

// NPC data
const NPCS = {
  '村长': {
    name: '村长',
    location: '村长屋',
    dialogues: [
      '年轻人，你可知道这世间有三大门派？少林防御坚固，武当内力深厚，逍遥则奇遇多多。到了3级，便可去寻访门派了。',
      '修仙之路漫漫，先在竹林练练手，打打野兔野鸡。等实力够了，自然能拜入名门。',
      '功法也很重要！在修炼场多练练功法，功法等级越高，战斗时越厉害。'
    ]
  },
  '铁匠': {
    name: '铁匠',
    location: '铁匠铺',
    dialogues: [
      '嘿！要打造装备的话，你还得再等等。这铺子正在筹备中，以后会有好兵器卖的！',
      '好的兵器能大大提升战斗力。等铺子开业了，记得常来看看。',
      '听说高级副本里能打出稀有材料，拿来打造神兵利器再好不过了。'
    ]
  }
};

// ===== PROGRAM RELIC (程序遗物) SYSTEM =====
const RELICS_DATA = {
  // Category 1: 十二月遗物 (Monthly Relics)
  M01: { id: 'M01', name: '正月·春雷碎片', category: '十二月', desc: '悟性+5%, 突破率+3%', effects: { wisdom: 0.05, breakthrough: 0.03 } },
  M02: { id: 'M02', name: '二月·惊蛰之种', category: '十二月', desc: 'HP+8%, 回复+15%', effects: { hp: 0.08, regen: 0.15 } },
  M03: { id: 'M03', name: '三月·清明露珠', category: '十二月', desc: '灵力+10%, 炼丹+5%', effects: { spirit: 0.10, alchemy: 0.05 } },
  M04: { id: 'M04', name: '四月·谷雨精华', category: '十二月', desc: '经验+5%, 体力恢复+10%', effects: { exp: 0.05, staminaRecovery: 0.10 } },
  M05: { id: 'M05', name: '五月·端午龙鳞', category: '十二月', desc: '防御+8%, 毒抗+20%', effects: { defense: 0.08, poisonResist: 0.20 } },
  M06: { id: 'M06', name: '六月·夏至烈焰', category: '十二月', desc: '攻击+10%, 暴击伤害+15%', effects: { attack: 0.10, critDamage: 0.15 } },
  // Category 2: 十二时辰遗物 (Time Relics)
  T01: { id: 'T01', name: '子时·夜半钟声', category: '十二时辰', desc: '挂机经验+8%, 夜间修炼+15%', effects: { idleExp: 0.08, nightCultivation: 0.15 } },
  T02: { id: 'T02', name: '丑时·鸡鸣破晓', category: '十二时辰', desc: '闪避+10%, 先手+8%', effects: { dodge: 0.10, initiative: 0.08 } },
  T03: { id: 'T03', name: '寅时·平旦微光', category: '十二时辰', desc: 'HP回复+12%, 减益时间-20%', effects: { hpRegen: 0.12, debuffReduction: 0.20 } },
  // Category 3: 十二生肖遗物 (Zodiac Relics)
  Z01: { id: 'Z01', name: '子鼠·窃运之爪', category: '十二生肖', desc: '偷取+10%, 掉落+5%', effects: { stealChance: 0.10, lootBonus: 0.05 } },
  Z02: { id: 'Z02', name: '丑牛·蛮力之心', category: '十二生肖', desc: '力量+15%, 负重+30%', effects: { strength: 0.15, carryWeight: 0.30 } },
  Z03: { id: 'Z03', name: '寅虎·啸风之牙', category: '十二生肖', desc: '暴击率+10%, 恐惧+8%', effects: { critRate: 0.10, fearChance: 0.08 } }
};

// Admin Watch level thresholds
const WATCH_THRESHOLDS = [
  { level: 0, relics: 0, abilities: '无' },
  { level: 1, relics: 1, abilities: '查看隐藏信息(怪物真实HP)' },
  { level: 2, relics: 3, abilities: 'Bug探测器(查看Bug位置)' },
  { level: 3, relics: 6, abilities: '自动Bug任务, 瞬移(5次/天)' },
  { level: 4, relics: 9, abilities: '战斗预测, 经验+10%' }
];

// ===== BUG EXPLOITATION SYSTEM =====
const BUGS_DATA = {
  // Experience bugs
  B01: { id: 'B01', name: '时间膨胀泡', category: '经验', desc: '挂机经验x3 持续10分钟', dailyLimit: 3, duration: 600000 },
  B02: { id: 'B02', name: '经验溢出点', category: '经验', desc: '战斗经验x2 持续1小时', dailyLimit: 1, duration: 3600000 },
  // Item bugs
  B11: { id: 'B11', name: '背包溢出', category: '物品', desc: '临时+100背包格 1小时', dailyLimit: 1, duration: 3600000 },
  B12: { id: 'B12', name: '商店漏洞', category: '物品', desc: '免费随机商店物品', dailyLimit: 1, duration: 0 },
  // Combat bugs
  B31: { id: 'B31', name: '伤害溢出', category: '战斗', desc: '下次攻击伤害x3', dailyLimit: 3, duration: 0 },
  B33: { id: 'B33', name: '怪物卡住', category: '战斗', desc: '怪物跳过1回合', dailyLimit: 3, duration: 0 },
  // Special bugs
  B45: { id: 'B45', name: '道心漏洞', category: '特殊', desc: '道心+200 持续1小时', dailyLimit: 1, duration: 3600000 },
  B49: { id: 'B49', name: '体力漏洞', category: '特殊', desc: '无限体力30分钟', dailyLimit: 1, duration: 1800000 },
  B50: { id: 'B50', name: '掉率漏洞', category: '特殊', desc: '掉率x5 持续1小时', dailyLimit: 1, duration: 3600000 },
  // Teleport bugs
  B17: { id: 'B17', name: '瞬移漏洞', category: '传送', desc: '传送到已探索地图', dailyLimit: 3, duration: 0 },
  B20: { id: 'B20', name: '回城Bug', category: '传送', desc: '瞬间回到新手村', dailyLimit: 999, duration: 0 },
  B21: { id: 'B21', name: '传送门', category: '传送', desc: '创建传送门30分钟', dailyLimit: 1, duration: 1800000 }
};

// Bug discovery locations
const BUG_LOCATIONS = {
  '竹林': ['B01', 'B33'],
  '村长屋': ['B12', 'B45'],
  '集市': ['B11', 'B50'],
  '客栈': ['B02', 'B49'],
  '药铺': ['B21'],
  '铁匠铺': ['B31'],
  '修炼场': ['B17', 'B20']
};

// Get player data
function getPlayers() {
  return readJSON(PLAYERS_FILE);
}

// Get sessions data
function getSessions() {
  return readJSON(SESSIONS_FILE);
}

// Save player data
function savePlayers(players) {
  // P0-4: Update lastOnlineTime for all connected players
  for (const [ws, clientInfo] of connectedClients.entries()) {
    if (ws.readyState === WebSocket.OPEN && players[clientInfo.playerId]) {
      players[clientInfo.playerId].lastOnlineTime = Date.now();
    }
  }
  writeJSON(PLAYERS_FILE, players);
}

// Save sessions data
function saveSessions(sessions) {
  writeJSON(SESSIONS_FILE, sessions);
}

// Create Express app
const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Parse JSON bodies
app.use(express.json());

// WebSocket server
const wss = new WebSocket.Server({ server });

// Track connected clients
const connectedClients = new Map(); // ws -> { playerId, playerName }
// Track players pending profession selection
const pendingProfessionSelections = new Map(); // playerId -> ws

// Broadcast message to all connected clients
function broadcast(message, excludeWs = null) {
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Send message to specific client
function sendToClient(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Get player by session token
function getPlayerByToken(token) {
  const sessions = getSessions();
  const playerId = sessions[token];
  if (!playerId) return null;
  
  const players = getPlayers();
  return players[playerId] || null;
}

// Create new player
function createPlayer(email, password, name, profession) {
  const players = getPlayers();
  
  // Check if email already exists
  const existingPlayer = Object.values(players).find(p => p.email === email);
  if (existingPlayer) {
    return { error: '该邮箱已被注册' };
  }
  
  // Check if name already exists
  const existingName = Object.values(players).find(p => p.name === name);
  if (existingName) {
    return { error: '该角色名已被使用' };
  }
  
  const playerId = uuidv4();
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  const newPlayer = {
    id: playerId,
    email: email,
    password: hashedPassword,
    name: name,
    isAdmin: email === 'admin@game.com',
    profession: null,
    stats: null,
    level: 1,
    realm: '练气期',
    exp: 0,
    hp: 0,
    maxHp: 0,
    spirit: 0,
    maxSpirit: 0,
    stamina: 0,
    maxStamina: 0,
    silver: 100,
    jade: 0,
    currentMap: null,
    currentRoom: null,
    needsProfession: true,
    isIdle: false,
    idleStartTime: null,
    skills: [
      { id: 'basic_fist', level: 1, exp: 0 },
      { id: 'basic_meditation', level: 1, exp: 0 }
    ],
    sect: null,
    sectContribution: 0,
    pills: { hp_pill: 3, spirit_pill: 2 },
    equipment: { weapon: null, head: null, body: null, feet: null, ring: null },
    equipmentBag: [],
    quests: { active: [], completed: [], dailyCompleted: {}, progress: {} },
    createdAt: new Date().toISOString(),
    encounterLog: [],
    friends: [],
    pendingFriendRequests: [],
    lastSignIn: null,
    channel: 'world',
    pendingEncounter: null,
    // Cyber systems
    relics: [],
    adminWatch: false,
    adminWatchLevel: 0,
    discoveredBugs: [],
    bugUsage: {},
    mysteryLetters: 0,
    activeBugs: {},
    exploredRooms: [],
    // P0-1: Dao Heart system
    daoHeart: 500,
    // P0-2: Credit Score system
    creditScore: 500,
    // P0-3: Bag capacity
    bagCapacity: 50,
    // P0-4: Offline gains tracking
    lastOnlineTime: Date.now(),
    // P0-6a: Lifespan system
    lifespan: 100,
    age: 60
  };
  
  players[playerId] = newPlayer;
  savePlayers(players);
  
  return { player: newPlayer };
}

// Authenticate player
function authenticatePlayer(email, password) {
  const players = getPlayers();
  const player = Object.values(players).find(p => p.email === email);
  
  if (!player) {
    return { error: '账号不存在' };
  }
  
  if (!bcrypt.compareSync(password, player.password)) {
    return { error: '密码错误' };
  }
  
  return { player };
}

// Create session
function createSession(playerId) {
  const sessions = getSessions();
  const token = uuidv4();
  sessions[token] = playerId;
  saveSessions(sessions);
  return token;
}

// Remove session
function removeSession(token) {
  const sessions = getSessions();
  delete sessions[token];
  saveSessions(sessions);
}

// Handle WebSocket connection
wss.on('connection', (ws, req) => {
  console.log('新的WebSocket连接');
  
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('消息解析错误:', error);
      sendToClient(ws, {
        type: 'error',
        data: { message: '消息格式错误' }
      });
    }
  });
  
  ws.on('close', () => {
    const clientInfo = connectedClients.get(ws);
    if (clientInfo) {
      // Clear idle state on disconnect
      const players = getPlayers();
      const player = players[clientInfo.playerId];
      if (player && player.isIdle) {
        player.isIdle = false;
        player.idleStartTime = null;
        savePlayers(players);
      }
      
      connectedClients.delete(ws);
      broadcast({
        type: 'system',
        data: { message: `${clientInfo.playerName} 离开了游戏` }
      });
    }
    console.log('WebSocket连接关闭');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

// Heartbeat interval
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
  clearInterval(idleTickInterval);
});

// Message handler
function handleMessage(ws, message) {
  const { type, data } = message;
  
  switch (type) {
    case 'register':
      handleRegister(ws, data);
      break;
    case 'login':
      handleLogin(ws, data);
      break;
    case 'select_profession':
      handleSelectProfession(ws, data);
      break;
    case 'get_professions':
      sendToClient(ws, { type: 'professions_list', data: { professions } });
      break;
    case 'chat':
      handleChat(ws, data);
      break;
    case 'command':
      handleCommand(ws, data);
      break;
    case 'move':
      handleMove(ws, data);
      break;
    case 'look':
      handleLook(ws, data);
      break;
    case 'status':
      handleStatus(ws, data);
      break;
    default:
      sendToClient(ws, {
        type: 'error',
        data: { message: '未知的消息类型' }
      });
  }
}

// Register handler
function handleRegister(ws, data) {
  const { email, password, name, profession } = data;
  
  if (!email || !password || !name) {
    sendToClient(ws, {
      type: 'register_response',
      data: { success: false, message: '邮箱、密码和角色名不能为空' }
    });
    return;
  }
  
  if (password.length < 6) {
    sendToClient(ws, {
      type: 'register_response',
      data: { success: false, message: '密码长度不能少于6位' }
    });
    return;
  }
  
  if (name.length < 2 || name.length > 12) {
    sendToClient(ws, {
      type: 'register_response',
      data: { success: false, message: '角色名长度需要在2-12个字符之间' }
    });
    return;
  }
  
  const result = createPlayer(email, password, name, profession);
  
  if (result.error) {
    sendToClient(ws, {
      type: 'register_response',
      data: { success: false, message: result.error }
    });
    return;
  }
  
  // Don't auto-login - require profession selection first
  pendingProfessionSelections.set(result.player.id, ws);
  
  sendToClient(ws, {
    type: 'register_response',
    data: {
      success: true,
      needsProfession: true,
      playerId: result.player.id,
      professions: professions
    }
  });
}

// Login handler
function handleLogin(ws, data) {
  const { email, password } = data;
  
  if (!email || !password) {
    sendToClient(ws, {
      type: 'login_response',
      data: { success: false, message: '邮箱和密码不能为空' }
    });
    return;
  }
  
  const result = authenticatePlayer(email, password);
  
  if (result.error) {
    sendToClient(ws, {
      type: 'login_response',
      data: { success: false, message: result.error }
    });
    return;
  }
  
  // Check if player needs profession selection
  if (result.player.needsProfession) {
    pendingProfessionSelections.set(result.player.id, ws);
    sendToClient(ws, {
      type: 'login_response',
      data: {
        success: true,
        needsProfession: true,
        playerId: result.player.id,
        professions: professions
      }
    });
    return;
  }
  
  // Check if already logged in
  for (const [clientWs, clientInfo] of connectedClients.entries()) {
    if (clientInfo.playerId === result.player.id && clientWs !== ws) {
      // Kick old session
      sendToClient(clientWs, {
        type: 'kicked',
        data: { message: '你的账号在其他地方登录' }
      });
      clientWs.close();
      connectedClients.delete(clientWs);
      break;
    }
  }
  
  const token = createSession(result.player.id);
  
  // Initialize missing properties for existing players
  if (!result.player.skills || result.player.skills.length === 0) result.player.skills = [{ id: 'basic_fist', level: 1, exp: 0 }, { id: 'basic_meditation', level: 1, exp: 0 }];
  if (!result.player.sect) result.player.sect = null;
  if (!result.player.sectContribution) result.player.sectContribution = 0;
  if (!result.player.isIdle) result.player.isIdle = false;
  if (!result.player.idleStartTime) result.player.idleStartTime = null;
  if (!result.player.pills) result.player.pills = { hp_pill: 3, spirit_pill: 2 };
  if (!result.player.equipment) result.player.equipment = { weapon: null, head: null, body: null, feet: null, ring: null };
  if (!result.player.equipmentBag) result.player.equipmentBag = [];
  if (!result.player.quests) result.player.quests = { active: [], completed: [], dailyCompleted: {}, progress: {} };
  if (!result.player.quests.progress) result.player.quests.progress = {};
  if (!result.player.encounterLog) result.player.encounterLog = [];
  if (!result.player.friends) result.player.friends = [];
  if (!result.player.pendingFriendRequests) result.player.pendingFriendRequests = [];
  if (!result.player.lastSignIn) result.player.lastSignIn = null;
  if (!result.player.channel) result.player.channel = 'world';
  if (!result.player.pendingEncounter) result.player.pendingEncounter = null;
  // Cyber system fields
  if (!result.player.relics) result.player.relics = [];
  if (!result.player.adminWatch) result.player.adminWatch = false;
  if (!result.player.adminWatchLevel) result.player.adminWatchLevel = 0;
  if (!result.player.discoveredBugs) result.player.discoveredBugs = [];
  if (!result.player.bugUsage) result.player.bugUsage = {};
  if (!result.player.mysteryLetters) result.player.mysteryLetters = 0;
  if (!result.player.activeBugs) result.player.activeBugs = {};
  if (!result.player.exploredRooms) result.player.exploredRooms = [];
  if (result.player.isAdmin === undefined) result.player.isAdmin = result.player.email === 'admin@game.com';
  // P0-1: Dao Heart initialization
  if (result.player.daoHeart === undefined) result.player.daoHeart = 500;
  // P0-2: Credit Score initialization
  if (result.player.creditScore === undefined) result.player.creditScore = 500;
  // P0-3: Bag capacity initialization
  if (result.player.bagCapacity === undefined) result.player.bagCapacity = 50;
  // P0-6a: Lifespan initialization
  if (result.player.lifespan === undefined) result.player.lifespan = getRealmLifespan(result.player.realm);
  if (result.player.age === undefined) result.player.age = 60;
  
  // P0-4: Offline gains calculation
  const now = Date.now();
  if (result.player.lastOnlineTime) {
    const offlineDuration = now - result.player.lastOnlineTime;
    if (offlineDuration > 5 * 60 * 1000) { // > 5 minutes
      const offlineMinutes = Math.min(offlineDuration / 60000, 1440); // max 24 hours
      const offlineExp = Math.floor(offlineMinutes * 0.5);
      if (offlineExp > 0) {
        addExp(result.player, offlineExp);
        // Partial recovery of spirit and stamina
        result.player.spirit = Math.min(result.player.maxSpirit, Math.floor(result.player.spirit + offlineMinutes * 0.5));
        result.player.stamina = Math.min(result.player.maxStamina, Math.floor(result.player.stamina + offlineMinutes * 0.3));
        sendToClient(ws, {
          type: 'system',
          data: { message: `⏰ 你在离线期间（${Math.floor(offlineMinutes)}分钟）获得了 ${offlineExp} 经验，灵力和体力也有所恢复。` }
        });
      }
    }
  }
  result.player.lastOnlineTime = now;
  
  savePlayers(getPlayers());
  
  connectedClients.set(ws, {
    playerId: result.player.id,
    playerName: result.player.name
  });
  
  sendToClient(ws, {
    type: 'login_response',
    data: {
      success: true,
      message: '登录成功！',
      token: token,
      player: sanitizePlayer(result.player)
    }
  });
  
  // Send current room description
  const room = getRoom(result.player.currentMap, result.player.currentRoom);
  if (room) {
    sendToClient(ws, {
      type: 'room',
      data: {
        name: room.name,
        description: room.description,
        exits: room.exits,
        players: getPlayersInRoom(result.player.currentMap, result.player.currentRoom, ws)
      }
    });
  }
  
  broadcast({
    type: 'system',
    data: { message: `${result.player.name} 进入了游戏` }
  }, ws);
}

// Select profession handler
function handleSelectProfession(ws, data) {
  const { playerId, professionId, stats } = data;
  
  // Validate profession exists
  const profession = professions.find(p => p.id === professionId);
  if (!profession) {
    sendToClient(ws, {
      type: 'select_profession_response',
      data: { success: false, message: '无效的职业选择' }
    });
    return;
  }
  
  // Validate stats exist
  if (!stats || typeof stats.str !== 'number' || typeof stats.dex !== 'number' || typeof stats.con !== 'number' || typeof stats.wis !== 'number') {
    sendToClient(ws, {
      type: 'select_profession_response',
      data: { success: false, message: '属性数据无效' }
    });
    return;
  }
  
  // Validate stats total = 100
  const total = stats.str + stats.dex + stats.con + stats.wis;
  if (total !== 100) {
    sendToClient(ws, {
      type: 'select_profession_response',
      data: { success: false, message: `属性总和必须为100，当前为${total}` }
    });
    return;
  }
  
  // Validate each stat is within reasonable range (1-50)
  for (const stat of ['str', 'dex', 'con', 'wis']) {
    if (stats[stat] < 1 || stats[stat] > 50) {
      sendToClient(ws, {
        type: 'select_profession_response',
        data: { success: false, message: `${stat}属性超出范围（1-50），当前值${stats[stat]}` }
      });
      return;
    }
  }
  
  // Update player
  const players = getPlayers();
  const player = players[playerId];
  if (!player) {
    sendToClient(ws, {
      type: 'select_profession_response',
      data: { success: false, message: '玩家不存在' }
    });
    return;
  }
  
  player.profession = profession.name;
  player.stats = stats;
  player.needsProfession = false;
  player.currentMap = '新手村';
  player.currentRoom = '村口';
  
  // Calculate maxHp/maxSpirit/maxStamina based on stats
  player.maxHp = 80 + stats.con * 2;
  player.maxSpirit = 30 + stats.wis * 2;
  player.maxStamina = 80 + stats.con + stats.dex;
  player.hp = player.maxHp;
  player.spirit = player.maxSpirit;
  player.stamina = player.maxStamina;
  
  savePlayers(players);
  
  // Remove from pending
  pendingProfessionSelections.delete(playerId);
  
  // Auto-login
  const token = createSession(playerId);
  connectedClients.set(ws, { playerId: player.id, playerName: player.name });
  
  sendToClient(ws, {
    type: 'select_profession_response',
    data: {
      success: true,
      message: '职业选择完成！',
      token: token,
      player: sanitizePlayer(player)
    }
  });
  
  // Also send login_response for client compatibility
  sendToClient(ws, {
    type: 'login_response',
    data: {
      success: true,
      message: '职业选择完成！',
      token: token,
      player: sanitizePlayer(player)
    }
  });
  
  // Send room
  const room = getRoom(player.currentMap, player.currentRoom);
  if (room) {
    sendToClient(ws, {
      type: 'room',
      data: {
        name: room.name,
        description: room.description,
        exits: room.exits,
        players: []
      }
    });
  }
  
  // Broadcast new player joining
  broadcast({
    type: 'system',
    data: { message: `${player.name} 穿越到了这个世界` }
  }, ws);
}

// Chat handler
function handleChat(ws, data) {
  const clientInfo = connectedClients.get(ws);
  if (!clientInfo) {
    sendToClient(ws, {
      type: 'error',
      data: { message: '请先登录' }
    });
    return;
  }
  
  const { message } = data;
  if (!message || message.trim() === '') return;
  
  broadcast({
    type: 'chat',
    data: {
      sender: clientInfo.playerName,
      message: message.trim(),
      channel: 'world',
      timestamp: new Date().toISOString()
    }
  });
}

// Command handler
function handleCommand(ws, data) {
  const clientInfo = connectedClients.get(ws);
  if (!clientInfo) {
    sendToClient(ws, {
      type: 'error',
      data: { message: '请先登录' }
    });
    return;
  }
  
  const players = getPlayers();
  const player = players[clientInfo.playerId];
  if (!player) return;
  
  const { command } = data;
  
  if (command.startsWith('/属性')) {
    handleStatsCommand(ws, player);
  } else if (command.startsWith('/背包')) {
    handleInventoryCommand(ws, player);
  } else if (command.startsWith('/地图')) {
    handleMapCommand(ws, player);
  } else if (command.startsWith('/移动')) {
    const direction = command.replace('/移动', '').trim();
    handleMoveCommand(ws, player, direction);
  } else if (command.startsWith('/频道')) {
    handleChannelCommand(ws, player, command);
  } else if (command.startsWith('/交谈')) {
    handleTalkCommand(ws, player, command);
  } else if (command.startsWith('/攻击')) {
    handleAttackCommand(ws, player, command);
  } else if (command.startsWith('/挂机')) {
    handleIdleCommand(ws, player);
  } else if (command.startsWith('/打坐')) {
    handleIdleCommand(ws, player);
  } else if (command.startsWith('/停止挂机')) {
    handleStopIdleCommand(ws, player);
  } else if (command.startsWith('/境界')) {
    handleRealmCommand(ws, player);
  } else if (command.startsWith('/帮助')) {
    handleHelpCommand(ws, player);
  } else if (command.startsWith('/功法')) {
    handleSkillListCommand(ws, player);
  } else if (command.startsWith('/学习')) {
    const skillId = command.replace('/学习', '').trim();
    handleLearnSkillCommand(ws, player, skillId);
  } else if (command.startsWith('/修炼')) {
    const skillId = command.replace('/修炼', '').trim();
    handlePracticeSkillCommand(ws, player, skillId);
  } else if (command.startsWith('/加入门派')) {
    const sectId = command.replace('/加入门派', '').trim();
    handleJoinSectCommand(ws, player, sectId);
  } else if (command.startsWith('/门派信息')) {
    handleSectInfoCommand(ws, player);
  } else if (command.startsWith('/门派')) {
    handleSectListCommand(ws, player);
  } else if (command.startsWith('/购买丹药')) {
    handleBuyPillCommand(ws, player, command);
  } else if (command.startsWith('/使用')) {
    handleUsePillCommand(ws, player, command);
  } else if (command.startsWith('/炼丹')) {
    handleCraftPillCommand(ws, player, command);
  } else if (command.startsWith('/丹药')) {
    handlePillListCommand(ws, player);
  } else if (command.startsWith('/购买装备')) {
    handleBuyEquipmentCommand(ws, player, command);
  } else if (command.startsWith('/购买')) {
    handleBuyItemCommand(ws, player, command);
  } else if (command.startsWith('/装备栏')) {
    handleEquipmentBagCommand(ws, player);
  } else if (command.startsWith('/穿戴')) {
    handleEquipCommand(ws, player, command);
  } else if (command.startsWith('/脱下')) {
    handleUnequipCommand(ws, player, command);
  } else if (command.startsWith('/装备')) {
    handleEquipmentCommand(ws, player);
  } else if (command.startsWith('/提交任务')) {
    handleCompleteQuestCommand(ws, player, command);
  } else if (command.startsWith('/接任务')) {
    handleAcceptQuestCommand(ws, player, command);
  } else if (command.startsWith('/任务')) {
    handleQuestListCommand(ws, player);
  } else if (command.startsWith('/商店')) {
    handleShopCommand(ws, player);
  } else if (command.startsWith('/出售')) {
    handleSellItemCommand(ws, player, command);
  } else if (command.startsWith('/签到')) {
    handleSignInCommand(ws, player);
  } else if (command.startsWith('/奇遇')) {
    handleEncounterLogCommand(ws, player);
  } else if (command.startsWith('/好友')) {
    handleFriendsCommand(ws, player);
  } else if (command.startsWith('/添加好友')) {
    handleAddFriendCommand(ws, player, command);
  } else if (command.startsWith('/接受好友')) {
    handleAcceptFriendCommand(ws, player);
  } else if (command.startsWith('/删除好友')) {
    handleRemoveFriendCommand(ws, player, command);
  } else if (command.startsWith('/私聊')) {
    handleWhisperCommand(ws, player, command);
  } else if (command.startsWith('/战斗心魔')) {
    handleFightDemonCommand(ws, player);
  } else if (command.startsWith('/逃跑')) {
    handleFleeCommand(ws, player);
  } else if (command.startsWith('/商人购买')) {
    handleMerchantBuyCommand(ws, player, command);
  } else if (command.startsWith('/遗物')) {
    handleRelicCommand(ws, player);
  } else if (command.startsWith('/手表')) {
    handleWatchCommand(ws, player);
  } else if (command.startsWith('/探索Bug')) {
    handleExploreBugCommand(ws, player);
  } else if (command.startsWith('/使用Bug')) {
    const bugId = command.replace('/使用Bug', '').trim();
    handleUseBugCommand(ws, player, bugId);
  } else if (command.startsWith('/Bug')) {
    handleBugListCommand(ws, player);
  } else if (command.startsWith('/道心')) {
    handleDaoHeartCommand(ws, player);
  } else if (command.startsWith('/信誉')) {
    handleCreditScoreCommand(ws, player);
  } else if (command.startsWith('/管理员')) {
    handleAdminCommand(ws, player, command);
  } else {
    sendToClient(ws, {
      type: 'error',
      data: { message: '未知命令。输入 /帮助 查看所有可用命令。' }
    });
  }
}

// Stats command
function handleStatsCommand(ws, player) {
  const expToNextLevel = player.level * 100;
  const realmInfo = getRealmInfo(player);
  const idleStatus = player.isIdle ? '🧘 打坐中' : '活跃';
  const realmProgress = realmInfo && realmInfo.subLevel ? 
    `${player.exp}/${realmInfo.subLevel.expRequired} (${Math.floor(player.exp / realmInfo.subLevel.expRequired * 100)}%)` : '-';
  
  const dh = player.daoHeart || 500;
  const dhBonus = getDaoHeartBonus(player);
  const cs = player.creditScore || 500;
  const csBonus = getCreditBonus(player);
  const age = player.age || 60;
  const lifespan = player.lifespan || 100;
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '角色属性',
      content: `
╔══════════════════════════════╗
║  ${player.name} - ${player.profession}
╠══════════════════════════════╣
║  境界: ${player.realm}
║  境界进度: ${realmProgress}
║  等级: ${player.level} (经验: ${player.exp}/${expToNextLevel})
║  状态: ${idleStatus}
╠══════════════════════════════╣
║  生命: ${player.hp}/${player.maxHp}
║  灵力: ${player.spirit}/${player.maxSpirit}
║  体力: ${player.stamina}/${player.maxStamina}
╠══════════════════════════════╣
║  力量: ${player.stats.str}
║  敏捷: ${player.stats.dex}
║  体质: ${player.stats.con}
║  悟性: ${player.stats.wis}
╠══════════════════════════════╣
║  道心: ${dh}/1000 [${dhBonus.label}]
║  信誉: ${cs}/1000 [${csBonus.label}]
║  年龄: ${Math.floor(age)}岁 / 寿命: ${lifespan}年
╠══════════════════════════════╣
║  灵石: ${player.silver}
║  仙玉: ${player.jade}
╚══════════════════════════════╝`
    }
  });
}

// Inventory command
function handleInventoryCommand(ws, player) {
  const used = getBagUsed(player);
  const capacity = getBagCapacity(player);
  
  let pillList = '';
  if (player.pills && Object.keys(player.pills).length > 0) {
    for (const [id, qty] of Object.entries(player.pills)) {
      if (qty <= 0) continue;
      const pd = (typeof PILLS_DATA !== 'undefined' && PILLS_DATA[id]) ? PILLS_DATA[id] : null;
      const name = pd ? pd.name : id;
      pillList += `║  【${name}】x${qty} (${id})\n`;
    }
  }
  
  let equipList = '';
  if (player.equipmentBag && player.equipmentBag.length > 0) {
    for (const eq of player.equipmentBag) {
      const ed = (typeof EQUIPMENT_DATA !== 'undefined' && EQUIPMENT_DATA[eq.id]) ? EQUIPMENT_DATA[eq.id] : null;
      const name = ed ? ed.name : eq.id;
      equipList += `║  【${name}】(${eq.id})\n`;
    }
  }
  
  const items = pillList + equipList;
  const display = items || '║  [空空如也]\n';
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '背包',
      content: `
╔══════════════════════════════╗
║  背包 [${used}/${capacity}]
╠══════════════════════════════╣
${display}║
║  提示: 背包容量上限 ${capacity}
╚══════════════════════════════╝`
    }
  });
}

// Map command
function handleMapCommand(ws, player) {
  const map = WORLD_DATA.maps[player.currentMap];
  if (!map) return;
  
  const roomList = Object.keys(map.rooms).map(roomName => {
    const marker = roomName === player.currentRoom ? ' ★' : '';
    return `  - ${roomName}${marker}`;
  }).join('\n');
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: `地图 - ${player.currentMap}`,
      content: `
╔══════════════════════════════╗
║  ${player.currentMap}
╠══════════════════════════════╣
║  当前位置: ${player.currentRoom}
║
║  区域列表: (★ = 当前位置)
${roomList}
╚══════════════════════════════╝`
    }
  });
}

// Move command
function handleMoveCommand(ws, player, direction) {
  if (!direction) {
    const room = getRoom(player.currentMap, player.currentRoom);
    if (room) {
      const exits = Object.keys(room.exits).join('、');
      sendToClient(ws, {
        type: 'system',
        data: { message: `请指定方向。可用方向: ${exits}` }
      });
    }
    return;
  }
  
  // Map Chinese directions to English
  const directionMap = {
    '北': 'north', '南': 'south', '东': 'east', '西': 'west',
    '上': 'up', '下': 'down', '东南': 'southeast', '东北': 'northeast', '西南': 'southwest', '西北': 'northwest',
    'north': 'north', 'south': 'south', 'east': 'east', 'west': 'west'
  };
  
  const dir = directionMap[direction] || direction.toLowerCase();
  const room = getRoom(player.currentMap, player.currentRoom);
  
  if (!room || !room.exits[dir]) {
    sendToClient(ws, {
      type: 'system',
      data: { message: '那个方向走不通。' }
    });
    return;
  }
  
  const newRoomName = room.exits[dir];
  const newRoom = getRoom(player.currentMap, newRoomName);
  
  if (!newRoom) {
    sendToClient(ws, {
      type: 'error',
      data: { message: '目标房间不存在' }
    });
    return;
  }
  
  // Update player position
  const players = getPlayers();
  players[player.id].currentRoom = newRoomName;
  savePlayers(players);
  
  // Notify old room
  broadcast({
    type: 'system',
    data: { message: `${player.name} 向${getDirectionName(dir)}方离开了。` }
  }, ws);
  
  // Send new room to player
  sendToClient(ws, {
    type: 'move_response',
    data: {
      success: true,
      room: {
        name: newRoom.name,
        description: newRoom.description,
        exits: newRoom.exits,
        players: getPlayersInRoom(player.currentMap, newRoomName, ws)
      }
    }
  });
  
  // Notify new room
  broadcast({
    type: 'system',
    data: { message: `${player.name} 从${getOppositeDirectionName(dir)}方走了过来。` }
  }, ws);

  // Check for encounter on explore
  const playersAfter = getPlayers();
  const pAfter = playersAfter[player.id];
  if (pAfter) {
    checkEncounter(ws, pAfter, 'explore');
    // Track explored rooms
    if (!pAfter.exploredRooms) pAfter.exploredRooms = [];
    const roomKey = `${pAfter.currentMap}:${newRoomName}`;
    if (!pAfter.exploredRooms.includes(roomKey)) {
      pAfter.exploredRooms.push(roomKey);
    }
    // Quest progress for explore_bamboo
    if (newRoomName === '竹林') {
      updateQuestProgress(pAfter, 'explore_bamboo', 1);
    }
    savePlayers(playersAfter);
  }
}

// Look handler
function handleLook(ws, data) {
  const clientInfo = connectedClients.get(ws);
  if (!clientInfo) {
    sendToClient(ws, {
      type: 'error',
      data: { message: '请先登录' }
    });
    return;
  }
  
  const players = getPlayers();
  const player = players[clientInfo.playerId];
  if (!player) return;
  
  const room = getRoom(player.currentMap, player.currentRoom);
  if (!room) return;
  
  sendToClient(ws, {
    type: 'room',
    data: {
      name: room.name,
      description: room.description,
      exits: room.exits,
      players: getPlayersInRoom(player.currentMap, player.currentRoom, ws)
    }
  });
}

// Status handler
function handleStatus(ws, data) {
  const clientInfo = connectedClients.get(ws);
  if (!clientInfo) {
    sendToClient(ws, {
      type: 'error',
      data: { message: '请先登录' }
    });
    return;
  }
  
  const players = getPlayers();
  const player = players[clientInfo.playerId];
  if (!player) return;
  
  sendToClient(ws, {
    type: 'status_response',
    data: {
      name: player.name,
      level: player.level,
      realm: player.realm,
      hp: player.hp,
      maxHp: player.maxHp,
      spirit: player.spirit,
      maxSpirit: player.maxSpirit,
      stamina: player.stamina,
      maxStamina: player.maxStamina,
      location: `${player.currentMap} - ${player.currentRoom}`
    }
  });
}

// Move handler (alternative to command)
function handleMove(ws, data) {
  const clientInfo = connectedClients.get(ws);
  if (!clientInfo) {
    sendToClient(ws, {
      type: 'error',
      data: { message: '请先登录' }
    });
    return;
  }
  
  const players = getPlayers();
  const player = players[clientInfo.playerId];
  if (!player) return;
  
  handleMoveCommand(ws, player, data.direction);
}

// Channel command
function handleChannelCommand(ws, player, command) {
  const args = command.replace('/频道', '').trim();
  if (!args) {
    sendToClient(ws, {
      type: 'system',
      data: { message: `当前频道: ${player.channel === 'sect' ? '门派频道' : '世界频道'}。可用: /频道 世界 或 /频道 门派` }
    });
    return;
  }
  const players = getPlayers();
  const p = players[player.id];
  if (args === '世界') {
    p.channel = 'world';
    sendToClient(ws, { type: 'system', data: { message: '已切换到世界频道。' } });
  } else if (args === '门派') {
    if (!p.sect) {
      sendToClient(ws, { type: 'system', data: { message: '你还没有加入门派，无法使用门派频道。' } });
      return;
    }
    p.channel = 'sect';
    sendToClient(ws, { type: 'system', data: { message: '已切换到门派频道。' } });
  } else {
    sendToClient(ws, { type: 'system', data: { message: '可用频道: 世界、门派' } });
  }
  savePlayers(players);
}

// Talk command (local chat)
function handleTalkCommand(ws, player, command) {
  const message = command.replace('/交谈', '').trim();
  if (!message) {
    sendToClient(ws, {
      type: 'system',
      data: { message: '请输入要说的话。用法: /交谈 <内容>' }
    });
    return;
  }
  
  // Check for NPC interaction
  const npc = NPCS[message];
  if (npc && npc.location === player.currentRoom) {
    const dialogue = npc.dialogues[Math.floor(Math.random() * npc.dialogues.length)];
    sendToClient(ws, {
      type: 'npc_talk',
      data: {
        npc: npc.name,
        message: dialogue
      }
    });
    return;
  }
  
  // Broadcast to players in same room
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const clientInfo = connectedClients.get(client);
      if (clientInfo) {
        const clientPlayers = getPlayers();
        const clientPlayer = clientPlayers[clientInfo.playerId];
        if (clientPlayer && 
            clientPlayer.currentMap === player.currentMap && 
            clientPlayer.currentRoom === player.currentRoom) {
          sendToClient(client, {
            type: 'local_chat',
            data: {
              sender: player.name,
              message: message,
              channel: 'local'
            }
          });
        }
      }
    }
  });
}

// Attack command
function handleAttackCommand(ws, player, command) {
  // Get current room
  const room = getRoom(player.currentMap, player.currentRoom);
  if (!room) {
    sendToClient(ws, { type: 'system', data: { message: '你不知道自己在哪里。' } });
    return;
  }
  
  // Stop idle mode if attacking
  if (player.isIdle) {
    const players = getPlayers();
    const p = players[player.id];
    if (p) {
      p.isIdle = false;
      p.idleStartTime = null;
      savePlayers(players);
    }
  }
  
  // Check stamina for combat (BUG 3 fix)
  const activeBugsCheck = player.activeBugs || {};
  const hasInfiniteStamina = activeBugsCheck.B49 && activeBugsCheck.B49 > Date.now();
  if (!hasInfiniteStamina && player.stamina < 10) {
    sendToClient(ws, { type: 'system', data: { message: '体力不足，无法战斗！需要至少10点体力。使用 /使用 stamina_pill 恢复体力。' } });
    return;
  }
  
  const result = executeCombat(ws, player, room);
  
  if (!result.success) {
    sendToClient(ws, { type: 'system', data: { message: result.message } });
    return;
  }
  
  // Deduct stamina after combat (BUG 3 fix)
  const staminaBugsCheck = player.activeBugs || {};
  if (!(staminaBugsCheck.B49 && staminaBugsCheck.B49 > Date.now())) {
    player.stamina = Math.max(0, player.stamina - 10);
  }
  
  // Save player data
  const players = getPlayers();
  players[player.id] = player;
  savePlayers(players);
  
  // Send combat log as combat type message
  sendToClient(ws, {
    type: 'combat',
    data: {
      log: result.combatLog,
      victory: result.victory,
      exp: result.exp,
      silver: result.silver,
      hp: player.hp,
      maxHp: player.maxHp
    }
  });
  
  // Send status update after combat (BUG 2 fix)
  sendToClient(ws, {
    type: 'status_update',
    data: {
      hp: player.hp,
      maxHp: player.maxHp,
      spirit: player.spirit,
      maxSpirit: player.maxSpirit,
      stamina: player.stamina,
      maxStamina: player.maxStamina,
      exp: player.exp,
      level: player.level,
      realm: player.realm
    }
  });
  
  // If player died and respawned, send new room
  if (result.respawn) {
    const newRoom = getRoom(player.currentMap, player.currentRoom);
    if (newRoom) {
      sendToClient(ws, {
        type: 'room',
        data: {
          name: newRoom.name,
          description: newRoom.description,
          exits: newRoom.exits,
          players: getPlayersInRoom(player.currentMap, player.currentRoom, ws)
        }
      });
    }
  }
}

// Idle command
function handleIdleCommand(ws, player) {
  const players = getPlayers();
  const p = players[player.id];
  if (!p) return;
  
  if (p.isIdle) {
    sendToClient(ws, {
      type: 'system',
      data: { message: '你已经在打坐修炼中了。输入 /停止挂机 结束打坐。' }
    });
    return;
  }
  
  p.isIdle = true;
  p.idleStartTime = Date.now();
  savePlayers(players);
  
  const room = getRoom(p.currentMap, p.currentRoom);
  const roomName = room ? room.name : '未知地点';
  
  let msg = `🧘 你盘膝而坐，开始打坐修炼。每分钟获得 2 经验，灵力和体力缓慢恢复。`;
  if (p.currentRoom === '竹林') {
    msg += `\n🌿 你在竹林中修炼，将自动与野兽战斗获取经验。`;
  }
  msg += `\n输入 /停止挂机 结束打坐。`;
  
  sendToClient(ws, { type: 'system', data: { message: msg } });
}

// Stop idle command
function handleStopIdleCommand(ws, player) {
  const players = getPlayers();
  const p = players[player.id];
  if (!p) return;
  
  if (!p.isIdle) {
    sendToClient(ws, {
      type: 'system',
      data: { message: '你现在没有在打坐。输入 /挂机 或 /打坐 开始修炼。' }
    });
    return;
  }
  
  p.isIdle = false;
  p.idleStartTime = null;
  savePlayers(players);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: '🧘 你缓缓收功，停止了打坐修炼。' }
  });
}

// Realm command
function handleRealmCommand(ws, player) {
  const realmInfo = getRealmInfo(player);
  if (!realmInfo) {
    sendToClient(ws, { type: 'system', data: { message: '无法获取境界信息。' } });
    return;
  }
  
  const { realm, subLevel, subLevelName } = realmInfo;
  const progress = subLevel ? `${player.exp}/${subLevel.expRequired}` : '-';
  const percent = subLevel ? Math.floor(player.exp / subLevel.expRequired * 100) : 0;
  const desc = subLevel ? subLevel.description : '';
  
  const dh = player.daoHeart || 500;
  const dhBonus = getDaoHeartBonus(player);
  const age = player.age || 60;
  const lifespan = player.lifespan || getRealmLifespan(player.realm);
  const agePercent = Math.floor(age / lifespan * 100);
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '境界信息',
      content: `
╔══════════════════════════════╗
║  境界详情
╠══════════════════════════════╣
║  当前境界: ${player.realm}
║  阶段: ${subLevelName}
║  进度: ${progress} (${percent}%)
║  
║  境界说明: ${realm.description}
║  阶段描述: ${desc}
║  
║  道心状态: ${dh}/1000 [${dhBonus.label}]
║  寿命: ${Math.floor(age)}/${lifespan}年 (${agePercent}%)
║  
║  境界列表:
║  练气 → 筑基 → 金丹 → 元婴
║  化神 → 炼虚 → 合体 → 大乘
║  渡劫 → 飞升 → 仙人 → 神尊
║  
║  每个境界分: 初期/中期/后期/巅峰
╚══════════════════════════════╝`
    }
  });
}

// Help command
function handleHelpCommand(ws, player) {
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '帮助 - 所有命令',
      content: `
╔══════════════════════════════╗
║  🎮 游戏命令列表
╠══════════════════════════════╣
║  
║  📊 角色信息:
║  /属性  - 查看角色属性详情
║  /境界  - 查看境界信息和进度
║  /背包  - 查看背包物品
║  /道心  - 查看道心状态
║  /信誉  - 查看信誉分状态
║  
║  🗺️ 移动探索:
║  /地图  - 查看当前地图
║  /移动 <方向> - 移动 (北/南/东/西)
║  
║  ⚔️ 战斗修炼:
║  /攻击  - 攻击当前房间的怪物
║  /挂机  - 开始挂机修炼 (也可用 /打坐)
║  /停止挂机 - 停止挂机修炼
║  
║  📜 功法系统:
║  /功法  - 查看已学功法列表
║  /学习 <功法ID> - 学习新功法
║  /修炼 <功法ID> - 修炼功法 (消耗体力)
║  
║  🏯 门派系统:
║  /门派  - 查看可加入门派
║  /加入门派 <门派ID> - 加入门派
║  /门派信息 - 查看当前门派详情
║  
║  💊 丹药系统:
║  /丹药  - 查看丹药背包
║  /使用 <丹药ID> - 使用丹药
║  /购买丹药 <丹药ID> [数量] - 在药铺购买丹药
║  /炼丹 <丹药ID> - 炼制丹药（需材料）
║  
║  🛡️ 装备系统:
║  /装备  - 查看已穿戴装备
║  /装备栏  - 查看装备背包
║  /穿戴 <装备ID> - 穿戴装备
║  /脱下 <部位> - 脱下装备
║  /购买装备 <装备ID> - 在铁匠铺购买装备
║  
║  📋 任务系统:
║  /任务  - 查看可接和进行中的任务
║  /接任务 <任务ID> - 接受任务
║  /提交任务 <任务ID> - 提交完成的任务
║  
║  💬 社交:
║  /频道  - 查看当前频道信息
║  /交谈 <内容> - 在当前房间说话
║  /交谈 <NPC名> - 与NPC对话
║  
║  ❓ 其他:
║  /帮助  - 显示此帮助信息
║  
║  🏪 商店交易:
║  /商店  - 查看商店商品
║  /购买 <物品ID> [数量] - 购买物品
║  /出售 <物品ID> - 出售物品(半价)
║  /商人购买 <丹药ID> [数量] - 行商折扣购买
║
║  🎯 签到奇遇:
║  /签到  - 每日签到(20灵石+随机丹药)
║  /奇遇  - 查看奇遇记录
║  /战斗心魔 - 与心魔战斗
║  /逃跑  - 逃离心魔
║
║  👥 社交系统:
║  /好友  - 查看好友列表
║  /添加好友 <玩家名> - 发送好友请求
║  /接受好友 - 接受好友请求
║  /删除好友 <玩家名> - 删除好友
║  /私聊 <玩家名> <消息> - 私聊
║  /频道  - 查看/切换频道
║
║  💡 提示: 打坐修炼每分钟+2经验
║  在竹林挂机会自动与怪物战斗
║  移动时可能触发奇遇事件
║  修炼功法可提升功法等级，增强战斗
║
║  🧬 赛博系统 (核心特色):
║  /遗物  - 查看收集的程序遗物
║  /手表  - 查看管理员手表状态
║  /Bug   - 查看已发现的Bug
║  /探索Bug - 搜索当前房间的Bug
║  /使用Bug <BugID> - 激活Bug效果
╚══════════════════════════════╝`
    }
  });
}

// ===== P0 COMMANDS =====

// P0-1: Dao Heart command
function handleDaoHeartCommand(ws, player) {
  const dh = player.daoHeart || 500;
  const bonus = getDaoHeartBonus(player);
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '道心信息',
      content: `
╔══════════════════════════════╗
║  道心详情
╠══════════════════════════════╣
║  道心值: ${dh}/1000
║  状态: ${bonus.label}
║  
║  效果:
║  暴击加成: ${bonus.critBonus > 0 ? '+' : ''}${bonus.critBonus}%
║  奇遇概率: ${bonus.encounterBonus > 0 ? '+' : ''}${bonus.encounterBonus}%
║  突破加成: ${bonus.breakthroughBonus > 0 ? '+' : ''}${bonus.breakthroughBonus}%
║  经验加成: ${bonus.expBonus > 0 ? '+' : ''}${bonus.expBonus}%
║  
║  道心说明:
║  0-199: 心魔缠身 (极弱)
║  200-499: 道心不稳 (偏弱)
║  500-799: 道心坚定 (正常)
║  800-1000: 道心圆满 (增强)
╚══════════════════════════════╝`
    }
  });
}

// P0-2: Credit Score command
function handleCreditScoreCommand(ws, player) {
  const cs = player.creditScore || 500;
  const bonus = getCreditBonus(player);
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '信誉信息',
      content: `
╔══════════════════════════════╗
║  信誉详情
╠══════════════════════════════╣
║  信誉分: ${cs}/1000
║  状态: ${bonus.label}
║  
║  效果:
║  交易权限: ${bonus.canTrade ? '✅ 允许' : '❌ 禁止'}
║  拍卖权限: ${bonus.canAuction ? '✅ 允许' : '❌ 禁止'}
║  师徒权限: ${bonus.canMentor ? '✅ 允许' : '❌ 禁止'}
║  交易税率: ${bonus.tradeTax > 0 ? '+' : ''}${bonus.tradeTax}%
║  
║  信誉说明:
║  0-199: 红名 (交易禁止)
║  200-499: 信用不良 (税率+50%)
║  500-799: 正常 (无加减)
║  800-1000: 信誉良好 (税率-20%)
╚══════════════════════════════╝`
    }
  });
}

// ===== SKILL COMMANDS =====

// Show learned skills
function handleSkillListCommand(ws, player) {
  if (!player.skills || player.skills.length === 0) {
    sendToClient(ws, {
      type: 'command_response',
      data: {
        title: '功法列表',
        content: `\n╔══════════════════════════════╗\n║  功法列表\n╠══════════════════════════════╣\n║  你还没有学会任何功法。\n║\n║  可学习的功法:\n║  /学习 basic_fist    - 基础拳法\n║  /学习 basic_sword   - 基础剑法\n║  /学习 basic_meditation - 吐纳术\n║  /学习 basic_movement - 轻功入门\n╚══════════════════════════════╝`
      }
    });
    return;
  }
  
  let skillList = '';
  for (const ps of player.skills) {
    const sd = SKILLS_DATA[ps.id];
    if (!sd) continue;
    const typeStr = sd.type === 'active' ? '主动' : '被动';
    const effectStr = sd.type === 'active' ? `伤害+${sd.damage + (ps.level-1)*3}` : sd.effect;
    const expToNext = ps.level * 50;
    const progress = ps.level >= 10 ? '已满级' : `${ps.exp}/${expToNext}`;
    skillList += `║  【${sd.name}】${typeStr} Lv${ps.level}\n║    ${sd.level} | ${effectStr}\n║    经验: ${progress}\n`;
  }
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '功法列表',
      content: `\n╔══════════════════════════════╗\n║  功法列表\n╠══════════════════════════════╣\n${skillList}╚══════════════════════════════╝`
    }
  });
}

// Learn a skill
function handleLearnSkillCommand(ws, player, skillId) {
  if (!skillId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /学习 <功法ID>\n可用功法: basic_fist, basic_sword, basic_meditation, basic_movement' } });
    return;
  }
  
  const skillData = SKILLS_DATA[skillId];
  if (!skillData) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该功法。可用: basic_fist, basic_sword, basic_meditation, basic_movement' } });
    return;
  }
  
  // Initialize skills array if needed
  if (!player.skills) player.skills = [];
  
  // Check if already learned
  if (player.skills.some(s => s.id === skillId)) {
    sendToClient(ws, { type: 'system', data: { message: `你已经学会了【${skillData.name}】。` } });
    return;
  }
  
  // Add skill
  const players = getPlayers();
  const p = players[player.id];
  if (!p.skills) p.skills = [];
  p.skills.push({ id: skillId, level: 1, exp: 0 });
  savePlayers(players);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `📜 你学会了新功法【${skillData.name}】！\n${skillData.description}` }
  });
}

// Practice a skill
function handlePracticeSkillCommand(ws, player, skillId) {
  if (!skillId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /修炼 <功法ID>' } });
    return;
  }
  
  if (!player.skills || !player.skills.some(s => s.id === skillId)) {
    sendToClient(ws, { type: 'system', data: { message: '你还没有学会这个功法。用 /学习 <功法ID> 来学习。' } });
    return;
  }
  
  // Check stamina
  if (player.stamina < 10) {
    // Check B49 infinite stamina bug
    const activeBugs = player.activeBugs || {};
    if (!(activeBugs.B49 && activeBugs.B49 > Date.now())) {
      sendToClient(ws, { type: 'system', data: { message: '体力不足，无法修炼功法。需要至少10点体力。' } });
      return;
    }
  }
  
  const skillData = SKILLS_DATA[skillId];
  const players = getPlayers();
  const p = players[player.id];
  const ps = p.skills.find(s => s.id === skillId);
  
  // Stop idle if active
  if (p.isIdle) {
    p.isIdle = false;
    p.idleStartTime = null;
  }
  
  // Use stamina (skip if B49 infinite stamina bug active)
  const practiceBugCheck = p.activeBugs || {};
  if (!(practiceBugCheck.B49 && practiceBugCheck.B49 > Date.now())) {
    p.stamina -= 10;
  }
  
  // Gain skill exp
  ps.exp += 5;
  const needed = ps.level * 50;
  let msg = `🧘 你修炼【${skillData.name}】，功法经验+5（${ps.exp}/${needed}）`;
  
  if (ps.exp >= needed && ps.level < 10) {
    ps.exp -= needed;
    ps.level++;
    msg += `\n📜 功法突破！【${skillData.name}】等级提升至 Lv${ps.level}！`;
  }
  
  // Sect contribution if in sect
  if (p.sect) {
    p.sectContribution = (p.sectContribution || 0) + 1;
  }
  
  // Update quest progress for practice_skill type
  updateQuestProgress(p, 'practice_skill', 1);
  
  savePlayers(players);
  sendToClient(ws, { type: 'system', data: { message: msg } });
}

// ===== SECT COMMANDS =====

// Show available sects
function handleSectListCommand(ws, player) {
  let sectList = '';
  for (const [id, sect] of Object.entries(SECTS_DATA)) {
    const joined = player.sect === id ? ' ✅ 当前门派' : '';
    sectList += `║  【${sect.name}】(${sect.type})${joined}\n║    ${sect.desc}\n║    门派加成: ${sect.bonusDesc}\n║    加入要求: 等级${sect.minLevel}+\n║    加入命令: /加入门派 ${id}\n`;
  }
  
  const currentSect = player.sect ? SECTS_DATA[player.sect] : null;
  const statusText = currentSect ? `当前门派: ${currentSect.name}` : '你还没有加入任何门派';
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '门派列表',
      content: `\n╔══════════════════════════════╗\n║  门派列表\n╠══════════════════════════════╣\n║  ${statusText}\n╠══════════════════════════════╣\n${sectList}╚══════════════════════════════╝`
    }
  });
}

// Join a sect
function handleJoinSectCommand(ws, player, sectId) {
  if (!sectId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /加入门派 <门派ID>\n可用门派: shaolin, wudang, xiaoyao, emei, huashan, kunlun, riyue, wudu, taohua\n输入 /门派 查看门派详情。' } });
    return;
  }
  
  const sect = SECTS_DATA[sectId];
  if (!sect) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该门派。输入 /门派 查看所有可用门派。' } });
    return;
  }
  
  // Already in a sect
  if (player.sect) {
    const currentSect = SECTS_DATA[player.sect];
    sendToClient(ws, { type: 'system', data: { message: `你已经是【${currentSect.name}】的弟子了，不能加入其他门派。` } });
    return;
  }
  
  // Level requirement
  if (player.level < sect.minLevel) {
    sendToClient(ws, { type: 'system', data: { message: `加入【${sect.name}】需要等级${sect.minLevel}，你当前等级${player.level}。` } });
    return;
  }
  
  // Join sect
  const players = getPlayers();
  const p = players[player.id];
  p.sect = sectId;
  p.sectContribution = 0;
  // Update quest progress for join_sect type
  if (!p.quests) p.quests = { active: [], completed: [], dailyCompleted: {}, progress: {} };
  if (!p.quests.progress) p.quests.progress = {};
  updateQuestProgress(p, 'join_sect', 1);
  savePlayers(players);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `🎉 恭喜！你成功加入了【${sect.name}】！\n${sect.desc}\n门派加成: ${sect.bonusDesc}\n使用 /门派信息 查看门派详情。` }
  });
  
  broadcast({
    type: 'system',
    data: { message: `${player.name} 拜入了【${sect.name}】！` }
  }, ws);
}

// Show sect info
function handleSectInfoCommand(ws, player) {
  if (!player.sect) {
    sendToClient(ws, { type: 'system', data: { message: '你还没有加入任何门派。输入 /门派 查看可加入的门派。' } });
    return;
  }
  
  const sect = SECTS_DATA[player.sect];
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '门派信息',
      content: `\n╔══════════════════════════════╗\n║  门派信息\n╠══════════════════════════════╣\n║  门派: ${sect.name}\n║  类型: ${sect.type}\n║  门派加成: ${sect.bonusDesc}\n║  门派贡献: ${player.sectContribution || 0}\n╠══════════════════════════════╣\n║  门派介绍:\n║  ${sect.desc}\n╠══════════════════════════════╣\n║  💡 提示:\n║  - 修炼功法可增加门派贡献\n║  - 门派专属功法即将开放\n║  - 门派日常任务即将开放\n╚══════════════════════════════╝`
    }
  });
}

// ===== PILL COMMANDS =====

// Show pill inventory
function handlePillListCommand(ws, player) {
  if (!player.pills || Object.keys(player.pills).length === 0) {
    sendToClient(ws, {
      type: 'command_response',
      data: {
        title: '丹药背包',
        content: `\n╔══════════════════════════════╗\n║  丹药背包\n╠══════════════════════════════╣\n║  你没有任何丹药。\n║\n║  可在药铺购买: /购买丹药 <丹药ID>\n║  药铺位置: 村广场 向西\n╚══════════════════════════════╝`
      }
    });
    return;
  }
  
  let pillList = '';
  for (const [pillId, count] of Object.entries(player.pills)) {
    if (count <= 0) continue;
    const pd = PILLS_DATA[pillId];
    if (!pd) continue;
    pillList += `║  【${pd.name}】x${count}\n║    ${pd.effect} | 单价: ${pd.price}灵石\n║    ID: ${pd.id}\n`;
  }
  
  if (!pillList) {
    pillList = '║  你没有任何丹药。\n';
  }
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '丹药背包',
      content: `\n╔══════════════════════════════╗\n║  丹药背包\n╠══════════════════════════════╣\n${pillList}╠══════════════════════════════╣\n║  使用: /使用 <丹药ID>\n║  购买: /购买丹药 <丹药ID> [数量]\n╚══════════════════════════════╝`
    }
  });
}

// Use a pill
function handleUsePillCommand(ws, player, command) {
  const pillId = command.replace('/使用', '').trim();
  if (!pillId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /使用 <丹药ID>\n输入 /丹药 查看拥有的丹药。' } });
    return;
  }
  
  const pd = PILLS_DATA[pillId];
  if (!pd) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该丹药。' } });
    return;
  }
  
  const players = getPlayers();
  const p = players[player.id];
  if (!p.pills) p.pills = {};
  if (!p.pills[pillId] || p.pills[pillId] <= 0) {
    sendToClient(ws, { type: 'system', data: { message: `你没有【${pd.name}】。` } });
    return;
  }
  
  p.pills[pillId]--;
  if (p.pills[pillId] <= 0) delete p.pills[pillId];
  
  const effectMsg = pd.apply(p);
  savePlayers(players);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `💊 使用了【${pd.name}】！${effectMsg}` }
  });
}

// Buy pills from herb shop
function handleBuyPillCommand(ws, player, command) {
  if (player.currentRoom !== '药铺') {
    sendToClient(ws, { type: 'system', data: { message: '你需要在药铺才能购买丹药。药铺位于村广场向西。' } });
    return;
  }
  
  const args = command.replace('/购买丹药', '').trim().split(/\s+/);
  const pillId = args[0];
  const quantity = parseInt(args[1]) || 1;
  
  if (!pillId) {
    let shopList = '🏪 药铺商品:\n';
    for (const [id, pd] of Object.entries(PILLS_DATA)) {
      shopList += `  【${pd.name}】(${id}) - ${pd.effect} - ${pd.price}灵石/个\n`;
    }
    shopList += '\n用法: /购买丹药 <丹药ID> [数量]';
    sendToClient(ws, { type: 'system', data: { message: shopList } });
    return;
  }
  
  const pd = PILLS_DATA[pillId];
  if (!pd) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该丹药。' } });
    return;
  }
  
  if (quantity < 1 || quantity > 99) {
    sendToClient(ws, { type: 'system', data: { message: '购买数量需在1-99之间。' } });
    return;
  }
  
  const totalCost = pd.price * quantity;
  const players = getPlayers();
  const p = players[player.id];
  
  if (p.silver < totalCost) {
    sendToClient(ws, { type: 'system', data: { message: `灵石不足！需要 ${totalCost} 灵石，你只有 ${p.silver} 灵石。` } });
    return;
  }
  
  p.silver -= totalCost;
  if (!p.pills) p.pills = {};
  p.pills[pillId] = (p.pills[pillId] || 0) + quantity;
  savePlayers(players);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `🏪 购买了 ${quantity} 个【${pd.name}】，花费 ${totalCost} 灵石。剩余: ${p.silver} 灵石` }
  });
}

// Craft pills (placeholder)
function handleCraftPillCommand(ws, player, command) {
  const pillId = command.replace('/炼丹', '').trim();
  if (!pillId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /炼丹 <丹药ID>\n可炼制: hp_pill, spirit_pill, stamina_pill, exp_pill\n提示: 炼丹系统即将开放，敬请期待！' } });
    return;
  }
  
  const pd = PILLS_DATA[pillId];
  if (!pd) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该丹药。' } });
    return;
  }
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `🔥 炼丹系统开发中，敬请期待！\n以后你将能炼制【${pd.name}】等丹药。` }
  });
}

// ===== EQUIPMENT COMMANDS =====

// Show equipped items
function handleEquipmentCommand(ws, player) {
  const equip = player.equipment || { weapon: null, head: null, body: null, feet: null, ring: null };
  
  let equipList = '';
  const slotNames = { weapon: '武器', head: '头部', body: '身体', feet: '足部', ring: '戒指' };
  let totalAttack = 0, totalDefense = 0, totalStr = 0, totalSpeed = 0;
  
  for (const [slot, equipId] of Object.entries(equip)) {
    if (equipId) {
      const ed = EQUIPMENT_DATA[equipId];
      if (ed) {
        let stats = [];
        if (ed.attack) { stats.push(`攻击+${ed.attack}`); totalAttack += ed.attack; }
        if (ed.defense) { stats.push(`防御+${ed.defense}`); totalDefense += ed.defense; }
        if (ed.str) { stats.push(`力量+${ed.str}`); totalStr += ed.str; }
        if (ed.speed) { stats.push(`速度+${ed.speed}`); totalSpeed += ed.speed; }
        equipList += `║  [${slotNames[slot]}] ${ed.name} - ${stats.join(' ')}\n`;
      } else {
        equipList += `║  [${slotNames[slot]}] 空\n`;
      }
    } else {
      equipList += `║  [${slotNames[slot]}] 空\n`;
    }
  }
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '装备栏',
      content: `\n╔══════════════════════════════╗\n║  装备栏\n╠══════════════════════════════╣\n${equipList}╠══════════════════════════════╣\n║  装备加成: 攻击+${totalAttack} 防御+${totalDefense} 力量+${totalStr} 速度+${totalSpeed}\n╠══════════════════════════════╣\n║  穿戴: /穿戴 <装备ID>\n║  脱下: /脱下 <部位>\n║  装备背包: /装备栏\n╚══════════════════════════════╝`
    }
  });
}

// Show equipment bag
function handleEquipmentBagCommand(ws, player) {
  const bag = player.equipmentBag || [];
  
  if (bag.length === 0) {
    sendToClient(ws, {
      type: 'command_response',
      data: {
        title: '装备背包',
        content: `\n╔══════════════════════════════╗\n║  装备背包\n╠══════════════════════════════╣\n║  背包中没有装备。\n║\n║  可在铁匠铺购买: /购买装备 <装备ID>\n║  铁匠铺位置: 村口 向东南\n╚══════════════════════════════╝`
      }
    });
    return;
  }
  
  let bagList = '';
  bag.forEach((item, index) => {
    const ed = EQUIPMENT_DATA[item.id];
    if (ed) {
      let stats = [];
      if (ed.attack) stats.push(`攻击+${ed.attack}`);
      if (ed.defense) stats.push(`防御+${ed.defense}`);
      if (ed.str) stats.push(`力量+${ed.str}`);
      if (ed.speed) stats.push(`速度+${ed.speed}`);
      bagList += `║  ${index + 1}. ${ed.name} - ${stats.join(' ')} (ID: ${ed.id})\n`;
    }
  });
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '装备背包',
      content: `\n╔══════════════════════════════╗\n║  装备背包\n╠══════════════════════════════╣\n${bagList}╠══════════════════════════════╣\n║  穿戴: /穿戴 <装备ID>\n╚══════════════════════════════╝`
    }
  });
}

// Equip an item
function handleEquipCommand(ws, player, command) {
  const equipId = command.replace('/穿戴', '').trim();
  if (!equipId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /穿戴 <装备ID>\n输入 /装备栏 查看可用装备。' } });
    return;
  }
  
  const ed = EQUIPMENT_DATA[equipId];
  if (!ed) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该装备。' } });
    return;
  }
  
  const players = getPlayers();
  const p = players[player.id];
  if (!p.equipment) p.equipment = { weapon: null, head: null, body: null, feet: null, ring: null };
  if (!p.equipmentBag) p.equipmentBag = [];
  
  // Find item in bag
  const bagIndex = p.equipmentBag.findIndex(item => item.id === equipId);
  if (bagIndex === -1) {
    sendToClient(ws, { type: 'system', data: { message: `你背包中没有【${ed.name}】。` } });
    return;
  }
  
  // If slot is occupied, move current equipment to bag
  const slot = ed.slot;
  if (p.equipment[slot]) {
    const currentEquipId = p.equipment[slot];
    p.equipmentBag.push({ id: currentEquipId });
    const currentEd = EQUIPMENT_DATA[currentEquipId];
    sendToClient(ws, { type: 'system', data: { message: `脱下了【${currentEd.name}】，放入背包。` } });
  }
  
  // Equip new item
  p.equipmentBag.splice(bagIndex, 1);
  p.equipment[slot] = equipId;
  savePlayers(players);
  
  let stats = [];
  if (ed.attack) stats.push(`攻击+${ed.attack}`);
  if (ed.defense) stats.push(`防御+${ed.defense}`);
  if (ed.str) stats.push(`力量+${ed.str}`);
  if (ed.speed) stats.push(`速度+${ed.speed}`);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `🛡️ 穿戴了【${ed.name}】！${stats.join(' ')}` }
  });
}

// Unequip an item
function handleUnequipCommand(ws, player, command) {
  const slot = command.replace('/脱下', '').trim();
  if (!slot) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /脱下 <部位>\n部位: weapon(武器), head(头部), body(身体), feet(足部), ring(戒指)' } });
    return;
  }
  
  const validSlots = ['weapon', 'head', 'body', 'feet', 'ring'];
  if (!validSlots.includes(slot)) {
    sendToClient(ws, { type: 'system', data: { message: '无效部位。可用: weapon, head, body, feet, ring' } });
    return;
  }
  
  const players = getPlayers();
  const p = players[player.id];
  if (!p.equipment) p.equipment = { weapon: null, head: null, body: null, feet: null, ring: null };
  if (!p.equipmentBag) p.equipmentBag = [];
  
  if (!p.equipment[slot]) {
    sendToClient(ws, { type: 'system', data: { message: '该部位没有装备。' } });
    return;
  }
  
  const equipId = p.equipment[slot];
  const ed = EQUIPMENT_DATA[equipId];
  p.equipmentBag.push({ id: equipId });
  p.equipment[slot] = null;
  savePlayers(players);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `🛡️ 脱下了【${ed.name}】，放入背包。` }
  });
}

// Buy equipment from blacksmith
function handleBuyEquipmentCommand(ws, player, command) {
  if (player.currentRoom !== '铁匠铺') {
    sendToClient(ws, { type: 'system', data: { message: '你需要在铁匠铺才能购买装备。铁匠铺位于村口向东南。' } });
    return;
  }
  
  const equipId = command.replace('/购买装备', '').trim();
  if (!equipId) {
    let shopList = '🏪 铁匠铺商品:\n';
    for (const [id, ed] of Object.entries(EQUIPMENT_DATA)) {
      let stats = [];
      if (ed.attack) stats.push(`攻击+${ed.attack}`);
      if (ed.defense) stats.push(`防御+${ed.defense}`);
      if (ed.str) stats.push(`力量+${ed.str}`);
      if (ed.speed) stats.push(`速度+${ed.speed}`);
      shopList += `  【${ed.name}】(${id}) - ${stats.join(' ')} - ${ed.price}灵石\n`;
    }
    shopList += '\n用法: /购买装备 <装备ID>';
    sendToClient(ws, { type: 'system', data: { message: shopList } });
    return;
  }
  
  const ed = EQUIPMENT_DATA[equipId];
  if (!ed) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该装备。' } });
    return;
  }
  
  const players = getPlayers();
  const p = players[player.id];
  if (!p.equipmentBag) p.equipmentBag = [];
  
  if (p.silver < ed.price) {
    sendToClient(ws, { type: 'system', data: { message: `灵石不足！需要 ${ed.price} 灵石，你只有 ${p.silver} 灵石。` } });
    return;
  }
  
  p.silver -= ed.price;
  p.equipmentBag.push({ id: equipId });
  savePlayers(players);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `🏪 购买了【${ed.name}】，花费 ${ed.price} 灵石。剩余: ${p.silver} 灵石\n使用 /穿戴 ${equipId} 来装备。` }
  });
}

// ===== QUEST COMMANDS =====

// Show quests
function handleQuestListCommand(ws, player) {
  if (!player.quests) player.quests = { active: [], completed: [], dailyCompleted: {}, progress: {} };
  
  let content = '';
  
  // Active quests
  if (player.quests.active.length > 0) {
    content += '║  📋 进行中的任务:\n';
    for (const qId of player.quests.active) {
      const qd = QUESTS_DATA[qId];
      if (!qd) continue;
      const progress = player.quests.progress[qId] || 0;
      const target = qd.requirement.target;
      content += `║  【${qd.name}】(${qId})\n║    ${qd.description}\n║    进度: ${progress}/${target}\n║    完成: /提交任务 ${qId}\n`;
    }
  }
  
  // Available main quests
  content += '║  \n║  📜 可接主线任务:\n';
  let hasMain = false;
  for (const [id, qd] of Object.entries(QUESTS_DATA)) {
    if (qd.type !== 'main') continue;
    if (player.quests.completed.includes(id)) continue;
    if (player.quests.active.includes(id)) continue;
    if (qd.prereq && !player.quests.completed.includes(qd.prereq)) continue;
    content += `║  【${qd.name}】(${id})\n║    ${qd.description}\n║    接取: /接任务 ${id}\n`;
    hasMain = true;
  }
  if (!hasMain) content += '║  暂无可用主线任务\n';
  
  // Available daily quests
  const today = new Date().toISOString().slice(0, 10);
  content += '║  \n║  🔄 每日任务:\n';
  for (const [id, qd] of Object.entries(QUESTS_DATA)) {
    if (qd.type !== 'daily') continue;
    const completedToday = player.quests.dailyCompleted[id] === today;
    if (completedToday) {
      content += `║  【${qd.name}】(${id}) - ✅ 今日已完成\n`;
    } else if (player.quests.active.includes(id)) {
      const progress = player.quests.progress[id] || 0;
      content += `║  【${qd.name}】(${id}) - 进度: ${progress}/${qd.requirement.target}\n║    完成: /提交任务 ${id}\n`;
    } else {
      content += `║  【${qd.name}】(${id})\n║    ${qd.description}\n║    接取: /接任务 ${id}\n`;
    }
  }
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '任务系统',
      content: `\n╔══════════════════════════════╗\n║  任务系统\n╠══════════════════════════════╣\n${content}╚══════════════════════════════╝`
    }
  });
}

// Accept a quest
function handleAcceptQuestCommand(ws, player, command) {
  const questId = command.replace('/接任务', '').trim();
  if (!questId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /接任务 <任务ID>\n输入 /任务 查看可接任务。' } });
    return;
  }
  
  const qd = QUESTS_DATA[questId];
  if (!qd) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该任务。' } });
    return;
  }
  
  const players = getPlayers();
  const p = players[player.id];
  if (!p.quests) p.quests = { active: [], completed: [], dailyCompleted: {}, progress: {} };
  if (!p.quests.progress) p.quests.progress = {};
  
  // Check if already active
  if (p.quests.active.includes(questId)) {
    sendToClient(ws, { type: 'system', data: { message: '你已经在进行这个任务了。' } });
    return;
  }
  
  // Check if already completed (main quests)
  if (qd.type === 'main' && p.quests.completed.includes(questId)) {
    sendToClient(ws, { type: 'system', data: { message: '你已经完成了这个任务。' } });
    return;
  }
  
  // Check daily completion
  if (qd.type === 'daily') {
    const today = new Date().toISOString().slice(0, 10);
    if (p.quests.dailyCompleted[questId] === today) {
      sendToClient(ws, { type: 'system', data: { message: '你今天已经完成了这个每日任务。' } });
      return;
    }
  }
  
  // Check prerequisite
  if (qd.prereq && !p.quests.completed.includes(qd.prereq)) {
    const prereqQuest = QUESTS_DATA[qd.prereq];
    sendToClient(ws, { type: 'system', data: { message: `需要先完成前置任务: ${prereqQuest ? prereqQuest.name : qd.prereq}` } });
    return;
  }
  
  p.quests.active.push(questId);
  p.quests.progress[questId] = 0;
  savePlayers(players);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `📋 接受了任务【${qd.name}】！\n${qd.description}\n输入 /任务 查看进度。` }
  });
}

// Complete a quest
function handleCompleteQuestCommand(ws, player, command) {
  const questId = command.replace('/提交任务', '').trim();
  if (!questId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /提交任务 <任务ID>' } });
    return;
  }
  
  const qd = QUESTS_DATA[questId];
  if (!qd) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该任务。' } });
    return;
  }
  
  const players = getPlayers();
  const p = players[player.id];
  if (!p.quests) p.quests = { active: [], completed: [], dailyCompleted: {}, progress: {} };
  if (!p.quests.progress) p.quests.progress = {};
  
  // Check if quest is active
  if (!p.quests.active.includes(questId)) {
    sendToClient(ws, { type: 'system', data: { message: '你没有在进行这个任务。先用 /接任务 接受任务。' } });
    return;
  }
  
  // Check if requirement is met
  const progress = p.quests.progress[questId] || 0;
  const target = qd.requirement.target;
  
  if (progress < target) {
    sendToClient(ws, { type: 'system', data: { message: `任务尚未完成！进度: ${progress}/${target}` } });
    return;
  }
  
  // Remove from active, add to completed
  p.quests.active = p.quests.active.filter(id => id !== questId);
  if (qd.type === 'main') {
    p.quests.completed.push(questId);
  } else if (qd.type === 'daily') {
    const today = new Date().toISOString().slice(0, 10);
    p.quests.dailyCompleted[questId] = today;
  }
  delete p.quests.progress[questId];
  
  // Give rewards
  let rewardMsg = '';
  if (qd.reward.exp) {
    const result = addExp(p, qd.reward.exp);
    rewardMsg += `${qd.reward.exp}经验 `;
    if (result.leveled) rewardMsg += `🎊 升级了！ `;
    if (result.realmChanged) rewardMsg += `✨ 境界突破！ `;
  }
  if (qd.reward.silver) {
    p.silver += qd.reward.silver;
    rewardMsg += `${qd.reward.silver}灵石 `;
  }
  if (qd.reward.pills) {
    if (!p.pills) p.pills = {};
    for (const [pillId, count] of Object.entries(qd.reward.pills)) {
      p.pills[pillId] = (p.pills[pillId] || 0) + count;
      const pd = PILLS_DATA[pillId];
      rewardMsg += `${pd ? pd.name : pillId}x${count} `;
    }
  }
  // Special reward: Admin Watch
  if (qd.reward.special === 'admin_watch') {
    p.adminWatch = true;
    p.adminWatchLevel = 1;
    p.mysteryLetters = (p.mysteryLetters || 0) + 1;
    rewardMsg += '\n⌚ 获得了【管理员手表】！输入 /手表 查看详情。';
    rewardMsg += '\n📩 获得了1封神秘信件。';
    rewardMsg += '\n"你感觉到了这个世界的异常...代码的回声在耳边响起。"';
  }
  
  savePlayers(players);
  
  sendToClient(ws, {
    type: 'system',
    data: { message: `🎉 完成了任务【${qd.name}】！\n获得奖励: ${rewardMsg}` }
  });
}

// Quest progress tracking helper
function updateQuestProgress(player, type, amount) {
  if (!player.quests || !player.quests.active) return;
  
  for (const questId of player.quests.active) {
    const qd = QUESTS_DATA[questId];
    if (!qd) continue;
    if (qd.requirement.type === type) {
      if (!player.quests.progress) player.quests.progress = {};
      // For 'level' type quests, set progress to current level (not accumulate)
      if (type === 'level') {
        player.quests.progress[questId] = player.level;
      } else {
        player.quests.progress[questId] = (player.quests.progress[questId] || 0) + amount;
      }
    }
  }
}

// Get equipment bonuses for combat
function getEquipmentBonuses(player) {
  let attack = 0, defense = 0, str = 0, speed = 0;
  if (!player.equipment) return { attack, defense, str, speed };
  
  for (const equipId of Object.values(player.equipment)) {
    if (!equipId) continue;
    const ed = EQUIPMENT_DATA[equipId];
    if (!ed) continue;
    if (ed.attack) attack += ed.attack;
    if (ed.defense) defense += ed.defense;
    if (ed.str) str += ed.str;
    if (ed.speed) speed += ed.speed;
  }
  
  return { attack, defense, str, speed };
}

// ===== SHOP COMMANDS =====

function handleShopCommand(ws, player) {
  let shopList = '';
  for (const [id, item] of Object.entries(SHOP_ITEMS)) {
    shopList += `║  【${item.name}】(${id}) - ${item.desc} - ${item.price}灵石\n`;
  }
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '商店',
      content: `\n╔══════════════════════════════╗\n║  🏪 商店\n╠══════════════════════════════╣\n${shopList}╠══════════════════════════════╣\n║  购买: /购买 <物品ID> [数量]\n║  出售: /出售 <物品ID>\n╚══════════════════════════════╝`
    }
  });
}

function handleBuyItemCommand(ws, player, command) {
  const args = command.replace('/购买', '').trim().split(/\s+/);
  const itemId = args[0];
  const quantity = parseInt(args[1]) || 1;
  if (!itemId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /购买 <物品ID> [数量]\n输入 /商店 查看商品。' } });
    return;
  }
  const item = SHOP_ITEMS[itemId];
  if (!item) {
    sendToClient(ws, { type: 'system', data: { message: '商店中没有该物品。输入 /商店 查看。' } });
    return;
  }
  if (quantity < 1 || quantity > 99) {
    sendToClient(ws, { type: 'system', data: { message: '数量需在1-99之间。' } });
    return;
  }
  const totalCost = item.price * quantity;
  const players = getPlayers();
  const p = players[player.id];
  if (p.silver < totalCost) {
    sendToClient(ws, { type: 'system', data: { message: `灵石不足！需要 ${totalCost}，你只有 ${p.silver}。` } });
    return;
  }
  p.silver -= totalCost;
  if (item.type === 'pill') {
    if (!p.pills) p.pills = {};
    p.pills[itemId] = (p.pills[itemId] || 0) + quantity;
  } else if (item.type === 'equipment') {
    for (let i = 0; i < quantity; i++) p.equipmentBag.push({ id: itemId });
  }
  savePlayers(players);
  sendToClient(ws, { type: 'system', data: { message: `🏪 购买了 ${quantity} 个【${item.name}】，花费 ${totalCost} 灵石。` } });
}

function handleSellItemCommand(ws, player, command) {
  const itemId = command.replace('/出售', '').trim();
  if (!itemId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /出售 <物品ID>\n可出售背包中的装备或丹药。' } });
    return;
  }
  const players = getPlayers();
  const p = players[player.id];
  // Check pills
  if (p.pills && p.pills[itemId] && p.pills[itemId] > 0) {
    const pd = PILLS_DATA[itemId];
    const sellPrice = Math.floor((pd ? pd.price : 5) / 2);
    p.pills[itemId]--;
    if (p.pills[itemId] <= 0) delete p.pills[itemId];
    p.silver += sellPrice;
    savePlayers(players);
    sendToClient(ws, { type: 'system', data: { message: `出售了【${pd ? pd.name : itemId}】，获得 ${sellPrice} 灵石。` } });
    return;
  }
  // Check equipment bag
  const bagIdx = p.equipmentBag.findIndex(e => e.id === itemId);
  if (bagIdx !== -1) {
    const ed = EQUIPMENT_DATA[itemId];
    const sellPrice = Math.floor((ed ? ed.price : 10) / 2);
    p.equipmentBag.splice(bagIdx, 1);
    p.silver += sellPrice;
    savePlayers(players);
    sendToClient(ws, { type: 'system', data: { message: `出售了【${ed ? ed.name : itemId}】，获得 ${sellPrice} 灵石。` } });
    return;
  }
  sendToClient(ws, { type: 'system', data: { message: '你没有该物品可以出售。' } });
}

// ===== SIGN-IN COMMAND =====
function handleSignInCommand(ws, player) {
  const today = new Date().toISOString().slice(0, 10);
  const players = getPlayers();
  const p = players[player.id];
  if (p.lastSignIn === today) {
    sendToClient(ws, { type: 'system', data: { message: '你今天已经签到过了，明天再来吧！' } });
    return;
  }
  p.lastSignIn = today;
  p.silver += 20;
  // Random pill reward
  const pillIds = Object.keys(PILLS_DATA);
  const randomPillId = pillIds[Math.floor(Math.random() * pillIds.length)];
  if (!p.pills) p.pills = {};
  p.pills[randomPillId] = (p.pills[randomPillId] || 0) + 1;
  const pd = PILLS_DATA[randomPillId];
  savePlayers(players);
  sendToClient(ws, {
    type: 'system',
    data: { message: `✅ 签到成功！获得 20 灵石和【${pd.name}】x1！` }
  });
}

// ===== ENCOUNTER LOG COMMAND =====
function handleEncounterLogCommand(ws, player) {
  const log = player.encounterLog || [];
  if (log.length === 0) {
    sendToClient(ws, { type: 'system', data: { message: '你还没有遇到过任何奇遇。多探索世界吧！' } });
    return;
  }
  let logText = '📜 最近的奇遇记录:\n';
  log.slice(0, 5).forEach((entry, i) => {
    logText += `  ${i + 1}. 【${entry.name}】- ${entry.message}\n`;
  });
  sendToClient(ws, { type: 'command_response', data: { title: '奇遇记录', content: `\n╔══════════════════════════════╗\n║  奇遇记录\n╠══════════════════════════════╣\n║  ${logText.split('\n').join('\n║  ')}\n╚══════════════════════════════╝` } });
}

// ===== SOCIAL COMMANDS =====
function handleFriendsCommand(ws, player) {
  const friends = player.friends || [];
  if (friends.length === 0) {
    sendToClient(ws, { type: 'system', data: { message: '你还没有好友。使用 /添加好友 <玩家名> 添加好友。' } });
    return;
  }
  let list = '👥 好友列表:\n';
  friends.forEach((f, i) => { list += `  ${i + 1}. ${f}\n`; });
  const pending = player.pendingFriendRequests || [];
  if (pending.length > 0) {
    list += '\n📩 待处理的好友请求:\n';
    pending.forEach(r => { list += `  - ${r}\n`; });
    list += '使用 /接受好友 接受请求。';
  }
  sendToClient(ws, { type: 'command_response', data: { title: '好友列表', content: `\n╔══════════════════════════════╗\n║  好友列表\n╠══════════════════════════════╣\n║  ${list.split('\n').join('\n║  ')}\n╚══════════════════════════════╝` } });
}

function handleAddFriendCommand(ws, player, command) {
  const targetName = command.replace('/添加好友', '').trim();
  if (!targetName) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /添加好友 <玩家名>' } });
    return;
  }
  const players = getPlayers();
  const targetPlayer = Object.values(players).find(p => p.name === targetName);
  if (!targetPlayer) {
    sendToClient(ws, { type: 'system', data: { message: `找不到玩家【${targetName}】。` } });
    return;
  }
  if (targetPlayer.id === player.id) {
    sendToClient(ws, { type: 'system', data: { message: '不能添加自己为好友。' } });
    return;
  }
  if (player.friends && player.friends.includes(targetName)) {
    sendToClient(ws, { type: 'system', data: { message: `【${targetName}】已经是你的好友了。` } });
    return;
  }
  // Add to target's pending requests
  const tp = players[targetPlayer.id];
  if (!tp.pendingFriendRequests) tp.pendingFriendRequests = [];
  if (tp.pendingFriendRequests.includes(player.name)) {
    sendToClient(ws, { type: 'system', data: { message: `你已经向【${targetName}】发送过好友请求了。` } });
    return;
  }
  tp.pendingFriendRequests.push(player.name);
  savePlayers(players);
  sendToClient(ws, { type: 'system', data: { message: `已向【${targetName}】发送好友请求。` } });
  // Notify target if online
  for (const [clientWs, info] of connectedClients.entries()) {
    if (info.playerId === targetPlayer.id) {
      sendToClient(clientWs, { type: 'system', data: { message: `📩 ${player.name} 向你发送了好友请求！使用 /接受好友 接受。` } });
      break;
    }
  }
}

function handleAcceptFriendCommand(ws, player) {
  const players = getPlayers();
  const p = players[player.id];
  if (!p.pendingFriendRequests || p.pendingFriendRequests.length === 0) {
    sendToClient(ws, { type: 'system', data: { message: '没有待处理的好友请求。' } });
    return;
  }
  const requesterName = p.pendingFriendRequests.shift();
  if (!p.friends) p.friends = [];
  p.friends.push(requesterName);
  // Add to requester's friend list too
  const requester = Object.values(players).find(pl => pl.name === requesterName);
  if (requester) {
    if (!requester.friends) requester.friends = [];
    if (!requester.friends.includes(player.name)) requester.friends.push(player.name);
  }
  savePlayers(players);
  sendToClient(ws, { type: 'system', data: { message: `✅ 已与【${requesterName}】成为好友！` } });
}

function handleRemoveFriendCommand(ws, player, command) {
  const targetName = command.replace('/删除好友', '').trim();
  if (!targetName) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /删除好友 <玩家名>' } });
    return;
  }
  const players = getPlayers();
  const p = players[player.id];
  if (!p.friends || !p.friends.includes(targetName)) {
    sendToClient(ws, { type: 'system', data: { message: `【${targetName}】不在你的好友列表中。` } });
    return;
  }
  p.friends = p.friends.filter(f => f !== targetName);
  // Remove from target's friend list too
  const targetPlayer = Object.values(players).find(pl => pl.name === targetName);
  if (targetPlayer && targetPlayer.friends) {
    targetPlayer.friends = targetPlayer.friends.filter(f => f !== player.name);
  }
  savePlayers(players);
  sendToClient(ws, { type: 'system', data: { message: `已删除好友【${targetName}】。` } });
}

function handleWhisperCommand(ws, player, command) {
  const args = command.replace('/私聊', '').trim();
  const spaceIdx = args.indexOf(' ');
  if (spaceIdx === -1 || !args) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /私聊 <玩家名> <消息>' } });
    return;
  }
  const targetName = args.slice(0, spaceIdx);
  const message = args.slice(spaceIdx + 1).trim();
  if (!message) {
    sendToClient(ws, { type: 'system', data: { message: '消息不能为空。' } });
    return;
  }
  for (const [clientWs, info] of connectedClients.entries()) {
    if (info.playerName === targetName) {
      sendToClient(clientWs, { type: 'whisper', data: { sender: player.name, message } });
      sendToClient(ws, { type: 'whisper', data: { sender: `→ ${targetName}`, message } });
      return;
    }
  }
  sendToClient(ws, { type: 'system', data: { message: `玩家【${targetName}】不在线。` } });
}

// ===== ENCOUNTER COMBAT COMMANDS =====
function handleFightDemonCommand(ws, player) {
  const players = getPlayers();
  const p = players[player.id];
  if (p.pendingEncounter !== 'inner_demon') {
    sendToClient(ws, { type: 'system', data: { message: '你现在没有心魔考验。' } });
    return;
  }
  p.pendingEncounter = null;
  // 60% win chance
  if (Math.random() < 0.6) {
    const { leveled, realmChanged } = addExp(p, 80);
    let msg = '🎉 你战胜了心魔！获得 80 经验！';
    if (leveled) msg += '\n🎊 恭喜！你升级了！';
    if (realmChanged) msg += '\n✨ 境界突破！';
    savePlayers(players);
    sendToClient(ws, { type: 'system', data: { message: msg } });
  } else {
    const expLoss = Math.min(20, p.exp);
    p.exp -= expLoss;
    savePlayers(players);
    sendToClient(ws, { type: 'system', data: { message: `💀 你被心魔击败，损失 ${expLoss} 经验...` } });
  }
}

function handleFleeCommand(ws, player) {
  const players = getPlayers();
  const p = players[player.id];
  if (p.pendingEncounter !== 'inner_demon') {
    sendToClient(ws, { type: 'system', data: { message: '你现在没有需要逃跑的遭遇。' } });
    return;
  }
  p.pendingEncounter = null;
  savePlayers(players);
  sendToClient(ws, { type: 'system', data: { message: '你转身逃离了心魔的追击。' } });
}

function handleMerchantBuyCommand(ws, player, command) {
  const args = command.replace('/商人购买', '').trim().split(/\s+/);
  const pillId = args[0];
  const quantity = parseInt(args[1]) || 1;
  if (!pillId) {
    sendToClient(ws, { type: 'system', data: { message: '商人出售: 回血丹(5灵石), 回灵丹(8灵石), 体力丹(10灵石)\n用法: /商人购买 <丹药ID> [数量]' } });
    return;
  }
  const merchantPrices = { hp_pill: 5, spirit_pill: 8, stamina_pill: 10 };
  if (!merchantPrices[pillId]) {
    sendToClient(ws, { type: 'system', data: { message: '商人只出售: hp_pill, spirit_pill, stamina_pill' } });
    return;
  }
  const price = merchantPrices[pillId];
  const totalCost = price * quantity;
  const players = getPlayers();
  const p = players[player.id];
  if (p.silver < totalCost) {
    sendToClient(ws, { type: 'system', data: { message: `灵石不足！需要 ${totalCost}，你只有 ${p.silver}。` } });
    return;
  }
  p.silver -= totalCost;
  if (!p.pills) p.pills = {};
  p.pills[pillId] = (p.pills[pillId] || 0) + quantity;
  savePlayers(players);
  const pd = PILLS_DATA[pillId];
  sendToClient(ws, { type: 'system', data: { message: `🏪 商人处购买了 ${quantity} 个【${pd ? pd.name : pillId}】，花费 ${totalCost} 灵石。` } });
}

// Helper functions

// ===== CYBER SYSTEM HELPER =====
function calcWatchLevel(relicCount) {
  if (relicCount >= 9) return 4;
  if (relicCount >= 6) return 3;
  if (relicCount >= 1) return 1;
  return 0;
}

// Get total stat bonuses from relics
function getRelicBonuses(player) {
  const bonuses = { attack: 0, defense: 0, hp: 0, spirit: 0, exp: 0, dodge: 0, critRate: 0, critDmg: 0, regen: 0 };
  const relics = player.relics || [];
  for (const id of relics) {
    const r = RELICS_DATA[id];
    if (!r || !r.effects) continue;
    if (r.effects.attack) bonuses.attack += r.effects.attack;
    if (r.effects.defense) bonuses.defense += r.effects.defense;
    if (r.effects.hp) bonuses.hp += r.effects.hp;
    if (r.effects.spirit) bonuses.spirit += r.effects.spirit;
    if (r.effects.exp) bonuses.exp += r.effects.exp;
    if (r.effects.dodge) bonuses.dodge += r.effects.dodge;
    if (r.effects.critRate) bonuses.critRate += r.effects.critRate;
    if (r.effects.critDamage) bonuses.critDmg += r.effects.critDamage;
    if (r.effects.regen) bonuses.regen += r.effects.regen;
    if (r.effects.hpRegen) bonuses.regen += r.effects.hpRegen;
  }
  return bonuses;
}

// ===== RELIC COMMANDS =====

// /遗物 - show collected relics
function handleRelicCommand(ws, player) {
  const relics = player.relics || [];
  if (relics.length === 0) {
    sendToClient(ws, {
      type: 'command_response',
      data: {
        title: '程序遗物',
        content: `\n╔══════════════════════════════╗\n║  程序遗物 (程序遗物)\n╠══════════════════════════════╣\n║  你还没有发现任何程序遗物。\n║\n║  击败怪物时有极小概率掉落。\n║  程序遗物是这个世界的源代码碎片...\n║  作为2030年的退休程序员，\n║  你似乎能感知到它们的存在。\n╚══════════════════════════════╝`
      }
    });
    return;
  }
  
  // Group by category
  const categories = {};
  for (const relicId of relics) {
    const r = RELICS_DATA[relicId];
    if (!r) continue;
    if (!categories[r.category]) categories[r.category] = [];
    categories[r.category].push(r);
  }
  
  let list = '';
  for (const [cat, items] of Object.entries(categories)) {
    list += `║  【${cat}】\n`;
    for (const r of items) {
      list += `║    ${r.name} - ${r.desc}\n`;
    }
  }
  
  const watchStatus = player.adminWatch ? `Lv${player.adminWatchLevel}` : '未获得';
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '程序遗物',
      content: `\n╔══════════════════════════════╗\n║  程序遗物 (已收集 ${relics.length}/12)\n╠══════════════════════════════╣\n${list}╠══════════════════════════════╣\n║  管理员手表: ${watchStatus}\n║  手表详情: /手表\n╚══════════════════════════════╝`
    }
  });
}

// /手表 - show admin watch status
function handleWatchCommand(ws, player) {
  if (!player.adminWatch) {
    sendToClient(ws, {
      type: 'command_response',
      data: {
        title: '管理员手表',
        content: `\n╔══════════════════════════════╗\n║  管理员手表\n╠══════════════════════════════╣\n║  你还未获得管理员手表。\n║\n║  完成任务「世界异常」获取。\n║  (等级5时自动触发)\n╚══════════════════════════════╝`
      }
    });
    return;
  }
  
  const level = player.adminWatchLevel || 0;
  const relicCount = (player.relics || []).length;
  
  let abilities = '';
  for (let i = 0; i <= 4; i++) {
    const wt = WATCH_THRESHOLDS[i];
    const marker = i <= level ? '✅' : '🔒';
    abilities += `║  ${marker} Lv${wt.level} (${wt.relics}遗物): ${wt.abilities}\n`;
  }
  
  // Show teleport usage if watch level >= 3
  let teleportInfo = '';
  if (level >= 3) {
    const bugUsage = player.bugUsage || {};
    const teleportUsed = (bugUsage['B17']?.dailyCount || 0);
    teleportInfo = `║  瞬移使用: ${teleportUsed}/5\n`;
  }
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '管理员手表',
      content: `\n╔══════════════════════════════╗\n║  管理员手表 Lv${level}\n╠══════════════════════════════╣\n║  遗物数量: ${relicCount}\n║  神秘信件: ${player.mysteryLetters || 0}\n╠══════════════════════════════╣\n║  等级能力:\n${abilities}${teleportInfo}╚══════════════════════════════╝`
    }
  });
}

// ===== BUG COMMANDS =====

// /Bug - show discovered bugs
function handleBugListCommand(ws, player) {
  const bugs = player.discoveredBugs || [];
  if (bugs.length === 0) {
    sendToClient(ws, {
      type: 'command_response',
      data: {
        title: 'Bug列表',
        content: `\n╔══════════════════════════════╗\n║  Bug列表\n╠══════════════════════════════╣\n║  你还没有发现任何Bug。\n║\n║  使用 /探索Bug 在当前房间搜索。\n║  (需要管理员手表才能直接使用Bug)\n║  没有手表时会获得神秘信件。\n╚══════════════════════════════╝`
      }
    });
    return;
  }
  
  const today = new Date().toISOString().slice(0, 10);
  const bugUsage = player.bugUsage || {};
  
  let bugList = '';
  for (const bugId of bugs) {
    const bd = BUGS_DATA[bugId];
    if (!bd) continue;
    const usage = bugUsage[bugId];
    const usedToday = (usage && usage.lastUsed === today) ? usage.dailyCount : 0;
    const limitStr = bd.dailyLimit >= 999 ? '无限' : `${usedToday}/${bd.dailyLimit}`;
    bugList += `║  【${bd.name}】(${bd.id})\n║    ${bd.desc}\n║    今日使用: ${limitStr}\n`;
  }
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: 'Bug列表',
      content: `\n╔══════════════════════════════╗\n║  Bug列表 (已发现 ${bugs.length})\n╠══════════════════════════════╣\n${bugList}╠══════════════════════════════╣\n║  使用: /使用Bug <BugID>\n║  探索: /探索Bug\n╚══════════════════════════════╝`
    }
  });
}

// /探索Bug - search current room for bugs
function handleExploreBugCommand(ws, player) {
  const players = getPlayers();
  const p = players[player.id];
  if (!p) return;
  
  // Check stamina
  if (p.stamina < 15) {
    sendToClient(ws, { type: 'system', data: { message: '体力不足，探索Bug需要15点体力。' } });
    return;
  }
  
  // Check if room has bugs
  const roomBugs = BUG_LOCATIONS[p.currentRoom];
  if (!roomBugs || roomBugs.length === 0) {
    sendToClient(ws, { type: 'system', data: { message: `${p.currentRoom}没有发现任何Bug痕迹。尝试其他地方探索。` } });
    return;
  }
  
  // Consume stamina
  p.stamina -= 15;
  
  // Try to find a bug (50% chance per exploration)
  if (Math.random() < 0.5) {
    // Find an undiscovered bug in this room
    const undiscovered = roomBugs.filter(id => !(p.discoveredBugs || []).includes(id));
    
    if (undiscovered.length === 0) {
      // Already discovered all bugs here, give mystery letter
      p.mysteryLetters = (p.mysteryLetters || 0) + 1;
      sendToClient(ws, {
        type: 'system',
        data: { message: `你在${p.currentRoom}搜索，发现了一封神秘信件... (神秘信件+1)\n  "这个世界的代码比你想象的要复杂..."` }
      });
      savePlayers(players);
      return;
    }
    
    const bugId = undiscovered[Math.floor(Math.random() * undiscovered.length)];
    const bd = BUGS_DATA[bugId];
    
    if (p.adminWatch) {
      // Has watch: discover bug directly
      if (!p.discoveredBugs) p.discoveredBugs = [];
      p.discoveredBugs.push(bugId);
      sendToClient(ws, {
        type: 'system',
        data: { message: `⌚ 管理员手表闪烁！你发现了一个Bug！\n  【${bd.name}】- ${bd.desc}\n  使用 /使用Bug ${bugId} 来激活。` }
      });
    } else {
      // No watch: get mystery letter instead
      p.mysteryLetters = (p.mysteryLetters || 0) + 1;
      sendToClient(ws, {
        type: 'system',
        data: { message: `你感觉到了一股异常的数据波动...但无法理解它的含义。\n  获得了一封神秘信件。(神秘信件+1)\n  "也许获得管理员手表后才能解读这些Bug..."` }
      });
    }
  } else {
    sendToClient(ws, {
      type: 'system',
      data: { message: `你在${p.currentRoom}仔细搜索，但什么也没发现。消耗15体力。` }
    });
  }
  
  savePlayers(players);
}

// /使用Bug <bugId> - activate a bug
function handleUseBugCommand(ws, player, bugId) {
  if (!bugId) {
    sendToClient(ws, { type: 'system', data: { message: '用法: /使用Bug <BugID>\n输入 /Bug 查看已发现的Bug。' } });
    return;
  }
  
  const players = getPlayers();
  const p = players[player.id];
  if (!p) return;
  
  // Check if player has admin watch
  if (!p.adminWatch) {
    sendToClient(ws, { type: 'system', data: { message: '你需要管理员手表才能使用Bug。完成任务「世界异常」获取。' } });
    return;
  }
  
  // Check if bug is discovered
  if (!p.discoveredBugs || !p.discoveredBugs.includes(bugId)) {
    sendToClient(ws, { type: 'system', data: { message: `你还没有发现Bug【${bugId}】。使用 /探索Bug 来寻找。` } });
    return;
  }
  
  const bd = BUGS_DATA[bugId];
  if (!bd) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该Bug。' } });
    return;
  }
  
  // Check daily limit
  const today = new Date().toISOString().slice(0, 10);
  if (!p.bugUsage) p.bugUsage = {};
  if (!p.bugUsage[bugId]) p.bugUsage[bugId] = { lastUsed: '', dailyCount: 0 };
  
  const usage = p.bugUsage[bugId];
  if (usage.lastUsed !== today) {
    usage.lastUsed = today;
    usage.dailyCount = 0;
  }
  
  if (usage.dailyCount >= bd.dailyLimit) {
    sendToClient(ws, { type: 'system', data: { message: `Bug【${bd.name}】今日使用次数已达上限(${bd.dailyLimit}次)。` } });
    return;
  }
  
  usage.dailyCount++;
  
  // Apply bug effect
  let msg = '';
  if (!p.activeBugs) p.activeBugs = {};
  
  switch (bugId) {
    case 'B01': // 时间膨胀泡 - idle exp x3 for 10 min
      p.activeBugs.B01 = Date.now() + bd.duration;
      msg = `⏳ 激活了【${bd.name}】！挂机经验x3，持续10分钟。`;
      break;
    case 'B02': // 经验溢出点 - combat exp x2 for 1 hour
      p.activeBugs.B02 = Date.now() + bd.duration;
      msg = `✨ 激活了【${bd.name}】！战斗经验x2，持续1小时。`;
      break;
    case 'B11': // 背包溢出
      p.activeBugs.B11 = Date.now() + bd.duration;
      msg = `🎒 激活了【${bd.name}】！临时+100背包格，持续1小时。`;
      break;
    case 'B12': { // 商店漏洞 - free random shop item
      const shopIds = Object.keys(SHOP_ITEMS);
      const randomId = shopIds[Math.floor(Math.random() * shopIds.length)];
      const item = SHOP_ITEMS[randomId];
      if (item.type === 'pill') {
        if (!p.pills) p.pills = {};
        p.pills[randomId] = (p.pills[randomId] || 0) + 1;
      } else if (item.type === 'equipment') {
        p.equipmentBag.push({ id: randomId });
      }
      msg = `🆓 激活了【${bd.name}】！免费获得了【${item.name}】！`;
      break;
    }
    case 'B31': // 伤害溢出 - next attack x3
      p.activeBugs.B31 = 1; // 1 charge
      msg = `💥 激活了【${bd.name}】！下次攻击伤害x3！`;
      break;
    case 'B33': // 怪物卡住
      p.activeBugs.B33 = 1; // 1 charge
      msg = `🐛 激活了【${bd.name}】！怪物将跳过1回合！`;
      break;
    case 'B45': // 道心漏洞
      p.activeBugs.B45 = Date.now() + bd.duration;
      msg = `🧘 激活了【${bd.name}】！道心+200，持续1小时。`;
      break;
    case 'B49': // 体力漏洞
      p.activeBugs.B49 = Date.now() + bd.duration;
      p.stamina = p.maxStamina;
      msg = `⚡ 激活了【${bd.name}】！体力恢复满！无限体力30分钟。`;
      break;
    case 'B50': // 掉率漏洞
      p.activeBugs.B50 = Date.now() + bd.duration;
      msg = `🍀 激活了【${bd.name}】！掉率x5，持续1小时。`;
      break;
    case 'B17': // 瞬移漏洞
      if (p.currentMap === '新手村') {
        const allRooms = Object.keys(WORLD_DATA.maps['新手村'].rooms);
        msg = `🌀 激活了【${bd.name}】！可传送房间:\n`;
        msg += allRooms.map((r, i) => `  ${i + 1}. ${r}`).join('\n');
        msg += `\n输入 /移动 <房间名> 传送到目标房间。`;
        p.activeBugs.B17 = 1; // 1 charge
      } else {
        msg = `🌀 你不在可传送的地图上。`;
      }
      break;
    case 'B20': // 回城Bug
      p.currentRoom = '村口';
      p.currentMap = '新手村';
      msg = `🏠 激活了【${bd.name}】！瞬间回到了新手村村口！`;
      // Send new room
      const newRoom = getRoom(p.currentMap, p.currentRoom);
      if (newRoom) {
        sendToClient(ws, {
          type: 'room',
          data: { name: newRoom.name, description: newRoom.description, exits: newRoom.exits, players: [] }
        });
      }
      break;
    case 'B21': // 传送门
      p.activeBugs.B21 = Date.now() + bd.duration;
      msg = `🚪 激活了【${bd.name}】！创建了传送门，持续30分钟。在村口和当前位置间自由传送。`;
      break;
    default:
      msg = `激活了Bug【${bd.name}】。效果: ${bd.desc}`;
  }
  
  savePlayers(players);
  sendToClient(ws, { type: 'system', data: { message: msg } });
}

// Helper functions
function getRoom(mapName, roomName) {
  const map = WORLD_DATA.maps[mapName];
  if (!map) return null;
  return map.rooms[roomName] || null;
}

function getPlayersInRoom(mapName, roomName, excludeWs) {
  const playersInRoom = [];
  
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      const clientInfo = connectedClients.get(client);
      if (clientInfo) {
        const players = getPlayers();
        const player = players[clientInfo.playerId];
        if (player && player.currentMap === mapName && player.currentRoom === roomName) {
          playersInRoom.push({
            name: player.name,
            profession: player.profession,
            level: player.level,
            realm: player.realm
          });
        }
      }
    }
  });
  
  return playersInRoom;
}

function sanitizePlayer(player) {
  const { password, ...safeData } = player;
  return safeData;
}

function getDirectionName(dir) {
  const names = {
    north: '北', south: '南', east: '东', west: '西',
    up: '上', down: '下',
    southeast: '东南', northeast: '东北', southwest: '西南', northwest: '西北'
  };
  return names[dir] || dir;
}

function getOppositeDirectionName(dir) {
  const opposites = {
    north: '南', south: '北', east: '西', west: '东',
    up: '下', down: '上',
    southeast: '西北', northeast: '西南', southwest: '东北', northwest: '东南'
  };
  return opposites[dir] || dir;
}

// ===== REALM/CULTIVATION SYSTEM =====

// Get current realm info for a player
function getRealmInfo(player) {
  const realmName = player.realm;
  const parts = realmName.split('期');
  const mainRealmName = parts[0].replace(/初期|中期|后期|巅峰/, '');
  
  // Find the realm data
  const realmData = realms.find(r => mainRealmName.includes(r.name));
  if (!realmData) return null;
  
  // Find the sub-level
  let subLevel = '初期';
  if (realmName.includes('中期')) subLevel = '中期';
  else if (realmName.includes('后期')) subLevel = '后期';
  else if (realmName.includes('巅峰')) subLevel = '巅峰';
  
  const subLevelData = realmData.subLevels.find(s => s.name === subLevel);
  
  return {
    realm: realmData,
    subLevel: subLevelData,
    subLevelName: subLevel,
    fullName: realmData.name + subLevel
  };
}

// Calculate exp needed for next level
function expToLevel(level) {
  return level * 100;
}

// Add exp to player and handle level up and realm progression
function addExp(player, amount) {
  player.exp += amount;
  let leveled = false;
  let realmChanged = false;
  
  // Level up check
  while (player.exp >= expToLevel(player.level)) {
    player.exp -= expToLevel(player.level);
    player.level++;
    leveled = true;
    // Increase stats on level up
    player.maxHp += 5;
    player.maxSpirit += 3;
    player.maxStamina += 4;
    player.hp = player.maxHp;
    player.spirit = player.maxSpirit;
    player.stamina = player.maxStamina;
    // Update quest progress for level-type quests
    updateQuestProgress(player, 'level', player.level);
  }
  
  // Realm progression check
  realmChanged = checkRealmProgression(player);
  
  return { leveled, realmChanged };
}

// Check and advance realm
function checkRealmProgression(player) {
  const realmInfo = getRealmInfo(player);
  if (!realmInfo || !realmInfo.subLevel) return false;
  
  // Check if exp meets the requirement for next sub-level
  if (player.exp >= realmInfo.subLevel.expRequired) {
    const currentRealmOrder = realmInfo.realm.order;
    const currentSubIndex = realmInfo.realm.subLevels.indexOf(realmInfo.subLevel);
    
    let nextRealm, nextSubLevel;
    
    if (currentSubIndex < 3) {
      // Next sub-level in same realm
      nextRealm = realmInfo.realm;
      nextSubLevel = realmInfo.realm.subLevels[currentSubIndex + 1];
    } else if (currentRealmOrder < 12) {
      // Next realm, first sub-level
      nextRealm = realms.find(r => r.order === currentRealmOrder + 1);
      nextSubLevel = nextRealm.subLevels[0];
    } else {
      return false; // Already at max realm
    }
    
    // P0-5c: Breakthrough failure chance
    const dhBonus = getDaoHeartBonus(player);
    const successRate = Math.min(100, 80 + dhBonus.breakthroughBonus);
    if (Math.random() * 100 >= successRate) {
      // Breakthrough failed!
      const expLoss = Math.floor(player.exp * 0.3);
      player.exp = Math.max(0, player.exp - expLoss);
      
      // If at first sub-level, drop to previous realm's last sub-level
      if (currentSubIndex === 0 && currentRealmOrder > 0) {
        const prevRealm = realms.find(r => r.order === currentRealmOrder - 1);
        if (prevRealm) {
          player.realm = prevRealm.name + prevRealm.subLevels[3].name;
        }
      }
      // Update lifespan to match realm
      player.lifespan = getRealmLifespan(player.realm);
      
      // Return a special value to indicate failure (we'll handle message in caller)
      player._breakthroughFailed = true;
      player._breakthroughExpLoss = expLoss;
      return false;
    }
    
    player.realm = nextRealm.name + nextSubLevel.name;
    player.exp -= realmInfo.subLevel.expRequired;
    
    // Stat bonuses for realm breakthrough
    player.maxHp += nextSubLevel.expRequired > 1000 ? 20 : 10;
    player.maxSpirit += nextSubLevel.expRequired > 1000 ? 10 : 5;
    player.hp = player.maxHp;
    player.spirit = player.maxSpirit;
    
    // P0-6a: Reset age and update lifespan on breakthrough
    player.age = 0;
    player.lifespan = getRealmLifespan(player.realm);
    
    return true;
  }
  return false;
}

// ===== P0 HELPER FUNCTIONS =====

// P0-1: Dao Heart system
function getDaoHeartBonus(player) {
  const dh = player.daoHeart || 500;
  if (dh < 200) return { critBonus: 0, encounterBonus: -30, breakthroughBonus: -20, expBonus: -10, label: '心魔缠身' };
  if (dh < 500) return { critBonus: 0, encounterBonus: -10, breakthroughBonus: -5, expBonus: 0, label: '道心不稳' };
  if (dh < 800) return { critBonus: 0, encounterBonus: 0, breakthroughBonus: 0, expBonus: 0, label: '道心坚定' };
  return { critBonus: 10, encounterBonus: 15, breakthroughBonus: 20, expBonus: 0, label: '道心圆满' };
}

// P0-2: Credit Score system
function getCreditBonus(player) {
  const cs = player.creditScore || 500;
  if (cs < 200) return { canTrade: false, canAuction: false, canMentor: false, tradeTax: 0, label: '红名' };
  if (cs < 500) return { canTrade: true, canAuction: true, canMentor: true, tradeTax: 50, label: '信用不良' };
  if (cs < 800) return { canTrade: true, canAuction: true, canMentor: true, tradeTax: 0, label: '正常' };
  return { canTrade: true, canAuction: true, canMentor: true, tradeTax: -20, label: '信誉良好' };
}

// P0-3: Bag capacity helpers
function getBagUsed(player) {
  let count = 0;
  if (player.pills) { for (const c of Object.values(player.pills)) count += c; }
  if (player.equipmentBag) count += player.equipmentBag.length;
  return count;
}

function getBagCapacity(player) {
  let cap = player.bagCapacity || 50;
  // VIP bonus would go here
  return cap;
}

// P0-5b: Realm order helper
function getRealmOrder(realmStr) {
  const realmNames = ['练气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫','飞升','仙人','神尊'];
  for (let i = 0; i < realmNames.length; i++) {
    if (realmStr.includes(realmNames[i])) return i;
  }
  return 0;
}

// P0-6b: Profession bonus helper
function getProfessionBonus(player) {
  const profs = {
    '退休警察': { primary: { type: '追击伤害', value: 0.10 }, secondary: { type: '体力恢复', value: 0.05 } },
    '退休军人': { primary: { type: '防御', value: 0.10 }, secondary: { type: 'HP上限', value: 0.05 } },
    '退休医生': { primary: { type: '治疗效果', value: 0.10 }, secondary: { type: '炼丹成功率', value: 0.05 } },
    '退休教师': { primary: { type: '功法修炼速度', value: 0.10 }, secondary: { type: '悟性成长', value: 0.05 } },
    '退休程序员': { primary: { type: 'Bug发现率', value: 0.10 }, secondary: { type: '解谜线索', value: 0.05 } },
    '退休工人': { primary: { type: '力道成长', value: 0.10 }, secondary: { type: '负重', value: 0.05 } },
    '退休厨师': { primary: { type: '食物效果', value: 0.10 }, secondary: { type: '体力上限', value: 0.05 } },
    '退休商人': { primary: { type: '银两获取', value: 0.10 }, secondary: { type: '交易税', value: -0.05 } },
    '退休运动员': { primary: { type: '速度', value: 0.10 }, secondary: { type: '闪避', value: 0.05 } },
    '退休艺术家': { primary: { type: '奇遇概率', value: 0.10 }, secondary: { type: '道心成长', value: 0.05 } },
    '退休农民': { primary: { type: '采集效率', value: 0.10 }, secondary: { type: '寿命', value: 0.05 } },
    '无业/自由': { primary: { type: '全属性', value: 0.03 }, secondary: null }
  };
  return profs[player.profession] || null;
}

// P0-6a: Lifespan by realm
function getRealmLifespan(realmStr) {
  const order = getRealmOrder(realmStr);
  const lifespans = [100, 200, 500, 1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 50000];
  return lifespans[order] || 100;
}

// ===== COMBAT SYSTEM =====

// Execute a full combat encounter
function executeCombat(ws, player, room) {
  if (!room.monsters || room.monsters.length === 0) {
    return { success: false, message: '这里没有可攻击的怪物。' };
  }
  
  // Pick a random monster and deep copy it
  const monsterTemplate = room.monsters[Math.floor(Math.random() * room.monsters.length)];
  const monster = { ...monsterTemplate, hp: monsterTemplate.maxHp || monsterTemplate.hp };
  
  // Player stats
  const equipBonuses = getEquipmentBonuses(player);
  let playerAttack = player.stats.str * 2 + player.level * 3 + equipBonuses.attack + equipBonuses.str * 2;
  let playerDefense = player.stats.con * 1.5 + player.level * 2 + equipBonuses.defense;
  let playerSpeed = player.stats.dex * 1.5 + equipBonuses.speed;
  
  // Apply relic bonuses to stats
  if (player.relics) {
    if (player.relics.includes('M06')) playerAttack = Math.floor(playerAttack * 1.10); // M06: attack+10%
    if (player.relics.includes('M05')) playerDefense = Math.floor(playerDefense * 1.08); // M05: defense+8%
    if (player.relics.includes('Z02')) playerAttack = Math.floor(playerAttack * 1.15); // Z02: str+15%
  }
  
  // P0-6b: Apply profession bonuses
  const profBonus = getProfessionBonus(player);
  if (profBonus) {
    if (profBonus.primary.type === '追击伤害' || profBonus.primary.type === '全属性') playerAttack = Math.floor(playerAttack * (1 + profBonus.primary.value));
    if (profBonus.primary.type === '防御' || profBonus.primary.type === '全属性') playerDefense = Math.floor(playerDefense * (1 + profBonus.primary.value));
    if (profBonus.primary.type === '速度' || profBonus.primary.type === '全属性') playerSpeed = Math.floor(playerSpeed * (1 + profBonus.primary.value));
  }
  
  // P0-5b: Realm suppression bonus
  const playerRealmOrder = getRealmOrder(player.realm);
  let realmDmgBonus = 1;
  let realmDmgReduce = 1;
  let realmSupMsg = '';
  if (monsterTemplate.realm) {
    const monsterRealmOrder = getRealmOrder(monsterTemplate.realm);
    if (playerRealmOrder > monsterRealmOrder) {
      realmDmgBonus = 1.2;
      realmDmgReduce = 0.8;
      realmSupMsg = '境界压制！你对低境界怪物造成额外伤害，受到伤害减少！';
    } else if (playerRealmOrder < monsterRealmOrder) {
      realmDmgBonus = 0.8;
      realmDmgReduce = 1.2;
      realmSupMsg = '境界差距！你对高境界怪物伤害降低，受到伤害增加！';
    }
  }
  
  // Find best active skill for bonus damage
  let activeSkillBonus = 0;
  let activeSkillName = null;
  if (player.skills && player.skills.length > 0) {
    for (const ps of player.skills) {
      const skillData = SKILLS_DATA[ps.id];
      if (skillData && skillData.type === 'active') {
        const bonus = skillData.damage + (ps.level - 1) * 3; // +3 damage per skill level
        if (bonus > activeSkillBonus) {
          activeSkillBonus = bonus;
          activeSkillName = skillData.name + ' Lv' + ps.level;
        }
      }
    }
  }
  
  // Check passive skills
  let dodgeChance = 0;
  let extraSpiritRecovery = 0;
  if (player.skills) {
    for (const ps of player.skills) {
      const skillData = SKILLS_DATA[ps.id];
      if (skillData && skillData.type === 'passive') {
        if (skillData.id === 'basic_movement') dodgeChance += 0.05 + (ps.level - 1) * 0.01;
        if (skillData.id === 'basic_meditation') extraSpiritRecovery += 2 + (ps.level - 1);
      }
    }
  }
  // Relic dodge bonus (T02)
  if (player.relics && player.relics.includes('T02')) dodgeChance += 0.10;
  
  // Check sect bonus
  let sectDefenseBonus = 1;
  let sectExpBonus = 1;
  let sectAttackBonus = 1;
  let sectCritBonus = 0;
  if (player.sect) {
    if (player.sect === 'shaolin') sectDefenseBonus = 1.1;
    else if (player.sect === 'xiaoyao') sectExpBonus = 1.1;
    else if (player.sect === 'huashan') sectAttackBonus = 1.1;
    else if (player.sect === 'riyue') sectCritBonus += 0.1;
  }
  
  const combatLog = [];
  combatLog.push(`⚔️ 战斗开始！你遭遇了 ${monster.name}！`);
  combatLog.push(`${monster.name}: HP ${monster.hp}/${monster.maxHp || monster.hp} | 攻击 ${monster.attack} | 防御 ${monster.defense}`);
  if (realmSupMsg) combatLog.push(`🔸 ${realmSupMsg}`);
  combatLog.push('');
  
  // P0-5a: Combat initiative (先手判定)
  const monsterSpeed = (monster.attack + monster.defense) * 0.5; // Approximate monster speed
  const playerGoesFirst = playerSpeed >= monsterSpeed;
  if (playerGoesFirst) {
    combatLog.push('🏃 你身法敏捷，率先出手！');
  } else {
    combatLog.push('💨 怪物速度更快，率先攻击！');
  }
  combatLog.push('');
  
  let round = 0;
  const maxRounds = 50; // Safety limit
  
  // P0-1: Dao heart crit bonus
  const dhBonus = getDaoHeartBonus(player);
  
  while (player.hp > 0 && monster.hp > 0 && round < maxRounds) {
    round++;
    
    // Monster attacks first if not playerGoesFirst (only first round)
    if (!playerGoesFirst && round === 1) {
      if (dodgeChance > 0 && Math.random() < dodgeChance) {
        combatLog.push(`        ${monster.name} 攻击你，但你身法灵动闪避了！`);
      } else {
        const monsterDmg = Math.max(1, Math.floor((monster.attack - playerDefense * sectDefenseBonus / 2 + Math.floor(Math.random() * 5) - 2) * realmDmgReduce));
        player.hp -= monsterDmg;
        combatLog.push(`        ${monster.name} 攻击你，造成 ${monsterDmg} 点伤害！你的 HP: ${Math.max(0, player.hp)}/${player.maxHp}`);
      }
      if (player.hp <= 0) break;
    }
    
    // Player attacks monster
    let playerDmg = Math.max(1, Math.floor((playerAttack - monster.defense / 2 + Math.floor(Math.random() * 5) - 2) * realmDmgBonus));
    // Apply active skill bonus
    if (activeSkillBonus > 0) {
      playerDmg += activeSkillBonus;
      if (round === 1) combatLog.push(`⚔️ 发动功法【${activeSkillName}】，额外造成 ${activeSkillBonus} 点伤害！`);
    }
    // Apply B31 damage bug
    const combatBugs = player.activeBugs || {};
    if (combatBugs.B31 && combatBugs.B31 > 0 && round === 1) {
      playerDmg *= 3;
      player.activeBugs.B31 = 0; // consume charge
      combatLog.push('  [Bug效果] 伤害溢出 - 伤害x3！');
    }
    // Apply relic damage bonuses
    if (player.relics && player.relics.includes('M06')) playerDmg = Math.floor(playerDmg * 1.10); // M06: attack+10%
    if (player.relics && player.relics.includes('Z03') && Math.random() < 0.10) {
      playerDmg = Math.floor(playerDmg * 1.5); // Z03: 10% crit rate
      combatLog.push('  [遗物效果] 暴击！');
    }
    // Apply sect bonuses (attack and crit)
    if (sectAttackBonus > 1) playerDmg = Math.floor(playerDmg * sectAttackBonus);
    if (sectCritBonus > 0 && Math.random() < sectCritBonus) {
      playerDmg = Math.floor(playerDmg * 1.5);
      if (round === 1) combatLog.push('  [门派效果] 暴击！');
    }
    // P0-1: Apply dao heart critBonus
    if (dhBonus.critBonus > 0 && Math.random() * 100 < dhBonus.critBonus) {
      playerDmg = Math.floor(playerDmg * 1.5);
      combatLog.push('  [道心效果] 暴击！');
    }
    monster.hp -= playerDmg;
    combatLog.push(`第${round}回合: 你攻击 ${monster.name}，造成 ${playerDmg} 点伤害！${monster.name} HP: ${Math.max(0, monster.hp)}/${monsterTemplate.maxHp || monsterTemplate.hp}`);
    
    if (monster.hp <= 0) break;
    
    // Check B33 monster skip bug
    if (player.activeBugs && player.activeBugs.B33 && player.activeBugs.B33 > 0) {
      player.activeBugs.B33 = 0; // consume charge
      combatLog.push(`        [Bug效果] 怪物卡住！${monster.name} 跳过了本回合！`);
      continue; // skip monster attack
    }
    
    // Monster attacks player (check dodge)
    if (dodgeChance > 0 && Math.random() < dodgeChance) {
      combatLog.push(`        ${monster.name} 攻击你，但你身法灵动闪避了！`);
    } else {
      const monsterDmg = Math.max(1, Math.floor((monster.attack - playerDefense * sectDefenseBonus / 2 + Math.floor(Math.random() * 5) - 2) * realmDmgReduce));
      player.hp -= monsterDmg;
      combatLog.push(`        ${monster.name} 攻击你，造成 ${monsterDmg} 点伤害！你的 HP: ${Math.max(0, player.hp)}/${player.maxHp}`);
    }
  }
  
  combatLog.push('');
  
  let result = {};
  
  if (monster.hp <= 0) {
    // Player wins
    combatLog.push(`🎉 你击败了 ${monster.name}！`);
    
    const expGain = Math.floor(monster.exp * sectExpBonus);
    
    // Apply bug effects to exp gain
    let finalExpGain = expGain;
    const activeBugs = player.activeBugs || {};
    if (activeBugs.B02 && activeBugs.B02 > Date.now()) {
      finalExpGain *= 2; // B02: combat exp x2
      combatLog.push('  [Bug效果] 经验溢出点 - 经验x2！');
    }
    if (player.adminWatch && player.adminWatchLevel >= 4) {
      finalExpGain = Math.floor(finalExpGain * 1.1); // Watch Lv4: exp+10%
    }
    // Relic bonuses
    if (player.relics && player.relics.includes('M04')) finalExpGain = Math.floor(finalExpGain * 1.05);
    if (player.relics && player.relics.includes('Z01')) finalExpGain = Math.floor(finalExpGain * 1.05);
    
    const silverGain = monster.silver;
    player.silver += silverGain;
    combatLog.push(`获得 ${finalExpGain} 经验，${silverGain} 灵石`);
    
    // Skill exp gain from combat
    if (player.skills) {
      for (const ps of player.skills) {
        ps.exp += 2;
        const needed = ps.level * 50;
        if (ps.exp >= needed && ps.level < 10) {
          ps.exp -= needed;
          ps.level++;
          const sd = SKILLS_DATA[ps.id];
          combatLog.push(`📜 功法【${sd.name}】突破！等级: ${ps.level}`);
        }
      }
    }
    
    // Check for item drop
    if (Math.random() < monster.dropRate) {
      // Drop table: pills and basic equipment
      const dropTable = [
        { id: 'hp_pill', name: '回血丹', type: 'pill', weight: 40 },
        { id: 'spirit_pill', name: '回灵丹', type: 'pill', weight: 30 },
        { id: 'stamina_pill', name: '体力丹', type: 'pill', weight: 15 },
        { id: 'wooden_sword', name: '木剑', type: 'equipment', weight: 8 },
        { id: 'cloth_armor', name: '布衣', type: 'equipment', weight: 5 },
        { id: 'straw_shoes', name: '草鞋', type: 'equipment', weight: 2 }
      ];
      // Weighted random selection
      const totalWeight = dropTable.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * totalWeight;
      let dropItem = dropTable[0];
      for (const item of dropTable) {
        roll -= item.weight;
        if (roll <= 0) { dropItem = item; break; }
      }
      // Add item to player inventory (P0-3: check bag capacity)
      const currentBagUsed = getBagUsed(player);
      const currentBagCap = getBagCapacity(player);
      if (currentBagUsed >= currentBagCap) {
        combatLog.push(`⚠️ 背包已满（${currentBagUsed}/${currentBagCap}），无法拾取【${dropItem.name}】！`);
      } else {
        if (dropItem.type === 'pill') {
          if (!player.pills) player.pills = {};
          const currentPillQty = player.pills[dropItem.id] || 0;
          if (currentPillQty >= 99) {
            combatLog.push(`⚠️ 【${dropItem.name}】已达最大堆叠数99，无法拾取！`);
          } else {
            player.pills[dropItem.id] = currentPillQty + 1;
            combatLog.push(`🍀 ${monster.name} 掉落了【${dropItem.name}】！已收入背包。`);
          }
        } else if (dropItem.type === 'equipment') {
          if (!player.equipmentBag) player.equipmentBag = [];
          player.equipmentBag.push({ id: dropItem.id });
          combatLog.push(`🍀 ${monster.name} 掉落了【${dropItem.name}】！已收入背包。`);
        }
      }
    }
    
    // ===== RELIC DROP CHECK =====
    {
      let relicChance = 0.001; // base 0.1%
      // Level bonus: +0.01% per level, max 0.5%
      relicChance = Math.min(0.005, relicChance + player.level * 0.0001);
      // VIP bonus placeholder (would need vip field)
      // if (player.vip === 'monthly') relicChance += 0.0005;
      // if (player.vip === 'yearly') relicChance += 0.001;
      // B50 drop rate bug bonus
      if (player.activeBugs && player.activeBugs.B50 && player.activeBugs.B50 > Date.now()) {
        relicChance *= 5;
        combatLog.push('  [Bug效果] 掉率漏洞 - 掉率x5！');
      }
      
      if (Math.random() < relicChance) {
        // Pick a random undiscovered relic
        const owned = player.relics || [];
        const available = Object.keys(RELICS_DATA).filter(id => !owned.includes(id));
        if (available.length > 0) {
          const relicId = available[Math.floor(Math.random() * available.length)];
          const relic = RELICS_DATA[relicId];
          player.relics = [...owned, relicId];
          combatLog.push(`✨✨✨ 程序遗物发现！你获得了【${relic.name}】！`);
          combatLog.push(`  ${relic.desc}`);
          // Update admin watch level if player has the watch
          if (player.adminWatch) {
            const oldLevel = player.adminWatchLevel || 0;
            const newLevel = calcWatchLevel(player.relics.length);
            if (newLevel > oldLevel) {
              player.adminWatchLevel = newLevel;
              combatLog.push(`⌚ 管理员手表升级！Lv${oldLevel} → Lv${newLevel}`);
              const wt = WATCH_THRESHOLDS[newLevel];
              combatLog.push(`  新能力: ${wt.abilities}`);
            }
          }
        }
      }
    }
    
    // Quest progress tracking for kills
    if (player.currentRoom === '竹林') {
      updateQuestProgress(player, 'kill_bamboo', 1);
    }
    updateQuestProgress(player, 'kill_any', 1);
    
    // Check level up and realm progression
    const { leveled, realmChanged } = addExp(player, finalExpGain);
    if (leveled) combatLog.push(`🎊 恭喜！你升级了！当前等级: ${player.level}`);
    if (realmChanged) combatLog.push(`✨ 突破成功！你的境界提升为: ${player.realm}`);
    // P0-5c: Breakthrough failure message
    if (player._breakthroughFailed) {
      combatLog.push(`💥 渡劫失败！修为倒退，损失 ${player._breakthroughExpLoss} 经验`);
      delete player._breakthroughFailed;
      delete player._breakthroughExpLoss;
    }
    
    // Auto-accept admin watch quest at level 5
    if (leveled && player.level >= 5 && !player.quests.active.includes('q_admin_watch') && !player.quests.completed.includes('q_admin_watch')) {
      player.quests.active.push('q_admin_watch');
      player.quests.progress['q_admin_watch'] = 0;
      combatLog.push('📋 新任务: 【世界异常】- 探索竹林寻找真相');
    }
    
    result = { success: true, victory: true, exp: finalExpGain, silver: silverGain };
  } else if (player.hp <= 0) {
    // Player dies
    combatLog.push(`💀 你被 ${monster.name} 击败了！`);
    
    // Lose 10% exp
    const expLoss = Math.floor(player.exp * 0.1);
    player.exp = Math.max(0, player.exp - expLoss);
    combatLog.push(`损失 ${expLoss} 经验...`);
    
    // Respawn at 村口
    player.currentRoom = '村口';
    player.hp = Math.floor(player.maxHp * 0.5);
    player.spirit = Math.floor(player.maxSpirit * 0.5);
    combatLog.push(`你被传送到 村口，恢复了一半状态。`);
    
    result = { success: true, victory: false, expLoss: expLoss, respawn: '村口' };
  } else {
    combatLog.push(`战斗超时，你逃离了战斗。`);
    result = { success: true, victory: false, timeout: true };
  }
  
  result.combatLog = combatLog;
  return result;
}

// Initialize and start server
initializeDataFiles();

// ===== ADMIN COMMANDS =====
function handleAdminCommand(ws, player, command) {
  // Check if player is admin
  if (!player.isAdmin) {
    sendToClient(ws, { type: 'system', data: { message: '你没有管理员权限。' } });
    return;
  }
  
  const args = command.replace('/管理员', '').trim().split(/\s+/);
  const subCommand = args[0];
  
  if (subCommand === '查看在线玩家列表' || subCommand === '在线') {
    // List online players
    let onlineList = '';
    let count = 0;
    for (const [clientWs, info] of connectedClients.entries()) {
      if (clientWs.readyState === WebSocket.OPEN) {
        onlineList += `║  ${info.playerName}\n`;
        count++;
      }
    }
    sendToClient(ws, {
      type: 'command_response',
      data: {
        title: '在线玩家',
        content: `\n╔══════════════════════════════╗\n║  在线玩家列表 (${count}人)\n╠══════════════════════════════╣\n${onlineList}╚══════════════════════════════╝`
      }
    });
  } else if (subCommand === '公告') {
    const message = args.slice(1).join(' ');
    if (!message) {
      sendToClient(ws, { type: 'system', data: { message: '用法: /管理员 公告 <消息>' } });
      return;
    }
    broadcast({
      type: 'system',
      data: { message: `📢 [管理员公告] ${message}` }
    });
    sendToClient(ws, { type: 'system', data: { message: '公告已发送。' } });
  } else if (subCommand === '给予') {
    const targetName = args[1];
    const itemId = args[2];
    const qty = parseInt(args[3]) || 1;
    if (!targetName || !itemId) {
      sendToClient(ws, { type: 'system', data: { message: '用法: /管理员 给予 <玩家名> <物品ID> [数量]' } });
      return;
    }
    const players = getPlayers();
    const target = Object.values(players).find(p => p.name === targetName);
    if (!target) {
      sendToClient(ws, { type: 'system', data: { message: `找不到玩家: ${targetName}` } });
      return;
    }
    // Try pills first, then equipment
    if (PILLS_DATA[itemId]) {
      if (!target.pills) target.pills = {};
      target.pills[itemId] = (target.pills[itemId] || 0) + qty;
      savePlayers(players);
      const pd = PILLS_DATA[itemId];
      sendToClient(ws, { type: 'system', data: { message: `已给予 ${targetName} ${qty}个【${pd.name}】` } });
    } else if (EQUIPMENT_DATA[itemId]) {
      if (!target.equipmentBag) target.equipmentBag = [];
      for (let i = 0; i < qty; i++) target.equipmentBag.push({ id: itemId });
      savePlayers(players);
      const ed = EQUIPMENT_DATA[itemId];
      sendToClient(ws, { type: 'system', data: { message: `已给予 ${targetName} ${qty}个【${ed.name}】` } });
    } else {
      sendToClient(ws, { type: 'system', data: { message: `未知物品ID: ${itemId}` } });
    }
  } else if (subCommand === '等级') {
    const targetName = args[1];
    const level = parseInt(args[2]);
    if (!targetName || !level || level < 1) {
      sendToClient(ws, { type: 'system', data: { message: '用法: /管理员 等级 <玩家名> <等级>' } });
      return;
    }
    const players = getPlayers();
    const target = Object.values(players).find(p => p.name === targetName);
    if (!target) {
      sendToClient(ws, { type: 'system', data: { message: `找不到玩家: ${targetName}` } });
      return;
    }
    target.level = level;
    savePlayers(players);
    sendToClient(ws, { type: 'system', data: { message: `已将 ${targetName} 的等级设置为 ${level}` } });
  } else if (subCommand === '灵石') {
    const targetName = args[1];
    const amount = parseInt(args[2]);
    if (!targetName || !amount) {
      sendToClient(ws, { type: 'system', data: { message: '用法: /管理员 灵石 <玩家名> <数量>' } });
      return;
    }
    const players = getPlayers();
    const target = Object.values(players).find(p => p.name === targetName);
    if (!target) {
      sendToClient(ws, { type: 'system', data: { message: `找不到玩家: ${targetName}` } });
      return;
    }
    target.silver = (target.silver || 0) + amount;
    savePlayers(players);
    sendToClient(ws, { type: 'system', data: { message: `已给予 ${targetName} ${amount} 灵石` } });
  } else if (subCommand === '遗物') {
    const targetName = args[1];
    const relicId = args[2];
    if (!targetName || !relicId) {
      sendToClient(ws, { type: 'system', data: { message: '用法: /管理员 遗物 <玩家名> <遗物ID>' } });
      return;
    }
    if (!RELICS_DATA[relicId]) {
      sendToClient(ws, { type: 'system', data: { message: `未知遗物ID: ${relicId}` } });
      return;
    }
    const players = getPlayers();
    const target = Object.values(players).find(p => p.name === targetName);
    if (!target) {
      sendToClient(ws, { type: 'system', data: { message: `找不到玩家: ${targetName}` } });
      return;
    }
    if (!target.relics) target.relics = [];
    if (!target.relics.includes(relicId)) {
      target.relics.push(relicId);
    }
    savePlayers(players);
    const relic = RELICS_DATA[relicId];
    sendToClient(ws, { type: 'system', data: { message: `已给予 ${targetName} 遗物【${relic.name}】` } });
  } else if (subCommand === '传送') {
    const mapName = args[1];
    const roomName = args[2];
    if (!mapName || !roomName) {
      sendToClient(ws, { type: 'system', data: { message: '用法: /管理员 传送 <地图> <房间>' } });
      return;
    }
    const map = WORLD_DATA.maps[mapName];
    if (!map) {
      sendToClient(ws, { type: 'system', data: { message: `未知地图: ${mapName}` } });
      return;
    }
    if (!map.rooms[roomName]) {
      sendToClient(ws, { type: 'system', data: { message: `未知房间: ${roomName}` } });
      return;
    }
    const players = getPlayers();
    const p = players[player.id];
    p.currentMap = mapName;
    p.currentRoom = roomName;
    savePlayers(players);
    const room = map.rooms[roomName];
    sendToClient(ws, { type: 'system', data: { message: `已传送到 ${mapName} - ${roomName}` } });
    sendToClient(ws, {
      type: 'room',
      data: {
        name: room.name,
        description: room.description,
        exits: room.exits,
        players: getPlayersInRoom(mapName, roomName, ws)
      }
    });
  } else {
    sendToClient(ws, {
      type: 'command_response',
      data: {
        title: '管理员命令',
        content: `\n╔══════════════════════════════╗\n║  管理员命令列表\n╠══════════════════════════════╣\n║  /管理员 在线 - 查看在线玩家\n║  /管理员 公告 <消息> - 发送公告\n║  /管理员 给予 <玩家> <物品ID> [数量]\n║  /管理员 等级 <玩家> <等级>\n║  /管理员 灵石 <玩家> <数量>\n║  /管理员 遗物 <玩家> <遗物ID>\n║  /管理员 传送 <地图> <房间>\n╚══════════════════════════════╝`
      }
    });
  }
}

// ===== IDLE TICK INTERVAL =====
// Every 60 seconds, process all connected idle players
const idleTickInterval = setInterval(() => {
  for (const [ws, clientInfo] of connectedClients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    
    const players = getPlayers();
    const player = players[clientInfo.playerId];
    if (!player || !player.isIdle) continue;
    
    let changed = false;
    
    // Check bug effects on idle exp
    let idleExpAmount = 2;
    const activeBugs = player.activeBugs || {};
    if (activeBugs.B01 && activeBugs.B01 > Date.now()) {
      idleExpAmount *= 3; // B01: idle exp x3
    }
    if (player.adminWatch && player.adminWatchLevel >= 4) {
      idleExpAmount = Math.floor(idleExpAmount * 1.1); // Watch Lv4: exp+10%
    }
    // Relic bonuses
    if (player.relics && player.relics.includes('M04')) idleExpAmount = Math.floor(idleExpAmount * 1.05); // M04: exp+5%
    if (player.relics && player.relics.includes('T01')) idleExpAmount = Math.floor(idleExpAmount * 1.08); // T01: idle exp+8%
    
    // Gain exp (doubled rate during idle)
    const { leveled, realmChanged } = addExp(player, idleExpAmount);
    changed = true;
    
    // Auto-accept admin watch quest at level 5
    if (leveled && player.level >= 5 && !player.quests.active.includes('q_admin_watch') && !player.quests.completed.includes('q_admin_watch')) {
      player.quests.active.push('q_admin_watch');
      player.quests.progress['q_admin_watch'] = 0;
      sendToClient(ws, {
        type: 'system',
        data: { message: '📋 新任务自动接取: 【世界异常】\n你感觉到了这个世界的异常...探索竹林寻找真相。\n输入 /任务 查看详情。' }
      });
    }
    
    // Skill exp gain during idle (1 per minute per skill)
    if (player.skills && player.skills.length > 0) {
      for (const ps of player.skills) {
        ps.exp += 1;
        const needed = ps.level * 50;
        if (ps.exp >= needed && ps.level < 10) {
          ps.exp -= needed;
          ps.level++;
          const sd = SKILLS_DATA[ps.id];
          sendToClient(ws, {
            type: 'system',
            data: { message: `📜 打坐修炼中，功法【${sd.name}】突破！等级: ${ps.level}` }
          });
        }
      }
    }
    
    // Recover spirit and stamina
    if (player.spirit < player.maxSpirit) {
      player.spirit = Math.min(player.maxSpirit, player.spirit + 5);
      changed = true;
    }
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + 3);
      changed = true;
    }

    // Random idle encounter check
    if (!player.pendingEncounter) {
      checkEncounter(ws, player, 'idle');
      changed = true;
    }
    
    // Auto-combat in bamboo forest
    if (player.currentRoom === '竹林' && player.currentMap === '新手村') {
      const room = getRoom(player.currentMap, player.currentRoom);
      if (room && room.monsters && room.monsters.length > 0) {
        const result = executeCombat(ws, player, room);
        if (result.success) {
          // Send combat notification
          sendToClient(ws, {
            type: 'idle_combat',
            data: {
              log: result.combatLog.slice(0, 5), // Show first few lines
              victory: result.victory,
              exp: result.exp,
              silver: result.silver,
              hp: player.hp,
              maxHp: player.maxHp
            }
          });
          
          // If player died, stop idle mode
          if (!result.victory && result.respawn) {
            player.isIdle = false;
            player.idleStartTime = null;
            sendToClient(ws, {
              type: 'system',
              data: { message: '你在战斗中倒下了，自动停止打坐。' }
            });
            
            // Send new room
            const newRoom = getRoom(player.currentMap, player.currentRoom);
            if (newRoom) {
              sendToClient(ws, {
                type: 'room',
                data: {
                  name: newRoom.name,
                  description: newRoom.description,
                  exits: newRoom.exits,
                  players: getPlayersInRoom(player.currentMap, player.currentRoom, ws)
                }
              });
            }
          }
        }
      }
    }
    
    // Notify level up
    if (leveled) {
      sendToClient(ws, {
        type: 'system',
        data: { message: `🎊 打坐修炼中，你突破了！当前等级: ${player.level}` }
      });
    }
    
    // Notify realm breakthrough
    if (realmChanged) {
      sendToClient(ws, {
        type: 'system',
        data: { message: `✨ 修炼有成！你的境界突破为: ${player.realm}` }
      });
    }
    
    // Send status update
    sendToClient(ws, {
      type: 'status_update',
      data: {
        hp: player.hp,
        maxHp: player.maxHp,
        spirit: player.spirit,
        maxSpirit: player.maxSpirit,
        stamina: player.stamina,
        maxStamina: player.maxStamina,
        exp: player.exp,
        level: player.level,
        realm: player.realm
      }
    });
    
    if (changed) {
      savePlayers(players);
    }
  }
}, 60000); // Every 60 seconds

// ===== ADMIN PANEL =====
app.get('/admin', (req, res) => {
  const players = getPlayers();
  const playerList = Object.values(players);
  const totalPlayers = playerList.length;
  
  // Get online players
  const onlinePlayers = [];
  for (const [ws, info] of connectedClients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      const p = players[info.playerId];
      onlinePlayers.push({
        name: info.playerName,
        level: p ? p.level : '?',
        realm: p ? p.realm : '?',
        map: p ? p.currentMap : '?'
      });
    }
  }
  
  // Recent logins (sort by last login, take top 10)
  const recentLogins = playerList
    .filter(p => p.lastSignIn)
    .sort((a, b) => new Date(b.lastSignIn) - new Date(a.lastSignIn))
    .slice(0, 10)
    .map(p => ({ name: p.name, level: p.level, lastSignIn: p.lastSignIn }));
  
  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>管理员面板 - 赛博修仙</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; background: #1a1a2e; color: #eee; margin: 0; padding: 20px; }
    h1 { color: #e94560; text-align: center; }
    .container { max-width: 1200px; margin: 0 auto; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: #16213e; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #0f3460; }
    .stat-card h3 { color: #e94560; margin: 0 0 10px 0; }
    .stat-card .value { font-size: 2em; color: #53d8fb; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #16213e; border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #0f3460; }
    th { background: #0f3460; color: #53d8fb; }
    tr:hover { background: #1a1a40; }
    .search-box { margin: 20px 0; }
    .search-box input { padding: 10px; width: 300px; background: #16213e; border: 1px solid #0f3460; color: #eee; border-radius: 4px; }
    .search-box button { padding: 10px 20px; background: #e94560; border: none; color: #fff; border-radius: 4px; cursor: pointer; }
    .section { background: #16213e; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #0f3460; }
    .section h2 { color: #53d8fb; border-bottom: 1px solid #0f3460; padding-bottom: 10px; }
    .online-dot { display: inline-block; width: 10px; height: 10px; background: #4ecca3; border-radius: 50%; margin-right: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎮 赛博修仙 - 管理员面板</h1>
    
    <div class="stats">
      <div class="stat-card">
        <h3>总玩家数</h3>
        <div class="value">${totalPlayers}</div>
      </div>
      <div class="stat-card">
        <h3>在线玩家</h3>
        <div class="value">${onlinePlayers.length}</div>
      </div>
      <div class="stat-card">
        <h3>服务器时间</h3>
        <div class="value" style="font-size:1em;">${new Date().toLocaleString('zh-CN')}</div>
      </div>
    </div>
    
    <div class="section">
      <h2><span class="online-dot"></span>在线玩家</h2>
      ${onlinePlayers.length > 0 ? `
      <table>
        <tr><th>角色名</th><th>等级</th><th>境界</th><th>所在地图</th></tr>
        ${onlinePlayers.map(p => `<tr><td>${p.name}</td><td>${p.level}</td><td>${p.realm}</td><td>${p.map}</td></tr>`).join('')}
      </table>
      ` : '<p>暂无在线玩家</p>'}
    </div>
    
    <div class="section">
      <h2>最近登录</h2>
      ${recentLogins.length > 0 ? `
      <table>
        <tr><th>角色名</th><th>等级</th><th>最后登录</th></tr>
        ${recentLogins.map(p => `<tr><td>${p.name}</td><td>${p.level}</td><td>${new Date(p.lastSignIn).toLocaleString('zh-CN')}</td></tr>`).join('')}
      </table>
      ` : '<p>暂无登录记录</p>'}
    </div>
    
    <div class="section">
      <h2>玩家搜索</h2>
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="输入玩家名搜索...">
        <button onclick="searchPlayer()">搜索</button>
      </div>
      <div id="searchResult"></div>
      <script>
        const allPlayers = ${JSON.stringify(playerList.map(p => ({ name: p.name, level: p.level, realm: p.realm, silver: p.silver, sect: p.sect, email: p.email, isAdmin: p.isAdmin })))};
        function searchPlayer() {
          const query = document.getElementById('searchInput').value.trim().toLowerCase();
          const result = document.getElementById('searchResult');
          if (!query) { result.innerHTML = ''; return; }
          const found = allPlayers.filter(p => p.name.toLowerCase().includes(query));
          if (found.length === 0) { result.innerHTML = '<p>未找到匹配的玩家</p>'; return; }
          result.innerHTML = '<table><tr><th>角色名</th><th>等级</th><th>境界</th><th>灵石</th><th>门派</th><th>管理员</th></tr>' +
            found.map(p => '<tr><td>'+p.name+'</td><td>'+p.level+'</td><td>'+p.realm+'</td><td>'+p.silver+'</td><td>'+(p.sect||'无')+'</td><td>'+(p.isAdmin?'是':'否')+'</td></tr>').join('') +
            '</table>';
        }
      </script>
    </div>
  </div>
</body>
</html>`;
  
  res.send(html);
});

server.listen(PORT, () => {
  console.log(`赛博修仙服务器已启动，端口: ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 开始游戏`);
});

module.exports = { app, server, wss };
