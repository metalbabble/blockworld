// Seeded 2D Perlin noise

const perm = new Uint8Array(512);

function seedPermutation(seed) {
  const table = Array.from({ length: 256 }, (_, i) => i);
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    const j = s % (i + 1);
    [table[i], table[j]] = [table[j], table[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = table[i & 255];
}

export const WORLD_SEED = (Math.random() * 999999 + 1) | 0;
seedPermutation(WORLD_SEED);

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function grad2(hash, x, y) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

export function perlin2(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const a  = perm[X]     + Y;
  const b  = perm[X + 1] + Y;
  return lerp(
    lerp(grad2(perm[a],     xf,     yf),     grad2(perm[b],     xf - 1, yf),     u),
    lerp(grad2(perm[a + 1], xf,     yf - 1), grad2(perm[b + 1], xf - 1, yf - 1), u),
    v
  );
}

// Fractional Brownian Motion — layered octaves for natural terrain
export function fbm(x, y, octaves = 5, persistence = 0.5, lacunarity = 2.0) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += perlin2(x * freq, y * freq) * amp;
    max += amp;
    amp  *= persistence;
    freq *= lacunarity;
  }
  return val / max; // normalised to roughly [-1, 1]
}
