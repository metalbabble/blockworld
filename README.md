# BlockWorld

A browser-based first-person voxel sandbox built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). Dig up blocks and place them back down in an infinitely generating world.

THIS GAME IS A WORK IN PROGRESS!!

Try it out: [Click here to play BlockWorld](https://metalbabble.github.io/blockworld/)

![Screenshot 1](/misc/1.png)
![Screenshot 2](/misc/2.png)
![Screenshot 3](/misc/3.png)
![Screenshot 4](/misc/4.png)
![Screenshot 5](/misc/5.png)

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:3456](http://localhost:3456) and click to start.

## Controls

### Keyboard & Mouse (desktop)

| Key / Button | Action |
|---|---|
| W / A / S / D | Move |
| Space | Jump |
| Mouse | Look around (FPS / Pointer Lock) |
| Left Click | Pick up targeted block |
| Right Click | Place held block |
| `/` | Open command bar |
| Esc | Cancel command / Release mouse / pause |

### Touch / Tablet

Tap the title screen (instead of clicking) to enter **touch mode**. On-screen controls appear along the bottom of the game view.

| Control | Action |
|---|---|
| ▲ ▼ ◀ ▶ (D-pad, bottom-left) | Move forward / back / left / right |
| JUMP button | Jump (hold to swim upward in water) |
| GRAB button | Pick up the targeted block |
| PUT button | Place the held block (disabled when hand is empty) |
| Drag finger on screen | Look / rotate camera |
| ☰ Menu (top-left) | Open the pause overlay (like Esc on desktop) |

Touch mode is also activated automatically when a touch event reaches the title screen, so tablets and phones are supported without any extra configuration.

## Commands

Press `/` during gameplay to open the command bar. See [`COMMANDS.md`](COMMANDS.md) for the full reference.

| Command | Description |
|---|---|
| `debug` | Toggle debug mode — 4x speed and hold Space to fly |
| `drawdistance <n>` | Set draw distance to `n` chunks (1–32) |
| `reset` | Regenerate the world and return to spawn |
| `touch on` | Enable on-screen touch controls (useful for testing on desktop) |
| `touch off` | Disable on-screen touch controls and return to keyboard/mouse |
| `info on` | Show the world-info overlay (XYZ position, chunk, seed) |
| `info off` | Hide the world-info overlay |
| `block <name>` | Place a block of the given type into your hand (e.g. `block gem`, `block stone`) |

## Gameplay

- **Move and place blocks** — left-clicking a block picks it up into your hand; right-clicking places it. You can only hold one block at a time.... for now
- **Placement rules** — blocks can only be placed adjacent to an existing block (no floating islands).
- **Ghost preview** — a white outline shows exactly where your held block will land before you place it.

## World Generation

- Infinite chunk-based world (16 × 16 × 64 per chunk)
- Terrain shaped by 6-octave FBM Perlin noise — rolling hills and valleys, ~16–40 blocks above sea level
- **Grass** on the surface, **dirt** for the top few layers, **stone** below
- **Gems** — rare iridescent crystal blocks that spawn in small clusters deep underground (Y ≤ 12). Dig down through stone to find them.
- Chunks load as you explore and unload when you move away; distance fog hides the boundary

## Configuration

Gameplay settings live in [`src/config.js`](src/config.js):

| Setting | Default | Description |
|---|---|---|
| `version` | `0.0.0` | Shows the current version of the game. |
| `drawDistance` | `5` | Chunks loaded/rendered in each direction from the player. Higher values show more world at the cost of performance. |

## Project Structure

```
src/
├── main.js                 Entry point
├── Game.js                 Scene, renderer, main loop
├── config.js               Gameplay settings (draw distance, etc.)
├── CommandSystem.js        In-game command bar (/ key)
├── TouchControls.js        On-screen touch gamepad (D-pad, actions, camera drag)
├── world/
│   ├── World.js            Chunk manager, block API, DDA raycast
│   ├── Chunk.js            Block storage + mesh builder
│   └── noise.js            Seeded 2D Perlin noise + FBM
├── player/
│   └── Player.js           FPS controls, AABB physics, block interaction
└── rendering/
    └── TextureAtlas.js     Procedural canvas texture atlas (no image files)
docs/
└── COMMANDS.md             In-game command reference
```

## Roadmap / Ideas

- [ ] Block inventory (hotbar with multiple block types)
- [ ] Underground caves
- [ ] Trees
- [ ] Lava
- [ ] Water block improvements (fill gaps, appearance underwater)
- [ ] Save/load world to localStorage
- [ ] Creative / Adventure modes
- [ ] Fault lines less straight, make zig zag
