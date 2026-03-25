# Overview
This is a browser-based first-person voxel sandbox built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). Dig up blocks and place them back down in an infinitely generating world. See [readme](README.md) for more.

# Guidelines
- When adding new commands, document them in README.md and COMMANDS.md
- The game generally supports touch. If adding new controls, ensure a plan is in place for touch support.
- When making changes, increment the version in settings (increment the third/patch value, e.g. 0.0.9 -> 0.0.10) - stored in config.js
- Document any config settings added to config.js in the README.md configuration table

## Adding a new block type
New blocks must be registered in all of these places:
1. `BLOCKS` enum + `BLOCK_NAMES` map in `src/world/Chunk.js`
2. `getTile()` switch in `src/world/Chunk.js` (assign an atlas tile index)
3. `src/rendering/TextureAtlas.js` — draw the procedural canvas tile (no image files are used)
4. `src/world/World.js` — if the block generates naturally in the world
5. `README.md` and `COMMANDS.md` — if it's accessible via `block <name>`

## Build & deploy
- `npm run dev` starts the dev server on port 3456
- `npm run build` outputs to `docs/` (GitHub Pages deploy target)

## Audio
`src/audio/SoundManager.js` and `src/audio/MusicPlayer.js` handle sound effects and music. New block interactions or game events should consider hooking into SoundManager.