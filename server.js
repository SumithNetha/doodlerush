const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { getRandomWordChoices } = require('./words');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Netlify function emulator for local development
const netlifyGameHandler = require('./netlify/functions/game').handler;
app.all('/.netlify/functions/game', async (req, res) => {
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body)
  };
  const result = await netlifyGameHandler(event);
  res.status(result.statusCode).set(result.headers).send(result.body);
});

// Store active rooms
const rooms = new Map();

function generateRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

class Room {
  constructor(code, hostId, hostName, avatar) {
    this.code = code;
    this.hostId = hostId;
    this.settings = {
      rounds: 3,
      drawTime: 60,
    };
    this.state = 'LOBBY'; // LOBBY, CHOOSING, DRAWING, ROUND_END, GAME_OVER
    this.currentRound = 1;
    this.players = new Map(); // socketId -> player obj
    this.playerOrder = [];
    this.currentDrawerIndex = 0;
    this.currentWord = null;
    this.wordChoices = [];
    this.hints = [];
    this.drawHistory = [];
    this.correctGuessedSockets = new Set();
    this.timer = null;
    this.timeLeft = 0;
    this.usedWords = [];

    this.addPlayer(hostId, hostName, avatar, true);
  }

  addPlayer(socketId, name, avatar, isHost = false) {
    const player = {
      id: socketId,
      name: name.trim().slice(0, 16) || `Player-${socketId.slice(-4)}`,
      avatar: avatar || '🎨',
      score: 0,
      roundScore: 0,
      isHost: isHost,
      hasGuessed: false
    };
    this.players.set(socketId, player);
    if (!this.playerOrder.includes(socketId)) {
      this.playerOrder.push(socketId);
    }
    return player;
  }

  removePlayer(socketId) {
    const wasDrawer = this.getDrawerId() === socketId;
    const wasHost = this.hostId === socketId;

    this.players.delete(socketId);
    this.playerOrder = this.playerOrder.filter(id => id !== socketId);
    this.correctGuessedSockets.delete(socketId);

    if (this.players.size === 0) {
      this.destroy();
      return null;
    }

    if (wasHost && this.playerOrder.length > 0) {
      this.hostId = this.playerOrder[0];
      const newHost = this.players.get(this.hostId);
      if (newHost) newHost.isHost = true;
    }

    if (this.state === 'DRAWING' || this.state === 'CHOOSING') {
      if (wasDrawer) {
        clearInterval(this.timer);
        this.broadcastSystemMessage(`The drawer disconnected! Skipping to next turn.`);
        this.nextTurn();
      } else {
        this.checkAllGuessed();
      }
    }

    return this.hostId;
  }

  getDrawerId() {
    if (this.playerOrder.length === 0) return null;
    return this.playerOrder[this.currentDrawerIndex % this.playerOrder.length];
  }

  getDrawer() {
    const id = this.getDrawerId();
    return id ? this.players.get(id) : null;
  }

  getPublicPlayersList() {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      roundScore: p.roundScore,
      isHost: p.id === this.hostId,
      hasGuessed: this.correctGuessedSockets.has(p.id)
    })).sort((a, b) => b.score - a.score);
  }

  startGame(settings = {}) {
    if (this.players.size < 2 && process.env.NODE_ENV === 'production') {
      return { error: 'Need at least 2 players to start!' };
    }
    this.settings.rounds = Number(settings.rounds) || 3;
    this.settings.drawTime = Number(settings.drawTime) || 60;
    this.currentRound = 1;
    this.currentDrawerIndex = 0;
    this.usedWords = [];
    for (const p of this.players.values()) {
      p.score = 0;
      p.roundScore = 0;
    }
    this.startTurn();
    return { success: true };
  }

  startTurn() {
    this.state = 'CHOOSING';
    this.drawHistory = [];
    this.correctGuessedSockets.clear();
    for (const p of this.players.values()) {
      p.roundScore = 0;
      p.hasGuessed = false;
    }

    const drawer = this.getDrawer();
    if (!drawer) {
      this.endGame();
      return;
    }

    this.wordChoices = getRandomWordChoices(3, this.usedWords);
    this.timeLeft = 15;

    io.to(this.code).emit('round_prepare', {
      round: this.currentRound,
      maxRounds: this.settings.rounds,
      drawer: {
        id: drawer.id,
        name: drawer.name,
        avatar: drawer.avatar
      },
      duration: this.timeLeft
    });

    // Send word choices ONLY to the drawer
    io.to(drawer.id).emit('word_choices', {
      choices: this.wordChoices
    });

    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.timeLeft--;
      io.to(this.code).emit('timer_tick', { timeLeft: this.timeLeft, phase: 'CHOOSING' });

      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        // Default to first word choice if drawer didn't pick
        this.selectWord(this.wordChoices[0].word);
      }
    }, 1000);
  }

  selectWord(selectedWord) {
    if (this.state !== 'CHOOSING') return;
    this.currentWord = selectedWord.toLowerCase().trim();
    this.usedWords.push(this.currentWord);
    this.state = 'DRAWING';
    this.timeLeft = this.settings.drawTime;

    const drawer = this.getDrawer();

    // Prepare masked hint for guessers (e.g., "_ _ _ _" or preserve spaces/dashes)
    const wordPattern = this.currentWord.split('').map(ch => (ch === ' ' ? ' ' : ch === '-' ? '-' : '_')).join(' ');

    // Tell drawer their word
    io.to(drawer.id).emit('drawing_started', {
      isDrawer: true,
      word: this.currentWord,
      duration: this.timeLeft,
      round: this.currentRound,
      maxRounds: this.settings.rounds
    });

    // Tell all guessers the masked hint and word length
    for (const [sId, p] of this.players.entries()) {
      if (sId !== drawer.id) {
        io.to(sId).emit('drawing_started', {
          isDrawer: false,
          pattern: wordPattern,
          wordLength: this.currentWord.length,
          drawerName: drawer.name,
          duration: this.timeLeft,
          round: this.currentRound,
          maxRounds: this.settings.rounds
        });
      }
    }

    io.to(this.code).emit('players_update', this.getPublicPlayersList());

    // Setup periodic hints (e.g. reveal one random letter when 50% time left, another at 25%)
    const hintTimes = [
      Math.floor(this.settings.drawTime * 0.5),
      Math.floor(this.settings.drawTime * 0.25)
    ];
    let revealedIndexes = [];

    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.timeLeft--;
      io.to(this.code).emit('timer_tick', { timeLeft: this.timeLeft, phase: 'DRAWING' });

      // Provide letter hints as time ticks down
      if (hintTimes.includes(this.timeLeft) && this.currentWord.length > 3) {
        const unrevealed = [];
        for (let i = 0; i < this.currentWord.length; i++) {
          if (this.currentWord[i] !== ' ' && !revealedIndexes.includes(i)) {
            unrevealed.push(i);
          }
        }
        if (unrevealed.length > 1) {
          const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
          revealedIndexes.push(pick);

          const hintPattern = this.currentWord.split('').map((ch, idx) => {
            if (ch === ' ' || ch === '-') return ch;
            if (revealedIndexes.includes(idx)) return ch;
            return '_';
          }).join(' ');

          for (const [sId] of this.players.entries()) {
            if (sId !== drawer.id && !this.correctGuessedSockets.has(sId)) {
              io.to(sId).emit('hint_revealed', { pattern: hintPattern });
            }
          }
        }
      }

      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.endTurn(false);
      }
    }, 1000);
  }

  handleGuess(socketId, text) {
    const player = this.players.get(socketId);
    if (!player || this.state !== 'DRAWING') return;

    const drawer = this.getDrawer();
    if (socketId === drawer.id) {
      // Drawer cannot guess
      return;
    }

    const cleanGuess = text.trim().toLowerCase();

    // If player already guessed, broadcast chat only to drawer & players who also guessed
    if (this.correctGuessedSockets.has(socketId)) {
      this.sendGuessedOnlyChat(player, text);
      return;
    }

    // Check if correct guess
    if (cleanGuess === this.currentWord) {
      this.correctGuessedSockets.add(socketId);
      player.hasGuessed = true;

      // Calculate score based on speed
      const timeRatio = Math.max(0.2, this.timeLeft / this.settings.drawTime);
      const points = Math.round(150 + timeRatio * 350);
      player.score += points;
      player.roundScore = points;

      // Reward drawer for good drawing
      const drawerBonus = Math.round(50 + (points * 0.2));
      drawer.score += drawerBonus;
      drawer.roundScore += drawerBonus;

      // Tell the guesser the full word
      io.to(socketId).emit('correct_guess_self', {
        word: this.currentWord,
        points: points
      });

      // Announce to everyone else that player guessed the word (without revealing word!)
      io.to(this.code).emit('player_guessed', {
        playerId: socketId,
        playerName: player.name,
        points: points
      });

      io.to(this.code).emit('players_update', this.getPublicPlayersList());

      this.checkAllGuessed();
    } else {
      // Check for close guess (Levenshtein distance == 1)
      if (this.currentWord.length >= 4 && levenshteinDistance(cleanGuess, this.currentWord) === 1) {
        io.to(socketId).emit('close_guess', { guess: text });
      }

      // Normal chat message
      io.to(this.code).emit('chat_message', {
        id: socketId,
        sender: player.name,
        avatar: player.avatar,
        text: text,
        type: 'normal'
      });
    }
  }

  sendGuessedOnlyChat(player, text) {
    const drawerId = this.getDrawerId();
    for (const [sId] of this.players.entries()) {
      if (sId === drawerId || this.correctGuessedSockets.has(sId)) {
        io.to(sId).emit('chat_message', {
          id: player.id,
          sender: player.name,
          avatar: player.avatar,
          text: text,
          type: 'guessed_only'
        });
      }
    }
  }

  checkAllGuessed() {
    // Number of guessers is total players minus 1 (the drawer)
    const totalGuessers = Math.max(1, this.players.size - 1);
    if (this.correctGuessedSockets.size >= totalGuessers) {
      clearInterval(this.timer);
      this.endTurn(true);
    }
  }

  endTurn(allGuessed = false) {
    this.state = 'ROUND_END';
    clearInterval(this.timer);

    io.to(this.code).emit('turn_end', {
      word: this.currentWord,
      allGuessed: allGuessed,
      players: this.getPublicPlayersList()
    });

    // 5 seconds pause to view the revealed word and scores
    setTimeout(() => {
      this.nextTurn();
    }, 5000);
  }

  nextTurn() {
    this.currentDrawerIndex++;

    // If all players have had a turn to draw, advance round
    if (this.currentDrawerIndex >= this.playerOrder.length) {
      this.currentDrawerIndex = 0;
      this.currentRound++;
    }

    if (this.currentRound > this.settings.rounds) {
      this.endGame();
    } else {
      this.startTurn();
    }
  }

  endGame() {
    this.state = 'GAME_OVER';
    clearInterval(this.timer);

    const podium = this.getPublicPlayersList();

    io.to(this.code).emit('game_over', {
      podium: podium
    });
  }

  broadcastSystemMessage(text) {
    io.to(this.code).emit('chat_message', {
      sender: 'System',
      avatar: '📢',
      text: text,
      type: 'system'
    });
  }

  destroy() {
    clearInterval(this.timer);
    rooms.delete(this.code);
  }
}

// Socket IO Event Listeners
io.on('connection', (socket) => {
  let userRoomCode = null;

  socket.on('create_room', ({ name, avatar, rounds, drawTime }, callback) => {
    const code = generateRoomCode();
    const room = new Room(code, socket.id, name, avatar);
    if (rounds) room.settings.rounds = Number(rounds);
    if (drawTime) room.settings.drawTime = Number(drawTime);

    rooms.set(code, room);
    socket.join(code);
    userRoomCode = code;

    callback({
      success: true,
      code: code,
      player: room.players.get(socket.id),
      roomSettings: room.settings
    });

    io.to(code).emit('players_update', room.getPublicPlayersList());
  });

  socket.on('join_room', ({ code, name, avatar }, callback) => {
    const cleanCode = (code || '').toUpperCase().trim();
    const room = rooms.get(cleanCode);

    if (!room) {
      return callback({ error: 'Room not found! Check the room code.' });
    }

    if (room.state !== 'LOBBY' && room.state !== 'ROUND_END') {
      return callback({ error: 'Game is currently in progress. Please wait for the next game or join a new room.' });
    }

    const player = room.addPlayer(socket.id, name, avatar);
    socket.join(cleanCode);
    userRoomCode = cleanCode;

    callback({
      success: true,
      code: cleanCode,
      player: player,
      state: room.state,
      roomSettings: room.settings
    });

    io.to(cleanCode).emit('players_update', room.getPublicPlayersList());
    room.broadcastSystemMessage(`${player.name} joined the room!`);
  });

  socket.on('start_game', (settings) => {
    const room = rooms.get(userRoomCode);
    if (!room || room.hostId !== socket.id) return;
    room.startGame(settings);
  });

  socket.on('choose_word', ({ word }) => {
    const room = rooms.get(userRoomCode);
    if (!room || room.getDrawerId() !== socket.id) return;
    room.selectWord(word);
  });

  socket.on('send_guess', ({ text }) => {
    const room = rooms.get(userRoomCode);
    if (!room || !text) return;
    room.handleGuess(socket.id, text);
  });

  // Canvas drawing events
  socket.on('draw_stroke', (strokeData) => {
    const room = rooms.get(userRoomCode);
    if (!room || room.state !== 'DRAWING' || room.getDrawerId() !== socket.id) return;

    room.drawHistory.push(strokeData);
    // Broadcast immediately to everyone else in room
    socket.to(userRoomCode).emit('draw_stroke', strokeData);
  });

  socket.on('clear_canvas', () => {
    const room = rooms.get(userRoomCode);
    if (!room || room.state !== 'DRAWING' || room.getDrawerId() !== socket.id) return;

    room.drawHistory = [];
    socket.to(userRoomCode).emit('clear_canvas');
  });

  socket.on('undo_stroke', () => {
    const room = rooms.get(userRoomCode);
    if (!room || room.state !== 'DRAWING' || room.getDrawerId() !== socket.id) return;

    if (room.drawHistory.length > 0) {
      room.drawHistory.pop();
      io.to(userRoomCode).emit('redraw_canvas', { history: room.drawHistory });
    }
  });

  socket.on('flood_fill', (fillData) => {
    const room = rooms.get(userRoomCode);
    if (!room || room.state !== 'DRAWING' || room.getDrawerId() !== socket.id) return;

    room.drawHistory.push({ type: 'fill', ...fillData });
    socket.to(userRoomCode).emit('flood_fill', fillData);
  });

  socket.on('request_canvas_sync', () => {
    const room = rooms.get(userRoomCode);
    if (!room) return;
    socket.emit('redraw_canvas', { history: room.drawHistory });
  });

  socket.on('play_again', () => {
    const room = rooms.get(userRoomCode);
    if (!room || room.hostId !== socket.id) return;
    room.state = 'LOBBY';
    room.drawHistory = [];
    room.correctGuessedSockets.clear();
    for (const p of room.players.values()) {
      p.score = 0;
      p.roundScore = 0;
      p.hasGuessed = false;
    }
    io.to(userRoomCode).emit('return_to_lobby', {
      players: room.getPublicPlayersList(),
      roomSettings: room.settings
    });
  });

  socket.on('disconnect', () => {
    if (userRoomCode) {
      const room = rooms.get(userRoomCode);
      if (room) {
        const player = room.players.get(socket.id);
        const playerName = player ? player.name : 'A player';
        const newHostId = room.removePlayer(socket.id);

        if (rooms.has(userRoomCode)) {
          io.to(userRoomCode).emit('players_update', room.getPublicPlayersList());
          room.broadcastSystemMessage(`${playerName} left the game.`);
          if (newHostId) {
            const hostPlayer = room.players.get(newHostId);
            if (hostPlayer) {
              room.broadcastSystemMessage(`${hostPlayer.name} is now the host!`);
            }
          }
        }
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 DoodleRush server running on http://localhost:${PORT}`);
});
