import type { Cell } from './types';

/** Lưới đi lại + A* 8 hướng (không cắt góc). Cạnh bị chặn dùng cho hàng rào giữa hai ô. */
export class NavGrid {
  readonly w: number;
  readonly d: number;
  private blocked: Uint8Array;
  private blockedEdges = new Set<string>();

  constructor(w: number, d: number) {
    this.w = w; this.d = d;
    this.blocked = new Uint8Array(w * d);
  }

  inside(x: number, z: number) { return x >= 0 && z >= 0 && x < this.w && z < this.d; }
  setBlocked(x: number, z: number, v = true) { if (this.inside(x, z)) this.blocked[z * this.w + x] = v ? 1 : 0; }
  isBlocked(x: number, z: number) { return !this.inside(x, z) || this.blocked[z * this.w + x] === 1; }
  walkable(x: number, z: number) { return !this.isBlocked(x, z); }

  private edgeKey(a: Cell, b: Cell) {
    return a.z < b.z || (a.z === b.z && a.x < b.x) ? `${a.x},${a.z}|${b.x},${b.z}` : `${b.x},${b.z}|${a.x},${a.z}`;
  }
  blockEdge(a: Cell, b: Cell) { this.blockedEdges.add(this.edgeKey(a, b)); }

  private canStep(ax: number, az: number, bx: number, bz: number) {
    if (this.isBlocked(bx, bz)) return false;
    if (ax !== bx && az !== bz) {
      // chéo: cả hai ô kề phải đi được và không có cạnh chặn
      if (this.isBlocked(ax, bz) || this.isBlocked(bx, az)) return false;
      if (!this.canStep(ax, az, ax, bz) || !this.canStep(ax, az, bx, az)) return false;
      if (!this.canStep(ax, bz, bx, bz) || !this.canStep(bx, az, bx, bz)) return false;
      return true;
    }
    return !this.blockedEdges.has(this.edgeKey({ x: ax, z: az }, { x: bx, z: bz }));
  }

  /** Trả về danh sách ô từ sau `from` tới `to`; rỗng nếu không có đường. */
  findPath(from: Cell, to: Cell): Cell[] {
    if (from.x === to.x && from.z === to.z) return [];
    if (this.isBlocked(to.x, to.z)) return [];
    const W = this.w, N = this.w * this.d;
    const g = new Float32Array(N).fill(Infinity);
    const f = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const open: number[] = [];
    const s = from.z * W + from.x, t = to.z * W + to.x;
    const h = (i: number) => {
      const dx = Math.abs((i % W) - to.x), dz = Math.abs(((i / W) | 0) - to.z);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    g[s] = 0; f[s] = h(s); open.push(s);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (cur === t) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.canStep(cx, cz, nx, nz)) continue;
        const ni = nz * W + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + (dx && dz ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; f[ni] = ng + h(ni); came[ni] = cur; open.push(ni); }
      }
    }
    if (came[t] === -1) return [];
    const path: Cell[] = [];
    for (let i = t; i !== s; i = came[i]) path.push({ x: i % W, z: (i / W) | 0 });
    return path.reverse();
  }

  /** Ô đi được gần nhất (BFS) – dùng khi người chơi chạm vào ô bị chặn. */
  nearestWalkable(c: Cell): Cell | null {
    if (this.walkable(c.x, c.z)) return c;
    for (let r = 1; r < 4; r++) {
      let best: Cell | null = null, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const x = c.x + dx, z = c.z + dz;
        if (this.walkable(x, z) && dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; best = { x, z }; }
      }
      if (best) return best;
    }
    return null;
  }
}
