-- 赛博修仙 - Supabase数据库初始化脚本
-- 在Supabase控制台的SQL编辑器中执行此脚本

-- 玩家表
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIP卡密表
CREATE TABLE IF NOT EXISTS vip_keys (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  used_by TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_vip_keys_used_by ON vip_keys(used_by);

-- 启用行级安全（RLS）
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_keys ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许服务端完全访问
CREATE POLICY "Allow all access for service role" ON players
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for service role" ON sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for service role" ON vip_keys
  FOR ALL USING (true) WITH CHECK (true);
