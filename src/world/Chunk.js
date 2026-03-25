import * as THREE from 'three';
import { tileUV } from '../rendering/TextureAtlas.js';

export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 64;

export const BLOCKS = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SNOW: 4, WATER: 5, BEDROCK: 6, WOOD: 7, LEAVES: 8, GEM: 9 };

export const BLOCK_NAMES = { 0: 'air', 1: 'grass', 2: 'dirt', 3: 'stone', 4: 'snow', 5: 'water', 6: 'bedrock', 7: 'wood', 8: 'leaves', 9: 'gem' };

// Atlas tile indices per block face
// face order: left(-X), right(+X), bottom(-Y), top(+Y), back(-Z), front(+Z)
function getTile(blockId, faceIndex) {
  switch (blockId) {
    case BLOCKS.GRASS:
      if (faceIndex === 3) return 0; // top  → grass_top
      if (faceIndex === 2) return 2; // bottom → dirt
      return 1;                      // sides → grass_side
    case BLOCKS.DIRT:  return 2;
    case BLOCKS.STONE: return 3;
    case BLOCKS.SNOW:    return 4;
    case BLOCKS.BEDROCK: return 5;
    case BLOCKS.WOOD:    return 6;
    case BLOCKS.LEAVES:  return 7;
    case BLOCKS.GEM:     return 8;
    default: return 2;
  }
}

// Face definitions: for each of 6 faces, 4 corners with local (0–1) positions
// and base UVs. Triangles use indices 0,1,2 and 2,1,3.
const FACE_DEFS = [
  { dir: [-1, 0, 0], corners: [[0,1,0],[0,0,0],[0,1,1],[0,0,1]], norm: [-1,0,0] }, // -X
  { dir: [ 1, 0, 0], corners: [[1,1,1],[1,0,1],[1,1,0],[1,0,0]], norm: [ 1,0,0] }, // +X
  { dir: [ 0,-1, 0], corners: [[1,0,1],[0,0,1],[1,0,0],[0,0,0]], norm: [ 0,-1,0] }, // -Y
  { dir: [ 0, 1, 0], corners: [[0,1,1],[1,1,1],[0,1,0],[1,1,0]], norm: [ 0, 1,0] }, // +Y
  { dir: [ 0, 0,-1], corners: [[1,1,0],[1,0,0],[0,1,0],[0,0,0]], norm: [ 0,0,-1] }, // -Z
  { dir: [ 0, 0, 1], corners: [[0,1,1],[0,0,1],[1,1,1],[1,0,1]], norm: [ 0,0, 1] }, // +Z
];

// Pre-compute AO neighbor offsets for each face × corner.
// For each corner, returns [side1, side2, diag] offsets to sample for occlusion.
// side1/side2 are the two tangent-direction neighbors; diag is the corner block.
const FACE_AO_OFFSETS = FACE_DEFS.map(({ dir: [dx, dy, dz], corners }) => {
  let t1, t2;
  if      (dx !== 0) { t1 = [0,1,0]; t2 = [0,0,1]; }
  else if (dy !== 0) { t1 = [1,0,0]; t2 = [0,0,1]; }
  else               { t1 = [1,0,0]; t2 = [0,1,0]; }

  return corners.map(([cx, cy, cz]) => {
    let a, b;
    if      (dx !== 0) { a = 2*cy-1; b = 2*cz-1; }
    else if (dy !== 0) { a = 2*cx-1; b = 2*cz-1; }
    else               { a = 2*cx-1; b = 2*cy-1; }

    return [
      [dx + a*t1[0], dy + a*t1[1], dz + a*t1[2]],
      [dx + b*t2[0], dy + b*t2[1], dz + b*t2[2]],
      [dx + a*t1[0] + b*t2[0], dy + a*t1[1] + b*t2[1], dz + a*t1[2] + b*t2[2]],
    ];
  });
});

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks    = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.mesh      = null;
    this.waterMesh = null;
    this.dirty     = true;
    this.decorated = false;
  }

  _idx(x, y, z) {
    return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
  }

  getBlock(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return -1; // out of local bounds
    }
    return this.blocks[this._idx(x, y, z)];
  }

  setBlock(x, y, z, id) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.blocks[this._idx(x, y, z)] = id;
    this.dirty = true;
  }

  // Build or rebuild the Three.js mesh.
  // getWorldBlock(wx, wy, wz) looks up blocks in neighboring chunks.
  buildMesh(getWorldBlock, material) {
    const positions = [];
    const normals   = [];
    const uvs       = [];
    const colors    = [];
    const indices   = [];

    const wx0 = this.cx * CHUNK_SIZE;
    const wz0 = this.cz * CHUNK_SIZE;

    // Returns true if a block at local coords (bx,by,bz) should cast AO
    const isSolidForAO = (bx, by, bz) => {
      if (by < 0 || by >= CHUNK_HEIGHT) return false;
      let b;
      if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE) {
        b = this.getBlock(bx, by, bz);
      } else {
        b = getWorldBlock(wx0 + bx, by, wz0 + bz);
      }
      return b > 0 && b !== BLOCKS.WATER && b !== BLOCKS.LEAVES && b !== -1;
    };

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.getBlock(x, y, z);
          if (id === BLOCKS.AIR || id === BLOCKS.WATER) continue;

          for (let fi = 0; fi < FACE_DEFS.length; fi++) {
            const face = FACE_DEFS[fi];
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];

            // Determine neighbor block – cross chunk boundary via world lookup
            let neighbor;
            if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) {
              neighbor = getWorldBlock(wx0 + nx, ny, wz0 + nz);
            } else if (ny < 0) {
              neighbor = BLOCKS.STONE; // bedrock below
            } else if (ny >= CHUNK_HEIGHT) {
              neighbor = BLOCKS.AIR;
            } else {
              neighbor = this.getBlock(nx, ny, nz);
            }

            // Skip face if hidden by opaque neighbor (water and leaves are transparent)
            if (neighbor > 0 && neighbor !== BLOCKS.WATER && neighbor !== BLOCKS.LEAVES) continue;
            // Leaves don't render internal faces against other leaves
            if (id === BLOCKS.LEAVES && neighbor === BLOCKS.LEAVES) continue;

            const tile = getTile(id, fi);
            const [uMin, uMax] = tileUV(tile);

            // Compute per-corner AO (0=fully occluded … 3=unoccluded)
            const aoOffsets = FACE_AO_OFFSETS[fi];
            const ao = [0, 0, 0, 0];
            for (let ci = 0; ci < 4; ci++) {
              const [o1, o2, o3] = aoOffsets[ci];
              const s1 = isSolidForAO(x + o1[0], y + o1[1], z + o1[2]) ? 1 : 0;
              const s2 = isSolidForAO(x + o2[0], y + o2[1], z + o2[2]) ? 1 : 0;
              const sd = isSolidForAO(x + o3[0], y + o3[1], z + o3[2]) ? 1 : 0;
              ao[ci] = (s1 && s2) ? 0 : 3 - s1 - s2 - sd;
            }

            const base = positions.length / 3;
            for (let ci = 0; ci < 4; ci++) {
              const [cx, cy, cz] = face.corners[ci];
              positions.push(x + cx, y + cy, z + cz);
              normals.push(...face.norm);
              const v = 0.55 + (ao[ci] / 3) * 0.45; // [0.55, 1.0]
              colors.push(v, v, v);
            }
            // UV: corners map to (uMin,1),(uMin,0),(uMax,1),(uMax,0)
            uvs.push(
              uMin, 1,
              uMin, 0,
              uMax, 1,
              uMax, 0
            );
            // Flip quad diagonal to avoid AO anisotropy artifacts
            if (ao[0] + ao[3] > ao[1] + ao[2]) {
              indices.push(base, base+1, base+2, base+2, base+1, base+3);
            } else {
              indices.push(base, base+1, base+3, base, base+3, base+2);
            }
          }
        }
      }
    }

    // Dispose old mesh
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.removeFromParent();
      this.mesh = null;
    }

    if (indices.length === 0) {
      this.dirty = false;
      return null;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);

    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.position.set(wx0, 0, wz0);
    this.mesh.castShadow    = false;
    this.mesh.receiveShadow = false;
    this.dirty = false;
    return this.mesh;
  }

  // Build transparent water mesh — only faces adjacent to air are emitted.
  buildWaterMesh(getWorldBlock, waterMaterial) {
    const positions = [];
    const normals   = [];
    const indices   = [];

    const wx0 = this.cx * CHUNK_SIZE;
    const wz0 = this.cz * CHUNK_SIZE;

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          if (this.getBlock(x, y, z) !== BLOCKS.WATER) continue;

          for (let fi = 0; fi < FACE_DEFS.length; fi++) {
            const face = FACE_DEFS[fi];
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];

            let neighbor;
            if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) {
              neighbor = getWorldBlock(wx0 + nx, ny, wz0 + nz);
            } else if (ny < 0) {
              neighbor = BLOCKS.STONE;
            } else if (ny >= CHUNK_HEIGHT) {
              neighbor = BLOCKS.AIR;
            } else {
              neighbor = this.getBlock(nx, ny, nz);
            }

            // Only render the top surface of water (+Y face, fi=3) — no side walls
            if (fi !== 3 || neighbor !== BLOCKS.AIR) continue;

            const base = positions.length / 3;
            for (const [cx, cy, cz] of face.corners) {
              positions.push(x + cx, y + cy, z + cz);
              normals.push(...face.norm);
            }
            indices.push(base, base+1, base+2, base+2, base+1, base+3);
          }
        }
      }
    }

    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      this.waterMesh.removeFromParent();
      this.waterMesh = null;
    }

    if (indices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);

    this.waterMesh = new THREE.Mesh(geo, waterMaterial);
    this.waterMesh.position.set(wx0, 0, wz0);
    return this.waterMesh;
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.removeFromParent();
      this.mesh = null;
    }
    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      this.waterMesh.removeFromParent();
      this.waterMesh = null;
    }
  }
}
