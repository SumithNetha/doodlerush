// Pure JavaScript version of Netlify Function for instant execution without build step
const { getRandomWordChoices } = require('../../words');

let getStore = null;
try {
  getStore = require('@netlify/blobs').getStore;
} catch (e) {
  // safe fallback
}

const localMemoryStore = new Map();

async function getRoomStore() {
  if (!getStore) return null;
  try {
    return getStore({
      name: 'game-rooms',
      consistency: 'strong'
    });
  } catch (e) {
    return null;
  }
}

async function loadRoom(code) {
  const store = await getRoomStore();
  if (store) {
    try {
      const data = await store.get(code, { type: 'json' });
      if (data) return data;
    } catch (e) {
      // fallback
    }
  }
  return localMemoryStore.get(code) || null;
}

async function saveRoom(code, room) {
  room.lastUpdate = Date.now();
  room.version = (room.version || 0) + 1;

  const store = await getRoomStore();
  if (store) {
    try {
      await store.setJSON(code, room);
    } catch (e) {
      // fallback
    }
  }
  localMemoryStore.set(code, room);
}

function generateRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
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

function generateMaskedPattern(word, revealedIndices = []) {
  return word.split('').map((ch, idx) => {
    if (ch === ' ' || ch === '-') return ch;
    if (revealedIndices.includes(idx)) return ch;
    return '_';
  }).join(' ');
}

function updateRoomTimerState(room) {
  const now = Date.now();

  if (room.state === 'CHOOSING') {
    if (now >= room.turnEndTime) {
      const autoWord = (room.wordChoices && room.wordChoices[0]) ? room.wordChoices[0].word : 'star';
      startDrawingPhase(room, autoWord);
    }
  } else if (room.state === 'DRAWING') {
    const totalTime = room.settings.drawTime * 1000;
    const timeLeft = Math.max(0, room.turnEndTime - now);
    const timeRatio = timeLeft / totalTime;

    if (room.currentWord && room.currentWord.length > 3) {
      if (timeRatio <= 0.5 && (!room.revealedIndices || room.revealedIndices.length === 0)) {
        revealRandomLetter(room);
      } else if (timeRatio <= 0.25 && room.revealedIndices && room.revealedIndices.length === 1) {
        revealRandomLetter(room);
      }
    }

    if (now >= room.turnEndTime) {
      endTurnPhase(room, false);
    }
  } else if (room.state === 'ROUND_END') {
    if (now >= room.intermissionEndTime) {
      advanceToNextTurn(room);
    }
  }
}

function revealRandomLetter(room) {
  if (!room.revealedIndices) room.revealedIndices = [];
  const unrevealed = [];
  for (let i = 0; i < room.currentWord.length; i++) {
    if (room.currentWord[i] !== ' ' && !room.revealedIndices.includes(i)) {
      unrevealed.push(i);
    }
  }
  if (unrevealed.length > 1) {
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    room.revealedIndices.push(pick);
  }
}

function startDrawingPhase(room, word) {
  room.currentWord = word.toLowerCase().trim();
  room.state = 'DRAWING';
  room.turnStartTime = Date.now();
  room.turnEndTime = Date.now() + (room.settings.drawTime * 1000);
  room.revealedIndices = [];
  room.drawHistory = [];
  room.correctGuessed = [];
  for (const p of room.players) {
    p.hasGuessed = false;
    p.roundScore = 0;
  }
}

function endTurnPhase(room, allGuessed) {
  room.state = 'ROUND_END';
  room.intermissionEndTime = Date.now() + 5000;
  room.allGuessed = allGuessed;
  room.chat.push({
    sender: '📢 Game',
    avatar: '⭐',
    text: `Round ended! The secret word was: "${room.currentWord.toUpperCase()}".`,
    type: 'system',
    timestamp: Date.now()
  });
}

function advanceToNextTurn(room) {
  room.currentDrawerIndex = (room.currentDrawerIndex || 0) + 1;

  if (room.currentDrawerIndex >= room.players.length) {
    room.currentDrawerIndex = 0;
    room.currentRound++;
  }

  if (room.currentRound > room.settings.rounds) {
    room.state = 'GAME_OVER';
    room.chat.push({
      sender: '🎉 Game',
      avatar: '🏆',
      text: `Game over! Check the podium for final rankings!`,
      type: 'system',
      timestamp: Date.now()
    });
  } else {
    prepareTurnPhase(room);
  }
}

function prepareTurnPhase(room) {
  room.state = 'CHOOSING';
  room.turnStartTime = Date.now();
  room.turnEndTime = Date.now() + 15000;
  room.wordChoices = getRandomWordChoices(3, room.usedWords || []);
  room.drawHistory = [];
  room.correctGuessed = [];
  room.revealedIndices = [];
  for (const p of room.players) {
    p.hasGuessed = false;
    p.roundScore = 0;
  }

  const drawer = room.players[room.currentDrawerIndex % room.players.length];
  room.chat.push({
    sender: '🎨 Game',
    avatar: '✏️',
    text: `${drawer.name} is choosing a word for Round ${room.currentRound}!`,
    type: 'system',
    timestamp: Date.now()
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { action, code, playerId } = payload;

    if (action === 'create_room') {
      const roomCode = generateRoomCode();
      const newPlayerId = 'p_' + Math.random().toString(36).substring(2, 9);
      const newPlayer = {
        id: newPlayerId,
        name: (payload.name || 'Host').trim().slice(0, 16),
        avatar: payload.avatar || '🦊',
        score: 0,
        roundScore: 0,
        isHost: true,
        hasGuessed: false,
        lastSeen: Date.now()
      };

      const room = {
        code: roomCode,
        state: 'LOBBY',
        settings: {
          rounds: Number(payload.rounds) || 3,
          drawTime: Number(payload.drawTime) || 60
        },
        currentRound: 1,
        currentDrawerIndex: 0,
        players: [newPlayer],
        drawHistory: [],
        chat: [{
          sender: '📢 System',
          avatar: '🎮',
          text: `Room created! Room code: ${roomCode}`,
          type: 'system',
          timestamp: Date.now()
        }],
        usedWords: [],
        version: 1
      };

      await saveRoom(roomCode, room);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          code: roomCode,
          playerId: newPlayerId,
          player: newPlayer,
          roomSettings: room.settings
        })
      };
    }

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Room code is required' })
      };
    }

    const room = await loadRoom(code.toUpperCase());
    if (!room) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Room not found! Check code.' })
      };
    }

    if (action === 'join_room') {
      if (room.state !== 'LOBBY' && room.state !== 'ROUND_END') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Game is in progress. Wait for next round.' })
        };
      }

      const newPlayerId = 'p_' + Math.random().toString(36).substring(2, 9);
      const newPlayer = {
        id: newPlayerId,
        name: (payload.name || 'Player').trim().slice(0, 16),
        avatar: payload.avatar || '🎨',
        score: 0,
        roundScore: 0,
        isHost: false,
        hasGuessed: false,
        lastSeen: Date.now()
      };

      room.players.push(newPlayer);
      room.chat.push({
        sender: '📢 System',
        avatar: '👋',
        text: `${newPlayer.name} joined the room!`,
        type: 'system',
        timestamp: Date.now()
      });

      await saveRoom(code, room);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          code: room.code,
          playerId: newPlayerId,
          player: newPlayer,
          roomSettings: room.settings
        })
      };
    }

    if (action === 'start_game') {
      const player = room.players.find(p => p.id === playerId);
      if (!player || !player.isHost) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only the host can start the game!' }) };
      }

      room.currentRound = 1;
      room.currentDrawerIndex = 0;
      room.usedWords = [];
      for (const p of room.players) {
        p.score = 0;
        p.roundScore = 0;
      }

      prepareTurnPhase(room);
      await saveRoom(code, room);

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'choose_word') {
      const currentDrawer = room.players[room.currentDrawerIndex % room.players.length];
      if (!currentDrawer || currentDrawer.id !== playerId) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not your turn to draw!' }) };
      }

      startDrawingPhase(room, payload.word);
      await saveRoom(code, room);

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'draw_stroke') {
      const currentDrawer = room.players[room.currentDrawerIndex % room.players.length];
      if (currentDrawer && currentDrawer.id === playerId && room.state === 'DRAWING') {
        room.drawHistory.push(payload.stroke);
        await saveRoom(code, room);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'flood_fill') {
      const currentDrawer = room.players[room.currentDrawerIndex % room.players.length];
      if (currentDrawer && currentDrawer.id === playerId && room.state === 'DRAWING') {
        room.drawHistory.push({ type: 'fill', ...payload.fill });
        await saveRoom(code, room);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'clear_canvas') {
      const currentDrawer = room.players[room.currentDrawerIndex % room.players.length];
      if (currentDrawer && currentDrawer.id === playerId && room.state === 'DRAWING') {
        room.drawHistory = [];
        await saveRoom(code, room);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'undo_stroke') {
      const currentDrawer = room.players[room.currentDrawerIndex % room.players.length];
      if (currentDrawer && currentDrawer.id === playerId && room.state === 'DRAWING') {
        room.drawHistory.pop();
        await saveRoom(code, room);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'send_guess') {
      const player = room.players.find(p => p.id === playerId);
      const currentDrawer = room.players[room.currentDrawerIndex % room.players.length];

      if (!player || room.state !== 'DRAWING' || player.id === currentDrawer.id) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false }) };
      }

      const guessText = (payload.text || '').trim();
      const cleanGuess = guessText.toLowerCase();

      if (!room.correctGuessed) room.correctGuessed = [];

      if (room.correctGuessed.includes(playerId)) {
        room.chat.push({
          id: playerId,
          sender: player.name,
          avatar: player.avatar,
          text: guessText,
          type: 'guessed_only',
          timestamp: Date.now()
        });
        await saveRoom(code, room);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, guessed: true }) };
      }

      if (cleanGuess === room.currentWord) {
        room.correctGuessed.push(playerId);
        player.hasGuessed = true;

        const timeLeft = Math.max(0, room.turnEndTime - Date.now());
        const timeRatio = Math.max(0.2, timeLeft / (room.settings.drawTime * 1000));
        const points = Math.round(150 + timeRatio * 350);

        player.score += points;
        player.roundScore = points;

        currentDrawer.score += Math.round(50 + points * 0.2);
        currentDrawer.roundScore += Math.round(50 + points * 0.2);

        room.chat.push({
          sender: '🎉 Game',
          avatar: '⭐',
          text: `${player.name} guessed the word! (+${points} pts)`,
          type: 'correct',
          timestamp: Date.now()
        });

        const totalGuessers = Math.max(1, room.players.length - 1);
        if (room.correctGuessed.length >= totalGuessers) {
          endTurnPhase(room, true);
        }

        await saveRoom(code, room);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            isCorrect: true,
            word: room.currentWord,
            points: points
          })
        };
      }

      const isClose = room.currentWord.length >= 4 && levenshteinDistance(cleanGuess, room.currentWord) === 1;

      room.chat.push({
        id: playerId,
        sender: player.name,
        avatar: player.avatar,
        text: guessText,
        type: 'normal',
        timestamp: Date.now()
      });

      await saveRoom(code, room);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          isClose: isClose,
          guess: guessText
        })
      };
    }

    if (action === 'poll_state') {
      updateRoomTimerState(room);
      await saveRoom(code, room);

      const player = room.players.find(p => p.id === playerId);
      if (player) player.lastSeen = Date.now();

      const currentDrawer = room.players[room.currentDrawerIndex % room.players.length];
      const isDrawer = (currentDrawer && currentDrawer.id === playerId);

      const now = Date.now();
      let timeLeft = 0;
      if (room.state === 'CHOOSING' || room.state === 'DRAWING') {
        timeLeft = Math.max(0, Math.ceil((room.turnEndTime - now) / 1000));
      }

      let wordPattern = '';
      if (room.state === 'DRAWING') {
        if (isDrawer || (room.correctGuessed && room.correctGuessed.includes(playerId))) {
          wordPattern = room.currentWord.toUpperCase();
        } else {
          wordPattern = generateMaskedPattern(room.currentWord, room.revealedIndices || []);
        }
      }

      const lastStrokeIndex = Number(payload.lastStrokeIndex) || 0;
      const newStrokes = (room.drawHistory || []).slice(lastStrokeIndex);

      const lastChatIndex = Number(payload.lastChatIndex) || 0;
      const newChat = (room.chat || []).slice(lastChatIndex).filter(msg => {
        if (msg.type !== 'guessed_only') return true;
        return isDrawer || (room.correctGuessed && room.correctGuessed.includes(playerId));
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          state: room.state,
          currentRound: room.currentRound,
          maxRounds: room.settings.rounds,
          drawer: {
            id: currentDrawer ? currentDrawer.id : null,
            name: currentDrawer ? currentDrawer.name : '',
            avatar: currentDrawer ? currentDrawer.avatar : '🎨'
          },
          isDrawer: isDrawer,
          timeLeft: timeLeft,
          wordPattern: wordPattern,
          wordChoices: isDrawer && room.state === 'CHOOSING' ? room.wordChoices : [],
          revealedWord: (room.state === 'ROUND_END' || room.state === 'GAME_OVER') ? room.currentWord : null,
          allGuessed: room.allGuessed,
          players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: p.score,
            roundScore: p.roundScore,
            isHost: p.isHost,
            hasGuessed: room.correctGuessed ? room.correctGuessed.includes(p.id) : false
          })).sort((a, b) => b.score - a.score),
          strokes: newStrokes,
          totalStrokes: (room.drawHistory || []).length,
          chat: newChat,
          totalChat: (room.chat || []).length
        })
      };
    }

    if (action === 'play_again') {
      const player = room.players.find(p => p.id === playerId);
      if (player && player.isHost) {
        room.state = 'LOBBY';
        room.drawHistory = [];
        room.correctGuessed = [];
        room.chat = [];
        for (const p of room.players) {
          p.score = 0;
          p.roundScore = 0;
          p.hasGuessed = false;
        }
        await saveRoom(code, room);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Unknown action: ${action}` })
    };

  } catch (error) {
    console.error('Netlify function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
};
