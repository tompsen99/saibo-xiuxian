// supabase-sync.js - Supabase同步模块（改进版 v2）
// 核心改进：每次操作立即同步 + 登录时Supabase回退查询

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const useSupabase = !!(SUPABASE_URL && SUPABASE_KEY);

let supabase = null;
let dataLoaded = false;

if (useSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[Supabase] 已连接云端数据库');
}

// 本地缓存目录
const DATA_DIR = path.join(__dirname, '../data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 读取本地缓存
function readCache(filename) {
  try {
    const filePath = path.join(CACHE_DIR, filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {}
  return null;
}

// 写入本地缓存
function writeCache(filename, data) {
  try {
    const filePath = path.join(CACHE_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[缓存] 写入失败:', e.message);
  }
}

// 从Supabase加载数据到本地缓存（启动时调用）
async function loadFromSupabase() {
  if (!useSupabase) return;
  
  try {
    // 加载玩家数据
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*');
    
    if (!playersError && players) {
      const playersMap = {};
      for (const p of players) {
        // 从data列恢复完整玩家数据
        if (p.data && typeof p.data === 'object') {
          // 确保id字段一致
          playersMap[p.id] = { ...p.data, id: p.id };
        } else {
          playersMap[p.id] = p;
        }
      }
      writeCache('players.json', playersMap);
      console.log(`[Supabase] 已加载 ${players.length} 个玩家`);
    } else if (playersError) {
      console.error('[Supabase] 加载玩家失败:', playersError.message);
    }
    
    // 加载会话数据
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*');
    
    if (!sessionsError && sessions) {
      const sessionsMap = {};
      for (const s of sessions) {
        sessionsMap[s.token] = s.player_id;
      }
      writeCache('sessions.json', sessionsMap);
    }
    
    // 加载VIP卡密
    const { data: vipKeys, error: vipKeysError } = await supabase
      .from('vip_keys')
      .select('*');
    
    if (!vipKeysError && vipKeys) {
      const keysMap = {};
      for (const k of vipKeys) {
        keysMap[k.code] = k;
      }
      writeCache('vip_keys.json', keysMap);
    }
    
    dataLoaded = true;
    console.log('[Supabase] 数据加载完成');
  } catch (e) {
    console.error('[Supabase] 加载失败:', e.message);
  }
}

// 从Supabase查询单个玩家（登录回退用）
async function getPlayerFromSupabase(playerId) {
  if (!useSupabase) return null;
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();
    
    if (error) throw error;
    
    if (data && data.data && typeof data.data === 'object') {
      return { ...data.data, id: data.id };
    }
    return data;
  } catch (e) {
    console.error('[Supabase] 查询玩家失败:', e.message);
    return null;
  }
}

// 从Supabase通过邮箱查询玩家（登录用）
async function getPlayerByEmailFromSupabase(email) {
  if (!useSupabase) return null;
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) throw error;
    
    if (data && data.data && typeof data.data === 'object') {
      return { ...data.data, id: data.id };
    }
    return data;
  } catch (e) {
    // 如果是PGRST116 (not found)，不打印错误
    if (!e.message.includes('PGRST116')) {
      console.error('[Supabase] 通过邮箱查询玩家失败:', e.message);
    }
    return null;
  }
}

// 立即同步单个玩家到Supabase
async function syncPlayerNow(player) {
  if (!useSupabase) return;
  try {
    // 准备Supabase格式的数据
    const row = {
      id: player.id,
      email: player.email || '',
      password: player.password || '',
      name: player.name || '',
      is_admin: player.isAdmin || false,
      data: player,  // 完整数据存入JSONB
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('players')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase] 同步玩家失败:', error.message);
    }
  } catch (e) {
    console.error('[Supabase] 同步玩家异常:', e.message);
  }
}

// 立即同步所有玩家到Supabase
async function syncAllPlayersNow(playersMap) {
  if (!useSupabase) return;
  try {
    const playerList = Object.values(playersMap);
    if (playerList.length === 0) return;
    
    // 将玩家数据转为Supabase格式
    const rows = playerList.map(p => ({
      id: p.id,
      email: p.email || '',
      password: p.password || '',
      name: p.name || '',
      is_admin: p.isAdmin || false,
      data: p,  // 完整数据存入JSONB
      updated_at: new Date().toISOString()
    }));
    
    // 批量upsert
    const { error } = await supabase
      .from('players')
      .upsert(rows, { onConflict: 'id' });
    
    if (error) {
      console.error('[Supabase] 批量同步失败:', error.message);
    }
  } catch (e) {
    console.error('[Supabase] 批量同步异常:', e.message);
  }
}

// 立即同步会话
async function syncSessionNow(token, playerId) {
  if (!useSupabase) return;
  try {
    await supabase.from('sessions').upsert({
      token: token,
      player_id: playerId,
      created_at: new Date().toISOString()
    }, { onConflict: 'token' });
  } catch (e) {
    console.error('[Supabase] 同步会话失败:', e.message);
  }
}

// 删除会话
async function deleteSessionFromSupabase(token) {
  if (!useSupabase) return;
  try {
    await supabase.from('sessions').delete().eq('token', token);
  } catch (e) {
    console.error('[Supabase] 删除会话失败:', e.message);
  }
}

// 立即同步VIP卡密
async function syncVipKeyNow(keyData) {
  if (!useSupabase) return;
  try {
    await supabase.from('vip_keys').upsert(keyData, { onConflict: 'code' });
  } catch (e) {
    console.error('[Supabase] 同步VIP卡密失败:', e.message);
  }
}

// 启动同步（加载数据）
async function startSync() {
  if (!useSupabase) return;
  await loadFromSupabase();
  
  // 定期重新加载（防止多实例数据不一致）
  setInterval(async () => {
    await loadFromSupabase();
  }, 60000); // 每1分钟重新加载一次
  
  console.log('[Supabase] 同步已启动');
}

module.exports = {
  useSupabase,
  startSync,
  loadFromSupabase,
  getPlayerFromSupabase,
  getPlayerByEmailFromSupabase,
  syncPlayerNow,
  syncAllPlayersNow,
  syncSessionNow,
  deleteSessionFromSupabase,
  syncVipKeyNow,
  readCache,
  writeCache,
  get dataLoaded() { return dataLoaded; }
};
