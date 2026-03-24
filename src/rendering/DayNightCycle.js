import * as THREE from 'three';

// Full cycle duration in seconds (10 minutes)
const CYCLE = 600;

// t=0 is midnight, t=0.25 is dawn, t=0.5 is noon, t=0.75 is dusk
// Keyframes: [t, hexColor]
const SKY_KEYS = [
  [0.00, 0x050a14],  // midnight
  [0.22, 0x050a14],  // pre-dawn dark
  [0.27, 0xf05020],  // dawn orange
  [0.35, 0x87ceeb],  // morning blue
  [0.65, 0x87ceeb],  // afternoon blue
  [0.73, 0xf05020],  // dusk orange
  [0.78, 0x050a14],  // night
  [1.00, 0x050a14],  // midnight
];

// Sun color keyframes [t, hexColor]
const SUN_COL_KEYS = [
  [0.00, 0x000000],
  [0.25, 0x000000],
  [0.30, 0xff9050],  // warm sunrise
  [0.40, 0xfff5dd],  // white-ish day
  [0.60, 0xfff5dd],
  [0.70, 0xff9050],  // warm sunset
  [0.75, 0x000000],
  [1.00, 0x000000],
];

// Float keyframes [t, value]
const AMB_INT_KEYS = [
  [0.00, 0.05], [0.22, 0.05], [0.27, 0.25], [0.35, 0.65],
  [0.65, 0.65], [0.73, 0.25], [0.78, 0.05], [1.00, 0.05],
];

const SUN_INT_KEYS = [
  [0.00, 0.0], [0.25, 0.0], [0.32, 0.9], [0.68, 0.9], [0.75, 0.0], [1.00, 0.0],
];

function sampleFloat(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) return v0 + (v1 - v0) * (t - t0) / (t1 - t0);
  }
  return keys[keys.length - 1][1];
}

const _colorKeys = {};
function parseColorKeys(rawKeys) {
  return rawKeys.map(([t, hex]) => ({ t, c: new THREE.Color(hex) }));
}

const _tmp = new THREE.Color();
function sampleColor(keys, t) {
  if (t <= keys[0].t) return _tmp.copy(keys[0].c);
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i], k1 = keys[i + 1];
    if (t <= k1.t) {
      const f = (t - k0.t) / (k1.t - k0.t);
      return _tmp.lerpColors(k0.c, k1.c, f);
    }
  }
  return _tmp.copy(keys[keys.length - 1].c);
}

export class DayNightCycle {
  constructor(scene, renderer, fog, ambientLight, sunLight, camera) {
    this.scene        = scene;
    this.renderer     = renderer;
    this.fog          = fog;
    this.ambientLight = ambientLight;
    this.sunLight     = sunLight;
    this.camera       = camera;

    this._skyKeys    = parseColorKeys(SKY_KEYS);
    this._sunColKeys = parseColorKeys(SUN_COL_KEYS);

    // Start at early morning (just past dawn)
    this._time = 0.3;

    this._stars = this._createStars();
    scene.add(this._stars);
  }

  _createStars() {
    const N = 1000;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 200;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color:           0xffffff,
      size:            1.5,
      sizeAttenuation: false,
      transparent:     true,
      opacity:         0,
      fog:             false,
      depthWrite:      false,
    });
    return new THREE.Points(geo, mat);
  }

  update(dt) {
    this._time = (this._time + dt / CYCLE) % 1;
    const t = this._time;

    // Sky + fog color
    const sky = sampleColor(this._skyKeys, t);
    this.scene.background.copy(sky);
    this.fog.color.copy(sky);

    // Ambient
    this.ambientLight.intensity = sampleFloat(AMB_INT_KEYS, t);

    // Sun arc: phase=0 at dawn (t=0.25), π at dusk (t=0.75)
    const sunPhase = (t - 0.25) * Math.PI * 2;
    this.sunLight.position.set(Math.cos(sunPhase), Math.sin(sunPhase), 0.3);
    this.sunLight.intensity = sampleFloat(SUN_INT_KEYS, t);
    sampleColor(this._sunColKeys, t);
    this.sunLight.color.copy(_tmp);

    // Stars follow camera position (fixed radius in world space)
    this._stars.position.copy(this.camera.position);

    // Stars fade: fully visible at night (t<0.20 or t>0.80), fade at twilight
    let starOpacity = 0;
    if (t < 0.22) {
      starOpacity = t < 0.17 ? 1.0 : 1.0 - (t - 0.17) / 0.05;
    } else if (t > 0.78) {
      starOpacity = t > 0.83 ? 1.0 : (t - 0.78) / 0.05;
    }
    this._stars.material.opacity = starOpacity;
  }

  get timeOfDay() { return this._time; }
}
