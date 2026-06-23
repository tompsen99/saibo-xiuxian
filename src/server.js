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
    createdAt: new Date().toISOString()
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
║  灵石: ${player.silver}
║  仙玉: ${player.jade}
╚══════════════════════════════╝`
    }
  });
}

// Inventory command
function handleInventoryCommand(ws, player) {
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '背包',
      content: `
╔══════════════════════════════╗
║  背包
╠══════════════════════════════╣
║  [空空如也]
║
║  提示: 你可以在集市购买物品
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
  sendToClient(ws, {
    type: 'system',
    data: { message: '当前频道: 世界频道。所有在线玩家都可以看到你的消息。' }
  });
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
  
  const result = executeCombat(ws, player, room);
  
  if (!result.success) {
    sendToClient(ws, { type: 'system', data: { message: result.message } });
    return;
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
║  💡 提示: 打坐修炼每分钟+2经验
║  在竹林挂机会自动与怪物战斗
║  修炼功法可提升功法等级，增强战斗
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
    sendToClient(ws, { type: 'system', data: { message: '体力不足，无法修炼功法。需要至少10点体力。' } });
    return;
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
  
  // Use stamina
  p.stamina -= 10;
  
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
    sendToClient(ws, { type: 'system', data: { message: '用法: /加入门派 <门派ID>\n可用门派: shaolin, wudang, xiaoyao\n输入 /门派 查看门派详情。' } });
    return;
  }
  
  const sect = SECTS_DATA[sectId];
  if (!sect) {
    sendToClient(ws, { type: 'system', data: { message: '不存在该门派。可用: shaolin(少林), wudang(武当), xiaoyao(逍遥)' } });
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
      player.quests.progress[questId] = (player.quests.progress[questId] || 0) + amount;
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
    
    player.realm = nextRealm.name + nextSubLevel.name;
    player.exp -= realmInfo.subLevel.expRequired;
    
    // Stat bonuses for realm breakthrough
    player.maxHp += nextSubLevel.expRequired > 1000 ? 20 : 10;
    player.maxSpirit += nextSubLevel.expRequired > 1000 ? 10 : 5;
    player.hp = player.maxHp;
    player.spirit = player.maxSpirit;
    
    return true;
  }
  return false;
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
  const playerAttack = player.stats.str * 2 + player.level * 3 + equipBonuses.attack + equipBonuses.str * 2;
  const playerDefense = player.stats.con * 1.5 + player.level * 2 + equipBonuses.defense;
  
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
  
  // Check sect bonus
  let sectDefenseBonus = 1;
  let sectExpBonus = 1;
  if (player.sect) {
    if (player.sect === 'shaolin') sectDefenseBonus = 1.1;
    else if (player.sect === 'xiaoyao') sectExpBonus = 1.1;
  }
  
  const combatLog = [];
  combatLog.push(`⚔️ 战斗开始！你遭遇了 ${monster.name}！`);
  combatLog.push(`${monster.name}: HP ${monster.hp}/${monster.maxHp || monster.hp} | 攻击 ${monster.attack} | 防御 ${monster.defense}`);
  combatLog.push('');
  
  let round = 0;
  const maxRounds = 50; // Safety limit
  
  while (player.hp > 0 && monster.hp > 0 && round < maxRounds) {
    round++;
    
    // Player attacks monster
    let playerDmg = Math.max(1, Math.floor(playerAttack - monster.defense / 2 + Math.floor(Math.random() * 5) - 2));
    // Apply active skill bonus
    if (activeSkillBonus > 0) {
      playerDmg += activeSkillBonus;
      if (round === 1) combatLog.push(`⚔️ 发动功法【${activeSkillName}】，额外造成 ${activeSkillBonus} 点伤害！`);
    }
    monster.hp -= playerDmg;
    combatLog.push(`第${round}回合: 你攻击 ${monster.name}，造成 ${playerDmg} 点伤害！${monster.name} HP: ${Math.max(0, monster.hp)}/${monsterTemplate.maxHp || monsterTemplate.hp}`);
    
    if (monster.hp <= 0) break;
    
    // Monster attacks player (check dodge)
    if (dodgeChance > 0 && Math.random() < dodgeChance) {
      combatLog.push(`        ${monster.name} 攻击你，但你身法灵动闪避了！`);
    } else {
      const monsterDmg = Math.max(1, Math.floor(monster.attack - playerDefense * sectDefenseBonus / 2 + Math.floor(Math.random() * 5) - 2));
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
    const silverGain = monster.silver;
    player.silver += silverGain;
    combatLog.push(`获得 ${expGain} 经验，${silverGain} 灵石`);
    
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
      combatLog.push(`🍀 ${monster.name} 掉落了一件物品！`);
    }
    
    // Quest progress tracking for kills
    if (player.currentRoom === '竹林') {
      updateQuestProgress(player, 'kill_bamboo', 1);
    }
    updateQuestProgress(player, 'kill_any', 1);
    
    // Check level up and realm progression
    const { leveled, realmChanged } = addExp(player, expGain);
    if (leveled) combatLog.push(`🎊 恭喜！你升级了！当前等级: ${player.level}`);
    if (realmChanged) combatLog.push(`✨ 突破成功！你的境界提升为: ${player.realm}`);
    
    result = { success: true, victory: true, exp: expGain, silver: silverGain };
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

// ===== IDLE TICK INTERVAL =====
// Every 60 seconds, process all connected idle players
const idleTickInterval = setInterval(() => {
  for (const [ws, clientInfo] of connectedClients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    
    const players = getPlayers();
    const player = players[clientInfo.playerId];
    if (!player || !player.isIdle) continue;
    
    let changed = false;
    
    // Gain 2 exp per minute (doubled rate during idle)
    const { leveled, realmChanged } = addExp(player, 2);
    changed = true;
    
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

server.listen(PORT, () => {
  console.log(`赛博修仙服务器已启动，端口: ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 开始游戏`);
});

module.exports = { app, server, wss };
