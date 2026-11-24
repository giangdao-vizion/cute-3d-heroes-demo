import { BRAND, GRID, ECONOMY, SKUS, PHASE } from './config.js';
import { createGrid, gridToScreen, screenToGrid, forEachCell, countByState } from './grid.js';

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
  state.originY = innerHeight * 0.18 + Math.max(0, (innerHeight * 0.62 - mapH) / 2);
}

function jitter(x, y, n, amount = 1.1) {
  return ((Math.sin((x + 3) * 9.1 + (y + 2) * 5.7 + n * 2.3) * 0.5 + 0.5) - 0.5) * amount;
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
  const pad = 2;
  const x = p.x + pad + jitter(cell.x, cell.y, 1, 0.6);
  const y = p.y + pad + jitter(cell.x, cell.y, 2, 0.6);
  const w = t - pad * 2;
  const h = t - pad * 2;

  let fill = '#eef6dc';
  let stroke = '#c9dbb0';
  if (cell.state === 'locked') {
    fill = '#c5d3d8';
    stroke = '#9aafb7';
  } else if (cell.state === 'occupied') {
    fill = '#e7f0cf';
    stroke = '#b7cb8f';
  }
  if (selected) {
    fill = '#fff1b8';
    stroke = '#e0a800';
  }

  // Bóng sàn nhẹ.
  ctx.fillStyle = 'rgba(31,58,70,.08)';
  roundRect(x + 2, y + 3, w, h, 10);
  ctx.fill();

  ctx.fillStyle = fill;
  roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.7;
  ctx.stroke();

  // Vân gạch tay vẽ rất nhẹ.
  if (cell.state !== 'locked') {
    ctx.strokeStyle = 'rgba(159,191,122,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h * 0.55);
    ctx.lineTo(x + w - 8, y + h * 0.55);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(31,58,70,.22)';
    ctx.font = '700 14px "Baloo 2", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔒', x + w / 2, y + h / 2);
  }
}

function drawBox25D(x, y, w, depth, height, top, side, front, stroke) {
  // Nhìn hơi nghiêng: mặt trên + cạnh phải + mặt trước.
  const topY = y - height;
  ctx.beginPath();
  ctx.moveTo(x, topY + depth);
  ctx.lineTo(x + w, topY + depth);
  ctx.lineTo(x + w + depth, topY);
  ctx.lineTo(x + depth, topY);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + w, topY + depth);
  ctx.lineTo(x + w + depth, topY);
  ctx.lineTo(x + w + depth, topY + height);
  ctx.lineTo(x + w, topY + height + depth);
  ctx.closePath();
  ctx.fillStyle = side;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x, topY + depth);
  ctx.lineTo(x + w, topY + depth);
  ctx.lineTo(x + w, topY + height + depth);
  ctx.lineTo(x, topY + height + depth);
  ctx.closePath();
  ctx.fillStyle = front;
  ctx.fill();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawBuilding(cell) {
  if (!cell.building) return;
  const t = GRID.tile;
  const p = gridToScreen(cell.x, cell.y, state.originX, state.originY);
  const cx = p.x + t / 2;
  const baseY = p.y + t - 10;

  if (cell.building === 'shelf') {
    drawBox25D(cx - 18, baseY - 8, 30, 8, 26, '#7ec2dd', '#3f7f9b', BRAND.colors.shelf, '#2b5f74');
    ctx.fillStyle = '#f4fbff';
    roundRect(cx - 13, baseY - 26, 9, 7, 2); ctx.fill();
    roundRect(cx - 1, baseY - 26, 9, 7, 2); ctx.fill();
    roundRect(cx - 13, baseY - 16, 9, 7, 2); ctx.fill();
    roundRect(cx - 1, baseY - 16, 9, 7, 2); ctx.fill();
  } else if (cell.building === 'checkout') {
    drawBox25D(cx - 20, baseY - 6, 34, 8, 18, '#f3d56b', '#c79a1d', BRAND.colors.money, '#8d6a08');
    ctx.fillStyle = BRAND.colors.ink;
    ctx.font = '800 11px "Baloo 2", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAY', cx - 1, baseY - 10);
  } else if (cell.building === 'stockroom') {
    drawBox25D(cx - 18, baseY - 8, 30, 9, 28, '#c4a07a', '#7a5738', '#8b6b4a', '#5c3f27');
    ctx.fillStyle = '#f3e6cf';
    roundRect(cx - 7, baseY - 18, 12, 12, 3); ctx.fill();
  }
}

function drawRoomFrame() {
  const t = GRID.tile;
  const x = state.originX - 10;
  const y = state.originY - 10;
  const w = GRID.width * t + 20;
  const h = GRID.height * t + 20;
  ctx.fillStyle = 'rgba(255,253,247,.55)';
  roundRect(x, y, w, h, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(31,58,70,.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function draw() {
  const w = innerWidth;
  const h = innerHeight;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#c8ebf5');
  g.addColorStop(0.55, BRAND.colors.bg);
  g.addColorStop(1, '#e7f6d8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  drawRoomFrame();

  // Vẽ sàn trước, công trình sau theo hàng để 2.5D chồng đúng.
  forEachCell(cells, drawFloorTile);
  const list = [];
  forEachCell(cells, cell => list.push(cell));
  list.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const cell of list) drawBuilding(cell);

  ctx.fillStyle = 'rgba(216,238,245,.55)';
  ctx.fillRect(0, 0, w, 92);
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
