// supabase-sync.js - Supabase同步模块
// 使用本地缓存+后台同步的方式，兼容现有同步代码

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const useSupabase = !!(SUPABASE_URL && SUPABASE_KEY);

let supabase = null;
let syncQueue = [];
let lastSyncTime = 0;
const SYNC_INTERVAL = 30000; // 30秒同步一次

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

// 从Supabase加载数据到本地缓存
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
    
    lastSyncTime = Date.now();
  } catch (e) {
    console.error('[Supabase] 加载失败:', e.message);
  }
}

// 同步本地更改到Supabase
async function syncToSupabase() {
  if (!useSupabase || syncQueue.length === 0) return;
  
  const batch = syncQueue.splice(0, 100); // 每次最多同步100条
  
  try {
    for (const item of batch) {
      if (item.type === 'player') {
        await supabase.from('players').upsert(item.data, { onConflict: 'id' });
      } else if (item.type === 'session') {
        await supabase.from('sessions').upsert(item.data, { onConflict: 'token' });
      } else if (item.type === 'vip_key') {
        await supabase.from('vip_keys').upsert(item.data, { onConflict: 'code' });
      } else if (item.type === 'delete_player') {
        await supabase.from('players').delete().eq('id', item.id);
      } else if (item.type === 'delete_session') {
        await supabase.from('sessions').delete().eq('token', item.token);
      }
    }
    console.log(`[Supabase] 已同步 ${batch.length} 条数据`);
  } catch (e) {
    console.error('[Supabase] 同步失败:', e.message);
    // 失败的数据重新加入队列
    syncQueue.unshift(...batch);
  }
}

// 启动后台同步
function startSync() {
  if (!useSupabase) return;
  
  // 初始加载
  loadFromSupabase();
  
  // 定期同步
  setInterval(async () => {
    await syncToSupabase();
  }, SYNC_INTERVAL);
  
  // 定期重新加载（防止多实例数据不一致）
  setInterval(async () => {
    await loadFromSupabase();
  }, 60000); // 每分钟重新加载一次
  
  console.log('[Supabase] 后台同步已启动');
}

// 队列同步操作
function queueSync(type, data) {
  if (!useSupabase) return;
  syncQueue.push({ type, data, timestamp: Date.now() });
}

// 队列删除操作
function queueDelete(type, id) {
  if (!useSupabase) return;
  if (type === 'player') {
    syncQueue.push({ type: 'delete_player', id, timestamp: Date.now() });
  } else if (type === 'session') {
    syncQueue.push({ type: 'delete_session', token: id, timestamp: Date.now() });
  }
}

module.exports = {
  useSupabase,
  startSync,
  loadFromSupabase,
  syncToSupabase,
  queueSync,
  queueDelete,
  readCache,
  writeCache
};
