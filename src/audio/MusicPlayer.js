export class MusicPlayer {
  constructor() {
    this._playlist = [];
    this._audio    = null;
    this._started  = false;
  }

  // Call once after a user gesture (pointer lock click)
  async start() {
    if (this._started) return;
    this._started = true;
    await this._probe();
    if (this._playlist.length > 0) this._playRandom();
  }

  // Probe for /music/1.mp3, /music/2.mp3, … stopping at first missing file.
  // Uses Audio element so it works reliably with Vite's static file server.
  async _probe() {
    for (let i = 1; i <= 99; i++) {
      const url = `/music/${i}.mp3`;
      const ok = await new Promise(resolve => {
        const a = new Audio();
        a.preload = 'metadata';
        a.addEventListener('loadedmetadata', () => resolve(true),  { once: true });
        a.addEventListener('error',          () => resolve(false), { once: true });
        a.src = url;
      });
      if (!ok) break;
      this._playlist.push(url);
    }
  }

  _playRandom() {
    if (this._playlist.length === 0) return;
    const idx = Math.floor(Math.random() * this._playlist.length);
    this._play(this._playlist[idx]);
  }

  _play(url) {
    if (this._audio) {
      this._audio.pause();
      this._audio.src = '';
    }
    this._audio = new Audio(url);
    this._audio.volume = 0.5;
    this._audio.addEventListener('ended', () => this._playRandom());
    this._audio.play().catch(() => {});
  }

  stop() {
    if (this._audio) {
      this._audio.pause();
      this._audio.src = '';
      this._audio = null;
    }
  }
}
