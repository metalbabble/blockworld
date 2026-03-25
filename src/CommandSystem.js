import { config } from './config.js';
import { CHUNK_SIZE, BLOCKS, BLOCK_NAMES } from './world/Chunk.js';

export class CommandSystem {
  constructor(game) {
    this.game   = game;
    this._active  = false;
    this._buffer  = '';

    this._bar      = document.getElementById('command-bar');
    this._prompt   = document.getElementById('command-prompt');
    this._response = document.getElementById('command-response');
    this._responseTimer = null;

    document.addEventListener('keydown', e => this._onKey(e), true);
  }

  get active() { return this._active; }

  _onKey(e) {
    if (!this._active) {
      if (e.key === '/' && document.pointerLockElement) {
        e.preventDefault();
        this._open();
      }
      return;
    }

    // Swallow all keys while command bar is open
    e.preventDefault();
    e.stopImmediatePropagation();

    if (e.key === 'Escape') {
      this._close();
      return;
    }

    if (e.key === 'Enter') {
      const input = this._buffer.trim();
      this._close();
      if (input) this._execute(input);
      return;
    }

    if (e.key === 'Backspace') {
      this._buffer = this._buffer.slice(0, -1);
    } else if (e.key.length === 1) {
      this._buffer += e.key;
    }

    this._prompt.textContent = '> ' + this._buffer;
  }

  _open() {
    this._active = true;
    this._buffer = '';
    this._prompt.textContent = '> ';
    this._bar.style.display = 'block';
    if (this._responseTimer) {
      clearTimeout(this._responseTimer);
      this._response.style.display = 'none';
    }
  }

  _close() {
    this._active = false;
    this._bar.style.display = 'none';
    // Clear stale key state accumulated while typing
    this.game.player.clearKeys();
  }

  _showResponse(msg) {
    this._response.textContent = msg;
    this._response.style.display = 'block';
    if (this._responseTimer) clearTimeout(this._responseTimer);
    this._responseTimer = setTimeout(() => {
      this._response.style.display = 'none';
      this._responseTimer = null;
    }, 4000);
  }

  _execute(input) {
    const parts = input.split(/\s+/);
    const cmd   = parts[0].toLowerCase();

    if (cmd === 'debug') {
      this.game.player.debugMode = !this.game.player.debugMode;
      this._showResponse(this.game.player.debugMode ? 'Debug mode ON' : 'Debug mode OFF');

    } else if (cmd === 'drawdistance') {
      const val = parseInt(parts[1], 10);
      if (!parts[1] || isNaN(val) || val < 1 || val > 32) {
        this._showResponse('Usage: drawdistance <1-32>');
      } else {
        config.drawDistance = val;
        this.game.updateFog();
        this._showResponse(`Draw distance set to ${val}`);
      }

    } else if (cmd === 'reset') {
      this.game.resetWorld();
      this._showResponse('World reset.');

    } else if (cmd === 'info') {
      const sub = parts[1]?.toLowerCase();
      const infoEl = document.getElementById('info');
      if (sub === 'on') {
        infoEl.style.display = 'block';
        this._showResponse('Info overlay ON');
      } else if (sub === 'off') {
        infoEl.style.display = 'none';
        this._showResponse('Info overlay OFF');
      } else {
        this._showResponse('Usage: info on | info off');
      }

    } else if (cmd === 'touch') {
      const sub = parts[1]?.toLowerCase();
      if (sub === 'on') {
        this.game._touchMode = true;
        this.game.touch.enable();
        this._showResponse('Touch controls enabled');
      } else if (sub === 'off') {
        this.game._touchMode = false;
        this.game.touch.disable();
        this._showResponse('Touch controls disabled');
      } else {
        this._showResponse('Usage: touch on | touch off');
      }

    } else if (cmd === 'block') {
      const name = parts[1]?.toLowerCase();
      const entry = Object.entries(BLOCK_NAMES).find(([, n]) => n === name);
      if (!name || !entry) {
        const valid = Object.values(BLOCK_NAMES).filter(n => n !== 'air').join(', ');
        this._showResponse(`Usage: block <name>  Valid: ${valid}`);
      } else if (name === 'air') {
        this._showResponse('Cannot give air');
      } else {
        this.game.player.giveBlock(Number(entry[0]));
        this._showResponse(`Gave ${name}`);
      }

    } else {
      this._showResponse('Invalid command');
    }
  }
}
