// Main client game logic and socket connection
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // State
  let currentRoom = null;
  let currentUser = null;
  let isDrawer = false;
  let myScore = 0;
  let drawingEngine = null;

  // DOM Elements
  const screens = {
    auth: document.getElementById('screen-auth'),
    lobby: document.getElementById('screen-lobby'),
    game: document.getElementById('screen-game')
  };

  const nicknameInput = document.getElementById('nickname-input');
  const avatarGrid = document.getElementById('avatar-grid');
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const roomCodeInput = document.getElementById('room-code-input');
  const roundsSelect = document.getElementById('rounds-select');
  const drawTimeSelect = document.getElementById('draw-time-select');

  // Lobby elements
  const lobbyRoomCode = document.getElementById('lobby-room-code');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnShowQr = document.getElementById('btn-show-qr');
  const lobbyPlayersList = document.getElementById('lobby-players-list');
  const btnStartGame = document.getElementById('btn-start-game');
  const lobbyWaitingMsg = document.getElementById('lobby-waiting-msg');

  // Game elements
  const roundDisplay = document.getElementById('round-display');
  const timerDisplay = document.getElementById('timer-display');
  const timerCircle = document.getElementById('timer-circle');
  const wordDisplay = document.getElementById('word-display');
  const canvasElement = document.getElementById('drawing-canvas');
  const drawerControls = document.getElementById('drawer-controls');
  const gamePlayersList = document.getElementById('game-players-list');
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const btnMute = document.getElementById('btn-mute');

  // Modals & Overlays
  const modalWordChoice = document.getElementById('modal-word-choice');
  const wordChoicesContainer = document.getElementById('word-choices-container');
  const modalTurnEnd = document.getElementById('modal-turn-end');
  const turnEndWord = document.getElementById('turn-end-word');
  const modalGameOver = document.getElementById('modal-game-over');
  const podiumContainer = document.getElementById('podium-container');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const modalQr = document.getElementById('modal-qr');
  const qrCanvas = document.getElementById('qr-canvas');
  const btnCloseQr = document.getElementById('btn-close-qr');
  const closeNotification = document.getElementById('close-notification');

  // Initialize Avatar Selection
  const avatars = ['🦊', '🐱', '🐼', '🦁', '🐸', '🦄', '🤖', '🚀', '🎨', '🍕', '⚡', '👑'];
  let selectedAvatar = localStorage.getItem('doodlerush_avatar') || avatars[0];

  function renderAvatars() {
    avatarGrid.innerHTML = '';
    avatars.forEach(av => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `avatar-option ${av === selectedAvatar ? 'active' : ''}`;
      btn.textContent = av;
      btn.addEventListener('click', () => {
        selectedAvatar = av;
        localStorage.setItem('doodlerush_avatar', av);
        renderAvatars();
        window.sounds.playPop();
      });
      avatarGrid.appendChild(btn);
    });
  }
  renderAvatars();

  // Restore cached name or query params
  const cachedName = localStorage.getItem('doodlerush_name');
  if (cachedName) nicknameInput.value = cachedName;

  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    roomCodeInput.value = roomParam.toUpperCase().trim();
  }

  // Audio Toggle
  function updateMuteButton() {
    btnMute.innerHTML = window.sounds.muted
      ? '<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
      : '<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
  }
  btnMute.addEventListener('click', () => {
    window.sounds.toggleMute();
    updateMuteButton();
  });
  updateMuteButton();

  // Screen Switcher
  function switchScreen(screenName) {
    Object.keys(screens).forEach(key => {
      screens[key].classList.remove('active');
    });
    screens[screenName].classList.add('active');
  }

  // Initialize Canvas Drawing Engine
  drawingEngine = new window.DrawingEngine(
    canvasElement,
    (strokeData) => socket.emit('draw_stroke', strokeData),
    (fillData) => socket.emit('flood_fill', fillData),
    () => socket.emit('clear_canvas'),
    () => socket.emit('undo_stroke')
  );

  // Setup Palette & Toolbar Controls
  const colors = [
    '#111827', '#ffffff', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
    '#8b5cf6', '#ec4899', '#78350f', '#64748b'
  ];
  const paletteContainer = document.getElementById('palette-container');
  const customColorPicker = document.getElementById('custom-color-picker');

  colors.forEach((col, idx) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = `color-swatch ${idx === 0 ? 'active' : ''}`;
    swatch.style.backgroundColor = col;
    swatch.setAttribute('data-color', col);
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      drawingEngine.setColor(col);
      if (drawingEngine.tool === 'eraser') {
        selectTool('brush');
      }
      window.sounds.playPop();
    });
    paletteContainer.appendChild(swatch);
  });

  customColorPicker.addEventListener('input', (e) => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    drawingEngine.setColor(e.target.value);
    if (drawingEngine.tool === 'eraser') selectTool('brush');
  });

  function selectTool(toolName) {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === toolName);
    });
    drawingEngine.setTool(toolName);
    window.sounds.playPop();
  }

  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectTool(btn.getAttribute('data-tool'));
    });
  });

  const brushSizes = document.querySelectorAll('.size-btn');
  brushSizes.forEach(btn => {
    btn.addEventListener('click', () => {
      brushSizes.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawingEngine.setSize(btn.getAttribute('data-size'));
      window.sounds.playPop();
    });
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    if (!isDrawer) return;
    socket.emit('undo_stroke');
    window.sounds.playPop();
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!isDrawer) return;
    drawingEngine.clearLocal(true);
    window.sounds.playPop();
  });

  // Keyboard Shortcuts for drawer
  window.addEventListener('keydown', (e) => {
    if (!isDrawer || document.activeElement === chatInput) return;
    const key = e.key.toLowerCase();
    if (key === 'b') selectTool('brush');
    if (key === 'e') selectTool('eraser');
    if (key === 'f') selectTool('fill');
    if (key === 'z' && (e.ctrlKey || e.metaKey)) socket.emit('undo_stroke');
    if (key === 'c') {
      drawingEngine.clearLocal(true);
      window.sounds.playPop();
    }
  });

  // Room Creation
  btnCreateRoom.addEventListener('click', () => {
    const name = nicknameInput.value.trim() || 'Player';
    localStorage.setItem('doodlerush_name', name);
    window.sounds.playSelect();

    socket.emit('create_room', {
      name: name,
      avatar: selectedAvatar,
      rounds: roundsSelect.value,
      drawTime: drawTimeSelect.value
    }, (res) => {
      if (res.success) {
        currentRoom = res.code;
        currentUser = res.player;
        setupLobbyView(res.code, true);
        switchScreen('lobby');
      }
    });
  });

  // Room Joining
  btnJoinRoom.addEventListener('click', () => {
    const name = nicknameInput.value.trim() || 'Player';
    const code = roomCodeInput.value.trim().toUpperCase();

    if (!code) {
      alert('Please enter a 4-letter room code!');
      return;
    }

    localStorage.setItem('doodlerush_name', name);
    window.sounds.playSelect();

    socket.emit('join_room', {
      code: code,
      name: name,
      avatar: selectedAvatar
    }, (res) => {
      if (res.error) {
        alert(res.error);
        return;
      }
      currentRoom = res.code;
      currentUser = res.player;
      setupLobbyView(res.code, res.player.isHost);
      switchScreen('lobby');
    });
  });

  function setupLobbyView(code, isHost) {
    lobbyRoomCode.textContent = code;
    if (isHost) {
      btnStartGame.style.display = 'block';
      lobbyWaitingMsg.style.display = 'none';
    } else {
      btnStartGame.style.display = 'none';
      lobbyWaitingMsg.style.display = 'block';
    }

    // Update URL history for seamless bookmarking/sharing
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
    window.history.replaceState({ room: code }, '', newUrl);
  }

  // Copy Invite Link
  btnCopyLink.addEventListener('click', () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoom}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      btnCopyLink.textContent = '✓ Copied Link!';
      setTimeout(() => btnCopyLink.textContent = '🔗 Copy Invite Link', 2000);
      window.sounds.playPop();
    }).catch(() => {
      prompt('Copy this link to invite players:', inviteUrl);
    });
  });

  // QR Code generator
  btnShowQr.addEventListener('click', () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoom}`;
    if (window.QRCode) {
      modalQr.classList.add('active');
      const container = document.getElementById('qr-container');
      container.innerHTML = '';
      new window.QRCode(container, {
        text: inviteUrl,
        width: 220,
        height: 220,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }
  });

  btnCloseQr.addEventListener('click', () => {
    modalQr.classList.remove('active');
  });

  // Host starts game
  btnStartGame.addEventListener('click', () => {
    window.sounds.playSelect();
    socket.emit('start_game', {
      rounds: roundsSelect.value,
      drawTime: drawTimeSelect.value
    });
  });

  // Chat / Guess Submission
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    socket.emit('send_guess', { text: text });
    chatInput.value = '';
  });

  // Socket Events
  socket.on('players_update', (players) => {
    updatePlayersLists(players);
  });

  function updatePlayersLists(players) {
    // Lobby view
    lobbyPlayersList.innerHTML = '';
    players.forEach(p => {
      const card = document.createElement('div');
      card.className = `player-card ${p.id === socket.id ? 'self' : ''}`;
      card.innerHTML = `
        <span class="p-avatar">${p.avatar}</span>
        <div class="p-info">
          <div class="p-name">${p.name} ${p.isHost ? '<span class="crown-badge">👑 Host</span>' : ''}</div>
          <div class="p-status">${p.id === socket.id ? '(You)' : 'Ready'}</div>
        </div>
      `;
      lobbyPlayersList.appendChild(card);
    });

    // Game view leaderboard
    gamePlayersList.innerHTML = '';
    players.forEach((p, rank) => {
      const row = document.createElement('div');
      row.className = `game-player-row ${p.id === socket.id ? 'self' : ''} ${p.hasGuessed ? 'guessed' : ''}`;
      row.innerHTML = `
        <span class="gp-rank">#${rank + 1}</span>
        <span class="gp-avatar">${p.avatar}</span>
        <div class="gp-info">
          <div class="gp-name">${p.name} ${p.isHost ? '👑' : ''}</div>
          <div class="gp-score">${p.score} pts</div>
        </div>
        ${p.hasGuessed ? '<span class="guess-badge">✓</span>' : ''}
      `;
      gamePlayersList.appendChild(row);
    });
  }

  socket.on('round_prepare', ({ round, maxRounds, drawer, duration }) => {
    switchScreen('game');
    modalTurnEnd.classList.remove('active');
    modalGameOver.classList.remove('active');

    roundDisplay.textContent = `Round ${round} of ${maxRounds}`;
    isDrawer = (drawer.id === socket.id);
    drawingEngine.setDrawer(false); // Locked until word chosen
    drawingEngine.clearLocal(false);

    if (isDrawer) {
      drawerControls.style.display = 'flex';
      wordDisplay.innerHTML = `<span class="drawer-notice">🎨 Your turn to draw! Pick a word...</span>`;
    } else {
      drawerControls.style.display = 'none';
      wordDisplay.innerHTML = `<span class="waiting-notice">${drawer.avatar} <b>${drawer.name}</b> is choosing a word...</span>`;
    }
  });

  socket.on('word_choices', ({ choices }) => {
    modalWordChoice.classList.add('active');
    wordChoicesContainer.innerHTML = '';

    choices.forEach(c => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'word-choice-card';
      card.innerHTML = `
        <span class="wc-word">${c.word}</span>
        <span class="wc-meta">${c.category} • <span class="wc-diff ${c.difficulty}">${c.difficulty}</span></span>
      `;
      card.addEventListener('click', () => {
        window.sounds.playSelect();
        modalWordChoice.classList.remove('active');
        socket.emit('choose_word', { word: c.word });
      });
      wordChoicesContainer.appendChild(card);
    });
  });

  socket.on('drawing_started', (data) => {
    modalWordChoice.classList.remove('active');
    window.sounds.playRoundStart();

    if (data.isDrawer) {
      isDrawer = true;
      drawingEngine.setDrawer(true);
      wordDisplay.innerHTML = `Word to draw: <span class="revealed-word">${data.word.toUpperCase()}</span>`;
      chatInput.disabled = true;
      chatInput.placeholder = "You are drawing! Watch others guess...";
    } else {
      isDrawer = false;
      drawingEngine.setDrawer(false);
      chatInput.disabled = false;
      chatInput.placeholder = "Type your guess here...";
      renderWordPattern(data.pattern);
    }
  });

  function renderWordPattern(pattern) {
    wordDisplay.innerHTML = pattern.split(' ').map(ch => {
      if (ch === '_') return `<span class="letter-blank"></span>`;
      if (ch === ' ') return `<span class="word-space"></span>`;
      return `<span class="letter-hint">${ch.toUpperCase()}</span>`;
    }).join('');
  }

  socket.on('hint_revealed', ({ pattern }) => {
    if (!isDrawer) {
      renderWordPattern(pattern);
      window.sounds.playTone(550, 'sine', 0.1, 0.08);
    }
  });

  socket.on('timer_tick', ({ timeLeft, phase }) => {
    timerDisplay.textContent = timeLeft;
    if (timeLeft <= 5 && phase === 'DRAWING') {
      window.sounds.playTick();
      timerDisplay.classList.add('pulse-warning');
    } else {
      timerDisplay.classList.remove('pulse-warning');
    }
  });

  socket.on('close_guess', ({ guess }) => {
    window.sounds.playCloseGuess();
    closeNotification.textContent = `🔥 "${guess}" is so close!`;
    closeNotification.classList.add('show');
    setTimeout(() => {
      closeNotification.classList.remove('show');
    }, 2500);
  });

  socket.on('correct_guess_self', ({ word, points }) => {
    window.sounds.playCorrectGuess();
    wordDisplay.innerHTML = `You guessed it! <span class="revealed-word-success">${word.toUpperCase()} (+${points} pts)</span>`;
    chatInput.placeholder = "You guessed correctly! Chat with other winners...";
  });

  socket.on('player_guessed', ({ playerName, points }) => {
    window.sounds.playTone(700, 'sine', 0.15, 0.1);
    appendChatMessage({
      sender: '🎉 Game',
      avatar: '⭐',
      text: `${playerName} guessed the word! (+${points} pts)`,
      type: 'correct'
    });
  });

  socket.on('turn_end', ({ word, allGuessed, players }) => {
    window.sounds.playTurnEnd();
    isDrawer = false;
    drawingEngine.setDrawer(false);
    turnEndWord.textContent = word.toUpperCase();
    modalTurnEnd.classList.add('active');

    if (allGuessed && window.confetti) {
      window.confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
  });

  socket.on('game_over', ({ podium }) => {
    window.sounds.playGameOver();
    modalTurnEnd.classList.remove('active');
    modalGameOver.classList.add('active');

    if (window.confetti) {
      window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    }

    podiumContainer.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    podium.slice(0, 3).forEach((p, idx) => {
      const stand = document.createElement('div');
      stand.className = `podium-stand rank-${idx + 1}`;
      stand.innerHTML = `
        <div class="podium-avatar">${p.avatar}</div>
        <div class="podium-name">${p.name}</div>
        <div class="podium-score">${p.score} pts</div>
        <div class="podium-block">${medals[idx]}</div>
      `;
      podiumContainer.appendChild(stand);
    });
  });

  btnPlayAgain.addEventListener('click', () => {
    socket.emit('play_again');
  });

  socket.on('return_to_lobby', ({ players }) => {
    modalGameOver.classList.remove('active');
    modalTurnEnd.classList.remove('active');
    switchScreen('lobby');
    updatePlayersLists(players);
  });

  // Canvas stroke sync
  socket.on('draw_stroke', (strokeData) => {
    drawingEngine.renderStroke(strokeData);
  });

  socket.on('flood_fill', (fillData) => {
    const x = Math.round(fillData.nx * drawingEngine.INTERNAL_WIDTH);
    const y = Math.round(fillData.ny * drawingEngine.INTERNAL_HEIGHT);
    drawingEngine.floodFill(x, y, fillData.color);
  });

  socket.on('clear_canvas', () => {
    drawingEngine.clearLocal(false);
  });

  socket.on('redraw_canvas', ({ history }) => {
    drawingEngine.redrawHistory(history);
  });

  // Chat message rendering
  socket.on('chat_message', (msg) => {
    appendChatMessage(msg);
  });

  function appendChatMessage(msg) {
    const row = document.createElement('div');
    row.className = `chat-row ${msg.type || 'normal'}`;

    if (msg.type === 'system') {
      row.innerHTML = `<span class="chat-system">${msg.text}</span>`;
    } else if (msg.type === 'correct') {
      row.innerHTML = `<span class="chat-correct">${msg.text}</span>`;
    } else {
      row.innerHTML = `
        <span class="chat-author">${msg.avatar || '👤'} ${msg.sender}:</span>
        <span class="chat-text ${msg.type === 'guessed_only' ? 'guessed-text' : ''}">${escapeHTML(msg.text)}</span>
      `;
    }

    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
});
