import * as THREE from 'three';
import { makeRenderer } from '../engine.js';
import { SurvivorGame } from './survivor.js';
import { bindLobbyLinks } from '../lobby-nav.js';
import { getSavedMode, setSavedMode, loadStars } from './late-game.js';

const $ = id => document.getElementById(id);
const renderer = makeRenderer($('c'));
const ui = {
  hud:$('hud'),
  enemyLabels:$('enemyLabels'),
  heroName:$('heroName'),
  hpFill:$('hpFill'),
  hpText:$('hpText'),
  timer:$('timer'),
  stage:$('stage'),
  kills:$('kills'),
  gems:$('gems'),
  xpFill:$('xpFill'),
  level:$('level'),
  pause:$('pause'),
  heroPanel:$('heroPanel'),
  attrBadge:$('attrBadge'),
  attrSheet:$('attrSheet'),
  attrRows:$('attrRows'),
  attrPointsLabel:$('attrPoints'),
  attrClose:$('attrClose'),
  enemyIntro:$('enemyIntro'),
  eventBanner:$('eventBanner'),
  objective:$('objectiveHud'),
  hint:$('hint'),
  levelupDock:$('levelupDock'),
  levelupCards:$('levelupCards'),
  levelupQueue:$('levelupQueue'),
  joystick:$('joystick'),
  stick:$('stick'),
  modal:$('modal'),
  toast:$('toast'),
  damageFlash:$('damageFlash'),
  loading:$('loading'),
  loadFill:$('loadFill'),
  loadText:$('loadText'),
  modePick:$('modePick'),
};

const game = new SurvivorGame(renderer, ui);

function viewportSize() {
  const canvas = $('c');
  const width = Math.max(1, Math.round(canvas?.clientWidth || innerWidth));
  const height = Math.max(1, Math.round(canvas?.clientHeight || innerHeight));
  return { width, height };
}

function resize() {
  const { width, height } = viewportSize();
  const canvas = $('c');
  canvas.style.top = '';
  canvas.style.left = '';
  canvas.style.right = '';
  canvas.style.bottom = '';
  canvas.style.width = '';
  canvas.style.height = '';
  renderer.setSize(width, height, false);
  game.resize(width, height);
}
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.visualViewport?.addEventListener('scroll', resize);
resize();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.state === 'playing') game.togglePause();
    clock.getDelta();
    return;
  }
  game.needsRender = true;
});
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('dblclick', event => event.preventDefault(), { passive:false });
for (const name of ['gesturestart','gesturechange','gestureend']) {
  document.addEventListener(name, event => event.preventDefault(), { passive:false });
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  if (document.hidden) return;
  game.update(clock.getDelta());
  game.render();
});

function chooseMode(mode) {
  setSavedMode(mode);
  game.runMode = mode;
  ui.modePick.classList.add('hidden');
  ui.loading.classList.remove('hidden');
  return boot();
}

async function boot() {
  try {
    await game.start((progress, text) => {
      ui.loadFill.style.width = `${Math.round(progress * 100)}%`;
      ui.loadText.textContent = text;
    });
    ui.loading.classList.add('hidden');
    requestAnimationFrame(() => game.showCurrentStageIntro());
  } catch (error) {
    console.error(error);
    ui.loading.classList.remove('hidden');
    ui.loading.innerHTML = `
      <div class="box">
        <h2>Không tải được đấu trường</h2>
        <p>Hãy kiểm tra kết nối mạng rồi thử lại.</p>
        <div class="actions"><button id="retry">Thử lại</button><a class="alt" href="index.html">Về sảnh</a></div>
      </div>`;
    ui.loading.querySelector('#retry').onclick = () => location.reload();
    bindLobbyLinks(ui.loading);
  }
}

// Chọn chế độ trước khi tải (trừ khi URL đã chỉ định ?mode=).
const queryMode = new URLSearchParams(location.search).get('mode');
bindLobbyLinks(ui.modePick);
if (queryMode === 'standard' || queryMode === 'endless') {
  chooseMode(queryMode);
} else {
  const stars = loadStars();
  const saved = getSavedMode();
  const hint = ui.modePick.querySelector('p');
  if (hint) hint.textContent = `Chuẩn có đích thắng phút 10. Endless chơi vô hạn. Sao đang có: ${stars}★`;
  if (saved === 'endless') {
    $('modeEndless')?.classList.add('primary');
    $('modeStandard')?.classList.remove('primary');
  }
  ui.modePick.classList.remove('hidden');
  $('modeStandard').onclick = () => chooseMode('standard');
  $('modeEndless').onclick = () => chooseMode('endless');
}

window.__survivor = game;
