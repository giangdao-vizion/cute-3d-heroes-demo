import { BRAND, GRID, ECONOMY, SKUS, PHASE, ICONS } from './config.js?v=m3c';
import { createGrid, gridToScreen, screenToGrid, forEachCell, cellCenter } from './grid.js?v=m3c';
import { createActorsState, updateActors, drawCustomer, spawnCustomer } from './actors.js?v=m3c';
import { createFx, addFloat, addSpark, addRing, updateFx, drawFx } from './fx.js?v=m3c';
import {
  canBuild, placeBuilding, storeLevel, nextLevelProgress,
  applyOpenRegion, refreshActorsBuildings, countOpened, totalCells,
  regionForLevel, cellInRegion,
} from './build.js?v=m3c';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const cells = createGrid();
const actors = createActorsState(cells);
const fx = createFx();

const icons = {};
for (const [key, src] of Object.entries(ICONS)) {
  const img = new Image();
  img.src = `${src}?v=m3c`;
  icons[key] = img;
}

const state = {
  money: ECONOMY.startMoney,
  pendingMoney: 0,
  selected: null,
  originX: 0,
  originY: 0,
  dragging: false,
  moved: false,
  lastX: 0,
  lastY: 0,
  playing: false,
  speed: 1,
  time: 0,
  mode: null,
  level: 1,
  toastT: 0,
};

let lastTs = 0;

function applyBrandCss() {
  const root = document.documentElement;
  root.style.setProperty('--ms-ink', BRAND.colors.ink);
  root.style.setProperty('--ms-bg', BRAND.colors.bg);
  root.style.setProperty('--ms-accent', BRAND.colors.accent);
  root.style.setProperty('--ms-money', BRAND.colors.money);
  root.style.setProperty('--ms-panel', BRAND.colors.panel);
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!state.originX && !state.originY) centerMap();
}

function centerMap() {
  const mapW = GRID.width * GRID.tile;
  const mapH = GRID.height * GRID.tile;
  state.originX = (innerWidth - mapW) / 2;
  // Đẩy map lên một chút để thấy khách đứng ngoài cửa rồi bước vào.
  state.originY = innerHeight * 0.16 + Math.max(0, (innerHeight * 0.55 - mapH) / 2);
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawIcon(img, x, y, size) {
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, x, y, size, size);
    return true;
  }
  return false;
}

function drawPadlock(cx, cy, s = 14) {
  ctx.fillStyle = 'rgba(31,58,70,.55)';
  roundRect(cx - s * 0.35, cy - s * 0.05, s * 0.7, s * 0.55, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(31,58,70,.55)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.12, s * 0.22, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.12, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawFloorTile(cell) {
  const t = GRID.tile;
  const p = gridToScreen(cell.x, cell.y, state.originX, state.originY);
  const selected = state.selected && state.selected.x === cell.x && state.selected.y === cell.y;
  const gap = 3;
  const x = p.x + gap;
  const y = p.y + gap;
  const w = t - gap * 2;
  const h = t - gap * 2;

  let fill = ((cell.x + cell.y) % 2 === 0) ? '#f4f8e8' : '#eaf3d5';
  let stroke = '#c5d8a8';
  if (cell.state === 'locked') {
    fill = ((cell.x + cell.y) % 2 === 0) ? '#d5e0e5' : '#c9d7dd';
    stroke = '#a7b8bf';
  }
  if (cell.building === 'door') {
    fill = '#cfeaf4';
    stroke = '#7fb5c8';
  }
  const buildOk = (state.mode === 'shelf' || state.mode === 'checkout') && canBuild(cell);
  if (buildOk) {
    fill = '#e7f0ff';
    stroke = '#4f9dff';
  }
  if (selected) {
    fill = '#ffe9a8';
    stroke = '#e0a800';
  }

  ctx.fillStyle = fill;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (cell.state === 'locked') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    // Ô thuộc vùng level kế tiếp → icon mở khóa mờ (gợi ý lên cấp sẽ mở cả vùng).
    const nextRegion = regionForLevel(state.level + 1);
    const upcoming = cellInRegion(cell.x, cell.y, nextRegion)
      && !cellInRegion(cell.x, cell.y, regionForLevel(state.level));
    if (upcoming) {
      ctx.globalAlpha = 0.55;
      if (!drawIcon(icons.unlock, cx - 14, cy - 14, 28)) drawPadlock(cx, cy, 14);
      ctx.globalAlpha = 1;
    } else {
      drawPadlock(cx, cy, 15);
    }
  }
}

function drawBuildingShell(x, y, w, h, shell, shellStroke) {
  ctx.fillStyle = 'rgba(31,58,70,.10)';
  roundRect(x + 2, y + 3, w, h, 8);
  ctx.fill();
  ctx.fillStyle = shell;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = shellStroke;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function drawStockPips(x, y, w, stock, cap) {
  const n = 4;
  const filled = Math.ceil((stock / Math.max(1, cap)) * n);
  const pipW = (w - 10) / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < filled ? '#22c55e' : 'rgba(255,255,255,.35)';
    roundRect(x + 5 + i * pipW, y + 4, pipW - 2, 5, 2);
    ctx.fill();
  }
}

function drawTopDownShelf(cell, x, y, w, h) {
  const empty = (cell.stock ?? 0) <= 0;
  const pulse = cell.pulse > 0 ? 1 + Math.sin(state.time * 20) * 0.03 : 1;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.translate(-cx, -cy);

  drawBuildingShell(x, y, w, h, empty ? '#8aa4b0' : '#4f93b0', empty ? '#6c838e' : '#2f647a');
  const ok = drawIcon(icons.shelf, x + 4, y + 2, Math.min(w - 8, h - 14));
  if (!ok) {
    // Fallback họa tiết kệ nếu icon chưa load.
    ctx.fillStyle = '#eef8ff';
    roundRect(x + 6, y + 6, w - 12, h - 18, 5);
    ctx.fill();
  }
  drawStockPips(x, y + h - 12, w, cell.stock ?? 0, cell.stockCap || 12);
  if (empty) {
    ctx.fillStyle = 'rgba(228,87,76,.85)';
    ctx.beginPath();
    ctx.arc(x + w - 8, y + 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTopDownCheckout(x, y, w, h) {
  drawBuildingShell(x, y, w, h, '#f0c94a', '#a67c00');
  if (!drawIcon(icons.checkout, x + 4, y + 4, Math.min(w, h) - 8)) {
    ctx.fillStyle = '#fff7d1';
    roundRect(x + 6, y + 6, w - 12, h - 12, 5);
    ctx.fill();
  }
}

function drawTopDownStock(x, y, w, h) {
  drawBuildingShell(x, y, w, h, '#8b6b4a', '#5c3f27');
  if (!drawIcon(icons.stock, x + 4, y + 4, Math.min(w, h) - 8)) {
    ctx.fillStyle = '#f0e2c8';
    roundRect(x + 8, y + 8, w - 16, h - 16, 5);
    ctx.fill();
  }
}

function drawDoor(cell, x, y, w, h) {
  // Cánh cửa mở ra ngoài — nhìn là biết lối vào.
  const swing = 0.12 + Math.sin(state.time * 1.6) * 0.04;
  ctx.fillStyle = '#6b8f9c';
  roundRect(x, y, w, h, 6);
  ctx.fill();

  // Sàn cửa sáng hơn = lối đi.
  ctx.fillStyle = '#b8e0ef';
  roundRect(x + 6, y + 4, w - 12, h - 6, 4);
  ctx.fill();

  // Hai cánh cửa.
  ctx.save();
  ctx.translate(x + 8, y + 6);
  ctx.rotate(-swing);
  ctx.fillStyle = '#d7eef7';
  roundRect(0, 0, w * 0.32, h - 14, 3);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x + w - 8, y + 6);
  ctx.rotate(swing);
  ctx.fillStyle = '#c5e6f4';
  roundRect(-w * 0.32, 0, w * 0.32, h - 14, 3);
  ctx.fill();
  ctx.restore();

  drawIcon(icons.door, x + (w - 22) / 2, y + h - 24, 22);

  // Mũi tên vào cửa (nhấp nháy nhẹ).
  const a = 0.45 + Math.sin(state.time * 4) * 0.35;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#1f8f6c';
  const ax = x + w / 2;
  const ay = y - 6;
  ctx.beginPath();
  ctx.moveTo(ax, ay + 10);
  ctx.lineTo(ax - 7, ay);
  ctx.lineTo(ax + 7, ay);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBuilding(cell) {
  if (!cell.building) return;
  const t = GRID.tile;
  const p = gridToScreen(cell.x, cell.y, state.originX, state.originY);
  const x = p.x + 8;
  const y = p.y + 8;
  const w = t - 16;
  const h = t - 16;
  if (cell.building === 'shelf') drawTopDownShelf(cell, x, y, w, h);
  else if (cell.building === 'checkout') drawTopDownCheckout(x, y, w, h);
  else if (cell.building === 'stockroom') drawTopDownStock(x, y, w, h);
  else if (cell.building === 'door') drawDoor(cell, x, y, w, h);
}

function drawQueueMarks() {
  if (!actors.checkout || !actors.queue.length) return;
  const co = actors.checkout;
  const slots = [
    { x: co.x, y: co.y + 1 },
    { x: co.x, y: co.y + 2 },
    { x: co.x + 1, y: co.y + 1 },
  ];
  for (let i = 0; i < Math.min(actors.queue.length, slots.length); i++) {
    const s = slots[i];
    const cell = cells[s.y]?.[s.x];
    if (!cell || cell.state === 'locked') continue;
    const c = cellCenter(s, state.originX, state.originY);
    ctx.fillStyle = 'rgba(230,180,34,.22)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 8, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(166,124,0,.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawMoneyStack() {
  if (state.pendingMoney <= 0 || !actors.checkout) return;
  const c = cellCenter(actors.checkout, state.originX, state.originY);
  const bounce = Math.sin(state.time * 6) * 2;
  const x = c.x + 16;
  const y = c.y - 18 + bounce;
  const layers = Math.min(5, 1 + Math.floor(state.pendingMoney / 12));
  for (let i = 0; i < layers; i++) {
    ctx.fillStyle = i % 2 ? '#f5d76e' : '#e6b422';
    roundRect(x - 12, y - i * 4, 24, 10, 3);
    ctx.fill();
    ctx.strokeStyle = '#a67c00';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Icon tay chạm thay chữ "CHẠM THU".
  const pulse = 0.7 + Math.sin(state.time * 5) * 0.3;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#1f3a46';
  ctx.beginPath();
  ctx.arc(x, y + 18, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 14);
  ctx.lineTo(x + 2, y + 14);
  ctx.lineTo(x + 4, y + 22);
  ctx.lineTo(x - 4, y + 22);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRoomFrame() {
  const t = GRID.tile;
  const x = state.originX - 14;
  const y = state.originY - 14;
  const w = GRID.width * t + 28;
  const h = GRID.height * t + 28;
  ctx.fillStyle = '#fffdf8';
  roundRect(x, y, w, h, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(31,58,70,.14)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Lối mở tường trùng ô cửa.
  if (actors.door) {
    const doorP = gridToScreen(actors.door.x, actors.door.y, state.originX, state.originY);
    const gapX = doorP.x + 6;
    const gapW = t - 12;
    const gapY = state.originY + GRID.height * t - 2;
    ctx.fillStyle = '#9fd0e8';
    roundRect(gapX, gapY, gapW, 16, 4);
    ctx.fill();
    // Thảm đỏ ngoài cửa.
    ctx.fillStyle = '#e4574c';
    roundRect(gapX + 8, gapY + 10, gapW - 16, 18, 3);
    ctx.fill();
  }
}

function drawOutsidePath() {
  if (!actors.door) return;
  const t = GRID.tile;
  const p = gridToScreen(actors.door.x, actors.door.y, state.originX, state.originY);
  const x = p.x + 10;
  const y = p.y + t + 2;
  ctx.fillStyle = 'rgba(159,208,232,.55)';
  roundRect(x, y, t - 20, t * 0.7, 8);
  ctx.fill();
}

function draw() {
  const w = innerWidth;
  const h = innerHeight;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#bfe8f4');
  g.addColorStop(0.55, BRAND.colors.bg);
  g.addColorStop(1, '#dff3c9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  drawRoomFrame();
  drawOutsidePath();
  forEachCell(cells, drawFloorTile);
  drawQueueMarks();
  forEachCell(cells, drawBuilding);
  for (const c of actors.customers) drawCustomer(ctx, c, state.originX, state.originY);
  drawMoneyStack();
  drawFx(ctx, fx);
}

function showToast(text) {
  const el = $('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  state.toastT = 1.4;
}

function setMode(mode) {
  state.mode = state.mode === mode ? null : mode;
  syncDock();
  syncHud();
}

function syncDock() {
  $('btnShelf')?.classList.toggle('on', state.mode === 'shelf');
  $('btnCheckout')?.classList.toggle('on', state.mode === 'checkout');
}

function celebrateRegionUnlock(newly, level) {
  if (!newly.length) return;
  for (const cell of newly) {
    const p = cellCenter(cell, state.originX, state.originY);
    addSpark(fx, p.x, p.y, '#1f8f6c');
    addRing(fx, p.x, p.y, 'rgba(31,143,108,.28)');
  }
  const mid = newly[Math.floor(newly.length / 2)];
  const c = cellCenter(mid, state.originX, state.originY);
  addFloat(fx, c.x, c.y - 10, `Lv${level}`, '#1f8f6c');
  showToast(`Lv ${level} · mở vùng mới!`);
}

function checkLevelUp() {
  const level = storeLevel(cells);
  if (level <= state.level) {
    state.level = level;
    return false;
  }
  // Lên từng bậc để mỗi vùng bung ra rõ ràng.
  while (state.level < level) {
    state.level += 1;
    const newly = applyOpenRegion(cells, state.level);
    celebrateRegionUnlock(newly, state.level);
  }
  refreshActorsBuildings(actors, cells);
  return true;
}

function syncHud() {
  checkLevelUp();
  const opened = countOpened(cells);
  const prog = nextLevelProgress(cells);
  $('money').textContent = `$${state.money}`;
  if (prog.done) {
    $('stats').textContent = `Lv${prog.level} · ${opened}/${totalCells()}`;
  } else {
    $('stats').textContent = `Lv${prog.level} · ${prog.have}/${prog.need} → vùng`;
  }
  if (state.mode === 'shelf') $('hint').textContent = 'Chạm ô trống để đặt kệ';
  else if (state.mode === 'checkout') $('hint').textContent = 'Chạm ô trống để đặt quầy';
  else if (state.pendingMoney > 0) $('hint').textContent = 'Chạm đống vàng ở quầy để thu';
  else if (!prog.done) $('hint').textContent = `Xây thêm ${prog.need - prog.have} để mở vùng Lv${prog.next}`;
  else $('hint').textContent = PHASE.reviewNote;
}

function tryBuildOn(cell) {
  if (!cell || !state.mode) return false;
  if (cell.building === 'door') {
    showToast('Đây là cửa vào');
    return true;
  }
  if (state.mode === 'shelf' || state.mode === 'checkout') {
    const price = state.mode === 'shelf' ? ECONOMY.buildShelf : ECONOMY.buildCheckout;
    if (state.money < price) { showToast('Không đủ tiền'); return true; }
    const res = placeBuilding(cell, state.mode);
    if (!res.ok) { showToast(res.reason); return true; }
    state.money -= res.price;
    refreshActorsBuildings(actors, cells);
    const p = cellCenter(cell, state.originX, state.originY);
    addSpark(fx, p.x, p.y, state.mode === 'shelf' ? '#4f9dff' : '#e6b422');
    addRing(fx, p.x, p.y, 'rgba(79,157,255,.3)');
    checkLevelUp();
    syncHud();
    return true;
  }
  return false;
}

function worldFromCustomer(c) {
  return {
    x: state.originX + c.x * GRID.tile + GRID.tile / 2,
    y: state.originY + c.y * GRID.tile + GRID.tile / 2,
  };
}

function onEnter(c) {
  const p = worldFromCustomer(c);
  addRing(fx, p.x, p.y, 'rgba(31,143,108,.35)');
}

function onArriveShelf(c) {
  const p = worldFromCustomer(c);
  addRing(fx, p.x, p.y, 'rgba(79,157,255,.35)');
}

function onTakeItem(c, shelf) {
  shelf.pulse = 0.35;
  const p = cellCenter(shelf, state.originX, state.originY);
  const color = c.sku?.color || '#22c55e';
  addSpark(fx, p.x, p.y, color);
}

function onPay(c) {
  const gain = Math.max(4, (c.basket || 1) * (c.sku?.price || 5));
  state.pendingMoney += gain;
  const p = cellCenter(actors.checkout, state.originX, state.originY);
  addSpark(fx, p.x, p.y, BRAND.colors.money);
  addFloat(fx, p.x, p.y - 12, `+$${gain}`, '#b45309');
  syncHud();
}

function onExit(c) {
  const p = worldFromCustomer(c);
  addRing(fx, p.x, p.y, 'rgba(159,208,232,.5)');
}

function collectMoney(clientX, clientY) {
  if (state.pendingMoney <= 0 || !actors.checkout) return false;
  const c = cellCenter(actors.checkout, state.originX, state.originY);
  const x = c.x + 16;
  const y = c.y - 18;
  const rect = canvas.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  if (Math.hypot(px - x, py - y) > 42) return false;
  const got = state.pendingMoney;
  state.money += got;
  state.pendingMoney = 0;
  addFloat(fx, x, y - 10, `+$${got}`, BRAND.colors.accent);
  addSpark(fx, x, y, BRAND.colors.money);
  addRing(fx, x, y, 'rgba(230,180,34,.4)');
  syncHud();
  return true;
}

function pickCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const g = screenToGrid(x, y, state.originX, state.originY);
  if (g.x < 0 || g.y < 0 || g.x >= GRID.width || g.y >= GRID.height) return null;
  return cells[g.y][g.x];
}

function onPointerDown(e) {
  if (!state.playing) return;
  state.dragging = true;
  state.moved = false;
  state.lastX = e.clientX;
  state.lastY = e.clientY;
}

function onPointerMove(e) {
  if (!state.dragging) return;
  const dx = e.clientX - state.lastX;
  const dy = e.clientY - state.lastY;
  if (Math.hypot(dx, dy) > 4) state.moved = true;
  state.originX += dx;
  state.originY += dy;
  state.lastX = e.clientX;
  state.lastY = e.clientY;
}

function onPointerUp(e) {
  if (!state.playing) return;
  if (state.dragging && !state.moved) {
    if (!collectMoney(e.clientX, e.clientY)) {
      state.selected = pickCell(e.clientX, e.clientY);
      if (state.mode) {
        tryBuildOn(state.selected);
      } else if (state.selected?.building === 'shelf' && state.selected.stock <= 0) {
        state.selected.stock = state.selected.stockCap;
        const p = cellCenter(state.selected, state.originX, state.originY);
        addSpark(fx, p.x, p.y, '#22c55e');
        addRing(fx, p.x, p.y, 'rgba(34,197,94,.35)');
      }
      syncHud();
    }
  }
  state.dragging = false;
}

function update(dt) {
  state.time += dt;
  if (state.toastT > 0) {
    state.toastT -= dt;
    if (state.toastT <= 0) $('toast')?.classList.remove('show');
  }
  forEachCell(cells, cell => {
    if (cell.pulse > 0) cell.pulse = Math.max(0, cell.pulse - dt);
  });
  updateActors(actors, cells, dt, {
    onEnter,
    onArriveShelf,
    onTakeItem,
    onPay,
    onExit,
  });
  updateFx(fx, dt);
  syncHud();
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000) * state.speed;
  lastTs = ts;
  if (state.playing) update(dt);
  draw();
  requestAnimationFrame(frame);
}

function openStore() {
  state.playing = true;
  $('splash').classList.add('hidden');
  $('hud').classList.remove('hidden');
  centerMap();
  spawnCustomer(actors, cells);
  spawnCustomer(actors, cells);
  actors.spawnT = 1.2;
  state.level = storeLevel(cells);
  syncDock();
  syncHud();
}

function boot() {
  applyBrandCss();
  $('brandName').textContent = BRAND.name;
  $('brandSlogan').textContent = BRAND.slogan;
  $('phaseTag').textContent = PHASE.id;
  $('skuPreview').innerHTML = SKUS.slice(0, 4).map(s =>
    `<span style="background:${s.color}33;border:2px solid ${s.color}">●</span>`
  ).join('');
  $('openBtn').onclick = openStore;
  if ($('speedBtn')) {
    $('speedBtn').onclick = () => {
      state.speed = state.speed === 1 ? 2 : 1;
      $('speedBtn').textContent = `x${state.speed}`;
    };
  }
  $('btnShelf').onclick = () => setMode('shelf');
  $('btnCheckout').onclick = () => setMode('checkout');
  $('btnCancel').onclick = () => { state.mode = null; syncDock(); syncHud(); };
  addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointerDown);
  addEventListener('pointermove', onPointerMove);
  addEventListener('pointerup', onPointerUp);
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  }
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  syncDock();
  resize();
  requestAnimationFrame(frame);
}

boot();
if (location.search.includes('play=1')) openStore();
