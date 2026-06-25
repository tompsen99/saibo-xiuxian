-- 赛博修仙 - Supabase数据库初始化脚本（简化版）
-- 在Supabase控制台的SQL编辑器中执行

-- 如果表已存在，先删除（注意：会丢失数据）
-- DROP TABLE IF EXISTS players CASCADE;
-- DROP TABLE IF EXISTS sessions CASCADE;
-- DROP TABLE IF EXISTS vip_keys CASCADE;

-- 玩家表（简化版，所有数据存入data列）
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  email TEXT DEFAULT '',
  password TEXT DEFAULT '',
  name TEXT DEFAULT '',
  is_admin BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  player_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIP卡密表
CREATE TABLE IF NOT EXISTS vip_keys (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'month',
  used_by TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
