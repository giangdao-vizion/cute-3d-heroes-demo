import { World } from './sim/world';
import type { WorldEvent } from './sim/types';

/** Một thế giới duy nhất cho phiên chơi. Phần vẽ và HUD cùng đọc từ đây. */
export const world = new World();
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __world: World }).__world = world;

type Listener = (e: WorldEvent) => void;
const listeners = new Set<Listener>();
export function onWorldEvent(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** Gọi mỗi frame: chạy mô phỏng rồi phát sự kiện cho HUD / hiệu ứng. */
export function tick(dt: number) {
  world.update(dt);
  for (const e of world.drainEvents()) listeners.forEach(fn => fn(e));
}

export const modelUrl = (path: string) => `${import.meta.env.BASE_URL}models/${path}`;
