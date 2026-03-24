import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, BLOCKS } from './Chunk.js';
import { fbm, perlin2, WORLD_SEED } from './noise.js';
import { config } from '../config.js';
const DIRT_DEPTH      = 4;   // layers of dirt below grass before stone
const SEA_LEVEL       = 18;  // water fills valleys up to this height
const SNOW_HEIGHT     = 42;  // surface blocks at or above this get snow
const TREE_GRID       = 6;   // one potential tree per N×N world-block cell

// ── Fault lines ──────────────────────────────────────────────────────────────
const FAULT_GRID        = 320;  // world-blocks per fault-grid cell
const FAULT_CHANCE      = 0.22; // probability a cell contains a fault
const FAULT_HALF_WIDTH  = 7;    // blocks from spine to wall at full depth
const FAULT_HALF_LENGTH = 280;  // blocks from centre to tapered tip
const FAULT_FLOOR       = 5;    // target Y at fault spine (bare rock)
const FAULT_SHARPNESS   = 4;    // exponent – higher → steeper walls

// Returns a carve intensity in [0, 1]: 0 = no effect, 1 = full depth.
function faultCarve(wx, wz) {
  const gx = Math.floor(wx / FAULT_GRID);
  const gz = Math.floor(wz / FAULT_GRID);
  let best = 0;

  for (let dgx = -1; dgx <= 1; dgx++) {
    for (let dgz = -1; dgz <= 1; dgz++) {
      const cgx = gx + dgx;
      const cgz = gz + dgz;

      if (hashFloat(cgx * 17, cgz * 31) > FAULT_CHANCE) continue;

      // Fault spine origin and direction
      const ox    = (cgx + hashFloat(cgx,       cgz      )) * FAULT_GRID;
      const oz    = (cgz + hashFloat(cgx + 500, cgz + 700)) * FAULT_GRID;
      const angle = hashFloat(cgx * 7, cgz * 11) * Math.PI;
      const cosA  = Math.cos(angle);
      const sinA  = Math.sin(angle);

      const dx    = wx - ox;
      const dz    = wz - oz;
      const along = dx * cosA + dz * sinA;

      // Taper to nothing at the tips
      const lengthFrac = Math.abs(along) / FAULT_HALF_LENGTH;
      if (lengthFrac >= 1) continue;
      const lengthTaper = 1 - lengthFrac * lengthFrac; // smooth 1→0

      // Perpendicular distance with slight sinusoidal curvature
      const warp = perlin2(along * 0.004, cgx * 5.3 + cgz * 2.9) * 10;
      const perp = Math.abs(dx * sinA - dz * cosA + warp);

      const effectiveWidth = FAULT_HALF_WIDTH * lengthTaper;
      if (perp >= effectiveWidth) continue;

      const t     = 1 - perp / effectiveWidth;
      const carve = Math.pow(t, FAULT_SHARPNESS) * lengthTaper;
      if (carve > best) best = carve;
    }
  }
  return best;
}

function chunkKey(cx, cz) { return `${cx},${cz}`; }

function terrainHeight(wx, wz) {
  // Large-scale continental noise: positive → land, negative → valleys/sea
  const continental = fbm(wx * 0.003, wz * 0.003, 4, 0.6, 2.0);
  // Continuous shaping — no hard +offset at the zero crossing so shores
  // slope naturally rather than cliffing up.  Some steeper spots still
  // emerge from the detail layer for variety.
  const shaped = continental > 0
    ? continental * continental * 35
    : continental * 18;
  // Fine detail layer
  const detail = fbm(wx * 0.018, wz * 0.018, 4, 0.5, 2.0) * 5;

  // Mountain peaks: a separate mid-scale noise creates infrequent tall peaks
  // on top of continental terrain.  They rise well above SNOW_HEIGHT so the
  // player will encounter snow-capped summits after some exploration.
  let mountainBoost = 0;
  if (continental > 0.15) {
    const mt = fbm(wx * 0.006, wz * 0.006, 4, 0.55, 2.0);
    if (mt > 0.52) {
      const t = (mt - 0.52) / 0.48; // 0 at threshold → 1 at peak
      mountainBoost = t * t * 28;   // up to ~28 extra blocks; cubic spike shape
    }
  }

  const base = Math.max(1, Math.min(CHUNK_HEIGHT - 8, Math.round(22 + shaped + detail + mountainBoost)));

  // Fault lines: rare deep cracks into bare rock (land only)
  if (base > SEA_LEVEL + 3) {
    const carve = faultCarve(wx, wz);
    if (carve > 0) {
      return Math.max(FAULT_FLOOR, Math.round(base + (FAULT_FLOOR - base) * carve));
    }
  }

  return base;
}

// Deterministic float in [0, 1) from two integers + world seed
function hashFloat(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7 + WORLD_SEED * 0.001) * 43758.5453;
  return s - Math.floor(s);
}

// Place a tree with trunk base at world position (wx, baseY, wz).
// setBlock(wx, wy, wz, id) only places in loaded chunks and only on AIR cells.
function placeTree(setBlock, wx, baseY, wz, seed) {
  const trunkH = 4 + Math.floor(seed * 3); // 4–6 blocks
  const topY   = baseY + trunkH - 1;

  // Trunk
  for (let dy = 0; dy < trunkH; dy++) {
    setBlock(wx, baseY + dy, wz, BLOCKS.WOOD);
  }

  // 1–2 side branches at upper trunk
  const seed2 = Math.floor(seed * 997);
  const branchDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const numBranches = 1 + (seed2 % 2);
  for (let b = 0; b < numBranches; b++) {
    const [bx, bz] = branchDirs[(seed2 + b * 3) % 4];
    setBlock(wx + bx, topY - 1 - b, wz + bz, BLOCKS.WOOD);
  }

  // Leaf canopy — ellipsoid centred one block above trunk top
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      for (let dy = -1; dy <= 3; dy++) {
        const rv   = dy >= 0 ? 2.2 : 1.2; // taller above, shorter below
        const dist = Math.sqrt((dx * dx + dz * dz) / (2.3 * 2.3) + (dy * dy) / (rv * rv));
        if (dist > 1.0) continue;
        setBlock(wx + dx, topY + dy + 1, wz + dz, BLOCKS.LEAVES);
      }
    }
  }
}

export class World {
  constructor(scene, material) {
    this.scene    = scene;
    this.material = material;
    this.chunks   = new Map(); // key → Chunk

    this.waterMaterial = new THREE.MeshLambertMaterial({
      color:       0x1a6ba0,
      transparent: true,
      opacity:     0.68,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
  }

  // Return surface Y at world XZ (fast, no chunk needed)
  getSurfaceY(wx, wz) { return terrainHeight(wx, wz); }

  _generateChunk(cx, cz) {
    const chunk = new Chunk(cx, cz);
    const wx0 = cx * CHUNK_SIZE;
    const wz0 = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const surface = terrainHeight(wx0 + lx, wz0 + lz);
        const isHighAlt = surface >= SNOW_HEIGHT;

        for (let y = 0; y <= surface; y++) {
          let id;
          if (y === 0) {
            id = BLOCKS.BEDROCK;
          } else if (y === surface) {
            id = isHighAlt ? BLOCKS.SNOW : BLOCKS.GRASS;
          } else if (!isHighAlt && y >= surface - DIRT_DEPTH) {
            id = BLOCKS.DIRT;  // dirt only under grass, not under snow
          } else {
            id = BLOCKS.STONE;
          }
          chunk.setBlock(lx, y, lz, id);
        }

        // Fill valleys below sea level with water
        if (surface < SEA_LEVEL) {
          for (let y = surface + 1; y <= SEA_LEVEL; y++) {
            chunk.setBlock(lx, y, lz, BLOCKS.WATER);
          }
        }
      }
    }
    chunk.dirty = true;
    return chunk;
  }

  // Plant trees for chunk (cx, cz). Requires all 8 neighbours to already exist.
  // Uses world.setBlock so leaves can safely spill into adjacent chunks.
  _decorateChunk(cx, cz) {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk || chunk.decorated) return;
    chunk.decorated = true;

    const wx0 = cx * CHUNK_SIZE;
    const wz0 = cz * CHUNK_SIZE;

    // Wrapper: only place on AIR cells in already-loaded chunks
    const setBlock = (wx, wy, wz, id) => {
      const tcx = Math.floor(wx / CHUNK_SIZE);
      const tcz = Math.floor(wz / CHUNK_SIZE);
      if (!this.chunks.has(chunkKey(tcx, tcz))) return;
      if (this.getBlock(wx, wy, wz) === BLOCKS.AIR) {
        this.setBlock(wx, wy, wz, id);
      }
    };

    // Walk grid cells whose trunk positions land inside this chunk
    const gx0 = Math.floor(wx0 / TREE_GRID);
    const gz0 = Math.floor(wz0 / TREE_GRID);
    const gx1 = Math.floor((wx0 + CHUNK_SIZE - 1) / TREE_GRID);
    const gz1 = Math.floor((wz0 + CHUNK_SIZE - 1) / TREE_GRID);

    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        // Jitter trunk position within the cell
        const jx  = Math.floor(hashFloat(gx, gz) * TREE_GRID);
        const jz  = Math.floor(hashFloat(gx + 7777, gz + 3333) * TREE_GRID);
        const twx = gx * TREE_GRID + jx;
        const twz = gz * TREE_GRID + jz;

        // Only handle trunks that fall inside this chunk
        if (twx < wx0 || twx >= wx0 + CHUNK_SIZE) continue;
        if (twz < wz0 || twz >= wz0 + CHUNK_SIZE) continue;

        // Forest density: large-scale noise — positive means forest, negative means plains
        const forestNoise = fbm(twx * 0.004, twz * 0.004, 3, 0.5, 2.0);
        if (forestNoise < 0.1) continue; // plain area

        // Only on grass at mid-altitude (not underwater, not snowy peaks)
        const surface = terrainHeight(twx, twz);
        if (surface <= SEA_LEVEL || surface >= SNOW_HEIGHT - 4) continue;

        const treeSeed = hashFloat(gx * 131 + 7, gz * 97 + 3);
        placeTree(setBlock, twx, surface + 1, twz, treeSeed);
      }
    }
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz)) || null;
  }

  // Fetch or lazy-generate a chunk
  _ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (!this.chunks.has(key)) {
      const chunk = this._generateChunk(cx, cz);
      this.chunks.set(key, chunk);
    }
    return this.chunks.get(key);
  }

  // World-space block lookup (used by chunk meshing & player physics)
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return wy < 0 ? BLOCKS.STONE : BLOCKS.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BLOCKS.AIR; // unloaded = air (fog covers it)
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, wy, lz);
  }

  setBlock(wx, wy, wz, id) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this._ensureChunk(cx, cz);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlock(lx, wy, lz, id);

    // Mark neighboring chunks dirty if on a boundary
    if (lx === 0)                  { const c = this.getChunk(cx-1, cz); if (c) c.dirty = true; }
    if (lx === CHUNK_SIZE-1)       { const c = this.getChunk(cx+1, cz); if (c) c.dirty = true; }
    if (lz === 0)                  { const c = this.getChunk(cx, cz-1); if (c) c.dirty = true; }
    if (lz === CHUNK_SIZE-1)       { const c = this.getChunk(cx, cz+1); if (c) c.dirty = true; }
  }

  // Call every frame with player world position
  update(playerX, playerZ) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // --- Pass 1: generate terrain for all chunks in range ---
    for (let dz = -config.drawDistance; dz <= config.drawDistance; dz++) {
      for (let dx = -config.drawDistance; dx <= config.drawDistance; dx++) {
        if (dx * dx + dz * dz > config.drawDistance * config.drawDistance) continue;
        this._ensureChunk(pcx + dx, pcz + dz);
      }
    }

    // --- Pass 2: decorate (plant trees) for chunks whose 8 neighbours all exist ---
    for (let dz = -config.drawDistance; dz <= config.drawDistance; dz++) {
      for (let dx = -config.drawDistance; dx <= config.drawDistance; dx++) {
        if (dx * dx + dz * dz > config.drawDistance * config.drawDistance) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const chunk = this.chunks.get(chunkKey(cx, cz));
        if (!chunk || chunk.decorated) continue;

        // All 8 neighbours must be generated before decorating
        let ready = true;
        outer: for (let nz = -1; nz <= 1; nz++) {
          for (let nx = -1; nx <= 1; nx++) {
            if (nx === 0 && nz === 0) continue;
            if (!this.chunks.has(chunkKey(cx + nx, cz + nz))) { ready = false; break outer; }
          }
        }
        if (ready) this._decorateChunk(cx, cz);
      }
    }

    // --- Pass 3: rebuild dirty meshes ---
    for (let dz = -config.drawDistance; dz <= config.drawDistance; dz++) {
      for (let dx = -config.drawDistance; dx <= config.drawDistance; dx++) {
        if (dx * dx + dz * dz > config.drawDistance * config.drawDistance) continue;
        const chunk = this.chunks.get(chunkKey(pcx + dx, pcz + dz));
        if (!chunk || !chunk.dirty) continue;

        const getBlock  = (wx, wy, wz) => this.getBlock(wx, wy, wz);
        const mesh      = chunk.buildMesh(getBlock, this.material);
        const waterMesh = chunk.buildWaterMesh(getBlock, this.waterMaterial);
        if (mesh)      this.scene.add(mesh);
        if (waterMesh) this.scene.add(waterMesh);
      }
    }

    // --- Pass 4: unload distant chunks ---
    const unloadDist = config.drawDistance + 2;
    for (const [key, chunk] of this.chunks) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - pcx, dz = cz - pcz;
      if (Math.abs(dx) > unloadDist || Math.abs(dz) > unloadDist) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }

  // BFS water propagation from a position that just became AIR.
  // Fills any AIR block reachable from a water source (above or horizontal neighbor).
  propagateWater(wx, wy, wz) {
    const queue = [];
    const visited = new Set();

    const enqueue = (x, y, z) => {
      const key = `${x},${y},${z}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push([x, y, z]);
      }
    };

    enqueue(wx, wy, wz);

    while (queue.length > 0) {
      const [x, y, z] = queue.shift();
      if (this.getBlock(x, y, z) !== BLOCKS.AIR) continue;

      // Water flows here if the block above or any horizontal neighbour is water
      const canFlow =
        this.getBlock(x, y + 1, z) === BLOCKS.WATER ||
        this.getBlock(x + 1, y, z) === BLOCKS.WATER ||
        this.getBlock(x - 1, y, z) === BLOCKS.WATER ||
        this.getBlock(x, y, z + 1) === BLOCKS.WATER ||
        this.getBlock(x, y, z - 1) === BLOCKS.WATER;

      if (!canFlow) continue;

      this.setBlock(x, y, z, BLOCKS.WATER);

      // Continue spreading: downward first, then horizontal (never upward)
      enqueue(x, y - 1, z);
      enqueue(x + 1, y, z);
      enqueue(x - 1, y, z);
      enqueue(x, y, z + 1);
      enqueue(x, y, z - 1);
    }
  }

  // DDA voxel raycast. Returns { pos, face, placePos } or null.
  // pos = hit block world coords, face = outward normal array, placePos = adjacent empty cell
  raycast(origin, direction, maxDist = 6) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const dx = direction.x, dy = direction.y, dz = direction.z;
    const sx = Math.sign(dx) || 1;
    const sy = Math.sign(dy) || 1;
    const sz = Math.sign(dz) || 1;

    const tdx = Math.abs(dx) < 1e-8 ? Infinity : Math.abs(1 / dx);
    const tdy = Math.abs(dy) < 1e-8 ? Infinity : Math.abs(1 / dy);
    const tdz = Math.abs(dz) < 1e-8 ? Infinity : Math.abs(1 / dz);

    let tmx = sx > 0 ? (x + 1 - origin.x) * tdx : (origin.x - x) * tdx;
    let tmy = sy > 0 ? (y + 1 - origin.y) * tdy : (origin.y - y) * tdy;
    let tmz = sz > 0 ? (z + 1 - origin.z) * tdz : (origin.z - z) * tdz;

    let face = [0, 0, 0];
    let t = 0;

    while (t < maxDist) {
      if (tmx < tmy && tmx < tmz) {
        t = tmx; tmx += tdx; x += sx; face = [-sx, 0, 0];
      } else if (tmy < tmz) {
        t = tmy; tmy += tdy; y += sy; face = [0, -sy, 0];
      } else {
        t = tmz; tmz += tdz; z += sz; face = [0, 0, -sz];
      }
      if (t > maxDist) break;

      const id = this.getBlock(x, y, z);
      if (id !== BLOCKS.AIR && id !== BLOCKS.WATER && id >= 0) {
        return {
          pos:      { x, y, z },
          face:     [...face],
          placePos: { x: x + face[0], y: y + face[1], z: z + face[2] },
          blockId:  id,
        };
      }
    }
    return null;
  }
}
