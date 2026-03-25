import { createAtlasCanvas } from '../rendering/TextureAtlas.js';

const ICON_SIZE = 56;
const TILE_SIZE = 64;

// Block ID → atlas tile index used for icon display (top-face tile)
const BLOCK_ICON_TILE = { 1: 0, 2: 2, 3: 3, 4: 4, 5: -1, 7: 6, 8: 7, 9: 8 };

export class InventoryDock {
  constructor(player) {
    this._player      = player;
    this._atlasCanvas = createAtlasCanvas();
    this._el          = null;
    this._items       = new Map(); // blockId → { root, badge }
    this._buildDOM();
  }

  _buildDOM() {
    this._el    = document.createElement('div');
    this._el.id = 'inventory-dock';
    document.body.appendChild(this._el);
  }

  /** Re-render dock to match current inventory and selection. */
  update(inventory, selectedBlock) {
    // Remove items no longer in inventory
    for (const [id, item] of this._items) {
      if (!inventory.has(id)) {
        item.root.remove();
        this._items.delete(id);
      }
    }

    // Add new items and update existing counts + selection state
    for (const [id, count] of inventory) {
      if (!this._items.has(id)) this._addItem(id);
      const item = this._items.get(id);
      item.badge.textContent = count;
      item.root.classList.toggle('dock-selected', id === selectedBlock);
    }

    this._el.style.display = inventory.size > 0 ? 'flex' : 'none';
  }

  _addItem(blockId) {
    const root     = document.createElement('div');
    root.className = 'dock-item';

    const canvas  = document.createElement('canvas');
    canvas.width  = ICON_SIZE;
    canvas.height = ICON_SIZE;
    this._drawBlockIcon(canvas, blockId);

    const badge     = document.createElement('span');
    badge.className = 'dock-badge';

    root.appendChild(canvas);
    root.appendChild(badge);

    // Touch: tap to select this block
    root.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      this._player._selectBlock(blockId);
    }, { passive: false });

    this._el.appendChild(root);
    this._items.set(blockId, { root, badge });
  }

  _drawBlockIcon(canvas, blockId) {
    const tileIndex = BLOCK_ICON_TILE[blockId] ?? 2;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      this._atlasCanvas,
      tileIndex * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE,
      0, 0, ICON_SIZE, ICON_SIZE,
    );
  }
}
