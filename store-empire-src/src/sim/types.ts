export type Cell = { x: number; z: number };

/** Tên clip animation có trong Kenney Mini Characters. */
export type AnimName =
  | 'idle' | 'walk' | 'sprint' | 'pick-up' | 'interact-right' | 'interact-left'
  | 'holding-both' | 'emote-yes' | 'emote-no' | 'crouch';

export type FixtureKind = 'shelf' | 'freezer' | 'display' | 'register' | 'storage' | 'decor';

export type FixtureDef = {
  id: string;
  kind: FixtureKind;
  model: string;          // đường dẫn tương đối trong /models
  cell: Cell;             // ô đặt vật thể
  rot: 0 | 1 | 2 | 3;     // xoay 90° * rot quanh trục Y (0 = mặt trước hướng +z)
  access?: Cell;          // ô nhân vật đứng để thao tác
  blocks?: boolean;       // chặn đường đi (mặc định true)
  product?: string;       // tên hàng (shelf/freezer/display)
  price?: number;         // giá bán mỗi món
  capacity?: number;      // sức chứa tối đa
  offset?: [number, number]; // lệch vị trí trong ô (x, z)
};

export type FixtureState = FixtureDef & { stock: number };

export type AgentKind = 'player' | 'customer' | 'staff';

export type Agent = {
  id: number;
  kind: AgentKind;
  model: string;
  x: number; z: number;   // vị trí thế giới (đơn vị ô)
  rot: number;            // góc quay Y (rad)
  path: Cell[];
  speed: number;
  anim: AnimName;
  state: string;
  timer: number;
  carrying: boolean;
  fade: number;           // 0..1 hiện dần khi xuất hiện / biến mất
  data: Record<string, unknown>;
};

export type WorldEvent =
  | { type: 'float'; x: number; z: number; text: string; color: string }
  | { type: 'toast'; text: string }
  | { type: 'pulse'; fixtureId: string }
  | { type: 'levelup'; level: number };
