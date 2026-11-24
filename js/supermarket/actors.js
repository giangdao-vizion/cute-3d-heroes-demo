import { GRID, SKUS } from './config.js?v=m3c';

const PALETTES = [
  { body: '#5ea3c2', shirt: '#ff7a59', hair: '#2b2340' },
  { body: '#7cbc6e', shirt: '#4f9dff', hair: '#6b3f2a' },
  { body: '#e2a36b', shirt: '#a855f7', hair: '#1f3a46' },
  { body: '#f0b6c8', shirt: '#22c55e', hair: '#7c3aed' },
];

export function createActorsState(cells) {
  const door = cells.flat().find(c => c.building === 'door') || { x: 4, y: 5 };
  return {
    customers: [],
    queue: [],
    spawnT: 0.5,
    maxCustomers: 5,
    shelves: cells.flat().filter(c => c.building === 'shelf'),
    checkout: cells.flat().find(c => c.building === 'checkout'),
    door: { x: door.x, y: door.y },
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
  if (!to) return [from];
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
  if (!prev.has(key(to.x, to.y))) return [from, to];
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
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function queueSlots(actors, cells) {
  const co = actors.checkout;
  if (!co) return [];
  // Hàng chờ hướng về cửa (xuống dưới), rồi sang phải/trái — chỉ ô trống/cửa.
  const candidates = [
    { x: co.x, y: co.y + 1 },
    { x: co.x, y: co.y + 2 },
    { x: co.x + 1, y: co.y + 1 },
    { x: co.x - 1, y: co.y + 1 },
    { x: co.x + 1, y: co.y },
    { x: co.x - 1, y: co.y },
  ];
  return candidates.filter(s => {
    const cell = cells[s.y]?.[s.x];
    if (!cell || cell.state === 'locked') return false;
    if (cell.building && cell.building !== 'door') return false;
    return !(s.x === co.x && s.y === co.y);
  });
}

function here(c) {
  return { x: Math.round(c.x), y: Math.round(c.y) };
}

export function spawnCustomer(actors, cells) {
  if (actors.customers.length >= actors.maxCustomers) return null;
  if (!actors.shelves.length || !actors.checkout || !actors.door) return null;
  const door = actors.door;
  const shelf = pickShelf(actors);
  if (!shelf) return null;
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const sku = SKUS[Math.floor(Math.random() * SKUS.length)];
  const c = {
    id: Math.random().toString(36).slice(2, 8),
    gx: door.x,
    gy: door.y,
    x: door.x,
    y: door.y + 0.85, // đứng ngoài cửa rồi bước vào
    phase: 'enter',
    path: [{ x: door.x, y: door.y + 0.85 }, { x: door.x, y: door.y }],
    pathI: 0,
    wait: 0,
    basket: 0,
    sku,
    targetShelf: shelf,
    queueSlot: null,
    palette,
    bob: Math.random() * Math.PI * 2,
    foot: 0,
    alpha: 0,
  };
  actors.customers.push(c);
  return c;
}

function advancePath(c, dt, speed = 2.2) {
  if (!c.path || c.pathI >= c.path.length - 1) return true;
  const next = c.path[c.pathI + 1];
  const dx = next.x - c.x;
  const dy = next.y - c.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) {
    c.x = next.x;
    c.y = next.y;
    c.gx = Math.round(next.x);
    c.gy = Math.round(next.y);
    c.pathI += 1;
    return c.pathI >= c.path.length - 1;
  }
  const step = Math.min(dist, speed * dt);
  c.x += (dx / dist) * step;
  c.y += (dy / dist) * step;
  c.foot += step * 10;
  return false;
}

function joinQueue(actors, cells, c) {
  if (!actors.queue.includes(c.id)) actors.queue.push(c.id);
  const slots = queueSlots(actors, cells);
  const idx = Math.max(0, actors.queue.indexOf(c.id));
  c.queueSlot = slots[Math.min(idx, Math.max(0, slots.length - 1))] || {
    x: actors.checkout.x,
    y: actors.checkout.y + 1,
  };
  c.path = findPath(cells, here(c), c.queueSlot);
  c.pathI = 0;
  c.phase = 'toQueue';
}

export function updateActors(actors, cells, dt, hooks = {}) {
  actors.spawnT -= dt;
  if (actors.spawnT <= 0) {
    spawnCustomer(actors, cells);
    actors.spawnT = 1.5 + Math.random() * 1.5;
  }

  // Dọn queue nếu khách đã mất.
  const live = new Set(actors.customers.map(c => c.id));
  actors.queue = actors.queue.filter(id => live.has(id));

  for (const c of actors.customers) {
    c.bob += dt * 8;
    if (c.phase === 'enter') {
      c.alpha = Math.min(1, (c.alpha || 0) + dt * 2.5);
      if (advancePath(c, dt, 1.8)) {
        c.alpha = 1;
        c.targetShelf = pickShelf(actors);
        c.path = findPath(cells, here(c), c.targetShelf);
        c.pathI = 0;
        c.phase = 'toShelf';
        hooks.onEnter?.(c);
      }
    } else if (c.phase === 'toShelf' || c.phase === 'toQueue' || c.phase === 'toPay' || c.phase === 'leave') {
      const done = advancePath(c, dt);
      if (done) {
        if (c.phase === 'toShelf') {
          c.phase = 'shop';
          c.wait = 0.55;
          hooks.onArriveShelf?.(c);
        } else if (c.phase === 'toQueue') {
          c.phase = 'waitQueue';
        } else if (c.phase === 'toPay') {
          c.phase = 'pay';
          c.wait = 0.55;
          hooks.onArriveCheckout?.(c);
        } else if (c.phase === 'leave') {
          c.phase = 'exit';
          c.path = [
            { x: actors.door.x, y: actors.door.y },
            { x: actors.door.x, y: actors.door.y + 1.1 },
          ];
          c.pathI = 0;
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
        if (c.basket < 2 && Math.random() < 0.4) {
          c.targetShelf = pickShelf(actors);
          c.path = findPath(cells, here(c), c.targetShelf);
          c.pathI = 0;
          c.phase = 'toShelf';
        } else {
          joinQueue(actors, cells, c);
        }
      }
    } else if (c.phase === 'waitQueue') {
      const idx = actors.queue.indexOf(c.id);
      const slots = queueSlots(actors, cells);
      const slot = slots[Math.min(Math.max(idx, 0), Math.max(0, slots.length - 1))] || c.queueSlot;
      if (slot && (Math.round(c.x) !== slot.x || Math.round(c.y) !== slot.y)) {
        c.queueSlot = slot;
        c.path = findPath(cells, here(c), slot);
        c.pathI = 0;
        c.phase = 'toQueue';
      } else if (idx === 0) {
        // Người đầu hàng vào quầy thanh toán.
        c.path = findPath(cells, here(c), actors.checkout);
        c.pathI = 0;
        c.phase = 'toPay';
      }
    } else if (c.phase === 'pay') {
      c.wait -= dt;
      if (c.wait <= 0) {
        hooks.onPay?.(c);
        actors.queue = actors.queue.filter(id => id !== c.id);
        c.path = findPath(cells, here(c), actors.door);
        c.pathI = 0;
        c.phase = 'leave';
      }
    } else if (c.phase === 'exit') {
      c.alpha = Math.max(0, (c.alpha ?? 1) - dt * 1.8);
      if (advancePath(c, dt, 1.7) || c.alpha <= 0.05) {
        c.phase = 'done';
        hooks.onExit?.(c);
      }
    }
  }
  actors.customers = actors.customers.filter(c => c.phase !== 'done');
}

export function drawCustomer(ctx, c, originX, originY, tile = GRID.tile) {
  const sx = originX + c.x * tile + tile / 2;
  const sy = originY + c.y * tile + tile / 2 + Math.sin(c.bob) * 1.5;
  const moving = ['enter', 'toShelf', 'toQueue', 'toPay', 'leave', 'exit'].includes(c.phase);
  ctx.save();
  ctx.globalAlpha = c.alpha ?? 1;

  ctx.fillStyle = 'rgba(31,58,70,.16)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 10, 10, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

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

  ctx.fillStyle = '#1f3a46';
  ctx.beginPath();
  ctx.arc(sx - 2.2, sy - 4, 1.1, 0, Math.PI * 2);
  ctx.arc(sx + 2.2, sy - 4, 1.1, 0, Math.PI * 2);
  ctx.fill();

  if (c.basket > 0) {
    ctx.fillStyle = '#e6b422';
    ctx.fillRect(sx + 7, sy - 1, 7, 6);
    ctx.fillStyle = '#fff';
    ctx.font = '800 9px "Baloo 2", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(String(c.basket), sx + 10.5, sy + 4);
  }

  if (c.phase === 'waitQueue') {
    // Icon đồng hồ nhỏ = đang xếp hàng.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx, sy - 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f3a46';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 16);
    ctx.lineTo(sx, sy - 19);
    ctx.moveTo(sx, sy - 16);
    ctx.lineTo(sx + 3, sy - 15);
    ctx.stroke();
  }

  if (moving) {
    const a = c.foot % (Math.PI * 2);
    ctx.globalAlpha = (c.alpha ?? 1) * (0.25 + Math.sin(a) * 0.15);
    ctx.fillStyle = '#1f8f6c';
    ctx.beginPath();
    ctx.arc(sx - 5, sy + 12, 2.2, 0, Math.PI * 2);
    ctx.arc(sx + 5, sy + 12, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
