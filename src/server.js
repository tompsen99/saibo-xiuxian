const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

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
          exits: { north: '村广场', east: '集市', west: '修炼场' }
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
        '修炼场': {
          name: '修炼场',
          description: '开阔的修炼场，地面平整。几位修士正在打坐修炼，空气中隐约有灵气流动。',
          exits: { east: '村口' }
        }
      }
    }
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
    profession: profession || '散修',
    stats: {
      str: 10,
      dex: 10,
      con: 10,
      wis: 10
    },
    level: 1,
    realm: '练气期',
    exp: 0,
    hp: 100,
    maxHp: 100,
    spirit: 50,
    maxSpirit: 50,
    stamina: 100,
    maxStamina: 100,
    silver: 100,
    jade: 0,
    currentMap: '新手村',
    currentRoom: '村口',
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
  
  // Auto-login after registration
  const token = createSession(result.player.id);
  
  connectedClients.set(ws, {
    playerId: result.player.id,
    playerName: result.player.name
  });
  
  sendToClient(ws, {
    type: 'register_response',
    data: {
      success: true,
      message: '注册成功！',
      token: token,
      player: sanitizePlayer(result.player)
    }
  });
  
  // Send welcome message
  sendToClient(ws, {
    type: 'system',
    data: { message: `欢迎来到赛博修仙世界，${result.player.name}！你出现在了新手村的村口。` }
  });
  
  // Broadcast new player joining
  broadcast({
    type: 'system',
    data: { message: `${result.player.name} 降临了修仙世界` }
  }, ws);
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
  } else {
    sendToClient(ws, {
      type: 'error',
      data: { message: '未知命令。可用命令: /属性, /背包, /地图, /移动, /频道, /交谈, /攻击, /挂机' }
    });
  }
}

// Stats command
function handleStatsCommand(ws, player) {
  const expToNextLevel = player.level * 100;
  
  sendToClient(ws, {
    type: 'command_response',
    data: {
      title: '角色属性',
      content: `
╔══════════════════════════════╗
║  ${player.name} - ${player.profession}
╠══════════════════════════════╣
║  境界: ${player.realm}
║  等级: ${player.level} (经验: ${player.exp}/${expToNextLevel})
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
    '上': 'up', '下': 'down',
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
  sendToClient(ws, {
    type: 'system',
    data: { message: '你四下张望，但没有发现可以攻击的目标。' }
  });
}

// Idle command
function handleIdleCommand(ws, player) {
  sendToClient(ws, {
    type: 'system',
    data: { message: '你盘膝而坐，开始打坐修炼。灵力缓缓恢复中...' }
  });
  
  // Simulate spirit recovery
  const players = getPlayers();
  const p = players[player.id];
  if (p && p.spirit < p.maxSpirit) {
    p.spirit = Math.min(p.maxSpirit, p.spirit + 10);
    savePlayers(players);
    
    setTimeout(() => {
      sendToClient(ws, {
        type: 'status_update',
        data: {
          spirit: p.spirit,
          maxSpirit: p.maxSpirit
        }
      });
      sendToClient(ws, {
        type: 'system',
        data: { message: `打坐完毕，灵力恢复至 ${p.spirit}/${p.maxSpirit}` }
      });
    }, 3000);
  }
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
    up: '上', down: '下'
  };
  return names[dir] || dir;
}

function getOppositeDirectionName(dir) {
  const opposites = {
    north: '南', south: '北', east: '西', west: '东',
    up: '下', down: '上'
  };
  return opposites[dir] || dir;
}

// Initialize and start server
initializeDataFiles();

server.listen(PORT, () => {
  console.log(`赛博修仙服务器已启动，端口: ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 开始游戏`);
});

module.exports = { app, server, wss };
