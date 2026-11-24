import { ECONOMY } from './config.js?v=m3b';

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

export function storeLevel(cells) {
  const opened = countOpened(cells);
  const buildings = countBuildings(cells);
  return 1
    + Math.floor(Math.max(0, opened - 16) / 4)
    + Math.floor(Math.max(0, buildings - 4) / 2);
}

export function unlockPrice(cells) {
  const opened = countOpened(cells);
  const extras = Math.max(0, opened - 16);
  return ECONOMY.unlockCellBase + extras * ECONOMY.unlockCellStep;
}

export function isAdjacentToOpen(cells, x, y) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const n = cells[y + dy]?.[x + dx];
    if (n && n.state !== 'locked') return true;
  }
  return false;
}

export function canUnlock(cells, cell) {
  return !!cell && cell.state === 'locked' && isAdjacentToOpen(cells, cell.x, cell.y);
}

export function canBuild(cell) {
  return !!cell && cell.state === 'empty' && !cell.building;
}

export function unlockCell(cells, cell) {
  if (!canUnlock(cells, cell)) return { ok: false, reason: 'Ô này chưa mở được' };
  const price = unlockPrice(cells);
  cell.state = 'empty';
  cell.building = null;
  return { ok: true, price };
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
}
