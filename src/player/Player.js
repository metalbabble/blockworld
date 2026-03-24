import * as THREE from 'three';
import { BLOCKS, BLOCK_NAMES, CHUNK_HEIGHT } from '../world/Chunk.js';

const GRAVITY       = 28;   // m/s²
const JUMP_VEL      = 9.5;  // m/s
const WALK_SPEED    = 5.0;  // m/s
const RUN_SPEED     = 9.0;  // m/s — shift held
const WATER_SPEED   = 2.0;  // m/s — horizontal speed while swimming
const WATER_GRAVITY = 4.0;  // m/s² — gentle pull while submerged
const WATER_SINK    = 2.5;  // m/s — terminal sink speed in water
const SWIM_VEL      = 4.5;  // m/s — upward burst when pressing jump in water
const EYE_HEIGHT  = 1.6;   // metres above feet
const HALF_W      = 0.29;  // half-width of player AABB
const PLAYER_H    = 1.8;

export class Player {
  constructor(camera, world) {
    this.camera  = camera;
    this.world   = world;

    // Feet position in world space
    this.position = new THREE.Vector3(0.5, 50, 0.5);
    this.velocity = new THREE.Vector3();
    this.onGround = false;

    // Look angles
    this.yaw   = 0;   // radians, horizontal
    this.pitch = 0;   // radians, vertical (clamped)

    // Block in hand
    this.heldBlock = null;  // null = empty hand

    // Debug mode (toggled via command)
    this.debugMode = false;

    // Sound manager (injected after construction)
    this._sound = null;

    // State tracking for sound events
    this._wasInWater  = false;
    this._wasOnGround = false;

    // Input state
    this._keys = {};
    this._initControls();

    // Ghost block preview (place indicator)
    const ghostGeo  = new THREE.BoxGeometry(1.001, 1.001, 1.001);
    const ghostMat  = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false,
    });
    this.ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    this.ghostMesh.visible = false;

    const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
    const edgesMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    this.ghostEdges = new THREE.LineSegments(edgesGeo, edgesMat);
    this.ghostEdges.visible = false;
  }

  setSoundManager(sm) { this._sound = sm; }

  // ── Controls ──────────────────────────────────────────────────────────────

  _initControls() {
    document.addEventListener('keydown', e => {
      this._keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'ShiftLeft') e.preventDefault();
    });
    document.addEventListener('keyup', e => { this._keys[e.code] = false; });

    document.addEventListener('mousemove', e => {
      if (!document.pointerLockElement) return;
      const sens = 0.0018;
      this.yaw   -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });

    document.addEventListener('mousedown', e => {
      if (!document.pointerLockElement) return;
      if (e.button === 0) this._leftClick();
      if (e.button === 2) this._rightClick();
    });

    // Prevent context menu on right-click
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  _leftClick() {
    // Remove the targeted block → goes to hand
    const hit = this.world.raycast(
      this._eyePos(),
      this._lookDir()
    );
    if (!hit) return;
    const { pos, blockId } = hit;
    if (blockId === BLOCKS.BEDROCK) return;
    this.world.setBlock(pos.x, pos.y, pos.z, BLOCKS.AIR);
    this.world.propagateWater(pos.x, pos.y, pos.z);
    this.heldBlock = blockId;
    this._updateHeldHUD();
    this._sound?.playRemoveBlock();
  }

  _rightClick() {
    // Place held block
    if (this.heldBlock === null) return;
    const hit = this.world.raycast(this._eyePos(), this._lookDir());
    if (!hit) return;

    const { placePos } = hit;
    const { x, y, z } = placePos;

    // Can't place inside the player
    if (this._overlapsPlayer(x, y, z)) return;

    // Must be adjacent to existing block (guaranteed by face placement, but confirm non-air below)
    this.world.setBlock(x, y, z, this.heldBlock);
    this.heldBlock = null;
    this._updateHeldHUD();
    this._sound?.playPlaceBlock();
  }

  _overlapsPlayer(bx, by, bz) {
    // Block AABB: [bx, bx+1] × [by, by+1] × [bz, bz+1]
    // Player AABB from feet
    const px = this.position.x, py = this.position.y, pz = this.position.z;
    return (
      px + HALF_W > bx && px - HALF_W < bx + 1 &&
      py + PLAYER_H > by && py < by + 1 &&
      pz + HALF_W > bz && pz - HALF_W < bz + 1
    );
  }

  _updateHeldHUD() {
    const el = document.getElementById('held-name');
    if (el) el.textContent = this.heldBlock !== null ? BLOCK_NAMES[this.heldBlock] : 'nothing';
  }

  // ── Physics ───────────────────────────────────────────────────────────────

  update(dt) {
    dt = Math.min(dt, 0.05); // cap to avoid tunnelling on lag spikes

    // Gather move input in camera-relative direction
    const forward = this._lookDirFlat();
    const right   = new THREE.Vector3(-forward.z, 0, forward.x);

    const moving = { x: 0, z: 0 };
    if (this._keys['KeyW'])  { moving.x += forward.x; moving.z += forward.z; }
    if (this._keys['KeyS'])  { moving.x -= forward.x; moving.z -= forward.z; }
    if (this._keys['KeyA'])  { moving.x -= right.x;   moving.z -= right.z;   }
    if (this._keys['KeyD'])  { moving.x += right.x;   moving.z += right.z;   }

    const len = Math.sqrt(moving.x*moving.x + moving.z*moving.z);
    if (len > 0) { moving.x /= len; moving.z /= len; }

    const inWater = this._isInWater();

    // Water transition sounds
    if (inWater && !this._wasInWater)  this._sound?.playEnterWater();
    if (!inWater && this._wasInWater)  this._sound?.playExitWater();
    this._wasInWater = inWater;

    // Apply walk speed (shift = run, reduced in water, 4x in debug mode)
    const running = !inWater && this._keys['ShiftLeft'];
    const baseSpeed = inWater ? WATER_SPEED : (running ? RUN_SPEED : WALK_SPEED);
    const speed = baseSpeed * (this.debugMode ? 4 : 1);
    this.velocity.x = moving.x * speed;
    this.velocity.z = moving.z * speed;

    // If we were on the ground, confirm there's still a block beneath us
    // (handles walking off ledges — gravity won't apply until this clears)
    if (this.onGround && !this._isGroundBelow()) {
      this.onGround = false;
    }

    // Jump on land / swim upward in water / fly upward in debug mode
    if (this._keys['Space']) {
      if (inWater) {
        this.velocity.y = SWIM_VEL; // swim up while space held
      } else if (this.debugMode) {
        this.velocity.y = JUMP_VEL; // hold space to fly upward indefinitely
        this.onGround = false;
      } else if (this.onGround) {
        this.velocity.y = JUMP_VEL;
        this.onGround   = false;
      }
    }

    // Gravity — gentle in water, full in air
    if (!this.onGround) {
      if (inWater) {
        this.velocity.y -= WATER_GRAVITY * dt;
        this.velocity.y  = Math.max(this.velocity.y, -WATER_SINK);
      } else {
        this.velocity.y -= GRAVITY * dt;
        this.velocity.y  = Math.max(this.velocity.y, -40);
      }
    }

    // Move and collide per-axis
    this._moveAxis('x', this.velocity.x * dt);
    this._moveAxis('y', this.velocity.y * dt);
    this._moveAxis('z', this.velocity.z * dt);

    // Landing sound
    if (this.onGround && !this._wasOnGround) this._sound?.playLand();
    this._wasOnGround = this.onGround;

    // Sync camera
    const eye = this._eyePos();
    this.camera.position.copy(eye);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Update ghost block
    this._updateGhost();

    // HUD position
    const pi = document.getElementById('pos-display');
    const ci = document.getElementById('chunk-display');
    if (pi) pi.textContent = `XYZ: ${this.position.x.toFixed(1)}, ${this.position.y.toFixed(1)}, ${this.position.z.toFixed(1)}`;
    if (ci) {
      const cx = Math.floor(this.position.x / 16);
      const cz = Math.floor(this.position.z / 16);
      ci.textContent = `Chunk: ${cx}, ${cz}`;
    }
  }

  _moveAxis(axis, delta) {
    if (Math.abs(delta) < 1e-6) return;
    this.position[axis] += delta;

    if (this._checkAABB()) {
      this.position[axis] -= delta;
      if (axis === 'y') {
        if (delta < 0) this.onGround = true;
        this.velocity.y = 0;
      } else {
        this.velocity[axis] = 0;
      }
    } else if (axis === 'y' && delta < 0) {
      this.onGround = false;
    }
  }

  _checkAABB() {
    const px = this.position.x, py = this.position.y, pz = this.position.z;
    const minX = Math.floor(px - HALF_W);
    const maxX = Math.floor(px + HALF_W);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + PLAYER_H - 0.001);
    const minZ = Math.floor(pz - HALF_W);
    const maxZ = Math.floor(pz + HALF_W);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = this.world.getBlock(x, y, z);
          if (id > 0 && id !== BLOCKS.WATER) return true;
        }
      }
    }
    return false;
  }

  // ── Ghost block preview ───────────────────────────────────────────────────

  _updateGhost() {
    if (this.heldBlock === null) {
      this.ghostMesh.visible  = false;
      this.ghostEdges.visible = false;
      return;
    }
    const hit = this.world.raycast(this._eyePos(), this._lookDir());
    if (!hit || this._overlapsPlayer(hit.placePos.x, hit.placePos.y, hit.placePos.z)) {
      this.ghostMesh.visible  = false;
      this.ghostEdges.visible = false;
      return;
    }
    const { x, y, z } = hit.placePos;
    const gp = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
    this.ghostMesh.position.copy(gp);
    this.ghostEdges.position.copy(gp);
    this.ghostMesh.visible  = true;
    this.ghostEdges.visible = true;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _isGroundBelow() {
    const checkY = Math.floor(this.position.y - 0.05);
    const minX = Math.floor(this.position.x - HALF_W);
    const maxX = Math.floor(this.position.x + HALF_W);
    const minZ = Math.floor(this.position.z - HALF_W);
    const maxZ = Math.floor(this.position.z + HALF_W);
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const id = this.world.getBlock(x, checkY, z);
        if (id > 0 && id !== BLOCKS.WATER) return true;
      }
    }
    return false;
  }

  _isInWater() {
    const px = this.position.x, py = this.position.y, pz = this.position.z;
    const minX = Math.floor(px - HALF_W), maxX = Math.floor(px + HALF_W);
    const minZ = Math.floor(pz - HALF_W), maxZ = Math.floor(pz + HALF_W);
    // Check at feet and knee height
    for (const checkY of [Math.floor(py), Math.floor(py + 0.6)]) {
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.getBlock(x, checkY, z) === BLOCKS.WATER) return true;
        }
      }
    }
    return false;
  }

  _eyePos() {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + EYE_HEIGHT,
      this.position.z
    );
  }

  _lookDir() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return dir.normalize();
  }

  _lookDirFlat() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  clearKeys() {
    this._keys = {};
  }

  // Spawn above terrain and fall down
  spawnAt(wx, wz) {
    const sy = this.world.getSurfaceY(wx, wz);
    this.position.set(wx + 0.5, sy + 2, wz + 0.5);
    this.velocity.set(0, 0, 0);
  }
}
