// My Supermarket — thông số Pha 0 đã khóa cho prototype.
export const BRAND = {
  name: 'My Supermarket',
  slogan: 'Build your aisle empire.',
  colors: {
    ink: '#1f3a46',
    bg: '#d8eef5',
    floor: '#f3f7ea',
    floorLine: '#c5d6b4',
    accent: '#1f8f6c',
    money: '#e6b422',
    shelf: '#5ea3c2',
    locked: '#9bb0b8',
    danger: '#e4574c',
    panel: '#fffdf7',
  },
};

export const GRID = {
  width: 8,
  height: 8,
  tile: 58,
  view: 'topdown',
};

// Mỗi level mở nguyên một vùng (rect inclusive). Lên cấp → auto unlock vùng đó.
export const LEVEL_REGIONS = {
  1: { x0: 2, y0: 2, x1: 5, y1: 5 }, // 4×4 sảnh ban đầu
  2: { x0: 1, y0: 1, x1: 6, y1: 6 }, // 6×6
  3: { x0: 0, y0: 1, x1: 7, y1: 6 }, // gần full
  4: { x0: 0, y0: 0, x1: 7, y1: 7 }, // full map
};

// Level theo số công trình (không tính cửa). Seed = 4 → Lv1.
export const LEVEL_BUILD_THRESHOLDS = {
  1: 0,
  2: 6,  // +2 công trình so với seed
  3: 8,
  4: 10,
};

export const ECONOMY = {
  startMoney: 160,
  buildShelf: 50,
  buildCheckout: 75,
  buildStockroom: 65,
  restockPack: 25,
  autoCollect: 220,
};

export const SKUS = [
  { id: 'water', name: 'Nước suối', category: 'Drinks', cost: 2, price: 5, shelfCap: 12, popularity: 1.0, color: '#4f9dff' },
  { id: 'cola', name: 'Cola', category: 'Drinks', cost: 3, price: 7, shelfCap: 10, popularity: 0.9, color: '#e4574c' },
  { id: 'juice', name: 'Nước cam', category: 'Drinks', cost: 3, price: 8, shelfCap: 8, popularity: 0.7, color: '#f59e0b' },
  { id: 'chips', name: 'Snack', category: 'Snacks', cost: 2, price: 6, shelfCap: 14, popularity: 0.95, color: '#e6b422' },
  { id: 'cookie', name: 'Bánh quy', category: 'Snacks', cost: 3, price: 7, shelfCap: 10, popularity: 0.8, color: '#a8794f' },
  { id: 'candy', name: 'Kẹo', category: 'Snacks', cost: 1, price: 4, shelfCap: 16, popularity: 0.75, color: '#ec4899' },
  { id: 'apple', name: 'Táo', category: 'Fresh', cost: 2, price: 5, shelfCap: 10, popularity: 0.7, color: '#22c55e' },
  { id: 'milk', name: 'Sữa', category: 'Fresh', cost: 4, price: 9, shelfCap: 8, popularity: 0.85, color: '#f8fafc' },
];

export const ICONS = {
  unlock: 'img/supermarket/icon-unlock.svg',
  shelf: 'img/supermarket/icon-shelf.svg',
  checkout: 'img/supermarket/icon-checkout.svg',
  done: 'img/supermarket/icon-done.svg',
  door: 'img/supermarket/icon-door.svg',
  stock: 'img/supermarket/icon-stock.svg',
};

export const PHASE = {
  id: 'M3c',
  title: 'Pha 3c — Mở vùng theo level',
  reviewNote: 'Xây kệ/quầy để lên cấp · mở vùng tự động',
};
