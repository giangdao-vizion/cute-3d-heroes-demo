import { GRID, SKUS } from './config.js?v=m2b';

const PALETTES = [
  { body: '#5ea3c2', shirt: '#ff7a59', hair: '#2b2340' },
  { body: '#7cbc6e', shirt: '#4f9dff', hair: '#6b3f2a' },
  { body: '#e2a36b', shirt: '#a855f7', hair: '#1f3a46' },
  { body: '#f0b6c8', shirt: '#22c55e', hair: '#7c3aed' },
];

export function createActorsState(cells) {
  return {
    customers: [],
    spawnT: 0.6,
    maxCustomers: 5,
    shelves: cells.flat().filter(c => c.building === 'shelf'),
    checkout: cells.flat().find(c => c.building === 'checkout'),
    door: { x: 4, y: 5 },
  };
}

function walkable(cells, x, y) {
  const c = cells[y]?.[x];
  return !!c && c.state !== 'locked';
}

function neighbors(cells, x, y) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
    .filter(([nx, ny]) => walkable(cells, nx, ny));
}

function findPath(cells, from, to) {
  if (from.x === to.x && from.y === to.y) return [from];
  const key = (x, y) => `${x},${y}`;
  const q = [{ x: from.x, y: from.y }];
  const prev = new Map([[key(from.x, from.y), null]]);
  while (q.length) {
    const cur = q.shift();
    if (cur.x === to.x && cur.y === to.y) break;
    for (const [nx, ny] of neighbors(cells, cur.x, cur.y)) {
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, cur);
      q.push({ x: nx, y: ny });
    }
  }
  if (!prev.has(key(to.x, to.y))) {
    // Không tới được: đi thẳng từng bước thô.
    return [from, to];
  }
  const path = [];
  let cur = { x: to.x, y: to.y };
  while (cur) {
    path.push(cur);
    cur = prev.get(key(cur.x, cur.y));
  }
  path.reverse();
  return path;
}

function pickShelf(actors) {
  const stocked = actors.shelves.filter(s => (s.stock ?? 0) > 0);
  const pool = stocked.length ? stocked : actors.shelves;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function spawnCustomer(actors, cells) {
  if (actors.customers.length >= actors.maxCustomers) return null;
  const door = actors.door;
  const shelf = pickShelf(actors);
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const sku = SKUS[Math.floor(Math.random() * SKUS.length)];
  const c = {
    id: Math.random().toString(36).slice(2, 8),
    gx: door.x,
    gy: door.y,
    x: door.x,
    y: door.y,
    phase: 'toShelf',
    path: findPath(cells, door, shelf),
    pathI: 0,
    wait: 0,
    basket: 0,
    sku,
    targetShelf: shelf,
    palette,
    bob: Math.random() * Math.PI * 2,
    foot: 0,
  };
  actors.customers.push(c);
  return c;
}

function advancePath(c, dt, speed = 2.4) {
  if (!c.path || c.pathI >= c.path.length - 1) return true;
  const next = c.path[c.pathI + 1];
  const dx = next.x - c.x;
  const dy = next.y - c.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.04) {
    c.x = next.x;
    c.y = next.y;
    c.gx = next.x;
    c.gy = next.y;
    c.pathI += 1;
    return c.pathI >= c.path.length - 1;
  }
  const step = Math.min(dist, speed * dt);
  c.x += (dx / dist) * step;
  c.y += (dy / dist) * step;
  c.foot += step * 10;
  return false;
}

export function updateActors(actors, cells, dt, hooks = {}) {
  actors.spawnT -= dt;
  if (actors.spawnT <= 0) {
    spawnCustomer(actors, cells);
    actors.spawnT = 1.4 + Math.random() * 1.4;
  }

  for (const c of actors.customers) {
    c.bob += dt * 8;
    if (c.phase === 'toShelf' || c.phase === 'toCheckout' || c.phase === 'leave') {
      const done = advancePath(c, dt);
      if (done) {
        if (c.phase === 'toShelf') {
          c.phase = 'shop';
          c.wait = 0.55;
          hooks.onArriveShelf?.(c);
        } else if (c.phase === 'toCheckout') {
          c.phase = 'pay';
          c.wait = 0.45;
          hooks.onArriveCheckout?.(c);
        } else if (c.phase === 'leave') {
          c.phase = 'done';
        }
      }
    } else if (c.phase === 'shop') {
      c.wait -= dt;
      if (c.wait <= 0) {
        const shelf = c.targetShelf;
        if (shelf && (shelf.stock ?? 0) > 0) {
          shelf.stock = Math.max(0, shelf.stock - 1);
          c.basket += 1;
          hooks.onTakeItem?.(c, shelf);
        }
        // Có thể lấy thêm 1 món ở kệ khác hoặc đi trả tiền.
        if (c.basket < 2 && Math.random() < 0.45) {
          c.targetShelf = pickShelf(actors);
          c.path = findPath(cells, { x: Math.round(c.x), y: Math.round(c.y) }, c.targetShelf);
          c.pathI = 0;
          c.phase = 'toShelf';
        } else {
          c.path = findPath(cells, { x: Math.round(c.x), y: Math.round(c.y) }, actors.checkout);
          c.pathI = 0;
          c.phase = 'toCheckout';
        }
      }
    } else if (c.phase === 'pay') {
      c.wait -= dt;
      if (c.wait <= 0) {
        hooks.onPay?.(c);
        c.path = findPath(cells, { x: Math.round(c.x), y: Math.round(c.y) }, actors.door);
        c.pathI = 0;
        c.phase = 'leave';
      }
    }
  }
  actors.customers = actors.customers.filter(c => c.phase !== 'done');
}

export function drawCustomer(ctx, c, originX, originY, tile = GRID.tile) {
  const sx = originX + c.x * tile + tile / 2;
  const sy = originY + c.y * tile + tile / 2 + Math.sin(c.bob) * 1.5;
  const moving = c.phase === 'toShelf' || c.phase === 'toCheckout' || c.phase === 'leave';

  // Bóng.
  ctx.fillStyle = 'rgba(31,58,70,.16)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 10, 10, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thân nhìn từ trên: viên nang + đầu.
  ctx.fillStyle = c.palette.shirt;
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.palette.body;
  ctx.beginPath();
  ctx.arc(sx, sy - 4, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.palette.hair;
  ctx.beginPath();
  ctx.arc(sx, sy - 7, 5.5, Math.PI * 1.1, Math.PI * 1.9);
  ctx.fill();

  // Mắt.
  ctx.fillStyle = '#1f3a46';
  ctx.beginPath();
  ctx.arc(sx - 2.2, sy - 4, 1.1, 0, Math.PI * 2);
  ctx.arc(sx + 2.2, sy - 4, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Giỏ hàng.
  if (c.basket > 0) {
    ctx.fillStyle = '#e6b422';
    ctx.fillRect(sx + 7, sy - 1, 7, 6);
    ctx.fillStyle = '#fff';
    ctx.font = '800 9px "Baloo 2", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(String(c.basket), sx + 10.5, sy + 4);
  }

  // Vệt bước chân khi đi.
  if (moving) {
    const a = (c.foot % (Math.PI * 2));
    ctx.globalAlpha = 0.25 + Math.sin(a) * 0.15;
    ctx.fillStyle = '#1f8f6c';
    ctx.beginPath();
    ctx.arc(sx - 5, sy + 12, 2.2, 0, Math.PI * 2);
    ctx.arc(sx + 5, sy + 12, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
