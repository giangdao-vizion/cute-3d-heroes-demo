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
  // Vùng usable ban đầu nằm giữa; vành ngoài locked.
  startOpen: [
    [2, 2], [3, 2], [4, 2], [5, 2],
    [2, 3], [3, 3], [4, 3], [5, 3],
    [2, 4], [3, 4], [4, 4], [5, 4],
    [2, 5], [3, 5], [4, 5], [5, 5],
  ],
  tileW: 72,
  tileH: 36,
};

export const ECONOMY = {
  startMoney: 120,
  unlockCellBase: 40,
  unlockCellStep: 15,
  buildShelf: 55,
  buildCheckout: 80,
  buildStockroom: 70,
  restockPack: 25,
  autoCollect: 220,
};

export const SKUS = [
  { id: 'water', name: 'Nước suối', category: 'Drinks', cost: 2, price: 5, shelfCap: 12, popularity: 1.0 },
  { id: 'cola', name: 'Cola', category: 'Drinks', cost: 3, price: 7, shelfCap: 10, popularity: 0.9 },
  { id: 'juice', name: 'Nước cam', category: 'Drinks', cost: 3, price: 8, shelfCap: 8, popularity: 0.7 },
  { id: 'chips', name: 'Snack', category: 'Snacks', cost: 2, price: 6, shelfCap: 14, popularity: 0.95 },
  { id: 'cookie', name: 'Bánh quy', category: 'Snacks', cost: 3, price: 7, shelfCap: 10, popularity: 0.8 },
  { id: 'candy', name: 'Kẹo', category: 'Snacks', cost: 1, price: 4, shelfCap: 16, popularity: 0.75 },
  { id: 'apple', name: 'Táo', category: 'Fresh', cost: 2, price: 5, shelfCap: 10, popularity: 0.7 },
  { id: 'milk', name: 'Sữa', category: 'Fresh', cost: 4, price: 9, shelfCap: 8, popularity: 0.85 },
];

export const PHASE = {
  id: 'M1',
  title: 'Pha 1 — Khung map lưới',
  reviewNote: 'Duyệt map isometric + brand. Chạm ô để xem trạng thái, kéo để xem map.',
};
