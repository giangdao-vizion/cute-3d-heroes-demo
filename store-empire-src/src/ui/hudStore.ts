import { create } from 'zustand';
import { world } from '../game';

type Task = { id: string; text: string; done: boolean };

type Hud = {
  level: number; xp: number; xpNext: number; cash: number; title: string;
  revenue: number; served: number; satisfaction: number; carrying: boolean;
  tasks: Task[]; fps: number;
  sync: () => void;
  setFps: (n: number) => void;
};

/** Ảnh chụp số liệu từ mô phỏng cho React HUD. Không chứa logic game. */
export const useHud = create<Hud>(set => ({
  level: 1, xp: 0, xpNext: 40, cash: 0, title: '', revenue: 0, served: 0, satisfaction: 100, carrying: false,
  tasks: [], fps: 60,
  sync: () => set({
    level: world.level, xp: world.xp, xpNext: world.xpNext(), cash: world.cash, title: world.title(),
    revenue: world.storeRevenue, served: world.served, satisfaction: Math.round(world.satisfaction),
    carrying: world.player.carrying, tasks: world.tasks(),
  }),
  setFps: fps => set({ fps }),
}));
