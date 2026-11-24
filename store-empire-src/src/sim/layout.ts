import type { Cell, FixtureDef } from './types';

/**
 * Bố cục cửa hàng Phase 0. Toàn bộ là dữ liệu: đổi layout không cần sửa logic.
 * Lưới: cột 0..13, hàng 0..11. Trong cửa hàng: cột 3..10, hàng 0..9.
 * Hàng 10..11 là vỉa hè (đi được mọi cột). Hàng rào nằm giữa hàng 9 và 10, cổng ở cột DOOR.x.
 */
export const GRID_W = 14;
export const GRID_D = 12;
export const STORE = { x0: 3, x1: 10, z0: 0, z1: 9 };
export const DOOR: Cell = { x: 7, z: 9 };          // ô trong cửa hàng ngay sau cổng
export const DOOR_OUT: Cell = { x: 7, z: 10 };     // ô vỉa hè trước cổng
export const SPAWNS: Cell[] = [{ x: 0, z: 11 }, { x: 13, z: 11 }];

/** Ô xếp hàng thanh toán, phần tử 0 là người đang được tính tiền. */
export const QUEUE: Cell[] = [{ x: 8, z: 6 }, { x: 8, z: 7 }, { x: 8, z: 8 }, { x: 9, z: 8 }];
export const CASHIER_SPOT: Cell = { x: 10, z: 6 };
export const PLAYER_START: Cell = { x: 6, z: 8 };

export const FIXTURES: FixtureDef[] = [
  // Kho hàng (góc sau bên phải)
  { id: 'storage', kind: 'storage', model: 'shop/shelf-boxes.glb', cell: { x: 9, z: 0 }, rot: 0, access: { x: 9, z: 1 } },
  { id: 'storage-2', kind: 'decor', model: 'shop/shelf-boxes.glb', cell: { x: 10, z: 0 }, rot: 0 },
  { id: 'hand-truck', kind: 'decor', model: 'shop/hand-truck.glb', cell: { x: 10, z: 1 }, rot: 3 },

  // Tủ đông đứng sát tường sau
  { id: 'freezer-1', kind: 'freezer', model: 'shop/freezers-standing.glb', cell: { x: 4, z: 0 }, rot: 0, access: { x: 4, z: 1 }, product: 'Kem', price: 4, capacity: 6 },
  { id: 'freezer-2', kind: 'freezer', model: 'shop/freezers-standing.glb', cell: { x: 5, z: 0 }, rot: 0, access: { x: 5, z: 1 }, product: 'Đồ đông lạnh', price: 6, capacity: 6 },
  { id: 'bottles', kind: 'decor', model: 'shop/bottle-return.glb', cell: { x: 3, z: 0 }, rot: 0 },

  // Dãy kệ giữa
  { id: 'shelf-1', kind: 'shelf', model: 'shop/shelf-boxes.glb', cell: { x: 4, z: 3 }, rot: 0, access: { x: 4, z: 4 }, product: 'Ngũ cốc', price: 5, capacity: 10 },
  { id: 'shelf-2', kind: 'shelf', model: 'shop/shelf-bags.glb', cell: { x: 5, z: 3 }, rot: 0, access: { x: 5, z: 4 }, product: 'Snack', price: 3, capacity: 8 },
  { id: 'shelf-3', kind: 'shelf', model: 'shop/shelf-boxes.glb', cell: { x: 6, z: 3 }, rot: 0, access: { x: 6, z: 4 }, product: 'Bánh quy', price: 4, capacity: 10 },
  { id: 'freezer-chest', kind: 'freezer', model: 'shop/freezer.glb', cell: { x: 3, z: 5 }, rot: 1, access: { x: 4, z: 5 }, product: 'Sữa chua', price: 3, capacity: 6 },

  // Quầy trưng bày
  { id: 'display-cans', kind: 'display', model: 'shop/display-cans.glb', cell: { x: 4, z: 7 }, rot: 0, access: { x: 5, z: 7 }, product: 'Nước ngọt', price: 2, capacity: 14 },
  { id: 'display-fruit', kind: 'display', model: 'shop/display-fruit.glb', cell: { x: 5, z: 6 }, rot: 0, access: { x: 6, z: 6 }, product: 'Trái cây', price: 3, capacity: 8 },
  { id: 'display-bread', kind: 'display', model: 'shop/display-bread.glb', cell: { x: 7, z: 3 }, rot: 0, access: { x: 7, z: 4 }, product: 'Bánh mì', price: 2, capacity: 8 },

  // Quầy thu ngân
  { id: 'register', kind: 'register', model: 'shop/cash-register.glb', cell: { x: 9, z: 6 }, rot: 3, access: { x: 10, z: 6 } },
  { id: 'register-self', kind: 'decor', model: 'shop/cash-register-self.glb', cell: { x: 9, z: 4 }, rot: 3 },

  // Trang trí
  { id: 'gacha', kind: 'decor', model: 'shop/gacha-machine.glb', cell: { x: 3, z: 9 }, rot: 0 },
  { id: 'flowers', kind: 'decor', model: 'shop/display-flowers.glb', cell: { x: 10, z: 9 }, rot: 0 },
  { id: 'cart', kind: 'decor', model: 'shop/shopping-cart.glb', cell: { x: 5, z: 9 }, rot: 1 },
  { id: 'basket', kind: 'decor', model: 'shop/shopping-basket.glb', cell: { x: 6, z: 9 }, rot: 0, blocks: false, offset: [-0.3, 0.25] },
];

/** Tường sau (bắc) và trái (tây). Phía trước và phải là hàng rào thấp để không che tầm nhìn. */
export type WallPiece = { model: string; x: number; z: number; rot: 0 | 1 | 2 | 3 };

export function buildWalls(): WallPiece[] {
  const out: WallPiece[] = [];
  for (let x = STORE.x0; x <= STORE.x1; x++) {
    const win = x === 6 || x === 7;
    out.push({ model: win ? 'shop/wall-window.glb' : 'shop/wall.glb', x, z: STORE.z0 - 0.5, rot: 0 });
  }
  for (let z = STORE.z0; z <= STORE.z1; z++) {
    const win = z === 3 || z === 6;
    out.push({ model: win ? 'shop/wall-window.glb' : 'shop/wall.glb', x: STORE.x0 - 0.5, z, rot: 1 });
  }
  out.push({ model: 'shop/wall-corner.glb', x: STORE.x0 - 0.5, z: STORE.z0 - 0.5, rot: 0 });
  // Hàng rào: mỗi đoạn dài nửa ô, cọc ở đầu +x.
  for (let x = STORE.x0; x <= STORE.x1; x++) {
    if (x === DOOR.x) continue;
    out.push({ model: 'shop/fence.glb', x: x, z: STORE.z1 + 0.5, rot: 0 });
    out.push({ model: 'shop/fence.glb', x: x + 0.5, z: STORE.z1 + 0.5, rot: 0 });
  }
  for (let z = STORE.z0; z <= STORE.z1; z++) {
    // rot 1: thanh rào chạy từ cọc về phía +z nửa ô
    out.push({ model: 'shop/fence.glb', x: STORE.x1 + 0.5, z: z - 0.5, rot: 1 });
    out.push({ model: 'shop/fence.glb', x: STORE.x1 + 0.5, z: z, rot: 1 });
  }
  return out;
}
