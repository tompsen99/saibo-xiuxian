// ═══════════════════════════════════════════════════════════════
// 赛博修仙 MUD — XP-Style Frontend Client
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── Profession Data (from game design doc, total=100) ───
  const PROFESSIONS = [
    {
      id: 'retired_police', name: '退休警察',
      stats: { 力道: 14, 根骨: 16, 身法: 15, 悟性: 10 },
      bonusMain: '追击伤害+10%', bonusSub: '体力恢复+5%',
      desc: '60年从警生涯，身手矫健，根骨扎实。穿越后依然保留着追击本能。'
    },
    {
      id: 'retired_soldier', name: '退休军人',
      stats: { 力道: 16, 根骨: 14, 身法: 14, 悟性: 11 },
      bonusMain: '防御+10%', bonusSub: 'HP上限+5%',
      desc: '军旅一生，体魄强健，攻防兼备。战场上积累的战斗经验不会消失。'
    },
    {
      id: 'retired_doctor', name: '退休医生',
      stats: { 力道: 10, 根骨: 12, 身法: 10, 悟性: 23 },
      bonusMain: '治疗效果+10%', bonusSub: '炼丹成功率+5%',
      desc: '悬壶济世数十载，对人体经络了然于胸。修仙炼丹事半功倍。'
    },
    {
      id: 'retired_teacher', name: '退休教师',
      stats: { 力道: 10, 根骨: 12, 身法: 10, 悟性: 23 },
      bonusMain: '功法修炼速度+10%', bonusSub: '悟性成长+5%',
      desc: '教书育人一辈子，学习能力超强。对功法的理解比常人更快。'
    },
    {
      id: 'retired_programmer', name: '退休程序员',
      stats: { 力道: 8, 根骨: 10, 身法: 12, 悟性: 25 },
      bonusMain: 'Bug发现率+10%', bonusSub: '解谜线索+5%',
      desc: '写了40年代码，是唯一能读懂这个世界Bug残留代码碎片的人。'
    },
    {
      id: 'retired_worker', name: '退休工人',
      stats: { 力道: 18, 根骨: 16, 身法: 10, 悟性: 11 },
      bonusMain: '力道成长+10%', bonusSub: '负重+5%',
      desc: '干了一辈子体力活，力大无穷。穿越后这副身板依然结实。'
    },
    {
      id: 'retired_chef', name: '退休厨师',
      stats: { 力道: 12, 根骨: 14, 身法: 10, 悟性: 19 },
      bonusMain: '食物效果+10%', bonusSub: '体力上限+5%',
      desc: '掌勺四十年，深谙食补之道。吃什么都比别人多恢复一些。'
    },
    {
      id: 'retired_merchant', name: '退休商人',
      stats: { 力道: 10, 根骨: 10, 身法: 14, 悟性: 21 },
      bonusMain: '银两获取+10%', bonusSub: '交易税-5%',
      desc: '商场沉浮半生，精于算计。穿越后做生意照样精明。'
    },
    {
      id: 'retired_athlete', name: '退休运动员',
      stats: { 力道: 14, 根骨: 14, 身法: 18, 悟性: 9 },
      bonusMain: '速度+10%', bonusSub: '闪避+5%',
      desc: '退役运动员，身体素质极佳。身法敏捷，来去如风。'
    },
    {
      id: 'retired_artist', name: '退休艺术家',
      stats: { 力道: 10, 根骨: 10, 身法: 14, 悟性: 21 },
      bonusMain: '奇遇概率+10%', bonusSub: '道心成长+5%',
      desc: '艺术人生，感知敏锐。容易触发奇遇，道心修炼更快。'
    },
    {
      id: 'retired_farmer', name: '退休农民',
      stats: { 力道: 16, 根骨: 18, 身法: 8, 悟性: 13 },
      bonusMain: '采集效率+10%', bonusSub: '寿命+5%',
      desc: '面朝黄土背朝天几十年，身体底子最好。寿命比一般人长。'
    },
    {
      id: 'retired_freelance', name: '无业/自由',
      stats: { 力道: 12, 根骨: 12, 身法: 12, 悟性: 19 },
      bonusMain: '全属性+3%', bonusSub: '无',
      desc: '自由自在一辈子，没有专精但也没有短板。全面均衡发展。'
    }
  ];

  // ─── State ───
  let ws = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  let token = null;
  let gameState = 'login'; // login | profession | attributes | game
  let selectedProfession = null;
  let attrValues = { 力道: 0, 根骨: 0, 身法: 0, 悟性: 0 };
  let messageCount = 0;
  const MAX_MESSAGES = 500;

  // ─── DOM Refs ───
  const $gameText = document.getElementById('game-text');
  const $chatInput = document.getElementById('chat-input');
  const $sendBtn = document.getElementById('send-btn');
  const $loginOverlay = document.getElementById('login-overlay');
  const $professionOverlay = document.getElementById('profession-overlay');
  const $attrOverlay = document.getElementById('attr-overlay');
  const $loginForm = document.getElementById('login-form');
  const $registerForm = document.getElementById('register-form');
  const $professionGrid = document.getElementById('profession-grid');
  const $attrControls = document.getElementById('attr-controls');

  // Status bar
  const $statHp = document.getElementById('stat-hp');
  const $statSp = document.getElementById('stat-sp');
  const $statSt = document.getElementById('stat-st');
  const $statSilver = document.getElementById('stat-silver');
  const $statRealm = document.getElementById('stat-realm');

  // ─── WebSocket Connection ───
  function connectWS() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
      ws = new WebSocket('ws://localhost:3000');
    } catch (e) {
      appendMessage('[系统] WebSocket连接失败: ' + e.message, 'system');
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      reconnectDelay = 1000;
      appendMessage('[系统] 已连接到服务器', 'system');
      // If we have stored credentials, try auto-login
      var storedEmail = localStorage.getItem('sbxx_email');
      var storedToken = localStorage.getItem('sbxx_token');
      if (storedToken && storedEmail) {
        sendWS('login', { email: storedEmail, token: storedToken });
      }
    };

    ws.onmessage = function (evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }
      handleServerMessage(msg);
    };

    ws.onclose = function () {
      appendMessage('[系统] 连接断开，正在重连...', 'system');
      scheduleReconnect();
    };

    ws.onerror = function () {
      // onclose will fire after this
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
      connectWS();
    }, reconnectDelay);
  }

  function sendWS(type, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      appendMessage('[系统] 未连接服务器', 'error');
      return;
    }
    ws.send(JSON.stringify({ type: type, data: data || {} }));
  }

  // ─── Server Message Handler ───
  function handleServerMessage(msg) {
    var type = msg.type;
    var data = msg.data || {};

    switch (type) {
      case 'system':
      case 'message':
        appendMessage(data.text || data.message || JSON.stringify(data), data.style || 'system');
        break;

      case 'chat':
        appendMessage((data.sender ? data.sender + ': ' : '') + (data.text || ''), 'chat');
        break;

      case 'combat':
        appendMessage(data.text || data.message || '', 'combat');
        break;

      case 'npc':
        appendMessage(data.text || data.message || '', 'npc');
        break;

      case 'error':
        appendMessage('错误: ' + (data.message || data.text || '未知错误'), 'error');
        break;

      case 'login_success':
        token = data.token || 'ok';
        localStorage.setItem('sbxx_email', data.email || document.getElementById('login-email').value);
        localStorage.setItem('sbxx_token', token);
        appendMessage('[系统] 登录成功！欢迎回来，' + (data.name || '修仙者'), 'system');
        if (data.needsProfession) {
          showProfessionSelection();
        } else if (data.needsAttributes) {
          showAttributeAllocation(data.baseStats);
        } else {
          enterGame(data);
        }
        break;

      case 'register_success':
        token = data.token || 'ok';
        localStorage.setItem('sbxx_email', data.email || document.getElementById('reg-email').value);
        localStorage.setItem('sbxx_token', token);
        appendMessage('[系统] 注册成功！请先选择你的前世职业。', 'system');
        showProfessionSelection();
        break;

      case 'profession_selected':
        appendMessage('[系统] 职业选择成功！请分配属性。', 'system');
        showAttributeAllocation(data.baseStats);
        break;

      case 'attributes_confirmed':
      case 'enter_game':
        enterGame(data);
        break;

      case 'status':
        updateStatus(data);
        break;

      default:
        appendMessage(data.text || data.message || JSON.stringify(data), data.style || 'info');
    }
  }

  // ─── Game Text Display ───
  function appendMessage(text, style) {
    if (!text) return;
    var div = document.createElement('div');
    div.className = 'msg-' + (style || 'info');
    div.textContent = text;
    $gameText.appendChild(div);
    messageCount++;

    // Prune old messages
    while (messageCount > MAX_MESSAGES) {
      if ($gameText.firstChild) {
        $gameText.removeChild($gameText.firstChild);
        messageCount--;
      }
    }

    // Auto-scroll
    $gameText.scrollTop = $gameText.scrollHeight;
  }

  // ─── Status Bar Update ───
  function updateStatus(data) {
    if (data.hp !== undefined) {
      $statHp.textContent = data.hp + '/' + (data.maxHp || data.hp);
    }
    if (data.spirit !== undefined) {
      $statSp.textContent = data.spirit + '/' + (data.maxSpirit || data.spirit);
    }
    if (data.stamina !== undefined) {
      $statSt.textContent = data.stamina + '/' + (data.maxStamina || data.stamina);
    }
    if (data.silver !== undefined) {
      $statSilver.textContent = data.silver;
    }
    if (data.realm) {
      $statRealm.textContent = data.realm;
    }
  }

  // ─── Chat / Command Input ───
  function sendMessage() {
    var text = $chatInput.value.trim();
    if (!text) return;
    $chatInput.value = '';

    if (gameState !== 'game') {
      appendMessage('[系统] 尚未进入游戏', 'error');
      return;
    }

    if (text.charAt(0) === '/') {
      var parts = text.slice(1).split(/\s+/);
      var cmd = parts[0];
      var args = parts.slice(1).join(' ');
      sendWS('command', { command: cmd, args: args });
      appendMessage('> ' + text, 'self');
    } else {
      sendWS('chat', { text: text });
    }
  }

  // ─── Login / Register ───
  function doLogin() {
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    var errEl = document.getElementById('login-error');

    if (!email || !password) {
      errEl.textContent = '请输入邮箱和密码';
      return;
    }
    errEl.textContent = '';
    sendWS('login', { email: email, password: password });
  }

  function doRegister() {
    var email = document.getElementById('reg-email').value.trim();
    var password = document.getElementById('reg-password').value;
    var name = document.getElementById('reg-name').value.trim();
    var errEl = document.getElementById('register-error');

    if (!email || !password || !name) {
      errEl.textContent = '请填写所有字段';
      return;
    }
    if (password.length < 6) {
      errEl.textContent = '密码至少6位';
      return;
    }
    errEl.textContent = '';
    sendWS('register', { email: email, password: password, name: name });
  }

  // ─── Profession Selection UI ───
  function showProfessionSelection() {
    gameState = 'profession';
    $loginOverlay.classList.add('hidden');
    $professionOverlay.classList.remove('hidden');
    $professionGrid.innerHTML = '';

    PROFESSIONS.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'profession-card';
      card.dataset.id = p.id;
      card.innerHTML =
        '<div class="prof-name">' + p.name + '</div>' +
        '<div class="prof-stats">力' + p.stats.力道 + ' 根' + p.stats.根骨 + ' 身' + p.stats.身法 + ' 悟' + p.stats.悟性 + '</div>' +
        '<div class="prof-bonus">' + p.bonusMain + ' / ' + p.bonusSub + '</div>' +
        '<div style="margin-top:3px;color:#666;font-size:10px;">' + p.desc + '</div>';
      card.addEventListener('click', function () {
        document.querySelectorAll('.profession-card').forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
        selectedProfession = p;
        document.getElementById('profession-confirm').disabled = false;
      });
      $professionGrid.appendChild(card);
    });
  }

  function confirmProfession() {
    if (!selectedProfession) return;
    sendWS('command', { command: 'select_profession', args: selectedProfession.id });
    appendMessage('[系统] 你选择了前世职业: ' + selectedProfession.name, 'system');
  }

  // ─── Attribute Allocation UI ───
  function showAttributeAllocation(baseStats) {
    gameState = 'attributes';
    $professionOverlay.classList.add('hidden');
    $attrOverlay.classList.remove('hidden');

    if (baseStats) {
      attrValues = {
        力道: baseStats.力道 || baseStats.str || 25,
        根骨: baseStats.根骨 || baseStats.con || 25,
        身法: baseStats.身法 || baseStats.dex || 25,
        悟性: baseStats.悟性 || baseStats.int || 25
      };
    } else if (selectedProfession) {
      attrValues = randomizeFromProfession(selectedProfession.stats);
    } else {
      attrValues = { 力道: 25, 根骨: 25, 身法: 25, 悟性: 25 };
    }

    renderAttrControls();
  }

  function randomizeFromProfession(base) {
    var result = {};
    var total = 0;
    var keys = ['力道', '根骨', '身法', '悟性'];
    keys.forEach(function (k) {
      var v = base[k] + Math.floor(Math.random() * 7) - 3; // ±3
      v = Math.max(1, Math.min(50, v));
      result[k] = v;
      total += v;
    });
    // Normalize to 100
    var diff = 100 - total;
    var i = 0;
    while (diff !== 0 && i < 100) {
      var k = keys[i % 4];
      if (diff > 0 && result[k] < 50) { result[k]++; diff--; }
      else if (diff < 0 && result[k] > 1) { result[k]--; diff++; }
      i++;
    }
    return result;
  }

  function renderAttrControls() {
    $attrControls.innerHTML = '';
    var keys = ['力道', '根骨', '身法', '悟性'];
    var labels = {
      力道: '物理伤害、近战、负重',
      根骨: '血量、防御、渡劫、寿命',
      身法: '闪避、攻速、先手、逃跑',
      悟性: '修炼速度、奇遇、Bug发现'
    };

    keys.forEach(function (k) {
      var row = document.createElement('div');
      row.className = 'attr-row';
      row.innerHTML =
        '<span class="attr-name">' + k + '</span>' +
        '<button class="xp-btn attr-minus" data-attr="' + k + '">−</button>' +
        '<span class="attr-value" id="av-' + k + '">' + attrValues[k] + '</span>' +
        '<button class="xp-btn attr-plus" data-attr="' + k + '">+</button>' +
        '<span style="font-size:10px;color:#666;">' + labels[k] + '</span>';
      $attrControls.appendChild(row);
    });

    updateAttrTotal();
  }

  function adjustAttr(key, delta) {
    var newVal = attrValues[key] + delta;
    if (newVal < 1 || newVal > 50) return;

    // Find a counter-attr to balance
    var keys = ['力道', '根骨', '身法', '悟性'];
    var otherKey = null;
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== key) {
        var ov = attrValues[keys[i]] - delta;
        if (ov >= 1 && ov <= 50) {
          otherKey = keys[i];
          break;
        }
      }
    }
    if (!otherKey) return;

    attrValues[key] = newVal;
    attrValues[otherKey] -= delta;
    document.getElementById('av-' + key).textContent = attrValues[key];
    document.getElementById('av-' + otherKey).textContent = attrValues[otherKey];
    updateAttrTotal();
  }

  function updateAttrTotal() {
    var total = attrValues.力道 + attrValues.根骨 + attrValues.身法 + attrValues.悟性;
    var el = document.getElementById('attr-total');
    el.textContent = '总计: ' + total + (total === 100 ? ' ✓' : ' (需=100)');
    el.style.color = total === 100 ? '#090' : '#c00';
  }

  function confirmAttributes() {
    var total = attrValues.力道 + attrValues.根骨 + attrValues.身法 + attrValues.悟性;
    if (total !== 100) {
      appendMessage('[系统] 属性总和必须为100', 'error');
      return;
    }
    sendWS('command', {
      command: 'confirm_attributes',
      args: JSON.stringify(attrValues)
    });
    appendMessage('[系统] 属性已确认，正在进入游戏...', 'system');
  }

  function enterGame(data) {
    gameState = 'game';
    $loginOverlay.classList.add('hidden');
    $professionOverlay.classList.add('hidden');
    $attrOverlay.classList.add('hidden');

    if (data && data.status) updateStatus(data.status);

    appendMessage('════════════════════════════════════════', 'system');
    appendMessage('  欢迎来到 赛博修仙 世界！', 'system');
    appendMessage('  你是一位60岁的退休老人，意识穿越到了武侠修仙游戏世界。', 'system');
    appendMessage('  输入 /帮助 查看可用指令', 'system');
    appendMessage('════════════════════════════════════════', 'system');

    $chatInput.focus();
  }

  // ─── Event Bindings ───
  // Login form toggle
  document.getElementById('show-register').addEventListener('click', function () {
    $loginForm.style.display = 'none';
    $registerForm.style.display = 'block';
  });
  document.getElementById('show-login').addEventListener('click', function () {
    $registerForm.style.display = 'none';
    $loginForm.style.display = 'block';
  });

  // Login/Register submit
  document.getElementById('login-submit').addEventListener('click', doLogin);
  document.getElementById('register-submit').addEventListener('click', doRegister);
  document.getElementById('login-password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('reg-name').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doRegister();
  });

  // Profession confirm
  document.getElementById('profession-confirm').addEventListener('click', confirmProfession);

  // Attribute controls
  $attrControls.addEventListener('click', function (e) {
    var btn = e.target.closest('.xp-btn');
    if (!btn) return;
    var attr = btn.dataset.attr;
    if (!attr) return;
    if (btn.classList.contains('attr-plus')) adjustAttr(attr, 1);
    else if (btn.classList.contains('attr-minus')) adjustAttr(attr, -1);
  });

  document.getElementById('attr-randomize').addEventListener('click', function () {
    if (selectedProfession) {
      attrValues = randomizeFromProfession(selectedProfession.stats);
    } else {
      attrValues = { 力道: 25, 根骨: 25, 身法: 25, 悟性: 25 };
    }
    renderAttrControls();
  });

  document.getElementById('attr-confirm').addEventListener('click', confirmAttributes);

  // Chat send
  $sendBtn.addEventListener('click', sendMessage);
  $chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  // Side panel quick commands
  document.getElementById('side-panel').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    var cmd = btn.dataset.cmd;
    if (gameState !== 'game') {
      appendMessage('[系统] 尚未进入游戏', 'error');
      return;
    }
    if (cmd.charAt(0) === '/') {
      sendWS('command', { command: cmd.slice(1), args: '' });
      appendMessage('> ' + cmd, 'self');
    } else {
      sendWS('chat', { text: cmd });
    }
  });

  // Prevent zoom on double-tap (mobile)
  document.addEventListener('touchend', function (e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    e.preventDefault();
  }, { passive: false });

  // ─── Init ───
  connectWS();

})();
