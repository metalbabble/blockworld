# BlockWorld Commands

Press `/` during gameplay to open the command bar. Type a command and press **Enter** to run it, or **Esc** to cancel. The game pauses while the command bar is open. A response message appears briefly after each command.

## Commands

### `debug`

Toggles debug mode on/off.

While debug mode is **on**:
- Movement speed is **4x** faster than normal.
- Holding **Space** continuously applies upward velocity, allowing the player to fly upward indefinitely.

```
> debug
Debug mode ON
```

```
> debug
Debug mode OFF
```

---

### `drawdistance <n>`

Sets the draw distance to `n` chunks in each direction from the player. Valid range: **1–32**.

```
> drawdistance 8
Draw distance set to 8
```

The fog boundary updates immediately to match the new value.

---

### `reset`

Clears all loaded chunks and respawns the player at the original spawn location (0, 0). The world regenerates from the same seed, so the terrain will be identical.

```
> reset
World reset.
```

---

## Invalid Commands

Unrecognised input returns:

```
Invalid command
```
