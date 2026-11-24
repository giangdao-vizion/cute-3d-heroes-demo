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
  const mid = gridToScreen((GRID.width - 1) / 2, (GRID.height - 1) / 2, 0, 0);
  state.originX = innerWidth / 2 - mid.x;
  state.originY = innerHeight * 0.42 - mid.y;
}

function drawHandTile(x, y, fill, stroke, jitter = 1.2) {
  const p = gridToScreen(x, y, state.originX, state.originY);
  const hw = GRID.tileW / 2;
  const hh = GRID.tileH / 2;
  const j = (n) => ((Math.sin((x + 1) * 12.3 + (y + 1) * 7.1 + n) * 0.5 + 0.5) - 0.5) * jitter;
  ctx.beginPath();
  ctx.moveTo(p.x + j(1), p.y - hh + j(2));
  ctx.lineTo(p.x + hw + j(3), p.y + j(4));
  ctx.lineTo(p.x + j(5), p.y + hh + j(6));
  ctx.lineTo(p.x - hw + j(7), p.y + j(8));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  return p;
}

function drawBuilding(p, type) {
  ctx.save();
  ctx.translate(p.x, p.y - 8);
  if (type === 'shelf') {
    ctx.fillStyle = BRAND.colors.shelf;
    roundRect(-16, -18, 32, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#eff8ff';
    roundRect(-12, -14, 10, 8, 2); ctx.fill();
    roundRect(2, -14, 10, 8, 2); ctx.fill();
  } else if (type === 'checkout') {
    ctx.fillStyle = BRAND.colors.money;
    roundRect(-18, -14, 36, 18, 5); ctx.fill();
    ctx.fillStyle = BRAND.colors.ink;
    ctx.font = '700 11px "Baloo 2", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('PAY', 0, -1);
  } else if (type === 'stockroom') {
    ctx.fillStyle = '#8b6b4a';
    roundRect(-18, -20, 36, 24, 4); ctx.fill();
    ctx.fillStyle = '#f0e2c8';
    roundRect(-8, -8, 16, 10, 2); ctx.fill();
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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

  // Sắp xếp painter's algorithm: x+y tăng dần.
  const list = [];
  forEachCell(cells, cell => list.push(cell));
  list.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);

  for (const cell of list) {
    const selected = state.selected && state.selected.x === cell.x && state.selected.y === cell.y;
    let fill = BRAND.colors.floor;
    let stroke = BRAND.colors.floorLine;
    if (cell.state === 'locked') {
      fill = '#b7c8cf';
      stroke = '#8fa3ab';
    } else if (cell.state === 'occupied') {
      fill = '#eef6d8';
      stroke = '#9fbf7a';
    }
    if (selected) {
      fill = '#fff4c2';
      stroke = BRAND.colors.money;
    }
    const p = drawHandTile(cell.x, cell.y, fill, stroke, cell.state === 'locked' ? 0.6 : 1.4);
    if (cell.state === 'locked') {
      ctx.fillStyle = 'rgba(31,58,70,.18)';
      ctx.font = '700 12px "Baloo 2", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🔒', p.x, p.y + 4);
    }
    if (cell.building) drawBuilding(p, cell.building);
  }

  // Bóng nhẹ dưới HUD để map không đụng chữ.
  ctx.fillStyle = 'rgba(216,238,245,.55)';
  ctx.fillRect(0, 0, w, 92);
}

function syncHud() {
  $('money').textContent = `$${state.money}`;
  const counts = countByState(cells);
  $('stats').textContent = `Mở ${counts.empty + counts.occupied}/${GRID.width * GRID.height} ô · Kệ ${(counts.occupied)}`;
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
