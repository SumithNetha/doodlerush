# 🎨 DoodleRush — Real-Time Multiplayer Draw & Guess Game

> Built for the **Handshake AI Skills Studio Challenge: Create a Multiplayer Game**.

A real-time, cross-device multiplayer party game where friends, family, or classmates can draw, guess, and compete from any phone, tablet, or laptop without needing an account or installing any app.

---

## 🌟 Key Features

- **Instant Join via 4-Letter Room Code or QR Code**:
  - No account creation, login, or installs needed.
  - Generates simple room codes (e.g. `ZPA7`, `MOON`, `DUCK`).
  - Shareable link with automatic room code injection (`?room=CODE`).
  - Built-in QR Code modal for instant smartphone camera scanning.
- **Synchronized Canvas Engine**:
  - Normalized floating-point coordinate mapping (`0.0` - `1.0`), ensuring drawings look crisp and identical across 4K monitors, iPads, and mobile screens.
  - Smooth Bezier curve interpolation with rounded brush caps.
  - Multi-tool palette: Brush, Eraser, and algorithmic Flood-Fill Bucket.
  - Full Undo (`Ctrl+Z`), Clear (`C`), and 12-color vibrant palette + custom color picker.
- **Real-Time Gameplay Loop & Rules**:
  - **Word Selection**: The active drawer picks between 3 categorized words (Easy, Medium, Hard).
  - **Dynamic Word Blanks & Hints**: Guessers see letter blanks (`_ _ _ _ _`) that progressively reveal letter hints as the countdown timer ticks down.
  - **Smart Chat & Fuzzy Matching**:
    - Levenshtein distance typo detection ("🔥 You're so close!").
    - Anti-spoiler chat masking: Once a player guesses the secret word, their messages are hidden from players who haven't guessed yet.
    - Speed-based scoring algorithm (faster guesses earn higher points, and drawers earn bonuses for clear drawings).
  - **Audio & Visual Polish**:
    - Synthesized Web Audio API sound effects (tick-tocks, fanfare, guess chimes, pops) with a mute toggle.
    - Interactive 3D podium and confetti celebration upon game conclusion.

---

## 🎮 Game Rules

1. **Host Setup**: One player creates a room and configures round count (2, 3, or 5 rounds) and draw duration (45s, 60s, or 80s).
2. **Joining**: Friends join by typing the 4-letter room code or scanning the QR code on the host's screen.
3. **Drawing Turn**: When it's your turn, choose 1 of 3 words. Use the canvas tools to sketch the word before time runs out.
4. **Guessing**: Other players type their guesses in the live chat.
   - Exact match awards points based on speed.
   - Guessing close will display a private "You are close!" tip.
5. **Winning**: After all rounds conclude, the player with the highest total score takes the 1st place gold podium!

---