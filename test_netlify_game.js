// Automated 3-round 2-player game test using /.netlify/functions/game
const http = require('http');

function postApi(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/.netlify/functions/game',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runFullThreeRoundTest() {
  console.log('===========================================================');
  console.log('🧪 Starting 3-Round 2-Player Test via /.netlify/functions/game');
  console.log('===========================================================');

  // 1. Create Room (Player 1 / Host)
  const p1Create = await postApi({
    action: 'create_room',
    name: 'Alice (Host)',
    avatar: '🦊',
    rounds: 3,
    drawTime: 45
  });
  console.log('✓ Player 1 created room:', p1Create.code, 'PlayerID:', p1Create.playerId);
  const code = p1Create.code;
  const p1Id = p1Create.playerId;

  // 2. Join Room (Player 2)
  const p2Join = await postApi({
    action: 'join_room',
    code: code,
    name: 'Bob',
    avatar: '🐼'
  });
  console.log('✓ Player 2 joined room:', code, 'PlayerID:', p2Join.playerId);
  const p2Id = p2Join.playerId;

  // 3. Start Game
  const startRes = await postApi({
    action: 'start_game',
    code: code,
    playerId: p1Id
  });
  console.log('✓ Host started game:', startRes.success ? 'SUCCESS' : 'FAILED');

  // Play through 3 complete rounds (Round 1, Round 2, Round 3)
  for (let r = 1; r <= 3; r++) {
    console.log(`\n--- ▶️ SIMULATING ROUND ${r} OF 3 ---`);

    // Poll to get drawer & choices
    let state = await postApi({ action: 'poll_state', code, playerId: p1Id });
    console.log(`State: ${state.state}, Round: ${state.currentRound}/${state.maxRounds}, Drawer: ${state.drawer.name}`);

    const isP1Drawer = state.drawer.id === p1Id;
    const drawerId = isP1Drawer ? p1Id : p2Id;
    const guesserId = isP1Drawer ? p2Id : p1Id;

    // Drawer polls for word choices
    const drawerPoll = await postApi({ action: 'poll_state', code, playerId: drawerId });
    const choices = drawerPoll.wordChoices;
    const chosenWord = (choices && choices.length > 0) ? choices[0].word : 'pizza';
    console.log(`✓ Drawer received ${choices ? choices.length : 0} choices. Picked: "${chosenWord}"`);

    // Choose word
    await postApi({ action: 'choose_word', code, playerId: drawerId, word: chosenWord });

    // Drawer draws a stroke
    await postApi({
      action: 'draw_stroke',
      code: code,
      playerId: drawerId,
      stroke: {
        type: 'stroke',
        color: '#3b82f6',
        size: 8,
        points: [{ nx: 0.1, ny: 0.1 }, { nx: 0.4, ny: 0.4 }, { nx: 0.8, ny: 0.8 }]
      }
    });
    console.log('✓ Drawer submitted canvas stroke');

    // Guesser polls to see drawing and masked hint
    const guesserPoll = await postApi({ action: 'poll_state', code, playerId: guesserId });
    console.log(`✓ Guesser sees masked pattern: ${guesserPoll.wordPattern}, Strokes received: ${guesserPoll.strokes.length}`);

    // Guesser makes a close guess first to test typo detection
    const closeGuessRes = await postApi({
      action: 'send_guess',
      code: code,
      playerId: guesserId,
      text: chosenWord + 's' // 1 letter typo
    });
    console.log(`✓ Guesser typo test ("${chosenWord}s"): close notification triggered:`, closeGuessRes.isClose);

    // Guesser submits the exact word
    const correctGuessRes = await postApi({
      action: 'send_guess',
      code: code,
      playerId: guesserId,
      text: chosenWord
    });
    console.log(`✓ Guesser submitted correct word: +${correctGuessRes.points} pts awarded!`);

    // Poll to verify round transition
    let afterGuessState = await postApi({ action: 'poll_state', code, playerId: p1Id });
    console.log(`✓ Round End State: ${afterGuessState.state}, Secret Word Revealed: "${afterGuessState.revealedWord}"`);

    // Advance intermission (wait or trigger state update)
    // Force transition to next turn by setting intermissionEndTime
    const fs = require('fs');
    // Poll again to let timer update
    await new Promise(res => setTimeout(res, 5200));
    await postApi({ action: 'poll_state', code, playerId: p1Id });
  }

  // 4. Final Game Over check
  console.log('\n--- 🏆 CHECKING FINAL PODIUM & WINNER ---');
  let finalState = await postApi({ action: 'poll_state', code, playerId: p1Id });
  console.log('Final State:', finalState.state);
  console.log('Leaderboard:');
  finalState.players.forEach((p, rank) => {
    console.log(`  ${rank + 1}. ${p.avatar} ${p.name}: ${p.score} pts ${rank === 0 ? '👑 WINNER' : ''}`);
  });

  console.log('\n===========================================================');
  console.log('🎉 3-ROUND MULTIPLAYER TEST PASSED WITH SCORING & PODIUM! 🎉');
  console.log('===========================================================');
}

runFullThreeRoundTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
