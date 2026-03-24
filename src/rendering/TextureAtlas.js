import * as THREE from 'three';

// Atlas layout (horizontal strip, 8 tiles × 64px = 512×64, power-of-two)
// Tile 0: grass top   u=[0.000, 0.125]
// Tile 1: grass side  u=[0.125, 0.250]
// Tile 2: dirt        u=[0.250, 0.375]
// Tile 3: stone       u=[0.375, 0.500]
// Tile 4: snow        u=[0.500, 0.625]
// Tile 5: bedrock     u=[0.625, 0.750]
// Tile 6: wood        u=[0.750, 0.875]
// Tile 7: leaves      u=[0.875, 1.000]

const TILE_SIZE = 64;
const TILE_COUNT = 8;           // padded to next POT: 8×64 = 512px wide
const ATLAS_W = TILE_SIZE * TILE_COUNT;  // 512 — power of two
const ATLAS_H = TILE_SIZE;

function noise(x, y, scale = 8) {
  // sin-based value noise — well-distributed across [0,1) for any integer inputs
  const xi = Math.floor(x * scale);
  const yi = Math.floor(y * scale);
  const s = Math.sin(xi * 127.1 + yi * 311.7 + 43.758) * 43758.5453;
  return s - Math.floor(s);
}

function drawGrassTop(ctx, ox) {
  // Base green
  ctx.fillStyle = '#5a9e3a';
  ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
  // Variation
  for (let px = 0; px < TILE_SIZE; px++) {
    for (let py = 0; py < TILE_SIZE; py++) {
      const v = noise(px / TILE_SIZE, py / TILE_SIZE, 10);
      const g = Math.floor(90 + v * 40);
      ctx.fillStyle = `rgb(${Math.floor(g * 0.55)},${g},${Math.floor(g * 0.3)})`;
      ctx.fillRect(ox + px, py, 1, 1);
    }
  }
  // Subtle darker patches spread across the tile
  for (let i = 0; i < 12; i++) {
    const px = Math.floor(noise(i * 0.15 + 0.07, i * 0.23 + 0.13, 8) * TILE_SIZE);
    const py = Math.floor(noise(i * 0.19 + 0.41, i * 0.11 + 0.53, 8) * TILE_SIZE);
    ctx.fillStyle = 'rgba(0,40,0,0.18)';
    ctx.fillRect(ox + px, py, 4, 4);
  }
}

function drawGrassSide(ctx, ox) {
  // Brown dirt base
  drawDirt(ctx, ox);
  // Green stripe on top (~16px)
  const stripeH = 14;
  for (let px = 0; px < TILE_SIZE; px++) {
    for (let py = 0; py < stripeH; py++) {
      const v = noise(px / TILE_SIZE, py / stripeH, 8);
      const g = Math.floor(90 + v * 40);
      const fade = (stripeH - py) / stripeH;
      ctx.fillStyle = `rgba(${Math.floor(g * 0.55)},${g},${Math.floor(g * 0.3)},${0.7 + fade * 0.3})`;
      ctx.fillRect(ox + px, py, 1, 1);
    }
  }
  // Grass blades on very top row
  ctx.fillStyle = '#4a8e2a';
  for (let px = 0; px < TILE_SIZE; px += 2) {
    const h = 2 + Math.floor(noise(px / TILE_SIZE, 0, 5) * 4);
    ctx.fillRect(ox + px, 0, 1, h);
  }
}

function drawDirt(ctx, ox) {
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
  for (let px = 0; px < TILE_SIZE; px++) {
    for (let py = 0; py < TILE_SIZE; py++) {
      const v = noise(px / TILE_SIZE, py / TILE_SIZE, 9);
      const r = Math.floor(100 + v * 50);
      const g = Math.floor(70 + v * 25);
      const b = Math.floor(35 + v * 15);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(ox + px, py, 1, 1);
    }
  }
  // Subtle pebble-like dark dots spread across the tile
  for (let i = 0; i < 20; i++) {
    const px = Math.floor(noise(i * 0.13 + 0.09, i * 0.17 + 0.43, 8) * TILE_SIZE);
    const py = Math.floor(noise(i * 0.19 + 0.57, i * 0.09 + 0.21, 8) * TILE_SIZE);
    ctx.fillStyle = 'rgba(40,20,10,0.35)';
    ctx.beginPath();
    ctx.arc(ox + px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnow(ctx, ox) {
  ctx.fillStyle = '#dde8f4';
  ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
  for (let px = 0; px < TILE_SIZE; px++) {
    for (let py = 0; py < TILE_SIZE; py++) {
      const v = noise(px / TILE_SIZE, py / TILE_SIZE, 8);
      const c = Math.floor(210 + v * 45);
      const b = Math.floor(220 + v * 35);
      ctx.fillStyle = `rgb(${c},${c},${b})`;
      ctx.fillRect(ox + px, py, 1, 1);
    }
  }
  // Sparkle highlights spread across the tile
  for (let i = 0; i < 20; i++) {
    const px = Math.floor(noise(i * 0.17 + 0.11, i * 0.13 + 0.61, 8) * TILE_SIZE);
    const py = Math.floor(noise(i * 0.11 + 0.73, i * 0.21 + 0.37, 8) * TILE_SIZE);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(ox + px, py, 2, 2);
  }
}

function drawStone(ctx, ox) {
  ctx.fillStyle = '#888';
  ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
  for (let px = 0; px < TILE_SIZE; px++) {
    for (let py = 0; py < TILE_SIZE; py++) {
      const v = noise(px / TILE_SIZE, py / TILE_SIZE, 7);
      const c = Math.floor(110 + v * 60);
      ctx.fillStyle = `rgb(${c},${c},${c})`;
      ctx.fillRect(ox + px, py, 1, 1);
    }
  }
  // Crack lines
  ctx.strokeStyle = 'rgba(60,60,60,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox + 10, 15); ctx.lineTo(ox + 30, 35);
  ctx.moveTo(ox + 40, 5);  ctx.lineTo(ox + 55, 20);
  ctx.moveTo(ox + 20, 45); ctx.lineTo(ox + 50, 60);
  ctx.stroke();
}

function drawBedrock(ctx, ox) {
  // Very dark base
  ctx.fillStyle = '#222';
  ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
  // Noisy dark stone variation
  for (let px = 0; px < TILE_SIZE; px++) {
    for (let py = 0; py < TILE_SIZE; py++) {
      const v = noise(px / TILE_SIZE, py / TILE_SIZE, 7);
      const c = Math.floor(40 + v * 35);
      ctx.fillStyle = `rgb(${c},${c},${c})`;
      ctx.fillRect(ox + px, py, 1, 1);
    }
  }
  // Scattered dark blotches for a rough, ancient look
  for (let i = 0; i < 18; i++) {
    const px = Math.floor(noise(i * 0.17 + 0.05, i * 0.23 + 0.11, 8) * TILE_SIZE);
    const py = Math.floor(noise(i * 0.21 + 0.43, i * 0.09 + 0.67, 8) * TILE_SIZE);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(ox + px, py, 5, 5);
  }
  // Faint crack lines
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox + 5, 20);  ctx.lineTo(ox + 25, 40);
  ctx.moveTo(ox + 35, 8);  ctx.lineTo(ox + 55, 28);
  ctx.moveTo(ox + 15, 50); ctx.lineTo(ox + 45, 62);
  ctx.stroke();
}

function drawWood(ctx, ox) {
  // Base dark brown
  ctx.fillStyle = '#4a2e0e';
  ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
  // Grain variation
  for (let px = 0; px < TILE_SIZE; px++) {
    for (let py = 0; py < TILE_SIZE; py++) {
      const v = noise(px / TILE_SIZE, py / TILE_SIZE, 6);
      const r = Math.floor(75 + v * 45);
      const g = Math.floor(48 + v * 28);
      const b = Math.floor(18 + v * 14);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(ox + px, py, 1, 1);
    }
  }
  // Vertical grain lines
  ctx.strokeStyle = 'rgba(25,12,3,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const px = Math.floor(noise(i * 0.17 + 0.05, i * 0.23 + 0.11, 5) * TILE_SIZE);
    ctx.beginPath();
    ctx.moveTo(ox + px, 0);
    ctx.lineTo(ox + px + Math.floor(noise(i * 0.2, 0.1, 3) * 6 - 3), TILE_SIZE);
    ctx.stroke();
  }
  // Horizontal bark rings
  ctx.strokeStyle = 'rgba(15,8,0,0.25)';
  for (let i = 0; i < 5; i++) {
    const py = Math.floor(noise(i * 0.23 + 0.11, i * 0.17 + 0.43, 7) * TILE_SIZE);
    ctx.beginPath();
    ctx.moveTo(ox, py);
    ctx.lineTo(ox + TILE_SIZE, py + Math.floor(noise(i * 0.15, 0.3, 4) * 6 - 3));
    ctx.stroke();
  }
}

function drawLeaves(ctx, ox) {
  // Base green
  ctx.fillStyle = '#2d7a1f';
  ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
  // Noisy green variation
  for (let px = 0; px < TILE_SIZE; px++) {
    for (let py = 0; py < TILE_SIZE; py++) {
      const v = noise(px / TILE_SIZE, py / TILE_SIZE, 9);
      const r = Math.floor(18 + v * 38);
      const g = Math.floor(88 + v * 62);
      const b = Math.floor(8 + v * 22);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(ox + px, py, 1, 1);
    }
  }
  // Small elliptical leaf highlights
  for (let i = 0; i < 18; i++) {
    const px = Math.floor(noise(i * 0.13 + 0.07, i * 0.19 + 0.31, 8) * TILE_SIZE);
    const py = Math.floor(noise(i * 0.17 + 0.53, i * 0.11 + 0.23, 8) * TILE_SIZE);
    ctx.fillStyle = 'rgba(70,150,35,0.45)';
    ctx.beginPath();
    ctx.ellipse(ox + px, py, 4, 2, noise(i * 0.21, 0.5, 5) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dark gaps suggesting depth
  for (let i = 0; i < 12; i++) {
    const px = Math.floor(noise(i * 0.23 + 0.41, i * 0.07 + 0.67, 8) * TILE_SIZE);
    const py = Math.floor(noise(i * 0.09 + 0.83, i * 0.29 + 0.17, 8) * TILE_SIZE);
    ctx.fillStyle = 'rgba(0,25,0,0.45)';
    ctx.fillRect(ox + px, py, 3, 3);
  }
}

export function createTextureAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width  = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');

  drawGrassTop(ctx,   0 * TILE_SIZE);
  drawGrassSide(ctx,  1 * TILE_SIZE);
  drawDirt(ctx,       2 * TILE_SIZE);
  drawStone(ctx,      3 * TILE_SIZE);
  drawSnow(ctx,       4 * TILE_SIZE);
  drawBedrock(ctx,    5 * TILE_SIZE);
  drawWood(ctx,       6 * TILE_SIZE);
  drawLeaves(ctx,     7 * TILE_SIZE);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

// Returns [uMin, uMax] for a given atlas tile index
export function tileUV(index) {
  const step = 1 / TILE_COUNT;
  return [index * step, (index + 1) * step];
}
