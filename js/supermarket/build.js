import { ECONOMY, LEVEL_REGIONS, LEVEL_BUILD_THRESHOLDS, GRID } from './config.js?v=m3c';

export const BUILD_TYPES = [
  { id: 'shelf', label: 'Kệ', costKey: 'buildShelf', stock: 10, stockCap: 12 },
  { id: 'checkout', label: 'Quầy', costKey: 'buildCheckout' },
  { id: 'stockroom', label: 'Kho', costKey: 'buildStockroom' },
];

export function countOpened(cells) {
  let n = 0;
  for (const row of cells) for (const c of row) if (c.state !== 'locked') n += 1;
  return n;
}

export function countBuildings(cells) {
  let n = 0;
  for (const row of cells) for (const c of row) if (c.building && c.building !== 'door') n += 1;
  return n;
}

export function maxLevel() {
  return Math.max(...Object.keys(LEVEL_REGIONS).map(Number));
}

/** Level theo số công trình — không phụ thuộc số ô đã mở. */
export function storeLevel(cells) {
  const b = countBuildings(cells);
  let level = 1;
  for (let lv = 1; lv <= maxLevel(); lv++) {
    if (b >= (LEVEL_BUILD_THRESHOLDS[lv] ?? 0)) level = lv;
  }
  return level;
}

export function nextLevelProgress(cells) {
  const level = storeLevel(cells);
  const next = level + 1;
  if (!LEVEL_BUILD_THRESHOLDS[next]) {
    return { level, next: null, have: countBuildings(cells), need: null, done: true };
  }
  const have = countBuildings(cells);
  const need = LEVEL_BUILD_THRESHOLDS[next];
  return { level, next, have, need, done: false };
}

export function regionForLevel(level) {
  const capped = Math.min(Math.max(1, level), maxLevel());
  return LEVEL_REGIONS[capped] || LEVEL_REGIONS[1];
}

export function cellInRegion(x, y, region) {
  return x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1;
}

/**
 * Mở toàn bộ vùng của level (và các level thấp hơn).
 * Trả về danh sách ô vừa được mở (trước đó locked).
 */
export function applyOpenRegion(cells, level) {
  const newly = [];
  const region = regionForLevel(level);
  for (let y = region.y0; y <= region.y1; y++) {
    for (let x = region.x0; x <= region.x1; x++) {
      const cell = cells[y]?.[x];
      if (!cell) continue;
      if (cell.state === 'locked') {
        cell.state = 'empty';
        if (!cell.building) cell.building = null;
        newly.push(cell);
      }
    }
  }
  return newly;
}

export function canBuild(cell) {
  return !!cell && cell.state === 'empty' && !cell.building;
}

export function placeBuilding(cell, typeId) {
  if (!canBuild(cell)) return { ok: false, reason: 'Cần ô trống' };
  const type = BUILD_TYPES.find(t => t.id === typeId);
  if (!type) return { ok: false, reason: 'Loại xây không hợp lệ' };
  const price = ECONOMY[type.costKey];
  cell.state = 'occupied';
  cell.building = type.id;
  if (type.id === 'shelf') {
    cell.stockCap = type.stockCap;
    cell.stock = type.stock;
  } else {
    cell.stock = 0;
    cell.stockCap = 0;
  }
  return { ok: true, price, type };
}

export function refreshActorsBuildings(actors, cells) {
  actors.shelves = cells.flat().filter(c => c.building === 'shelf');
  actors.checkout = cells.flat().find(c => c.building === 'checkout') || actors.checkout;
  const door = cells.flat().find(c => c.building === 'door');
  if (door) actors.door = { x: door.x, y: door.y };
  // Khách đông hơn khi siêu thị lớn.
  const lv = storeLevel(cells);
  actors.maxCustomers = 4 + lv;
}

export function totalCells() {
  return GRID.width * GRID.height;
}
