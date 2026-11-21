import * as THREE from 'three';
import { makeRenderer } from '../engine.js';
import { SurvivorGame } from './survivor.js';
import { bindLobbyLinks } from '../lobby-nav.js';

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
};

const game = new SurvivorGame(renderer, ui);

function viewportSize() {
  const vv = window.visualViewport;
  return {
    width: Math.max(1, Math.round(vv?.width ?? innerWidth)),
    height: Math.max(1, Math.round(vv?.height ?? innerHeight)),
    top: Math.max(0, Math.round(vv?.offsetTop ?? 0)),
    left: Math.max(0, Math.round(vv?.offsetLeft ?? 0)),
  };
}

function resize() {
  const { width, height, top, left } = viewportSize();
  const root = document.documentElement;
  root.style.setProperty('--app-height', `${height}px`);
  root.style.setProperty('--app-width', `${width}px`);
  root.style.setProperty('--app-top', `${top}px`);
  root.style.setProperty('--app-left', `${left}px`);
  const canvas = $('c');
  // Không dùng inset/bottom — chỉ top/left + size theo visualViewport (tránh dải nền dưới trên iPhone).
  canvas.style.top = `${top}px`;
  canvas.style.left = `${left}px`;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
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

try {
  await game.start((progress, text) => {
    ui.loadFill.style.width = `${Math.round(progress * 100)}%`;
    ui.loadText.textContent = text;
  });
  ui.loading.classList.add('hidden');
  requestAnimationFrame(() => game.showCurrentStageIntro());
} catch (error) {
  console.error(error);
  ui.loading.innerHTML = `
    <div class="box">
      <h2>Không tải được đấu trường</h2>
      <p>Hãy kiểm tra kết nối mạng rồi thử lại.</p>
      <div class="actions"><button id="retry">Thử lại</button><a class="alt" href="index.html">Về sảnh</a></div>
    </div>`;
  ui.loading.querySelector('#retry').onclick = () => location.reload();
  bindLobbyLinks(ui.loading);
}

window.__survivor = game;
