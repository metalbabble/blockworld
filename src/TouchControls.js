/**
 * TouchControls — on-screen gamepad for touch / tablet devices.
 *
 * Activated when a user taps the title screen (instead of clicking).
 * Draws a D-pad on the bottom-left, action buttons on the bottom-right,
 * and a ☰ Menu button in the top-left corner.
 * Dragging anywhere on the canvas (not on a button) rotates the camera.
 */
export class TouchControls {
  constructor(game) {
    this.game     = game;
    this._enabled = false;

    // Virtual directional state (mirrors WASD keys)
    this._vk = { forward: false, back: false, left: false, right: false };
    this._jumping = false;

    // Camera drag tracking (single touch)
    this._dragId   = null;
    this._dragPrev = { x: 0, y: 0 };

    // DOM references
    this._el      = null;   // controls container
    this._menuBtn = null;   // ☰ button

    this._buildDOM();
    this._bindCanvas();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get enabled() { return this._enabled; }

  /** Show controls and switch HUD to touch mode. */
  enable() {
    this._enabled = true;
    this._el.style.display      = 'flex';
    this._menuBtn.style.display = 'block';
    const xhair = document.getElementById('crosshair');
    if (xhair) xhair.style.display = 'none';
    this._syncPutBtn();
  }

  /** Hide controls and restore desktop HUD. */
  disable() {
    this._enabled = false;
    this._el.style.display      = 'none';
    this._menuBtn.style.display = 'none';
    const xhair = document.getElementById('crosshair');
    if (xhair) xhair.style.display = '';
    this._clearInput();
  }

  /** Return virtual directional input for Player.update(). */
  getMovement() { return this._vk; }

  /** Whether the jump button is currently held. */
  isJumping() { return this._jumping; }

  /** Re-evaluate PUT button enabled state after heldBlock changes. */
  syncPutBtn() { this._syncPutBtn(); }

  // ── DOM construction ───────────────────────────────────────────────────────

  _buildDOM() {
    // ── ☰ Menu button (top-left) ──────────────────────────────────────────
    this._menuBtn = document.createElement('button');
    this._menuBtn.id          = 'touch-menu-btn';
    this._menuBtn.textContent = '☰ Menu';
    this._menuBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      this._openMenu();
    }, { passive: false });
    document.body.appendChild(this._menuBtn);

    // ── Controls container (bottom strip) ─────────────────────────────────
    this._el    = document.createElement('div');
    this._el.id = 'touch-controls';

    // ── D-pad (left) ──────────────────────────────────────────────────────
    const dpad = document.createElement('div');
    dpad.className = 'tc-dpad';

    const btnUp    = this._mkBtn('▲', 'tc-up');
    const btnDown  = this._mkBtn('▼', 'tc-down');
    const btnLeft  = this._mkBtn('◀', 'tc-left');
    const btnRight = this._mkBtn('▶', 'tc-right');

    const midRow = document.createElement('div');
    midRow.className = 'tc-dpad-row';
    midRow.append(btnLeft, btnRight);

    dpad.append(btnUp, midRow, btnDown);
    this._bindDir(btnUp,    'forward');
    this._bindDir(btnDown,  'back');
    this._bindDir(btnLeft,  'left');
    this._bindDir(btnRight, 'right');

    // ── Action buttons (right) ────────────────────────────────────────────
    const actions = document.createElement('div');
    actions.className = 'tc-actions';

    const btnJump = this._mkBtn('JUMP', 'tc-jump');
    const btnGrab = this._mkBtn('GRAB', 'tc-grab');
    const btnPut  = this._mkBtn('PUT',  'tc-put');

    this._bindHold(btnJump,
      () => { this._jumping = true;  },
      () => { this._jumping = false; }
    );
    this._bindTap(btnGrab, () => this.game.player.grab());
    this._bindTap(btnPut,  () => this.game.player.put());

    actions.append(btnJump, btnGrab, btnPut);

    this._el.append(dpad, actions);
    document.body.appendChild(this._el);
  }

  _mkBtn(label, id) {
    const b = document.createElement('button');
    b.id        = id;
    b.className = 'tc-btn';
    b.textContent = label;
    return b;
  }

  // ── Button event bindings ─────────────────────────────────────────────────

  /** Direction button: held down maps to a virtual key. */
  _bindDir(btn, key) {
    btn.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      this._vk[key] = true;
    }, { passive: false });
    const release = e => { e.preventDefault(); this._vk[key] = false; };
    btn.addEventListener('touchend',    release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
  }

  /** Hold button: fires callbacks on press and release. */
  _bindHold(btn, onDown, onUp) {
    btn.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      onDown();
    }, { passive: false });
    const release = e => { e.preventDefault(); onUp(); };
    btn.addEventListener('touchend',    release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
  }

  /** Tap button: single action on press. */
  _bindTap(btn, fn) {
    btn.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!btn.disabled) fn();
    }, { passive: false });
  }

  // ── Camera drag ───────────────────────────────────────────────────────────

  _bindCanvas() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    canvas.addEventListener('touchstart', e => {
      if (!this._enabled) return;
      e.preventDefault();
      // Claim the first unclaimed touch for camera drag
      for (const t of e.changedTouches) {
        if (this._dragId === null) {
          this._dragId   = t.identifier;
          this._dragPrev = { x: t.clientX, y: t.clientY };
          break;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      if (!this._enabled || this._dragId === null) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._dragId) continue;
        const dx = t.clientX - this._dragPrev.x;
        const dy = t.clientY - this._dragPrev.y;
        this._dragPrev = { x: t.clientX, y: t.clientY };

        const p    = this.game.player;
        const sens = 0.003; // slightly larger than mouse for comfortable touch drag
        p.yaw   -= dx * sens;
        p.pitch -= dy * sens;
        p.pitch  = Math.max(-Math.PI / 2 + 0.01,
                   Math.min( Math.PI / 2 - 0.01, p.pitch));
      }
    }, { passive: false });

    const endDrag = e => {
      if (!this._enabled) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this._dragId) { this._dragId = null; break; }
      }
    };
    canvas.addEventListener('touchend',    endDrag, { passive: false });
    canvas.addEventListener('touchcancel', endDrag, { passive: false });
  }

  // ── Menu / overlay ────────────────────────────────────────────────────────

  _openMenu() {
    this._clearInput();
    this._el.style.display      = 'none';
    this._menuBtn.style.display = 'none';

    // Show touch-specific instructions in the overlay
    const kb    = document.getElementById('overlay-instructions-kb');
    const touch = document.getElementById('overlay-instructions-touch');
    if (kb)    kb.style.display    = 'none';
    if (touch) touch.style.display = 'flex';

    document.getElementById('overlay').style.display = 'flex';
  }

  /** Called by Game when overlay is dismissed in touch mode. */
  resumeFromMenu() {
    this._el.style.display      = 'flex';
    this._menuBtn.style.display = 'block';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _clearInput() {
    this._vk     = { forward: false, back: false, left: false, right: false };
    this._jumping = false;
    this._dragId  = null;
  }

  _syncPutBtn() {
    const btn = document.getElementById('tc-put');
    if (btn) btn.disabled = this.game.player.selectedBlock === null;
  }
}
