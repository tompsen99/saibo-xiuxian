// ===== ADMIN PANEL (ENHANCED) =====
// Auth middleware for admin API
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== 'admin123') return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Admin API: Get all players
app.get('/api/admin/players', requireAdmin, (req, res) => {
  const players = getPlayers();
  const list = Object.values(players).map(p => ({
    id: p.id, name: p.name, email: p.email, level: p.level, realm: p.realm,
    silver: p.silver || 0, exp: p.exp || 0, hp: p.hp, maxHp: p.maxHp,
    sect: p.sect || '无', isAdmin: p.isAdmin, vipType: p.vipType || '无',
    relics: (p.relics || []).length, bugs: (p.discoveredBugs || []).length,
    daoHeart: p.daoHeart || 500, creditScore: p.creditScore || 500,
    lastSignIn: p.lastSignIn, currentMap: p.currentMap || '新手村',
    pills: p.pills || {}, equipmentBag: p.equipmentBag || [],
    materials: p.materials || {}, achievements: p.achievements || []
  }));
  res.json({ players: list, total: list.length });
});

// Admin API: Get player detail
app.get('/api/admin/player/:id', requireAdmin, (req, res) => {
  const players = getPlayers();
  const p = players[req.params.id];
  if (!p) return res.status(404).json({ error: 'Player not found' });
  const safe = { ...p };
  delete safe.password;
  res.json(safe);
});

// Admin API: Give resources to player
app.post('/api/admin/give', requireAdmin, (req, res) => {
  const { playerId, type, item, qty } = req.body;
  if (!playerId || !type) return res.status(400).json({ error: 'Missing params' });
  
  const players = getPlayers();
  const p = players[playerId];
  if (!p) return res.status(404).json({ error: 'Player not found' });
  
  let msg = '';
  switch(type) {
    case 'silver':
      p.silver = (p.silver || 0) + (qty || 100);
      msg = `给予 ${p.name} ${qty || 100} 灵石`;
      break;
    case 'exp':
      p.exp = (p.exp || 0) + (qty || 100);
      msg = `给予 ${p.name} ${qty || 100} 经验`;
      break;
    case 'hp':
      p.maxHp = (p.maxHp || 100) + (qty || 50);
      p.hp = p.maxHp;
      msg = `给予 ${p.name} ${qty || 50} 最大HP`;
      break;
    case 'spirit':
      p.maxSpirit = (p.maxSpirit || 50) + (qty || 30);
      p.spirit = p.maxSpirit;
      msg = `给予 ${p.name} ${qty || 30} 最大灵力`;
      break;
    case 'daoHeart':
      p.daoHeart = Math.min(2000, (p.daoHeart || 500) + (qty || 50));
      msg = `给予 ${p.name} ${qty || 50} 道心 (当前: ${p.daoHeart})`;
      break;
    case 'creditScore':
      p.creditScore = Math.min(1000, (p.creditScore || 500) + (qty || 50));
      msg = `给予 ${p.name} ${qty || 50} 信誉 (当前: ${p.creditScore})`;
      break;
    case 'level':
      p.level = Math.max(1, (p.level || 1) + (qty || 1));
      msg = `设置 ${p.name} 等级为 ${p.level}`;
      break;
    case 'pill':
      if (!item) return res.status(400).json({ error: 'Missing item ID' });
      if (!p.pills) p.pills = {};
      p.pills[item] = (p.pills[item] || 0) + (qty || 1);
      msg = `给予 ${p.name} ${qty || 1}个 ${item}`;
      break;
    case 'equipment':
      if (!item) return res.status(400).json({ error: 'Missing item ID' });
      if (!p.equipmentBag) p.equipmentBag = [];
      for (let i = 0; i < (qty || 1); i++) p.equipmentBag.push({ id: item });
      msg = `给予 ${p.name} ${qty || 1}个装备 ${item}`;
      break;
    case 'relic':
      if (!item) return res.status(400).json({ error: 'Missing item ID' });
      if (!p.relics) p.relics = [];
      if (!p.relics.includes(item)) p.relics.push(item);
      msg = `给予 ${p.name} 遗物 ${item}`;
      break;
    case 'material':
      if (!item) return res.status(400).json({ error: 'Missing item ID' });
      if (!p.materials) p.materials = {};
      p.materials[item] = (p.materials[item] || 0) + (qty || 1);
      msg = `给予 ${p.name} ${qty || 1}个材料 ${item}`;
      break;
    case 'bug':
      if (!item) return res.status(400).json({ error: 'Missing item ID' });
      if (!p.discoveredBugs) p.discoveredBugs = [];
      if (!p.discoveredBugs.includes(item)) p.discoveredBugs.push(item);
      msg = `给予 ${p.name} Bug ${item}`;
      break;
    case 'watchExp':
      if (!p.adminWatch) p.adminWatch = true;
      p.watchExp = (p.watchExp || 0) + (qty || 100);
      p.adminWatchLevel = calcWatchLevel(p.watchExp);
      msg = `给予 ${p.name} ${qty || 100} 手表经验 (当前等级: Lv${p.adminWatchLevel})`;
      break;
    case 'vip':
      const days = qty || 30;
      p.vipExpiry = Date.now() + days * 86400000;
      p.vipType = 'month';
      p.vipTitle = 'VIP会员';
      msg = `给予 ${p.name} ${days}天VIP`;
      break;
    case 'maxAll':
      p.maxHp = 9999; p.hp = 9999;
      p.maxSpirit = 9999; p.spirit = 9999;
      p.maxStamina = 9999; p.stamina = 9999;
      p.silver = 999999;
      p.exp = 999999;
      msg = `已将 ${p.name} 所有属性设为最大`;
      break;
    default:
      return res.status(400).json({ error: 'Unknown type: ' + type });
  }
  
  savePlayers(players);
  
  // Notify player if online
  for (const [clientWs, info] of connectedClients.entries()) {
    if (info.playerId === playerId && clientWs.readyState === WebSocket.OPEN) {
      sendToClient(clientWs, { type: 'system', data: { message: `[管理员] ${msg}` } });
    }
  }
  
  res.json({ success: true, message: msg });
});

// Admin API: Batch give
app.post('/api/admin/batch-give', requireAdmin, (req, res) => {
  const { playerIds, type, item, qty } = req.body;
  if (!playerIds || !Array.isArray(playerIds) || !type) return res.status(400).json({ error: 'Missing params' });
  
  const players = getPlayers();
  const results = [];
  for (const pid of playerIds) {
    const p = players[pid];
    if (!p) { results.push({ id: pid, error: 'Not found' }); continue; }
    switch(type) {
      case 'silver': p.silver = (p.silver || 0) + (qty || 100); break;
      case 'exp': p.exp = (p.exp || 0) + (qty || 100); break;
      case 'vip':
        p.vipExpiry = Date.now() + (qty || 30) * 86400000;
        p.vipType = 'month'; p.vipTitle = 'VIP会员';
        break;
      default: results.push({ id: pid, error: 'Unsupported batch type' }); continue;
    }
    results.push({ id: pid, name: p.name, success: true });
  }
  savePlayers(players);
  res.json({ results });
});

// Admin API: Generate VIP keys
app.post('/api/admin/vip-keys', requireAdmin, (req, res) => {
  const { type, count } = req.body;
  const VIP_TYPES = { week: 7, month: 30, year: 365 };
  if (!VIP_TYPES[type]) return res.status(400).json({ error: 'Invalid VIP type' });
  
  const num = Math.min(count || 1, 50);
  const newKeys = {};
  for (let i = 0; i < num; i++) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'VIP-';
    for (let g = 0; g < 3; g++) {
      for (let c = 0; c < 4; c++) code += chars[Math.floor(Math.random() * chars.length)];
      if (g < 2) code += '-';
    }
    newKeys[code] = { code, type, createdAt: Date.now(), usedBy: null };
  }
  
  let existing = {};
  try { existing = readJSON(VIP_KEYS_FILE); } catch(e) {}
  Object.assign(existing, newKeys);
  writeJSON(VIP_KEYS_FILE, existing);
  
  res.json({ keys: Object.keys(newKeys), count: num, type });
});

// Admin API: Online players
app.get('/api/admin/online', requireAdmin, (req, res) => {
  const players = getPlayers();
  const online = [];
  for (const [ws, info] of connectedClients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      const p = players[info.playerId];
      online.push({
        id: info.playerId, name: info.playerName,
        level: p ? p.level : '?', realm: p ? p.realm : '?',
        map: p ? p.currentMap : '?'
      });
    }
  }
  res.json({ online, count: online.length });
});

// Admin API: Server stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const players = getPlayers();
  const list = Object.values(players);
  const now = Date.now();
  const dayMs = 86400000;
  res.json({
    totalPlayers: list.length,
    onlinePlayers: connectedClients.size,
    activeToday: list.filter(p => p.lastSignIn && (now - new Date(p.lastSignIn).getTime()) < dayMs).length,
    avgLevel: list.length ? Math.round(list.reduce((s, p) => s + (p.level || 1), 0) / list.length) : 0,
    maxLevel: list.length ? Math.max(...list.map(p => p.level || 1)) : 0,
    totalSilver: list.reduce((s, p) => s + (p.silver || 0), 0),
    serverTime: new Date().toLocaleString('zh-CN')
  });
});

app.get('/admin', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理员面板 - 赛博修仙</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Microsoft YaHei', sans-serif; background: #0a0a1a; color: #e0e0e0; min-height: 100vh; }
    .topbar { background: linear-gradient(135deg, #1a1a3e, #0f3460); padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e94560; }
    .topbar h1 { color: #53d8fb; font-size: 1.3em; }
    .topbar .token-input { display: flex; align-items: center; gap: 8px; }
    .topbar input { padding: 6px 12px; background: #16213e; border: 1px solid #0f3460; color: #eee; border-radius: 4px; width: 150px; }
    .topbar .status { padding: 4px 12px; border-radius: 12px; font-size: 0.8em; }
    .status.ok { background: #4ecca3; color: #000; }
    .status.err { background: #e94560; color: #fff; }
    .main { display: flex; min-height: calc(100vh - 60px); }
    .sidebar { width: 280px; background: #111133; padding: 15px; overflow-y: auto; border-right: 1px solid #1a1a4e; }
    .content { flex: 1; padding: 20px; overflow-y: auto; }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: linear-gradient(135deg, #16213e, #1a1a4e); border-radius: 10px; padding: 15px; text-align: center; border: 1px solid #0f3460; }
    .stat-card .label { font-size: 0.8em; color: #888; }
    .stat-card .val { font-size: 1.8em; color: #53d8fb; font-weight: bold; }
    .player-item { padding: 10px 12px; margin: 4px 0; background: #16213e; border-radius: 6px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; }
    .player-item:hover { border-color: #53d8fb; background: #1a2a4e; }
    .player-item.selected { border-color: #e94560; background: #2a1a3e; }
    .player-item .name { font-weight: bold; color: #53d8fb; }
    .player-item .info { font-size: 0.8em; color: #888; }
    .online-badge { display: inline-block; width: 8px; height: 8px; background: #4ecca3; border-radius: 50%; margin-right: 6px; }
    .search { width: 100%; padding: 8px; background: #0a0a2e; border: 1px solid #1a1a4e; color: #eee; border-radius: 6px; margin-bottom: 10px; }
    .tabs { display: flex; gap: 4px; margin-bottom: 15px; flex-wrap: wrap; }
    .tab { padding: 8px 14px; background: #16213e; border: 1px solid #0f3460; border-radius: 6px; cursor: pointer; font-size: 0.85em; transition: all 0.2s; }
    .tab:hover { background: #1a2a4e; }
    .tab.active { background: #e94560; color: #fff; border-color: #e94560; }
    .give-panel { background: #111133; border-radius: 10px; padding: 20px; border: 1px solid #1a1a4e; }
    .give-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin: 15px 0; }
    .give-btn { padding: 12px 8px; background: linear-gradient(135deg, #16213e, #1a2a4e); border: 1px solid #0f3460; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.2s; color: #eee; }
    .give-btn:hover { border-color: #53d8fb; background: #1a3a5e; transform: translateY(-2px); }
    .give-btn .icon { font-size: 1.5em; }
    .give-btn .label { font-size: 0.8em; margin-top: 4px; color: #aaa; }
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; justify-content: center; align-items: center; }
    .modal-overlay.show { display: flex; }
    .modal { background: #111133; border-radius: 12px; padding: 25px; width: 500px; max-width: 90vw; max-height: 80vh; overflow-y: auto; border: 2px solid #e94560; }
    .modal h3 { color: #53d8fb; margin-bottom: 15px; }
    .modal input, .modal select { width: 100%; padding: 8px; background: #0a0a2e; border: 1px solid #1a1a4e; color: #eee; border-radius: 4px; margin: 5px 0 10px; }
    .modal .item-list { max-height: 300px; overflow-y: auto; }
    .modal .item-option { padding: 8px; margin: 3px 0; background: #16213e; border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; }
    .modal .item-option:hover { background: #1a2a4e; border: 1px solid #53d8fb; }
    .modal .btn-row { display: flex; gap: 10px; margin-top: 15px; }
    .modal .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em; }
    .modal .btn-primary { background: #e94560; color: #fff; }
    .modal .btn-secondary { background: #333; color: #eee; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .detail-item { background: #16213e; padding: 10px; border-radius: 6px; border-left: 3px solid #53d8fb; }
    .detail-item .key { font-size: 0.8em; color: #888; }
    .detail-item .value { font-size: 1.1em; color: #53d8fb; }
    .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; background: #4ecca3; color: #000; border-radius: 8px; font-weight: bold; z-index: 2000; display: none; animation: slideIn 0.3s; }
    .toast.error { background: #e94560; color: #fff; }
    @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .quick-actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
    .quick-btn { padding: 6px 12px; background: #0f3460; border: 1px solid #53d8fb; border-radius: 4px; cursor: pointer; color: #53d8fb; font-size: 0.8em; }
    .quick-btn:hover { background: #53d8fb; color: #000; }
    .quick-btn.danger { border-color: #e94560; color: #e94560; }
    .quick-btn.danger:hover { background: #e94560; color: #fff; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>🎮 赛博修仙 · 管理员后台</h1>
    <div class="token-input">
      <span>Token:</span>
      <input type="password" id="tokenInput" value="admin123" placeholder="Admin Token">
      <span id="authStatus" class="status ok">已连接</span>
    </div>
  </div>
  <div class="main">
    <div class="sidebar">
      <input type="text" class="search" id="playerSearch" placeholder="🔍 搜索玩家...">
      <div id="playerList"></div>
    </div>
    <div class="content">
      <div class="stats-row" id="statsRow">
        <div class="stat-card"><div class="label">总玩家</div><div class="val" id="sTotal">-</div></div>
        <div class="stat-card"><div class="label">在线</div><div class="val" id="sOnline">-</div></div>
        <div class="stat-card"><div class="label">今日活跃</div><div class="val" id="sActive">-</div></div>
        <div class="stat-card"><div class="label">平均等级</div><div class="val" id="sAvgLv">-</div></div>
      </div>
      <div class="tabs">
        <div class="tab active" data-tab="give" onclick="switchTab('give')">🎁 给予物资</div>
        <div class="tab" data-tab="detail" onclick="switchTab('detail')">👤 玩家详情</div>
        <div class="tab" data-tab="vip" onclick="switchTab('vip')">👑 VIP管理</div>
        <div class="tab" data-tab="batch" onclick="switchTab('batch')">📦 批量操作</div>
      </div>
      <div class="tab-content" id="tab-give">
        <div class="give-panel">
          <h3 style="color:#53d8fb;">选择玩家后，点击下方按钮给予物资</h3>
          <p style="color:#888; margin:5px 0;">当前选中: <span id="selectedPlayer" style="color:#e94560;">未选择</span></p>
          <h4 style="color:#aaa; margin-top:15px;">💰 资源类</h4>
          <div class="give-grid">
            <div class="give-btn" onclick="giveResource('silver', 100)"><div class="icon">💎</div><div class="label">+100灵石</div></div>
            <div class="give-btn" onclick="giveResource('silver', 500)"><div class="icon">💎</div><div class="label">+500灵石</div></div>
            <div class="give-btn" onclick="giveResource('silver', 1000)"><div class="icon">💰</div><div class="label">+1000灵石</div></div>
            <div class="give-btn" onclick="giveResource('silver', 10000)"><div class="icon">🏆</div><div class="label">+10000灵石</div></div>
            <div class="give-btn" onclick="giveResource('exp', 100)"><div class="icon">⭐</div><div class="label">+100经验</div></div>
            <div class="give-btn" onclick="giveResource('exp', 1000)"><div class="icon">🌟</div><div class="label">+1000经验</div></div>
            <div class="give-btn" onclick="giveResource('exp', 10000)"><div class="icon">💫</div><div class="label">+10000经验</div></div>
            <div class="give-btn" onclick="giveResource('level', 1)"><div class="icon">📈</div><div class="label">+1等级</div></div>
          </div>
          <h4 style="color:#aaa; margin-top:15px;">❤️ 属性类</h4>
          <div class="give-grid">
            <div class="give-btn" onclick="giveResource('hp', 100)"><div class="icon">❤️</div><div class="label">+100最大HP</div></div>
            <div class="give-btn" onclick="giveResource('spirit', 50)"><div class="icon">🔮</div><div class="label">+50最大灵力</div></div>
            <div class="give-btn" onclick="giveResource('daoHeart', 100)"><div class="icon">💜</div><div class="label">+100道心</div></div>
            <div class="give-btn" onclick="giveResource('creditScore', 100)"><div class="icon">📊</div><div class="label">+100信誉</div></div>
            <div class="give-btn" onclick="giveResource('watchExp', 500)"><div class="icon">⌚</div><div class="label">+500手表经验</div></div>
            <div class="give-btn" onclick="giveResource('vip', 30)"><div class="icon">👑</div><div class="label">30天VIP</div></div>
          </div>
          <h4 style="color:#aaa; margin-top:15px;">🧪 物品类 (点击选择)</h4>
          <div class="give-grid">
            <div class="give-btn" onclick="showItemModal('pill')"><div class="icon">💊</div><div class="label">丹药</div></div>
            <div class="give-btn" onclick="showItemModal('equipment')"><div class="icon">⚔️</div><div class="label">装备</div></div>
            <div class="give-btn" onclick="showItemModal('relic')"><div class="icon">📦</div><div class="label">遗物</div></div>
            <div class="give-btn" onclick="showItemModal('material')"><div class="icon">🧪</div><div class="label">材料</div></div>
            <div class="give-btn" onclick="showItemModal('bug')"><div class="icon">🐛</div><div class="label">Bug</div></div>
          </div>
          <h4 style="color:#aaa; margin-top:15px;">⚡ 快捷操作</h4>
          <div class="quick-actions">
            <div class="quick-btn danger" onclick="giveResource('maxAll')">一键满属性</div>
          </div>
        </div>
      </div>
      <div class="tab-content" id="tab-detail" style="display:none;">
        <div id="playerDetail"><p style="color:#888;">请先在左侧选择一个玩家</p></div>
      </div>
      <div class="tab-content" id="tab-vip" style="display:none;">
        <div class="give-panel">
          <h3 style="color:#53d8fb;">👑 VIP卡密生成</h3>
          <div style="margin:15px 0;">
            <label>类型:</label>
            <select id="vipType" style="padding:8px; background:#0a0a2e; border:1px solid #1a1a4e; color:#eee; border-radius:4px;">
              <option value="week">周卡 (7天)</option>
              <option value="month" selected>月卡 (30天)</option>
              <option value="year">年卡 (365天)</option>
            </select>
            <label style="margin-left:15px;">数量:</label>
            <input type="number" id="vipCount" value="5" min="1" max="50" style="width:60px; padding:8px; background:#0a0a2e; border:1px solid #1a1a4e; color:#eee; border-radius:4px;">
            <button onclick="generateVipKeys()" style="margin-left:10px; padding:8px 20px; background:#e94560; border:none; color:#fff; border-radius:4px; cursor:pointer;">生成卡密</button>
          </div>
          <div id="vipKeysResult"></div>
        </div>
      </div>
      <div class="tab-content" id="tab-batch" style="display:none;">
        <div class="give-panel">
          <h3 style="color:#53d8fb;">📦 批量操作</h3>
          <p style="color:#888; margin:10px 0;">对所有玩家执行操作</p>
          <div class="quick-actions">
            <div class="quick-btn" onclick="batchGive('silver', 100)">全员+100灵石</div>
            <div class="quick-btn" onclick="batchGive('silver', 1000)">全员+1000灵石</div>
            <div class="quick-btn" onclick="batchGive('exp', 500)">全员+500经验</div>
            <div class="quick-btn" onclick="batchGive('vip', 7)">全员7天VIP</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-overlay" id="itemModal">
    <div class="modal">
      <h3 id="modalTitle">选择物品</h3>
      <input type="text" id="modalSearch" placeholder="搜索..." oninput="filterModalItems()">
      <div class="item-list" id="modalItemList"></div>
      <div style="margin-top:10px;">
        <label>数量:</label>
        <input type="number" id="modalQty" value="1" min="1" max="999" style="width:80px;">
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="confirmGiveItem()">确认给予</button>
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      </div>
    </div>
  </div>
  <div class="toast" id="toast"></div>
  <script>
    const TOKEN = () => document.getElementById('tokenInput').value;
    let selectedPlayerId = null;
    let selectedPlayerName = '';
    let allPlayers = [];
    let currentModalType = '';
    let selectedItemId = '';
    const ITEMS = {
      pill: { hp_pill:'回血丹', spirit_pill:'回灵丹', stamina_pill:'体力丹', exp_pill:'小培元丹', adv_hp_pill:'高级回血丹', adv_spirit_pill:'高级回灵丹', full_heal:'九转还魂丹', str_pill:'力量丹', dex_pill:'敏捷丹', con_pill:'体质丹', wis_pill:'悟性丹', adv_exp_pill:'大培元丹', rebirth_pill:'重生丹', adv_str_pill:'高级力量丹', adv_dex_pill:'高级敏捷丹' },
      equipment: { wooden_sword:'木剑', iron_sword:'铁剑', steel_sword:'钢剑', wooden_armor:'布衣', leather_armor:'皮甲', iron_armor:'铁甲', wooden_ring:'木戒指', silver_ring:'银戒指', gold_ring:'金戒指', apprentice_hat:'学徒帽', master_robe:'宗师袍', dragon_helm:'龙头盔', basic_bracelet:'基础手镯', jade_pendant:'玉佩', phoenix_feather:'凤凰羽', shadow_blade:'暗影刃', thunder_staff:'雷神杖', ice_crystal:'冰晶石', fire_heart:'炎心石', void_ring:'虚空戒' },
      relic: { M01:'正月·春雷碎片', M02:'二月·惊蛰之种', M03:'三月·清明露珠', M04:'四月·谷雨精华', M05:'五月·端午龙鳞', M06:'六月·夏至烈焰', M07:'七月·小暑流火', M08:'八月·立秋霜华', M09:'九月·白露凝珠', M10:'十月·寒露玄冰', M11:'十一月·大雪封山', M12:'十二月·冬至归元', T01:'子时·夜半钟声', T02:'丑时·鸡鸣破晓', T03:'寅时·平旦微光', T04:'卯时·日出东方', T05:'辰时·食时之宴', T06:'巳时·隅中之风', T07:'午时·日中之火', T08:'未时·日昳之影', T09:'申时·晡时之金', T10:'酉时·日入之霞', T11:'戌时·黄昏之灯', T12:'亥时·人定之梦', Z01:'子鼠·窃运之爪', Z02:'丑牛·蛮力之心', Z03:'寅虎·啸风之牙', Z04:'卯兔·月华之耳', Z05:'辰龙·龙吟之鳞', Z06:'巳蛇·蛇信之毒', Z07:'午马·千里之蹄', Z08:'未羊·祥瑞之角', Z09:'申猴·灵巧之手', Z10:'酉鸡·晨鸣之冠', Z11:'戌狗·忠诚之心', Z12:'亥猪·福运之鼻' },
      material: { herb:'灵草', spirit_shard:'灵石碎片', beast_core:'妖兽内丹' },
      bug: { B01:'时间膨胀泡', B02:'经验溢出点', B03:'显示闪烁', B04:'纹理错位', B05:'渲染残影', B06:'色彩反转', B07:'字体溢出', B08:'UI层叠', B11:'背包溢出', B12:'商店漏洞', B13:'数值溢出', B14:'循环漏洞', B15:'递归溢出', B16:'条件判断错误', B17:'瞬移漏洞', B18:'优先级反转', B19:'类型混淆', B20:'回城Bug', B21:'传送门', B22:'存档延迟', B23:'数据残留', B24:'缓存污染', B25:'索引错乱', B26:'内存泄漏', B27:'指针偏移', B28:'数据重复', B29:'记录丢失', B31:'伤害溢出', B33:'怪物卡住', B34:'规则漏洞', B35:'权限提升', B36:'时间回溯', B37:'世界线偏移', B45:'道心漏洞', B49:'体力漏洞', B50:'掉率漏洞' }
    };
    async function api(url, opts = {}) {
      const headers = { 'x-admin-token': TOKEN(), 'Content-Type': 'application/json', ...(opts.headers || {}) };
      try { const r = await fetch(url, { ...opts, headers }); const data = await r.json(); if (!r.ok) { showToast(data.error || 'Error', true); return null; } return data; } catch(e) { showToast('Network error', true); return null; }
    }
    function showToast(msg, isError = false) { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast' + (isError ? ' error' : ''); t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 3000); }
    async function loadData() {
      const [statsData, playersData, onlineData] = await Promise.all([api('/api/admin/stats'), api('/api/admin/players'), api('/api/admin/online')]);
      if (statsData) { document.getElementById('sTotal').textContent = statsData.totalPlayers; document.getElementById('sOnline').textContent = statsData.onlinePlayers; document.getElementById('sActive').textContent = statsData.activeToday; document.getElementById('sAvgLv').textContent = statsData.avgLevel; }
      if (playersData) { allPlayers = playersData.players; renderPlayerList(allPlayers); }
      if (onlineData) { const onlineIds = new Set(onlineData.online.map(p => p.id)); allPlayers.forEach(p => p._online = onlineIds.has(p.id)); renderPlayerList(allPlayers); }
    }
    function renderPlayerList(players) {
      document.getElementById('playerList').innerHTML = players.map(p =>
        '<div class="player-item ' + (p.id === selectedPlayerId ? 'selected' : '') + '" onclick="selectPlayer(\\'' + p.id + '\\',\\'' + p.name + '\\')">' +
        '<div>' + (p._online ? '<span class="online-badge"></span>' : '') + '<span class="name">' + p.name + '</span></div>' +
        '<div class="info">Lv' + p.level + ' ' + (p.sect || '') + '</div></div>'
      ).join('');
    }
    document.getElementById('playerSearch').addEventListener('input', function() { const q = this.value.trim().toLowerCase(); if (!q) { renderPlayerList(allPlayers); return; } renderPlayerList(allPlayers.filter(p => p.name.toLowerCase().includes(q))); });
    function selectPlayer(id, name) { selectedPlayerId = id; selectedPlayerName = name; document.getElementById('selectedPlayer').textContent = name; renderPlayerList(allPlayers); loadPlayerDetail(id); }
    async function loadPlayerDetail(id) {
      const p = await api('/api/admin/player/' + id); if (!p) return;
      const pillsList = Object.entries(p.pills || {}).map(([k,v]) => k + ':' + v).join(', ') || '无';
      const equipList = (p.equipmentBag || []).map(e => e.id).join(', ') || '无';
      const relicList = (p.relics || []).join(', ') || '无';
      const matList = Object.entries(p.materials || {}).map(([k,v]) => k + ':' + v).join(', ') || '无';
      const bugList = (p.discoveredBugs || []).join(', ') || '无';
      document.getElementById('playerDetail').innerHTML =
        '<div class="detail-grid">' +
        [['ID',p.id],['名字',p.name],['邮箱',p.email||''],['等级',p.level],['境界',p.realm||'凡人'],['经验',p.exp||0],['HP',(p.hp||0)+'/'+(p.maxHp||100)],['灵力',(p.spirit||0)+'/'+(p.maxSpirit||50)],['灵石',p.silver||0],['道心',p.daoHeart||500],['信誉',p.creditScore||500],['门派',p.sect||'无'],['VIP',p.vipType||'无'],['手表','Lv'+(p.adminWatchLevel||0)],['遗物',(p.relics||[]).length+'/36'],['Bug',(p.discoveredBugs||[]).length+'/32']].map(([k,v]) => '<div class="detail-item"><div class="key">'+k+'</div><div class="value">'+v+'</div></div>').join('') +
        '</div>' +
        '<h4 style="color:#aaa; margin:15px 0 8px;">📦 背包</h4>' +
        '<div style="background:#16213e; padding:10px; border-radius:6px; margin-bottom:8px;"><strong>丹药:</strong> ' + pillsList + '</div>' +
        '<div style="background:#16213e; padding:10px; border-radius:6px; margin-bottom:8px;"><strong>装备:</strong> ' + equipList + '</div>' +
        '<div style="background:#16213e; padding:10px; border-radius:6px; margin-bottom:8px;"><strong>遗物:</strong> ' + relicList + '</div>' +
        '<div style="background:#16213e; padding:10px; border-radius:6px; margin-bottom:8px;"><strong>材料:</strong> ' + matList + '</div>' +
        '<div style="background:#16213e; padding:10px; border-radius:6px; margin-bottom:8px;"><strong>Bug:</strong> ' + bugList + '</div>';
    }
    async function giveResource(type, qty) {
      if (!selectedPlayerId) { showToast('请先选择一个玩家', true); return; }
      const data = await api('/api/admin/give', { method: 'POST', body: JSON.stringify({ playerId: selectedPlayerId, type, qty }) });
      if (data && data.success) { showToast('✅ ' + data.message); loadPlayerDetail(selectedPlayerId); loadData(); }
    }
    function showItemModal(type) {
      if (!selectedPlayerId) { showToast('请先选择一个玩家', true); return; }
      currentModalType = type; selectedItemId = '';
      document.getElementById('modalTitle').textContent = '选择' + {pill:'丹药',equipment:'装备',relic:'遗物',material:'材料',bug:'Bug'}[type];
      document.getElementById('modalSearch').value = ''; renderModalItems(type);
      document.getElementById('itemModal').classList.add('show');
    }
    function renderModalItems(type, filter = '') {
      const items = ITEMS[type] || {};
      document.getElementById('modalItemList').innerHTML = Object.entries(items).filter(([id, name]) => !filter || name.includes(filter) || id.includes(filter)).map(([id, name]) =>
        '<div class="item-option" onclick="selectModalItem(\\'' + id + '\\')"><span>' + name + '</span><span style="color:#888;">' + id + '</span></div>'
      ).join('');
    }
    function filterModalItems() { renderModalItems(currentModalType, document.getElementById('modalSearch').value.trim()); }
    function selectModalItem(id) { selectedItemId = id; showToast('已选择: ' + id); }
    async function confirmGiveItem() {
      if (!selectedItemId) { showToast('请先选择一个物品', true); return; }
      const qty = parseInt(document.getElementById('modalQty').value) || 1;
      const data = await api('/api/admin/give', { method: 'POST', body: JSON.stringify({ playerId: selectedPlayerId, type: currentModalType, item: selectedItemId, qty }) });
      if (data && data.success) { showToast('✅ ' + data.message); closeModal(); loadPlayerDetail(selectedPlayerId); }
    }
    function closeModal() { document.getElementById('itemModal').classList.remove('show'); }
    async function generateVipKeys() {
      const type = document.getElementById('vipType').value; const count = parseInt(document.getElementById('vipCount').value) || 5;
      const data = await api('/api/admin/vip-keys', { method: 'POST', body: JSON.stringify({ type, count }) });
      if (data && data.keys) {
        document.getElementById('vipKeysResult').innerHTML = '<div style="background:#16213e; padding:15px; border-radius:8px; margin-top:10px;"><p style="color:#4ecca3;">✅ 已生成 ' + data.count + ' 个' + data.type + '卡密:</p>' +
          data.keys.map(k => '<div style="font-family:monospace; color:#53d8fb; padding:4px; cursor:pointer; background:#0a0a2e; margin:3px 0; border-radius:3px;" onclick="navigator.clipboard.writeText(\\'' + k + '\\'); showToast(\\'' + k + ' 已复制\\')">' + k + '</div>').join('') + '</div>';
      }
    }
    async function batchGive(type, qty) {
      if (!confirm('确定对所有玩家执行此操作？')) return;
      const data = await api('/api/admin/batch-give', { method: 'POST', body: JSON.stringify({ playerIds: allPlayers.map(p => p.id), type, qty }) });
      if (data && data.results) { showToast('✅ 批量操作完成: ' + data.results.filter(r => r.success).length + ' 人'); }
    }
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      document.getElementById('tab-' + tab).style.display = 'block';
    }
    loadData(); setInterval(loadData, 10000);
  </script>
</body>
</html>`;
  res.send(html);
});
