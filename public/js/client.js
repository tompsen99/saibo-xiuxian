// ═══════════════════════════════════════════════════════════════
// 赛博修仙 MUD — XP-Style Frontend Client
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const PROFESSIONS = [
    {
      id: 'police', name: '退休警察',
      desc: '60年执法生涯，练就一身正气',
      stats: { str: 14, con: 16, dex: 15, wis: 10 },
      primary: '追击伤害+10%', secondary: '体力恢复+5%'
    },
    {
      id: 'soldier', name: '退休军人',
      desc: '半生戎马，铁骨铮铮',
      stats: { str: 16, con: 14, dex: 14, wis: 11 },
      primary: '防御+10%', secondary: 'HP上限+5%'
    },
    {
      id: 'doctor', name: '退休医生',
      desc: '悬壶济世一甲子，深谙人体奥秘',
      stats: { str: 10, con: 12, dex: 10, wis: 23 },
      primary: '治疗效果+10%', secondary: '炼丹成功率+5%'
    },
    {
      id: 'teacher', name: '退休教师',
      desc: '桃李满天下，悟性超群',
      stats: { str: 10, con: 12, dex: 10, wis: 23 },
      primary: '功法修炼速度+10%', secondary: '悟性成长+5%'
    },
    {
      id: 'programmer', name: '退休程序员',
      desc: '与代码为伍四十载，洞察一切Bug',
      stats: { str: 8, con: 10, dex: 12, wis: 25 },
      primary: 'Bug发现率+10%', secondary: '解谜线索+5%'
    },
    {
      id: 'worker', name: '退休工人',
      desc: '一辈子劳作，力大无穷',
      stats: { str: 18, con: 16, dex: 10, wis: 11 },
      primary: '力道成长+10%', secondary: '负重+5%'
    },
    {
      id: 'chef', name: '退休厨师',
      desc: '民以食为天，深谙食补之道',
      stats: { str: 12, con: 14, dex: 10, wis: 19 },
      primary: '食物效果+10%', secondary: '体力上限+5%'
    },
    {
      id: 'merchant', name: '退休商人',
      desc: '精于算计，善于交易',
      stats: { str: 10, con: 10, dex: 14, wis: 21 },
      primary: '银两获取+10%', secondary: '交易税-5%'
    },
    {
      id: 'athlete', name: '退休运动员',
      desc: '赛场拼搏数十载，身手敏捷',
      stats: { str: 14, con: 14, dex: 18, wis: 9 },
      primary: '速度+10%', secondary: '闪避+5%'
    },
    {
      id: 'artist', name: '退休艺术家',
      desc: '追求美与灵感，直觉敏锐',
      stats: { str: 10, con: 10, dex: 14, wis: 21 },
      primary: '奇遇概率+10%', secondary: '道心成长+5%'
    },
    {
      id: 'farmer', name: '退休农民',
      desc: '面朝黄土背朝天，根基深厚',
      stats: { str: 16, con: 18, dex: 8, wis: 13 },
      primary: '采集效率+10%', secondary: '寿命+5%'
    },
    {
      id: 'freelance', name: '无业/自由',
      desc: '自由自在无拘无束，全面发展',
      stats: { str: 12, con: 12, dex: 12, wis: 19 },
      primary: '全属性+3%', secondary: '无'
    }
  ];

  // ─── State ───
  let ws = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  let token = null;
  let gameState = 'login'; // login | profession | attributes | game
  let selectedProfession = null;
  let attrValues = { str: 0, con: 0, dex: 0, wis: 0 };
  let pendingPlayerId = null;
  let messageCount = 0;
  const MAX_MESSAGES = 500;
  let isIdling = false;
  let originalPlaceholder = '输入命令或聊天内容...';

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
        var sysText = data.text || data.message || JSON.stringify(data);
        // Detect idle state changes in system messages
        if (sysText.includes('打坐') || sysText.includes('挂机') || sysText.includes('修炼中') || sysText.includes('进入了修炼状态')) {
          isIdling = true;
          $chatInput.placeholder = '🧘 修炼中... 输入任意内容退出打坐';
        } else if (sysText.includes('退出打坐') || sysText.includes('停止修炼') || sysText.includes('结束了修炼')) {
          isIdling = false;
          $chatInput.placeholder = originalPlaceholder;
        }
        appendMessage(sysText, 'system');
        break;

      case 'chat':
        appendMessage((data.sender ? data.sender + ': ' : '') + (data.message || data.text || ''), 'chat');
        break;

      case 'local_chat':
        appendMessage('[本地] ' + (data.sender || '') + ': ' + (data.message || ''), 'local');
        break;

      case 'combat':
        var combatLog = data.log || data.lines || [];
        if (Array.isArray(combatLog) && combatLog.length > 0) {
          combatLog.forEach(function(line) { appendMessage(line, 'combat'); });
        } else {
          var combatText = data.text || data.message || '';
          if (combatText) appendMessage(combatText, 'combat');
        }
        // Update HP display after combat
        if (data.hp !== undefined) {
          $statHp.textContent = data.hp + '/' + (data.maxHp || data.hp);
        }
        break;

      case 'idle_combat':
        var idleLog = data.log || [];
        if (Array.isArray(idleLog)) {
          idleLog.forEach(function(line) { appendMessage('[挂机] ' + line, 'combat'); });
        }
        if (data.hp !== undefined) {
          $statHp.textContent = data.hp + '/' + (data.maxHp || data.hp);
        }
        break;

      case 'status_update':
        updateStatus(data);
        break;

      case 'npc':
        appendMessage(data.text || data.message || '', 'npc');
        break;

      case 'error':
        appendMessage('错误: ' + (data.message || data.text || '未知错误'), 'error');
        break;

      // Registration response
      case 'register_response':
        if (data.success) {
          pendingPlayerId = data.playerId || null;
          appendMessage('[系统] 注册成功！请先选择你的前世职业。', 'system');
          showProfessionSelection();
        } else {
          document.getElementById('register-error').textContent = data.message || '注册失败';
        }
        break;

      // Login response
      case 'login_response':
        if (data.success) {
          token = data.token;
          localStorage.setItem('sbxx_token', token);
          if (data.player) {
            pendingPlayerId = data.player.id;
            updateStatusFromPlayer(data.player);
          }
          if (data.needsProfession) {
            pendingPlayerId = data.playerId || (data.player && data.player.id);
            appendMessage('[系统] 请先选择你的前世职业。', 'system');
            showProfessionSelection();
          } else {
            appendMessage('[系统] 登录成功！欢迎回来，' + (data.player ? data.player.name : '修仙者'), 'system');
            enterGame(data);
          }
        } else {
          document.getElementById('login-error').textContent = data.message || '登录失败';
        }
        break;

      // Profession selection response
      case 'select_profession_response':
        if (data.success) {
          token = data.token || token;
          localStorage.setItem('sbxx_token', token);
          if (data.player) {
            pendingPlayerId = data.player.id;
            updateStatusFromPlayer(data.player);
          }
          appendMessage('[系统] ' + (data.message || '职业选择完成！'), 'system');
          enterGame(data);
        } else {
          appendMessage('[系统] ' + (data.message || '职业选择失败'), 'error');
        }
        break;

      // Room display
      case 'room':
        displayRoom(data);
        break;

      // Move response
      case 'move_response':
        if (data.success && data.room) {
          displayRoom(data.room);
        }
        break;

      // Command response
      case 'command_response':
        var respText = data.content || data.message || '';
        // Detect idle/idle-related messages
        if (respText.includes('打坐') || respText.includes('挂机') || respText.includes('修炼中') || respText.includes('进入了修炼状态')) {
          isIdling = true;
          $chatInput.placeholder = '🧘 修炼中... 输入任意内容退出打坐';
          appendMessage(respText, 'system');
        } else if (respText.includes('退出打坐') || respText.includes('停止修炼') || respText.includes('结束了修炼')) {
          isIdling = false;
          $chatInput.placeholder = originalPlaceholder;
          appendMessage(respText, 'system');
        } else {
          appendMessage(respText, 'room');
        }
        break;
      // Skill list response
      case 'skill_list':
        var skillText = data.content || data.message || '';
        if (skillText) {
          appendMessage(skillText, 'room');
        }
        break;

      // Sect info response
      case 'sect_info':
        var sectText = data.content || data.message || '';
        if (sectText) {
          appendMessage(sectText, 'room');
        }
        break;

      // Encounter event
      case 'encounter':
        var encText = data.content || data.message || data.text || '';
        var encLines = data.lines || data.log || [];
        if (Array.isArray(encLines) && encLines.length > 0) {
          appendMessage('✨ ═══ 奇遇 ═══', 'system');
          encLines.forEach(function(line) { appendMessage(line, 'npc'); });
        } else if (encText) {
          appendMessage('✨ ═══ 奇遇 ═══', 'system');
          appendMessage(encText, 'npc');
        }
        // Update status if provided
        if (data.hp !== undefined) {
          $statHp.textContent = data.hp + '/' + (data.maxHp || data.hp);
        }
        if (data.silver !== undefined) {
          $statSilver.textContent = data.silver;
        }
        break;

      // Status
      case 'status_response':
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

    // Exit idle mode on any user input
    if (isIdling) {
      isIdling = false;
      $chatInput.placeholder = originalPlaceholder;
    }

    if (gameState !== 'game') {
      appendMessage('[系统] 尚未进入游戏', 'error');
      return;
    }

    if (text.charAt(0) === '/') {
      sendWS('command', { command: text });
      appendMessage('> ' + text, 'self');
    } else {
      sendWS('chat', { message: text });
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
        '<div class="prof-desc">' + p.desc + '</div>' +
        '<div class="prof-stats">' +
          '<div class="stat-bar"><span class="stat-label">力道</span><div class="bar-track"><div class="bar-fill" style="width:' + (p.stats.str * 4) + '%"></div></div><span class="stat-val">' + p.stats.str + '</span></div>' +
          '<div class="stat-bar"><span class="stat-label">根骨</span><div class="bar-track"><div class="bar-fill" style="width:' + (p.stats.con * 4) + '%"></div></div><span class="stat-val">' + p.stats.con + '</span></div>' +
          '<div class="stat-bar"><span class="stat-label">身法</span><div class="bar-track"><div class="bar-fill" style="width:' + (p.stats.dex * 4) + '%"></div></div><span class="stat-val">' + p.stats.dex + '</span></div>' +
          '<div class="stat-bar"><span class="stat-label">悟性</span><div class="bar-track"><div class="bar-fill" style="width:' + (p.stats.wis * 4) + '%"></div></div><span class="stat-val">' + p.stats.wis + '</span></div>' +
        '</div>' +
        '<div class="prof-bonus"><span class="bonus-main">' + p.primary + '</span>' + (p.secondary !== '无' ? ' <span class="bonus-sub">' + p.secondary + '</span>' : '') + '</div>';
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
    appendMessage('[系统] 你选择了前世职业: ' + selectedProfession.name, 'system');
    showAttributeAllocation();
  }

  // ─── Attribute Allocation UI ───
   function showAttributeAllocation(baseStats) {
     gameState = 'attributes';
     $professionOverlay.classList.add('hidden');
     $attrOverlay.classList.remove('hidden');
 
     if (baseStats) {
       attrValues = {
         str: baseStats.str || 25,
         con: baseStats.con || 25,
         dex: baseStats.dex || 25,
         wis: baseStats.wis || 25
       };
     } else if (selectedProfession) {
       attrValues = randomizeFromProfession(selectedProfession.stats);
     } else {
       attrValues = { str: 25, con: 25, dex: 25, wis: 25 };
     }
 
     renderAttrControls();
   }

  function randomizeFromProfession(base) {
     var result = {};
     var total = 0;
     var keys = ['str', 'con', 'dex', 'wis'];
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
     var keys = ['str', 'con', 'dex', 'wis'];
     var names = { str: '力道', con: '根骨', dex: '身法', wis: '悟性' };
     var labels = {
       str: '物理伤害、近战、负重',
       con: '血量、防御、渡劫、寿命',
       dex: '闪避、攻速、先手、逃跑',
       wis: '修炼速度、奇遇、Bug发现'
     };
 
     keys.forEach(function (k) {
       var row = document.createElement('div');
       row.className = 'attr-row';
       row.innerHTML =
         '<span class="attr-name">' + names[k] + '</span>' +
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
     var keys = ['str', 'con', 'dex', 'wis'];
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
     var total = attrValues.str + attrValues.con + attrValues.dex + attrValues.wis;
     var el = document.getElementById('attr-total');
     el.textContent = '总计: ' + total + (total === 100 ? ' ✓' : ' (需=100)');
     el.style.color = total === 100 ? '#090' : '#c00';
   }
 
   function confirmAttributes() {
     console.log('confirmAttributes called');
     var total = attrValues.str + attrValues.con + attrValues.dex + attrValues.wis;
     console.log('total:', total, 'attrValues:', JSON.stringify(attrValues));
     if (total !== 100) {
       appendMessage('[系统] 属性总和必须为100', 'error');
       return;
     }
     console.log('pendingPlayerId:', pendingPlayerId, 'selectedProfession:', selectedProfession ? selectedProfession.id : null);
     sendWS('select_profession', {
       playerId: pendingPlayerId,
       professionId: selectedProfession.id,
       stats: attrValues
     });
     appendMessage('[系统] 属性已确认，正在进入游戏...', 'system');
   }

  function enterGame(data) {
    gameState = 'game';
    $loginOverlay.classList.add('hidden');
    $professionOverlay.classList.add('hidden');
    $attrOverlay.classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    if (data && data.player) updateStatusFromPlayer(data.player);

    appendMessage('════════════════════════════════════════', 'system');
    appendMessage('  欢迎来到 赛博修仙 世界！', 'system');
    appendMessage('  你是一位60岁的退休老人，意识穿越到了武侠修仙游戏世界。', 'system');
    appendMessage('  输入 /帮助 查看可用指令（包括 /学习、/修炼 等）', 'system');
    appendMessage('  /丹药 炼丹/使用丹药 | /装备 查看/穿戴装备 | /任务 查看任务', 'system');
    appendMessage('  /商店 交易物品 | /签到 每日签到 | /好友 好友系统 | /奇遇 随机事件', 'system');
    appendMessage('════════════════════════════════════════', 'system');

    $chatInput.focus();
  }

  // Update status bar from player object
  function updateStatusFromPlayer(player) {
    if (!player) return;
    if (player.name) document.getElementById('player-name').textContent = player.name;
    if (player.realm) $statRealm.textContent = player.realm;
    if (player.level) document.getElementById('stat-level').textContent = player.level;
    if (player.hp !== undefined) $statHp.textContent = player.hp + '/' + player.maxHp;
    if (player.spirit !== undefined) $statSp.textContent = player.spirit + '/' + player.maxSpirit;
    if (player.stamina !== undefined) $statSt.textContent = player.stamina + '/' + player.maxStamina;
    if (player.silver !== undefined) $statSilver.textContent = player.silver;
    if (player.currentMap && player.currentRoom) {
      document.getElementById('current-location').textContent = player.currentMap + ' - ' + player.currentRoom;
    }
  }

  // Display room
  function displayRoom(room) {
    if (!room) return;
    var output = '\n═══════════════════════════════════════\n';
    output += '  ' + room.name + '\n';
    output += '═══════════════════════════════════════\n\n';
    output += '  ' + room.description + '\n\n';

    if (room.exits) {
      var exitNames = { north: '北', south: '南', east: '东', west: '西', up: '上', down: '下' };
      var exits = Object.keys(room.exits).map(function(e) { return exitNames[e] || e; }).join('、');
      output += '  出口: ' + exits + '\n';
    }

    if (room.npcs && room.npcs.length > 0) {
      output += '\n  NPC: ' + room.npcs.join('、') + '\n';
    }

    if (room.players && room.players.length > 0) {
      output += '\n  这里还有:\n';
      room.players.forEach(function(p) {
        output += '    ' + p.name + '\n';
      });
    }

    output += '\n═══════════════════════════════════════';
    appendMessage(output, 'room');

    // Update location in sidebar
    document.getElementById('current-location').textContent = room.name;
  }

  // ─── Event Bindings ───
  // Login form toggle
  document.getElementById('show-register').addEventListener('click', function () {
    $loginForm.classList.add('hidden');
    $registerForm.classList.remove('hidden');
  });
  document.getElementById('show-login').addEventListener('click', function () {
    $registerForm.classList.add('hidden');
    $loginForm.classList.remove('hidden');
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
       attrValues = { str: 25, con: 25, dex: 25, wis: 25 };
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
      sendWS('command', { command: cmd });
      appendMessage('> ' + cmd, 'self');
    } else {
      sendWS('chat', { message: cmd });
    }
  });

  // Prevent zoom on double-tap (mobile)
  document.addEventListener('touchend', function (e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'A') return;
    e.preventDefault();
  }, { passive: false });

  // ─── Init ───
  connectWS();

})();
