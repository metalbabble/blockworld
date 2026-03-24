export class SoundManager {
  constructor() {
    this._ctx = null;
  }

  init() {
    if (this._ctx) return;
    this._ctx = new AudioContext();
  }

  _resume() {
    if (this._ctx?.state === 'suspended') this._ctx.resume();
  }

  // Woody descending crack when picking up a block
  playRemoveBlock() {
    this._resume();
    if (!this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // Dull thud when placing a block
  playPlaceBlock() {
    this._resume();
    if (!this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Low thud when landing from a fall
  playLand() {
    this._resume();
    if (!this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const sr  = ctx.sampleRate;
    const len = Math.floor(sr * 0.18);

    const buf  = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18));
    }

    const source = ctx.createBufferSource();
    source.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type            = 'lowpass';
    lp.frequency.value = 130;

    const gain = ctx.createGain();
    gain.gain.value = 0.55;

    source.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
  }

  // Splash entering water
  playEnterWater() {
    this._splash(650, 0.45, 0.35);
  }

  // Lighter splash exiting water
  playExitWater() {
    this._splash(900, 0.3, 0.25);
  }

  _splash(freq, gainAmt, duration) {
    this._resume();
    if (!this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const sr  = ctx.sampleRate;
    const len = Math.floor(sr * duration);

    const buf  = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(Math.max(0, 1 - i / len), 0.4);
    }

    const source = ctx.createBufferSource();
    source.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type            = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value         = 0.4;

    const gain = ctx.createGain();
    gain.gain.value = gainAmt;

    source.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
  }
}
