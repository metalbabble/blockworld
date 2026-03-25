import * as THREE from 'three';
import { World } from './world/World.js';
import { Player } from './player/Player.js';
import { createTextureAtlas } from './rendering/TextureAtlas.js';
import { CHUNK_SIZE } from './world/Chunk.js';
import { DayNightCycle } from './rendering/DayNightCycle.js';
import { WORLD_SEED } from './world/noise.js';
import { SoundManager } from './audio/SoundManager.js';
import { MusicPlayer } from './audio/MusicPlayer.js';
import { config } from './config.js';
import { CommandSystem } from './CommandSystem.js';
import { TouchControls } from './TouchControls.js';

function fogNear() { return (config.drawDistance - 1) * CHUNK_SIZE; }
function fogFar()  { return (config.drawDistance + 1.5) * CHUNK_SIZE; }
const SKY_COLOR = 0x87ceeb;

export class Game {
  constructor() {
    this._initRenderer();
    this._initScene();
    this._initWorld();
    this._initPlayer();

    this._clock     = new THREE.Clock();
    this._started   = false;
    this._animFrame = null;
    this._touchMode = false;   // true once the player taps (vs clicks) to start

    this.sound    = new SoundManager();
    this.music    = new MusicPlayer();
    this.player.setSoundManager(this.sound);
    this.touch    = new TouchControls(this);
    this.player.setTouchControls(this.touch);
    this.commands = new CommandSystem(this);

    this._initPointerLock();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(SKY_COLOR);
    document.body.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _initScene() {
    this.scene  = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, fogNear(), fogFar());

    // Ambient + directional light (no shadows for performance)
    this._ambient = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this._ambient);

    this._sun = new THREE.DirectionalLight(0xfff0cc, 0.9);
    this._sun.position.set(0.6, 1, 0.4).normalize();
    this.scene.add(this._sun);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 512);
    this.scene.add(this.camera);

    this.dayNight = new DayNightCycle(
      this.scene, this.renderer, this.scene.fog,
      this._ambient, this._sun, this.camera,
    );
  }

  _initWorld() {
    const atlas = createTextureAtlas();
    this.material = new THREE.MeshLambertMaterial({ map: atlas, side: THREE.FrontSide, vertexColors: true });
    this.world = new World(this.scene, this.material);
    document.getElementById('world-seed').textContent = `World #${WORLD_SEED}`;
    document.getElementById('version-display').textContent = `v${config.version}`;
    const motdEl = document.getElementById('overlay-motd');
    if (config.motd) {
      motdEl.textContent = config.motd;
    } else {
      motdEl.style.display = 'none';
    }
  }

  _initPlayer() {
    this.player = new Player(this.camera, this.world);
    this.scene.add(this.player.ghostMesh);
    this.scene.add(this.player.ghostEdges);

    // Pre-generate chunks around spawn so player has ground on first tick
    const spawnChunks = 2;
    for (let dz = -spawnChunks; dz <= spawnChunks; dz++) {
      for (let dx = -spawnChunks; dx <= spawnChunks; dx++) {
        this.world._ensureChunk(dx, dz);
      }
    }
    this.player.spawnAt(0, 0);
  }

  _initPointerLock() {
    const overlay = document.getElementById('overlay');

    // ── Desktop: click requests pointer lock ──────────────────────────────
    overlay.addEventListener('click', () => {
      if (this._touchMode) {
        // Tap dismissed by touch — resume touch mode
        this._resumeTouchMode();
      } else {
        this.renderer.domElement.requestPointerLock();
      }
    });

    // ── Touch / tablet: tap starts (or resumes) touch mode ────────────────
    overlay.addEventListener('touchstart', e => {
      e.preventDefault();  // prevent synthetic click from also firing
      if (this._touchMode) {
        this._resumeTouchMode();
      } else {
        this._touchMode = true;
        overlay.style.display = 'none';
        this.touch.enable();
        this._startGame();
      }
    }, { passive: false });

    // ── Pointer lock change (desktop) ─────────────────────────────────────
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) {
        overlay.style.display = 'none';
        this._startGame();
      } else if (!this._touchMode) {
        // Only restore overlay for desktop mode; touch has its own menu button
        overlay.style.display = 'flex';
      }
    });
  }

  /** Begin the game loop — idempotent (only runs once). */
  _startGame() {
    if (this._started) return;
    this._started = true;
    this._clock.start();
    this.sound.init();
    this.music.start();
    this._loop();
  }

  /** Re-show controls after the touch menu was dismissed. */
  _resumeTouchMode() {
    document.getElementById('overlay').style.display = 'none';
    this.touch.resumeFromMenu();
  }

  _loop() {
    this._animFrame = requestAnimationFrame(() => this._loop());
    const dt = Math.min(this._clock.getDelta(), 0.1);

    // In touch mode pause physics when the overlay/menu is showing
    const overlayVisible = document.getElementById('overlay').style.display !== 'none';
    const paused = this.commands.active || (this._touchMode && overlayVisible);

    if (!paused) {
      this.dayNight.update(dt);
      this.player.update(dt);
    }
    this.world.update(this.player.position.x, this.player.position.z);
    this.renderer.render(this.scene, this.camera);
  }

  updateFog() {
    this.scene.fog.near = fogNear();
    this.scene.fog.far  = fogFar();
  }

  resetWorld() {
    for (const chunk of this.world.chunks.values()) chunk.dispose();
    this.world.chunks.clear();
    const spawnChunks = 2;
    for (let dz = -spawnChunks; dz <= spawnChunks; dz++) {
      for (let dx = -spawnChunks; dx <= spawnChunks; dx++) {
        this.world._ensureChunk(dx, dz);
      }
    }
    this.player.spawnAt(0, 0);
  }

  destroy() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this.renderer.dispose();
  }
}
