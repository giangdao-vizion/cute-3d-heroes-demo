import { byId } from './catalog.js';
import { selection, saveSelection } from './state.js';

const $ = id => document.getElementById(id);
const ui = {
  panel: $('panel'), labels: $('labels'), hud: $('hud'), stats: $('stats'), heroName: $('heroName'),
  heroHp: $('heroHp'), heroHpText: $('heroHpText'), btnSkill: $('btnSkill'), btnDash: $('btnDash'),
  cdSkill: $('cdSkill'), cdDash: $('cdDash'), toast: $('toast'), overlay: $('overlay'), overlayText: $('overlayText'),
};

let renderer;
let gallery;
let game;
let defense;
let clock;
let mode = 'home';
let galleryLoaded = false;
let selectedMode = 'defense';
let initializing;

function resize() {
  if (!renderer) return;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  gallery.resize(w, h); game.resize(w, h); defense.resize(w, h);
}
addEventListener('resize', resize);

function syncHome() {
  document.querySelectorAll('[data-hero]').forEach(button => {
    const on = button.dataset.hero === selection.hero;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('[data-mode]').forEach(button => {
    const on = button.dataset.mode === selectedMode;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
  });
  const labels = { game: 'Đấu trường', defense: 'Giữ cổng', survivor: 'Sinh tồn', gallery: 'Showroom' };
  $('startAdventure').innerHTML = `Chơi ${labels[selectedMode]} <span aria-hidden="true">→</span>`;
}

document.querySelectorAll('[data-hero]').forEach(button => {
  button.onclick = () => {
    selection.hero = button.dataset.hero;
    saveSelection();
    syncHome();
  };
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
      { Gallery },
      { Game },
      { Defense },
    ] = await Promise.all([
      import('three'),
      import('./engine.js'),
      import('./gallery.js'),
      import('./game.js'),
      import('./defense.js'),
    ]);
    renderer = makeRenderer($('c'));
    gallery = new Gallery(renderer, ui);
    game = new Game(renderer, ui);
    defense = new Defense(renderer, ui);
    defense.onExit = () => setMode('home');

    // Thêm lối chơi nhanh từ showroom sau khi người dùng đã chủ động tải showroom.
    const origRender = gallery.renderPanel.bind(gallery);
    gallery.renderPanel = () => {
      origRender();
      const arenaButton = document.createElement('button');
      arenaButton.id = 'play';
      arenaButton.textContent = '⚔️ Vào Đấu trường với lựa chọn này';
      arenaButton.onclick = () => setMode('game');
      const defenseButton = document.createElement('button');
      defenseButton.id = 'play';
      defenseButton.style.background = '#2563eb';
      defenseButton.textContent = '🛡️ Chơi Giữ cổng';
      defenseButton.onclick = () => setMode('defense');
      ui.panel.appendChild(defenseButton);
      ui.panel.appendChild(arenaButton);
    };

    clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.1);
      if (mode === 'gallery') { gallery.update(dt); gallery.render(); }
      else if (mode === 'defense') { defense.update(dt); defense.render(); }
      else if (mode === 'game') { game.update(dt); game.render(); }
    });
    resize();
    window.__app = { gallery, game, defense, setMode };
  })();
  return initializing;
}

function showAppChrome(show) {
  $('c').classList.toggle('hidden', !show);
  document.querySelector('header').classList.toggle('hidden', !show);
}

function stopActiveMode() {
  if (!renderer) return;
  game.stop();
  defense.stop();
  gallery.hide();
  ui.panel.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.overlay.classList.add('hidden');
}

async function setMode(nextMode) {
  if (nextMode === 'home') {
    mode = 'home';
    stopActiveMode();
    showAppChrome(false);
    $('home').classList.remove('hidden');
    $('loading').classList.add('hidden');
    syncHome();
    return;
  }
  if (nextMode === 'survivor') {
    location.href = 'survivor-arena.html';
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
    showAppChrome(true);
    $('tabGallery').classList.toggle('on', nextMode === 'gallery');
    $('tabGame').classList.toggle('on', nextMode === 'game');
    $('tabDefense').classList.toggle('on', nextMode === 'defense');
    if (nextMode === 'gallery') {
      ui.panel.classList.remove('hidden');
      if (!galleryLoaded) {
        await gallery.load((done, total) => {
          $('loadBar').style.width = `${Math.max(16, done / total * 100)}%`;
          $('loadText').textContent = `${done} / ${total} model`;
        });
        galleryLoaded = true;
      }
      gallery.show();
    } else if (nextMode === 'defense') {
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
$('tabGallery').onclick = () => setMode('gallery');
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
if (location.hash === '#defense') setMode('defense'); // để kiểm tra khi debug
