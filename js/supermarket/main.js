import { BRAND, GRID, ECONOMY, SKUS, PHASE } from './config.js?v=m3';
import { createGrid, gridToScreen, screenToGrid, forEachCell, countByState, cellCenter } from './grid.js?v=m3';
import { createActorsState, updateActors, drawCustomer, spawnCustomer } from './actors.js?v=m3';
import { createFx, addFloat, addSpark, addRing, updateFx, drawFx } from './fx.js?v=m3';
import {
  canUnlock, canBuild, unlockCell, placeBuilding, unlockPrice, storeLevel,
  refreshActorsBuildings, countOpened,
} from './build.js?v=m3';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const cells = createGrid();
const actors = createActorsState(cells);
const fx = createFx();

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
  mode: null, // null | unlock | shelf | checkout
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
  state.originY = innerHeight * 0.2 + Math.max(0, (innerHeight * 0.58 - mapH) / 2);
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
  const buildOk = (state.mode === 'unlock' && canUnlock(cells, cell))
    || ((state.mode === 'shelf' || state.mode === 'checkout') && canBuild(cell));
  if (buildOk) {
    fill = state.mode === 'unlock' ? '#d9f7e8' : '#e7f0ff';
    stroke = state.mode === 'unlock' ? '#1f8f6c' : '#4f9dff';
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
    const statusH = Math.max(13, Math.floor(h * 0.3));
    const pad = 4;
    const contentBottom = y + h - statusH - pad * 2;
    // Họa tiết chỉ trong vùng nội dung, không đụng khung chữ.
    ctx.strokeStyle = 'rgba(31,58,70,.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 10);
    ctx.lineTo(x + w - 8, contentBottom);
    ctx.moveTo(x + w - 8, y + 10);
    ctx.lineTo(x + 8, contentBottom);
    ctx.stroke();
    drawStatusChip(x + pad, y + h - statusH - pad, w - pad * 2, statusH, 'Khóa', {
      bg: 'rgba(255,253,247,.95)',
      fg: '#5b6f78',
      stroke: 'rgba(31,58,70,.16)',
    });
  }
}

function drawStatusChip(x, y, w, h, text, opts = {}) {
  const bg = opts.bg || '#fffdf7';
  const fg = opts.fg || BRAND.colors.ink;
  const stroke = opts.stroke || 'rgba(31,58,70,.18)';
  roundRect(x, y, w, h, Math.min(8, h / 2));
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = `800 ${Math.max(9, Math.floor(h * 0.62))}px "Baloo 2", system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
}

function drawSplitBuilding(x, y, w, h, { shell, shellStroke, contentBg, statusText, statusOpts, drawContent }) {
  const statusH = Math.max(13, Math.floor(h * 0.3));
  const pad = 3;

  // Vỏ ngoài ô.
  ctx.fillStyle = 'rgba(31,58,70,.10)';
  roundRect(x + 2, y + 3, w, h, 7);
  ctx.fill();
  ctx.fillStyle = shell;
  roundRect(x, y, w, h, 7);
  ctx.fill();
  ctx.strokeStyle = shellStroke;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Panel nội dung phía trên (không có chữ).
  const contentX = x + pad;
  const contentY = y + pad;
  const contentW = w - pad * 2;
  const contentH = h - statusH - pad * 2;
  ctx.fillStyle = contentBg;
  roundRect(contentX, contentY, contentW, contentH, 5);
  ctx.fill();
  drawContent?.(contentX, contentY, contentW, contentH);

  // Panel chữ riêng phía dưới.
  drawStatusChip(x + pad, y + h - statusH - pad, w - pad * 2, statusH, statusText, statusOpts);
}

function drawTopDownShelf(cell, x, y, w, h) {
  const pulse = cell.pulse > 0 ? 1 + Math.sin(state.time * 20) * 0.03 : 1;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.translate(-cx, -cy);

  const empty = (cell.stock ?? 0) <= 0;
  drawSplitBuilding(x, y, w, h, {
    shell: empty ? '#8aa4b0' : '#4f93b0',
    shellStroke: empty ? '#6c838e' : '#2f647a',
    contentBg: '#eef8ff',
    statusText: empty ? 'Hết hàng' : `${cell.stock}/${cell.stockCap}`,
    statusOpts: empty
      ? { bg: '#fee2e2', fg: BRAND.colors.danger, stroke: '#fca5a5' }
      : { bg: '#fffdf7', fg: BRAND.colors.ink, stroke: 'rgba(31,58,70,.16)' },
    drawContent: (cx0, cy0, cw, ch) => {
      const cols = 2;
      const rows = 2;
      const gap = 3;
      const gw = (cw - gap * (cols + 1)) / cols;
      const gh = (ch - gap * (rows + 1)) / rows;
      const filledSlots = Math.ceil(((cell.stock ?? 0) / Math.max(1, cell.stockCap || 12)) * 4);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const gx = cx0 + gap + c * (gw + gap);
          const gy = cy0 + gap + r * (gh + gap);
          ctx.fillStyle = '#dff0fa';
          roundRect(gx, gy, gw, gh, 3);
          ctx.fill();
          if (idx < filledSlots) {
            const sku = SKUS[(cell.x + cell.y + idx) % SKUS.length];
            const bob = Math.sin(state.time * 4 + idx) * 0.7;
            ctx.fillStyle = sku.color;
            ctx.beginPath();
            ctx.arc(gx + gw / 2, gy + gh / 2 + bob, Math.min(gw, gh) * 0.23, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
  });
  ctx.restore();
}

function drawTopDownCheckout(x, y, w, h) {
  drawSplitBuilding(x, y, w, h, {
    shell: '#f0c94a',
    shellStroke: '#a67c00',
    contentBg: '#fff7d1',
    statusText: 'PAY',
    statusOpts: { bg: '#fffdf7', fg: BRAND.colors.ink, stroke: '#e0b84a' },
    drawContent: (cx0, cy0, cw, ch) => {
      ctx.strokeStyle = 'rgba(166,124,0,.35)';
      ctx.lineWidth = 1.2;
      for (let i = 1; i <= 2; i++) {
        const yy = cy0 + ch * (i / 3);
        ctx.beginPath();
        ctx.moveTo(cx0 + 4, yy);
        ctx.lineTo(cx0 + cw - 4, yy);
        ctx.stroke();
      }
    },
  });
}

function drawTopDownStock(x, y, w, h) {
  drawSplitBuilding(x, y, w, h, {
    shell: '#8b6b4a',
    shellStroke: '#5c3f27',
    contentBg: '#f0e2c8',
    statusText: 'Kho',
    statusOpts: { bg: '#fff8ef', fg: '#5c3f27', stroke: '#d2b48c' },
    drawContent: (cx0, cy0, cw, ch) => {
      ctx.fillStyle = '#e4d0b0';
      roundRect(cx0 + cw * 0.18, cy0 + ch * 0.18, cw * 0.64, ch * 0.64, 4);
      ctx.fill();
      ctx.strokeStyle = '#c4a57a';
      ctx.stroke();
    },
  });
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
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(31,58,70,.35)';
  ctx.lineWidth = 3;
  ctx.font = '800 13px "Baloo 2", system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.strokeText(`$${state.pendingMoney}`, x, y - layers * 4 - 2);
  ctx.fillText(`$${state.pendingMoney}`, x, y - layers * 4 - 2);

  // Hint tap.
  ctx.fillStyle = 'rgba(31,58,70,.8)';
  roundRect(x - 28, y + 14, 56, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 10px "Baloo 2", system-ui';
  ctx.textBaseline = 'middle';
  ctx.fillText('CHẠM THU', x, y + 22);
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

  const doorW = t * 1.4;
  const doorX = state.originX + (GRID.width * t - doorW) / 2;
  const doorY = state.originY + GRID.height * t - 2;
  ctx.fillStyle = '#9fd0e8';
  roundRect(doorX, doorY, doorW, 12, 4);
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
  forEachCell(cells, drawFloorTile);
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
  const price = unlockPrice(cells);
  if ($('unlockPrice')) $('unlockPrice').textContent = `$${price}`;
  $('btnUnlock')?.classList.toggle('on', state.mode === 'unlock');
  $('btnShelf')?.classList.toggle('on', state.mode === 'shelf');
  $('btnCheckout')?.classList.toggle('on', state.mode === 'checkout');
}

function syncHud() {
  const opened = countOpened(cells);
  const level = storeLevel(cells);
  if (level > state.level) {
    state.level = level;
    showToast(`Store Level ${level}!`);
  } else {
    state.level = level;
  }
  $('money').textContent = `$${state.money}`;
  $('stats').textContent = `Lv${level} · ${opened}/64 ô · Chờ $${state.pendingMoney}`;
  if (state.mode === 'unlock') $('hint').textContent = `Chạm ô Khóa kề vùng mở · giá $${unlockPrice(cells)}`;
  else if (state.mode === 'shelf') $('hint').textContent = `Chạm ô trống để xây Kệ · $${ECONOMY.buildShelf}`;
  else if (state.mode === 'checkout') $('hint').textContent = `Chạm ô trống để xây Quầy · $${ECONOMY.buildCheckout}`;
  else if (state.pendingMoney > 0) $('hint').textContent = 'Chạm đống tiền vàng ở quầy PAY để thu';
  else $('hint').textContent = PHASE.reviewNote;
}

function tryBuildOn(cell) {
  if (!cell || !state.mode) return false;
  if (state.mode === 'unlock') {
    const price = unlockPrice(cells);
    if (state.money < price) { showToast('Không đủ tiền'); return true; }
    const res = unlockCell(cells, cell);
    if (!res.ok) { showToast(res.reason); return true; }
    state.money -= res.price;
    const p = cellCenter(cell, state.originX, state.originY);
    addSpark(fx, p.x, p.y, '#1f8f6c');
    addFloat(fx, p.x, p.y - 8, 'Mở ô!', '#1f8f6c');
    addRing(fx, p.x, p.y, 'rgba(31,143,108,.35)');
    syncDock();
    syncHud();
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
    addFloat(fx, p.x, p.y - 8, `+${res.type.label}`, BRAND.colors.accent);
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

function onArriveShelf(c) {
  const p = worldFromCustomer(c);
  addRing(fx, p.x, p.y, 'rgba(79,157,255,.35)');
}

function onTakeItem(c, shelf) {
  shelf.pulse = 0.35;
  const p = cellCenter(shelf, state.originX, state.originY);
  const color = c.sku?.color || '#22c55e';
  addSpark(fx, p.x, p.y, color);
  addFloat(fx, p.x, p.y - 8, `+${c.sku?.name || 'Item'}`, color);
}

function onPay(c) {
  const gain = Math.max(4, (c.basket || 1) * (c.sku?.price || 5));
  state.pendingMoney += gain;
  const p = cellCenter(actors.checkout, state.originX, state.originY);
  addSpark(fx, p.x, p.y, BRAND.colors.money);
  addFloat(fx, p.x, p.y - 12, `+$${gain}`, '#b45309');
  syncHud();
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
        // Tap kệ hết hàng → restock nhanh.
        state.selected.stock = state.selected.stockCap;
        const p = cellCenter(state.selected, state.originX, state.originY);
        addSpark(fx, p.x, p.y, '#22c55e');
        addFloat(fx, p.x, p.y - 8, 'Restock!', '#1f8f6c');
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
    onArriveShelf,
    onTakeItem,
    onPay,
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
  // Spawn ngay 2 khách để thấy chuyển động từ giây đầu.
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
  $('skuPreview').innerHTML = SKUS.slice(0, 4).map(s => `<span>${s.name}</span>`).join('');
  $('openBtn').onclick = openStore;
  if ($('speedBtn')) {
    $('speedBtn').onclick = () => {
      state.speed = state.speed === 1 ? 2 : 1;
      $('speedBtn').textContent = `x${state.speed}`;
    };
  }
  $('btnUnlock').onclick = () => setMode('unlock');
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
