import { GRID } from './config.js?v=m1c';

export function createGrid() {
  const cells = [];
  for (let y = 0; y < GRID.height; y++) {
    const row = [];
    for (let x = 0; x < GRID.width; x++) row.push({ x, y, state: 'locked', building: null });
    cells.push(row);
  }
  for (const [x, y] of GRID.startOpen) {
    if (cells[y]?.[x]) cells[y][x].state = 'empty';
  }
  // Layout mẫu để nhìn thấy occupied ngay từ M1.
  seed(cells, 3, 3, 'shelf');
  seed(cells, 4, 3, 'shelf');
  seed(cells, 3, 5, 'checkout');
  seed(cells, 5, 4, 'stockroom');
  return cells;
}

function seed(cells, x, y, building) {
  const cell = cells[y]?.[x];
  if (!cell) return;
  cell.state = 'occupied';
  cell.building = building;
}

export function gridToScreen(x, y, originX, originY, tile = GRID.tile) {
  return {
    x: originX + x * tile,
    y: originY + y * tile,
  };
}

export function screenToGrid(sx, sy, originX, originY, tile = GRID.tile) {
  return {
    x: Math.floor((sx - originX) / tile),
    y: Math.floor((sy - originY) / tile),
  };
}

export function forEachCell(cells, fn) {
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) fn(cells[y][x]);
  }
}

export function countByState(cells) {
  const out = { locked: 0, empty: 0, occupied: 0 };
  forEachCell(cells, cell => { out[cell.state] = (out[cell.state] || 0) + 1; });
  return out;
}
