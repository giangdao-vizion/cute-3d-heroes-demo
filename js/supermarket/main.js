import { BRAND, GRID, ECONOMY, SKUS, PHASE } from './config.js?v=m1c';
import { createGrid, gridToScreen, screenToGrid, forEachCell, countByState } from './grid.js?v=m1c';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const cells = createGrid();

const state = {
  money: ECONOMY.startMoney,
  selected: null,
  originX: 0,
  originY: 0,
  dragging: false,
  moved: false,
  lastX: 0,
  lastY: 0,
  playing: false,
};

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
  draw();
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

  // Lối đi vs ô khóa: nhìn thẳng từ trên, ô VUÔNG rõ.
  let fill = ((cell.x + cell.y) % 2 === 0) ? '#f4f8e8' : '#eaf3d5';
  let stroke = '#c5d8a8';
  if (cell.state === 'locked') {
    fill = ((cell.x + cell.y) % 2 === 0) ? '#d5e0e5' : '#c9d7dd';
    stroke = '#a7b8bf';
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
    ctx.fillStyle = 'rgba(31,58,70,.28)';
    ctx.font = '700 13px "Baloo 2", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔒', x + w / 2, y + h / 2);
  }
}

function drawTopDownShelf(x, y, w, h) {
  // Nhìn từ trên: mặt trên kệ + các ngăn hàng.
  ctx.fillStyle = 'rgba(31,58,70,.12)';
  roundRect(x + 2, y + 3, w, h, 6);
  ctx.fill();

  ctx.fillStyle = '#4f93b0';
  roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = '#2f647a';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const cols = 2;
  const rows = 2;
  const pad = 5;
  const gw = (w - pad * (cols + 1)) / cols;
  const gh = (h - pad * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gx = x + pad + c * (gw + pad);
      const gy = y + pad + r * (gh + pad);
      ctx.fillStyle = '#eef8ff';
      roundRect(gx, gy, gw, gh, 3);
      ctx.fill();
      // Chấm hàng hóa.
      ctx.fillStyle = ['#ff7a59', '#7c3aed', '#22c55e', '#f59e0b'][(r * 2 + c) % 4];
      ctx.beginPath();
      ctx.arc(gx + gw / 2, gy + gh / 2, Math.min(gw, gh) * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTopDownCheckout(x, y, w, h) {
  ctx.fillStyle = 'rgba(31,58,70,.12)';
  roundRect(x + 2, y + 3, w, h, 6);
  ctx.fill();
  ctx.fillStyle = '#f0c94a';
  roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = '#a67c00';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Băng chuyền nhìn từ trên.
  ctx.fillStyle = '#fff7d1';
  roundRect(x + 6, y + h * 0.28, w - 12, h * 0.22, 4);
  ctx.fill();
  ctx.fillStyle = BRAND.colors.ink;
  ctx.font = '800 11px "Baloo 2", system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAY', x + w / 2, y + h * 0.68);
}

function drawTopDownStock(x, y, w, h) {
  ctx.fillStyle = 'rgba(31,58,70,.12)';
  roundRect(x + 2, y + 3, w, h, 6);
  ctx.fill();
  ctx.fillStyle = '#8b6b4a';
  roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = '#5c3f27';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#f0e2c8';
  roundRect(x + w * 0.22, y + h * 0.22, w * 0.56, h * 0.56, 4);
  ctx.fill();
  ctx.strokeStyle = '#c4a57a';
  ctx.stroke();
}

function drawBuilding(cell) {
  if (!cell.building) return;
  const t = GRID.tile;
  const p = gridToScreen(cell.x, cell.y, state.originX, state.originY);
  const x = p.x + 8;
  const y = p.y + 8;
  const w = t - 16;
  const h = t - 16;
  if (cell.building === 'shelf') drawTopDownShelf(x, y, w, h);
  else if (cell.building === 'checkout') drawTopDownCheckout(x, y, w, h);
  else if (cell.building === 'stockroom') drawTopDownStock(x, y, w, h);
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

  // Cửa vào phía dưới — dấu hiệu nhìn từ trên.
  const doorW = t * 1.4;
  const doorX = state.originX + (GRID.width * t - doorW) / 2;
  const doorY = state.originY + GRID.height * t - 2;
  ctx.fillStyle = '#9fd0e8';
  roundRect(doorX, doorY, doorW, 12, 4);
  ctx.fill();
}

function drawViewBadge() {
  ctx.fillStyle = 'rgba(31,58,70,.82)';
  roundRect(12, 96, 168, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 13px "Baloo 2", system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('NHÌN TỪ TRÊN XUỐNG', 24, 110);
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
  drawViewBadge();
}

function syncHud() {
  $('money').textContent = `$${state.money}`;
  const counts = countByState(cells);
  $('stats').textContent = `Mở ${counts.empty + counts.occupied}/${GRID.width * GRID.height} ô · CT ${counts.occupied}`;
  if (state.selected) {
    const c = state.selected;
    const label = c.building || c.state;
    $('hint').textContent = `Ô (${c.x},${c.y}): ${label}`;
  } else {
    $('hint').textContent = PHASE.reviewNote;
  }
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
  draw();
}

function onPointerUp(e) {
  if (!state.playing) return;
  if (state.dragging && !state.moved) {
    state.selected = pickCell(e.clientX, e.clientY);
    syncHud();
    draw();
  }
  state.dragging = false;
}

function openStore() {
  state.playing = true;
  $('splash').classList.add('hidden');
  $('hud').classList.remove('hidden');
  centerMap();
  syncHud();
  draw();
}

function boot() {
  applyBrandCss();
  $('brandName').textContent = BRAND.name;
  $('brandSlogan').textContent = BRAND.slogan;
  $('phaseTag').textContent = PHASE.id;
  $('skuPreview').innerHTML = SKUS.slice(0, 4).map(s => `<span>${s.name}</span>`).join('');
  $('openBtn').onclick = openStore;
  addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointerDown);
  addEventListener('pointermove', onPointerMove);
  addEventListener('pointerup', onPointerUp);
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  }
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  resize();
}

boot();
if (location.search.includes('play=1')) openStore();
