// database.js - 数据库抽象层
// 支持 Supabase（云端）和 JSON文件（本地开发）

const fs = require('fs');
const path = require('path');

// 检测是否配置了Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const useSupabase = !!(SUPABASE_URL && SUPABASE_KEY);

let supabase = null;
if (useSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[数据库] 使用 Supabase 云端数据库');
} else {
  console.log('[数据库] 使用本地 JSON 文件存储');
}

// 本地JSON文件路径
const DATA_DIR = path.join(__dirname, '../data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const VIP_KEYS_FILE = path.join(DATA_DIR, 'vip_keys.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ===== 通用读写函数 =====

function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ===== 玩家数据 =====

async function getPlayers() {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*');
      if (error) throw error;
      // 转换为 { id: player } 格式
      const players = {};
      for (const p of data) {
        players[p.id] = p;
      }
      return players;
    } catch (e) {
      console.error('[数据库] 读取玩家失败:', e.message);
      return {};
    }
  } else {
    return readJSON(PLAYERS_FILE);
  }
}

async function getPlayer(playerId) {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('[数据库] 读取玩家失败:', e.message);
      return null;
    }
  } else {
    const players = readJSON(PLAYERS_FILE);
    return players[playerId] || null;
  }
}

async function savePlayers(players) {
  if (useSupabase) {
    try {
      // 批量upsert所有玩家
      const playerList = Object.values(players);
      if (playerList.length === 0) return;
      
      const { error } = await supabase
        .from('players')
        .upsert(playerList, { onConflict: 'id' });
      if (error) throw error;
    } catch (e) {
      console.error('[数据库] 保存玩家失败:', e.message);
    }
  } else {
    writeJSON(PLAYERS_FILE, players);
  }
}

async function savePlayer(player) {
  if (useSupabase) {
    try {
      const { error } = await supabase
        .from('players')
        .upsert(player, { onConflict: 'id' });
      if (error) throw error;
    } catch (e) {
      console.error('[数据库] 保存玩家失败:', e.message);
    }
  } else {
    const players = readJSON(PLAYERS_FILE);
    players[player.id] = player;
    writeJSON(PLAYERS_FILE, players);
  }
}

async function deletePlayer(playerId) {
  if (useSupabase) {
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);
      if (error) throw error;
    } catch (e) {
      console.error('[数据库] 删除玩家失败:', e.message);
    }
  } else {
    const players = readJSON(PLAYERS_FILE);
    delete players[playerId];
    writeJSON(PLAYERS_FILE, players);
  }
}

// ===== 会话数据 =====

async function getSessions() {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*');
      if (error) throw error;
      const sessions = {};
      for (const s of data) {
        sessions[s.token] = s;
      }
      return sessions;
    } catch (e) {
      console.error('[数据库] 读取会话失败:', e.message);
      return {};
    }
  } else {
    return readJSON(SESSIONS_FILE);
  }
}

async function saveSession(token, playerId) {
  if (useSupabase) {
    try {
      const { error } = await supabase
        .from('sessions')
        .upsert({ token, player_id: playerId, created_at: new Date().toISOString() }, { onConflict: 'token' });
      if (error) throw error;
    } catch (e) {
      console.error('[数据库] 保存会话失败:', e.message);
    }
  } else {
    const sessions = readJSON(SESSIONS_FILE);
    sessions[token] = { playerId, createdAt: new Date().toISOString() };
    writeJSON(SESSIONS_FILE, sessions);
  }
}

async function deleteSession(token) {
  if (useSupabase) {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('token', token);
      if (error) throw error;
    } catch (e) {
      console.error('[数据库] 删除会话失败:', e.message);
    }
  } else {
    const sessions = readJSON(SESSIONS_FILE);
    delete sessions[token];
    writeJSON(SESSIONS_FILE, sessions);
  }
}

// ===== VIP卡密 =====

async function getVipKeys() {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('vip_keys')
        .select('*');
      if (error) throw error;
      const keys = {};
      for (const k of data) {
        keys[k.code] = k;
      }
      return keys;
    } catch (e) {
      console.error('[数据库] 读取VIP卡密失败:', e.message);
      return {};
    }
  } else {
    return readJSON(VIP_KEYS_FILE);
  }
}

async function saveVipKey(keyData) {
  if (useSupabase) {
    try {
      const { error } = await supabase
        .from('vip_keys')
        .upsert(keyData, { onConflict: 'code' });
      if (error) throw error;
    } catch (e) {
      console.error('[数据库] 保存VIP卡密失败:', e.message);
    }
  } else {
    const keys = readJSON(VIP_KEYS_FILE);
    keys[keyData.code] = keyData;
    writeJSON(VIP_KEYS_FILE, keys);
  }
}

// ===== 初始化Supabase表 =====

async function initSupabaseTables() {
  if (!useSupabase) return;
  
  console.log('[数据库] Supabase表需要在Supabase控制台创建');
  console.log('[数据库] 请执行以下SQL创建表:');
  console.log(`
-- 玩家表
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  player_id UUID REFERENCES players(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIP卡密表
CREATE TABLE IF NOT EXISTS vip_keys (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  used_by UUID,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);
  `);
}

module.exports = {
  useSupabase,
  getPlayers,
  getPlayer,
  savePlayers,
  savePlayer,
  deletePlayer,
  getSessions,
  saveSession,
  deleteSession,
  getVipKeys,
  saveVipKey,
  initSupabaseTables,
  // 兼容旧代码
  readJSON,
  writeJSON,
  PLAYERS_FILE,
  SESSIONS_FILE,
  VIP_KEYS_FILE,
  DATA_DIR
};
