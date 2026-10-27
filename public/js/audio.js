// Built-in Web Audio API sound synthesizer - zero external asset dependencies
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('doodlerush_muted') === 'true';
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('doodlerush_muted', this.muted);
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.15) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  playPop() {
    this.playTone(600, 'sine', 0.08, 0.1);
  }

  playSelect() {
    this.playTone(440, 'triangle', 0.1, 0.12);
    setTimeout(() => this.playTone(880, 'triangle', 0.12, 0.12), 80);
  }

  playRoundStart() {
    if (this.muted) return;
    const notes = [392, 523, 659, 784]; // G4, C5, E5, G5
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.15), idx * 100);
    });
  }

  playCorrectGuess() {
    if (this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.3, 0.18), idx * 80);
    });
  }

  playCloseGuess() {
    this.playTone(320, 'sine', 0.15, 0.1);
    setTimeout(() => this.playTone(360, 'sine', 0.15, 0.1), 100);
  }

  playTick() {
    this.playTone(800, 'sine', 0.04, 0.05);
  }

  playTurnEnd() {
    if (this.muted) return;
    const notes = [659, 587, 523];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.25, 0.12), idx * 120);
    });
  }

  playGameOver() {
    if (this.muted) return;
    const fanfare = [523, 659, 784, 1046, 784, 1046];
    fanfare.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.35, 0.2), idx * 140);
    });
  }
}

window.sounds = new SoundEffects();
