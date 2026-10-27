const { io } = require('socket.io-client');

async function testGameFlow() {
  console.log('--- Starting Automated Multiplayer Test ---');

  const p1 = io('http://localhost:3000');
  let roomCode = null;

  await new Promise(resolve => p1.on('connect', resolve));
  console.log('✓ Player 1 connected');

  // Step 1: P1 creates room
  const createRes = await new Promise(resolve => {
    p1.emit('create_room', { name: 'Alice', avatar: '🦊', rounds: 2, drawTime: 45 }, resolve);
  });
  console.log('✓ Room created with code:', createRes.code);
  roomCode = createRes.code;

  // Step 2: P2 joins room
  const p2 = io('http://localhost:3000');
  await new Promise(resolve => p2.on('connect', resolve));
  console.log('✓ Player 2 connected');

  const joinRes = await new Promise(resolve => {
    p2.emit('join_room', { code: roomCode, name: 'Bob', avatar: '🐼' }, resolve);
  });
  console.log('✓ Player 2 joined room:', joinRes.code);

  // Step 3: Listen for game events
  const p1PreparePromise = new Promise(resolve => p1.once('round_prepare', resolve));
  const p2PreparePromise = new Promise(resolve => p2.once('round_prepare', resolve));

  p1.emit('start_game', { rounds: 2, drawTime: 45 });

  const [p1Prep, p2Prep] = await Promise.all([p1PreparePromise, p2PreparePromise]);
  console.log('✓ Round prepared! Drawer is:', p1Prep.drawer.name);

  // Step 4: Word choices
  const drawerSocket = p1Prep.drawer.id === p1.id ? p1 : p2;
  const guesserSocket = p1Prep.drawer.id === p1.id ? p2 : p1;

  const choicesData = await new Promise(resolve => drawerSocket.once('word_choices', resolve));
  console.log('✓ Drawer received word choices:', choicesData.choices.map(c => c.word).join(', '));

  const chosenWord = choicesData.choices[0].word;
  console.log('✓ Choosing word:', chosenWord);

  const drawStartedPromise = new Promise(resolve => guesserSocket.once('drawing_started', resolve));
  drawerSocket.emit('choose_word', { word: chosenWord });

  const guesserStart = await drawStartedPromise;
  console.log('✓ Guesser received pattern:', guesserStart.pattern);

  // Step 5: Test Canvas stroke sync
  const strokePromise = new Promise(resolve => guesserSocket.once('draw_stroke', resolve));
  drawerSocket.emit('draw_stroke', {
    type: 'stroke',
    color: '#ef4444',
    size: 6,
    points: [{ nx: 0.2, ny: 0.2 }, { nx: 0.5, ny: 0.5 }]
  });
  const strokeReceived = await strokePromise;
  console.log('✓ Guesser received canvas stroke successfully! Points:', strokeReceived.points.length);

  // Step 6: Test Guessing
  const guessedPromise = new Promise(resolve => drawerSocket.once('player_guessed', resolve));
  guesserSocket.emit('send_guess', { text: chosenWord });
  const guessRes = await guessedPromise;
  console.log('✓ Guess verified by server! Points awarded:', guessRes.points);

  console.log('==================================================');
  console.log('🎉 ALL MULTIPLAYER REAL-TIME TESTS PASSED 100%! 🎉');
  console.log('==================================================');

  p1.disconnect();
  p2.disconnect();
  process.exit(0);
}

testGameFlow().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
