// supabase-sync.js - Supabase同步模块（改进版）
// 立即同步 + 本地缓存，确保数据不丢失

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
        playersMap[p.id] = p;
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
        sessionsMap[s.token] = s;
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

// 立即同步单个玩家到Supabase
async function syncPlayerNow(player) {
  if (!useSupabase) return;
  try {
    const { error } = await supabase
      .from('players')
      .upsert(player, { onConflict: 'id' });
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
    
    // 批量upsert
    const { error } = await supabase
      .from('players')
      .upsert(playerList, { onConflict: 'id' });
    
    if (error) {
      console.error('[Supabase] 批量同步失败:', error.message);
    } else {
      console.log(`[Supabase] 已同步 ${playerList.length} 个玩家`);
    }
  } catch (e) {
    console.error('[Supabase] 批量同步异常:', e.message);
  }
}

// 立即同步会话
async function syncSessionNow(sessionData) {
  if (!useSupabase) return;
  try {
    await supabase.from('sessions').upsert(sessionData, { onConflict: 'token' });
  } catch (e) {
    console.error('[Supabase] 同步会话失败:', e.message);
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
  }, 120000); // 每2分钟重新加载一次
  
  console.log('[Supabase] 同步已启动');
}

module.exports = {
  useSupabase,
  startSync,
  loadFromSupabase,
  syncPlayerNow,
  syncAllPlayersNow,
  syncSessionNow,
  syncVipKeyNow,
  readCache,
  writeCache,
  get dataLoaded() { return dataLoaded; }
};
