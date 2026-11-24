import { byId } from './catalog.js';
import { selection, saveSelection } from './state.js';

const $ = id => document.getElementById(id);
const ui = {
  panel: $('panel'), labels: $('labels'), hud: $('hud'), stats: $('stats'), heroName: $('heroName'),
  heroHp: $('heroHp'), heroHpText: $('heroHpText'), btnSkill: $('btnSkill'), btnDash: $('btnDash'),
  cdSkill: $('cdSkill'), cdDash: $('cdDash'), toast: $('toast'), overlay: $('overlay'), overlayText: $('overlayText'),
};

let renderer;
let game;
let defense;
let clock;
let mode = 'home';
let selectedMode = 'defense';
let initializing;

/** Mở Sinh tồn full-page — không iframe (canvas position:fixed phủ body 100%). */
function openSurvivorArena() {
  location.href = 'survivor-arena.html';
}

const HERO_META = {
  Knight: { icon: '🛡️', style: 'Cân bằng', range: 'Cận chiến' },
  Barbarian: { icon: '🪓', style: 'Sát thương cao', range: 'Cận chiến' },
  Mage: { icon: '🔮', style: 'Phép thuật', range: 'Đánh xa' },
  Rogue: { icon: '🗡️', style: 'Tốc độ cao', range: 'Cận chiến' },
  Rogue_Hooded: { icon: '🏹', style: 'Linh hoạt', range: 'Đánh xa' },
};

function resize() {
  if (!renderer) return;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  game.resize(w, h); defense.resize(w, h);
}
addEventListener('resize', resize);

function syncHome() {
  document.querySelectorAll('[data-hero]').forEach(button => {
    const on = button.dataset.hero === selection.hero;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
  });
  const hero = byId[selection.hero] || byId.Knight;
  const meta = HERO_META[hero.id] || HERO_META.Knight;
  $('selectedHeroAvatar').textContent = meta.icon;
  $('selectedHeroName').textContent = hero.name;
  $('selectedHeroStats').innerHTML = `<span>${meta.style}</span><span>${meta.range}</span><span>HP ${hero.stats.hp}</span>`;
  document.querySelectorAll('[data-mode]').forEach(button => {
    const on = button.dataset.mode === selectedMode;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
  });
  const labels = { game: 'Đấu trường', defense: 'Giữ cổng', survivor: 'Sinh tồn', store: 'Store Empire' };
  $('startAdventure').innerHTML = `Chơi ${labels[selectedMode]} <span aria-hidden="true">→</span>`;
}

document.querySelectorAll('[data-hero]').forEach(button => {
  button.onclick = () => {
    selection.hero = button.dataset.hero;
    saveSelection();
    syncHome();
  };
});
$('openHeroPicker').onclick = () => $('heroSheet').classList.remove('hidden');
document.querySelectorAll('[data-close-heroes]').forEach(button => {
  button.onclick = () => $('heroSheet').classList.add('hidden');
});
document.querySelectorAll('[data-mode]').forEach(button => {
  button.onclick = () => {
    selectedMode = button.dataset.mode;
    syncHome();
  };
});

async function ensure3D() {
  if (renderer) return;
  if (initializing) return initializing;
  initializing = (async () => {
    $('loading').classList.remove('hidden');
    $('loadText').textContent = 'Khởi tạo thế giới…';
    $('loadBar').style.width = '12%';
    const [
      THREE,
      { makeRenderer },
      { Game },
      { Defense },
    ] = await Promise.all([
      import('three'),
      import('./engine.js'),
      import('./game.js'),
      import('./defense.js'),
    ]);
    renderer = makeRenderer($('c'));
    game = new Game(renderer, ui);
    defense = new Defense(renderer, ui);
    defense.onExit = () => setMode('home');

    clock = new THREE.Clock();
    startRenderLoop();
    resize();
    window.__app = { game, defense, setMode };
  })();
  return initializing;
}

function startRenderLoop() {
  if (!renderer) return;
  renderer.setAnimationLoop(() => {
    if (document.hidden || mode === 'home' || mode === 'survivor') return;
    const dt = Math.min(clock.getDelta(), 0.1);
    if (mode === 'defense') { defense.update(dt); defense.render(); }
    else if (mode === 'game') { game.update(dt); game.render(); }
  });
}

function stopRenderLoop() {
  renderer?.setAnimationLoop(null);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && (mode === 'game' || mode === 'defense')) startRenderLoop();
});

function showAppChrome(show) {
  $('c').classList.toggle('hidden', !show);
  document.querySelector('header').classList.toggle('hidden', !show);
}

function stopActiveMode() {
  if (!renderer) return;
  game.stop();
  defense.stop();
  ui.panel.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.overlay.classList.add('hidden');
}

async function setMode(nextMode) {
  if (nextMode === 'home') {
    mode = 'home';
    stopActiveMode();
    stopRenderLoop();
    showAppChrome(false);
    $('home').classList.remove('hidden');
    $('loading').classList.add('hidden');
    syncHome();
    return;
  }
  if (nextMode === 'survivor') {
    openSurvivorArena();
    return;
  }
  if (nextMode === 'store') {
    location.href = 'store-empire/';
    return;
  }

  $('home').classList.add('hidden');
  $('loading').classList.remove('hidden');
  $('loadBar').style.width = '16%';
  $('loadText').textContent = 'Đang tải model cần thiết…';
  try {
    await ensure3D();
    mode = nextMode;
    stopActiveMode();
    mode = nextMode;
    startRenderLoop();
    showAppChrome(true);
    $('tabGame').classList.toggle('on', nextMode === 'game');
    $('tabDefense').classList.toggle('on', nextMode === 'defense');
    if (nextMode === 'defense') {
      await defense.open();
      resize();
    } else {
      await game.start();
      resize();
    }
    $('loadBar').style.width = '100%';
    $('loading').classList.add('hidden');
  } catch (error) {
    console.error(error);
    $('loadText').textContent = 'Không tải được trò chơi. Hãy kiểm tra mạng và thử lại.';
  }
}

$('startAdventure').onclick = () => setMode(selectedMode);
$('tabHome').onclick = () => setMode('home');
$('tabGame').onclick = () => setMode('game');
$('tabDefense').onclick = () => setMode('defense');
$('tabSurvivor').onclick = () => setMode('survivor');
$('again').onclick = () => setMode('game');
$('back').onclick = () => setMode('home');

// Chặn zoom do chạm hai lần / chụm ngón (Safari bỏ qua user-scalable=no) và Ctrl+lăn chuột.
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

syncHome();
if (!byId[selection.hero]) {
  selection.hero = 'Knight';
  saveSelection();
  syncHome();
}
if (location.hash === '#survivor') openSurvivorArena();
else if (location.hash === '#defense') setMode('defense'); // để kiểm tra khi debug
