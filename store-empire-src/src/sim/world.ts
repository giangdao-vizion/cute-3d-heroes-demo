import { NavGrid } from './grid';
import {
  CASHIER_SPOT, DOOR, DOOR_OUT, FIXTURES, GRID_D, GRID_W, PLAYER_START, QUEUE, SPAWNS, STORE,
} from './layout';
import type { Agent, AgentKind, AnimName, Cell, FixtureState, WorldEvent } from './types';

const CUSTOMER_MODELS = [
  'chars/character-female-b.glb', 'chars/character-female-c.glb', 'chars/character-female-d.glb',
  'chars/character-female-e.glb', 'chars/character-male-a.glb', 'chars/character-male-b.glb',
  'chars/character-male-e.glb', 'chars/character-male-g.glb',
];
export const PLAYER_MODEL = 'shop/character-employee.glb';
export const CASHIER_MODEL = 'chars/character-male-f.glb';

const MAX_CUSTOMERS = 4;
const WALK = 1.7, RUN = 3.2;

export const CAREER_TITLES = ['Nhân viên mới', 'Nhân viên', 'Trưởng nhóm', 'Giám sát', 'Quản lý cửa hàng'];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[(Math.random() * arr.length) | 0];
const cellOf = (a: Agent): Cell => ({ x: Math.round(a.x), z: Math.round(a.z) });

type PlayerJob = { fixtureId: string } | null;

/**
 * Mô phỏng cửa hàng – TypeScript thuần, không phụ thuộc React/Three.
 * Phần vẽ chỉ đọc `agents`, `fixtures` và rút `events`.
 */
export class World {
  readonly grid = new NavGrid(GRID_W, GRID_D);
  readonly fixtures: FixtureState[];
  readonly agents: Agent[] = [];
  readonly events: WorldEvent[] = [];
  readonly player: Agent;
  readonly cashier: Agent;

  cash = 0;            // tiền lương của người chơi
  storeRevenue = 0;    // doanh thu cửa hàng hôm nay
  xp = 0;
  level = 1;
  served = 0;
  restocked = 0;
  satisfaction = 100;
  time = 0;

  private nextId = 1;
  private spawnTimer = 2;
  private queue: (number | null)[] = QUEUE.map(() => null);
  private job: PlayerJob = null;

  constructor() {
    this.fixtures = FIXTURES.map(f => ({ ...f, stock: f.capacity ?? 0 }));
    // Vài kệ thiếu hàng sẵn để người chơi có việc ngay khi vào.
    this.fx('shelf-2').stock = 1;
    this.fx('display-fruit').stock = 2;
    this.fx('freezer-1').stock = 0;
    this.buildNav();
    this.player = this.addAgent('player', PLAYER_MODEL, PLAYER_START);
    this.cashier = this.addAgent('staff', CASHIER_MODEL, CASHIER_SPOT);
    this.cashier.rot = -Math.PI / 2;
    this.player.rot = Math.PI;
  }

  // ---------- thiết lập ----------
  private buildNav() {
    const g = this.grid;
    for (let z = 0; z < GRID_D; z++) for (let x = 0; x < GRID_W; x++) {
      const inStore = x >= STORE.x0 && x <= STORE.x1 && z >= STORE.z0 && z <= STORE.z1;
      const sidewalk = z > STORE.z1;
      g.setBlocked(x, z, !(inStore || sidewalk));
    }
    for (const f of this.fixtures) if (f.blocks !== false) g.setBlocked(f.cell.x, f.cell.z);
    // Hàng rào trước: chỉ qua được ở cổng
    for (let x = STORE.x0; x <= STORE.x1; x++) {
      if (x !== DOOR.x) g.blockEdge({ x, z: STORE.z1 }, { x, z: STORE.z1 + 1 });
    }
    // Hàng rào phải: chặn giữa cột x1 và x1+1 (ô ngoài vốn đã bị chặn, giữ cho rõ ràng)
    for (let z = STORE.z0; z <= STORE.z1; z++) g.blockEdge({ x: STORE.x1, z }, { x: STORE.x1 + 1, z });
  }

  fx(id: string) {
    const f = this.fixtures.find(f => f.id === id);
    if (!f) throw new Error('fixture ' + id);
    return f;
  }

  private addAgent(kind: AgentKind, model: string, at: Cell): Agent {
    const a: Agent = {
      id: this.nextId++, kind, model, x: at.x, z: at.z, rot: 0, path: [], speed: WALK,
      anim: 'idle', state: 'idle', timer: 0, carrying: false, fade: kind === 'customer' ? 0 : 1, data: {},
    };
    this.agents.push(a);
    return a;
  }

  private emit(e: WorldEvent) { this.events.push(e); }

  // ---------- lệnh của người chơi ----------
  tapCell(c: Cell) {
    const target = this.grid.nearestWalkable(c);
    if (!target) return;
    this.job = null;
    this.goTo(this.player, target, true);
    this.player.state = 'walk';
  }

  tapFixture(id: string) {
    const f = this.fx(id);
    this.emit({ type: 'pulse', fixtureId: id });
    if (!f.access) {
      this.emit({ type: 'toast', text: f.kind === 'decor' ? 'Đồ trang trí' : '…' });
      return;
    }
    this.job = { fixtureId: id };
    const p = this.player;
    if (!this.goTo(p, f.access, true)) this.doPlayerJob(); // đã đứng sẵn tại chỗ
    else p.state = 'walk';
  }

  private goTo(a: Agent, to: Cell, isPlayer = false): boolean {
    const path = this.grid.findPath(cellOf(a), to);
    a.path = path;
    if (isPlayer) a.speed = path.length > 5 ? RUN : WALK;
    return path.length > 0;
  }

  private faceCell(a: Agent, c: Cell) { a.rot = Math.atan2(c.x - a.x, c.z - a.z); }

  private doPlayerJob() {
    const p = this.player;
    const job = this.job;
    this.job = null;
    if (!job) { p.state = 'idle'; return; }
    const f = this.fx(job.fixtureId);
    this.faceCell(p, f.cell);
    if (f.kind === 'storage') {
      if (p.carrying) { this.emit({ type: 'toast', text: 'Bạn đang cầm thùng hàng rồi' }); p.state = 'idle'; return; }
      p.state = 'pickup'; p.anim = 'pick-up'; p.timer = 0.9;
      return;
    }
    if (f.kind === 'register') {
      this.emit({ type: 'toast', text: this.cashier ? 'Thu ngân đang phụ trách quầy' : 'Quầy trống' });
      p.state = 'idle';
      return;
    }
    if (f.capacity) {
      if (f.stock >= f.capacity) { this.emit({ type: 'toast', text: `${f.product}: kệ đã đầy` }); p.state = 'idle'; return; }
      if (!p.carrying) { this.emit({ type: 'toast', text: 'Lấy thùng hàng ở kho (góc sau) trước' }); p.state = 'idle'; return; }
      p.state = 'restock'; p.anim = 'interact-right'; p.timer = 1.2; p.data.fixture = f.id;
      return;
    }
    p.state = 'idle';
  }

  private addXp(n: number) {
    this.xp += n;
    while (this.xp >= this.xpNext()) {
      this.xp -= this.xpNext();
      this.level++;
      this.emit({ type: 'levelup', level: this.level });
      this.player.state = 'celebrate'; this.player.anim = 'emote-yes'; this.player.timer = 1.4; this.player.path = [];
    }
  }
  xpNext() { return 40 + (this.level - 1) * 30; }

  // ---------- vòng cập nhật ----------
  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.spawnTimer -= dt;
    const customers = this.agents.filter(a => a.kind === 'customer').length;
    if (this.spawnTimer <= 0 && customers < MAX_CUSTOMERS) {
      this.spawnCustomer();
      this.spawnTimer = rnd(4, 8);
    }
    for (const a of this.agents) {
      this.move(a, dt);
      if (a.kind === 'player') this.updatePlayer(a, dt);
      else if (a.kind === 'customer') this.updateCustomer(a, dt);
      else this.updateCashier(a);
    }
    for (let i = this.agents.length - 1; i >= 0; i--) if (this.agents[i].state === 'gone') this.agents.splice(i, 1);
  }

  private move(a: Agent, dt: number) {
    if (!a.path.length) return;
    const next = a.path[0];
    const dx = next.x - a.x, dz = next.z - a.z;
    const dist = Math.hypot(dx, dz);
    const step = a.speed * dt;
    const want = Math.atan2(dx, dz);
    let diff = want - a.rot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    a.rot += diff * Math.min(1, dt * 14);
    if (dist <= step) { a.x = next.x; a.z = next.z; a.path.shift(); }
    else { a.x += (dx / dist) * step; a.z += (dz / dist) * step; }
  }

  private locoAnim(a: Agent): AnimName {
    // Cầm thùng: phần vẽ tự chồng tư thế tay `holding-both` lên chân.
    if (!a.path.length) return 'idle';
    if (a.carrying) return 'walk';
    return a.speed > WALK ? 'sprint' : 'walk';
  }

  private updatePlayer(p: Agent, dt: number) {
    if (p.state === 'walk') {
      p.anim = this.locoAnim(p);
      if (!p.path.length) { if (this.job) this.doPlayerJob(); else p.state = 'idle'; }
      return;
    }
    if (p.state === 'pickup') {
      p.timer -= dt;
      if (p.timer <= 0) {
        p.carrying = true; p.state = 'idle';
        this.emit({ type: 'toast', text: 'Đã lấy thùng hàng. Chạm vào kệ thiếu hàng để bổ sung' });
      }
      return;
    }
    if (p.state === 'restock') {
      p.timer -= dt;
      if (p.timer <= 0) {
        const f = this.fx(p.data.fixture as string);
        const added = (f.capacity ?? 0) - f.stock;
        f.stock = f.capacity ?? 0;
        p.carrying = false; p.state = 'idle';
        this.restocked += added;
        const wage = 3;
        this.cash += wage;
        this.emit({ type: 'float', x: f.cell.x, z: f.cell.z, text: `+$${wage}  +12 XP`, color: '#ffd84a' });
        this.emit({ type: 'pulse', fixtureId: f.id });
        this.addXp(12);
      }
      return;
    }
    if (p.state === 'celebrate') {
      p.timer -= dt;
      if (p.timer <= 0) p.state = 'idle';
      return;
    }
    p.anim = this.locoAnim(p);
  }

  private updateCashier(c: Agent) {
    const head = this.queue[0];
    const paying = head != null && this.agents.find(a => a.id === head)?.state === 'pay';
    c.anim = paying ? 'interact-right' : 'idle';
  }

  // ---------- khách hàng ----------
  private spawnCustomer() {
    const at = pick(SPAWNS);
    const c = this.addAgent('customer', pick(CUSTOMER_MODELS), at);
    const products = this.fixtures.filter(f => f.capacity);
    const wishes = [...products].sort(() => Math.random() - 0.5).slice(0, 1 + ((Math.random() * 3) | 0)).map(f => f.id);
    c.data = { wishes, basket: 0, items: 0, misses: 0 };
    c.state = 'enter';
    this.goTo(c, DOOR);
  }

  private updateCustomer(c: Agent, dt: number) {
    const d = c.data as { wishes: string[]; basket: number; items: number; misses: number; target?: string; slot?: number };
    if (c.state !== 'leave') c.fade = Math.min(1, c.fade + dt * 2.5);
    switch (c.state) {
      case 'enter':
        c.anim = this.locoAnim(c);
        if (!c.path.length) this.nextWish(c);
        break;
      case 'toShelf':
        c.anim = this.locoAnim(c);
        if (!c.path.length) {
          const f = this.fx(d.target!);
          this.faceCell(c, f.cell);
          c.state = 'browse'; c.timer = rnd(1.2, 2.0); c.anim = 'interact-right';
        }
        break;
      case 'browse': {
        c.timer -= dt;
        if (c.timer > 0) break;
        const f = this.fx(d.target!);
        if (f.stock > 0) {
          const n = Math.min(f.stock, 1 + ((Math.random() * 2) | 0));
          f.stock -= n; d.items += n; d.basket += n * (f.price ?? 1);
          c.state = 'took'; c.anim = 'pick-up'; c.timer = 0.7;
        } else {
          d.misses++;
          c.state = 'miss'; c.anim = 'emote-no'; c.timer = 1.0;
          this.emit({ type: 'float', x: f.cell.x, z: f.cell.z, text: 'Hết hàng!', color: '#ff7a7a' });
          this.satisfaction = Math.max(0, this.satisfaction - 4);
        }
        break;
      }
      case 'took':
      case 'miss':
        c.timer -= dt;
        if (c.timer <= 0) this.nextWish(c);
        break;
      case 'toQueue':
      case 'queue': {
        const slot = d.slot!;
        // tiến lên nếu ô phía trước trống
        if (slot > 0 && this.queue[slot - 1] == null) {
          this.queue[slot] = null; this.queue[slot - 1] = c.id; d.slot = slot - 1;
          this.goTo(c, QUEUE[slot - 1]); c.state = 'toQueue';
        }
        c.anim = this.locoAnim(c);
        if (!c.path.length) {
          c.state = 'queue';
          c.rot = d.slot === 0 ? Math.PI / 2 : Math.PI;
          if (d.slot === 0) { c.state = 'pay'; c.timer = 1.8; c.anim = 'idle'; }
        }
        break;
      }
      case 'pay':
        c.timer -= dt;
        c.anim = 'idle';
        if (c.timer <= 0) {
          this.storeRevenue += d.basket;
          this.served++;
          this.satisfaction = Math.min(100, this.satisfaction + (d.misses ? 0 : 2));
          this.emit({ type: 'float', x: 9, z: 6, text: `+$${d.basket}`, color: '#7dffa8' });
          this.queue[0] = null;
          this.leave(c, true);
        }
        break;
      case 'leave':
        c.anim = this.locoAnim(c);
        if (!c.path.length) {
          if (c.data.exitStage === 0) { c.data.exitStage = 1; this.goTo(c, pick(SPAWNS)); }
          else { c.fade -= dt * 2.5; if (c.fade <= 0) c.state = 'gone'; }
        }
        break;
    }
  }

  private nextWish(c: Agent) {
    const d = c.data as { wishes: string[]; items: number; target?: string; slot?: number };
    const id = d.wishes.shift();
    if (id) {
      d.target = id;
      const f = this.fx(id);
      c.state = 'toShelf';
      if (!this.goTo(c, f.access!)) { c.state = 'browse'; c.timer = 1.2; c.anim = 'interact-right'; this.faceCell(c, f.cell); }
      return;
    }
    if (d.items > 0) {
      const slot = this.queue.lastIndexOf(null) === -1 ? -1 : this.firstFreeSlot();
      if (slot >= 0) {
        this.queue[slot] = c.id; d.slot = slot;
        c.state = 'toQueue'; this.goTo(c, QUEUE[slot]);
        return;
      }
      // hàng quá dài: bực mình bỏ về
      this.satisfaction = Math.max(0, this.satisfaction - 6);
    }
    this.leave(c, false);
  }

  private firstFreeSlot() {
    // xếp sau người cuối cùng
    let last = -1;
    this.queue.forEach((v, i) => { if (v != null) last = i; });
    return last + 1 < this.queue.length ? last + 1 : -1;
  }

  private leave(c: Agent, happy: boolean) {
    c.state = 'leave';
    c.data.exitStage = 0;
    if (!happy) { c.anim = 'emote-no'; }
    this.goTo(c, DOOR_OUT);
    if (!c.path.length) { c.data.exitStage = 1; this.goTo(c, pick(SPAWNS)); }
  }

  // ---------- thông tin cho HUD ----------
  tasks() {
    const list: { id: string; text: string; done: boolean }[] = [];
    for (const f of this.fixtures) {
      if (!f.capacity) continue;
      if (f.stock / f.capacity < 0.35) list.push({ id: f.id, text: `Bổ sung ${f.product}`, done: false });
    }
    return list;
  }

  title() { return CAREER_TITLES[Math.min(CAREER_TITLES.length - 1, Math.floor((this.level - 1) / 3))]; }

  drainEvents() { return this.events.splice(0, this.events.length); }
}
