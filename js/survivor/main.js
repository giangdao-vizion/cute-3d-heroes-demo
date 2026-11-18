import * as THREE from 'three';
import { makeRenderer } from '../engine.js';
import { SurvivorGame } from './survivor.js';

const $ = id => document.getElementById(id);
const renderer = makeRenderer($('c'));
const ui = {
  hud:$('hud'),
  heroName:$('heroName'),
  hpFill:$('hpFill'),
  hpText:$('hpText'),
  timer:$('timer'),
  kills:$('kills'),
  gems:$('gems'),
  xpFill:$('xpFill'),
  level:$('level'),
  pause:$('pause'),
  hint:$('hint'),
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

function resize() {
  const width = innerWidth;
  const height = innerHeight;
  renderer.setSize(width, height, false);
  game.resize(width, height);
}
addEventListener('resize', resize);
resize();

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') game.togglePause();
});
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('dblclick', event => event.preventDefault(), { passive:false });
for (const name of ['gesturestart','gesturechange','gestureend']) {
  document.addEventListener(name, event => event.preventDefault(), { passive:false });
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  game.update(clock.getDelta());
  game.render();
});

try {
  await game.start((progress, text) => {
    ui.loadFill.style.width = `${Math.round(progress * 100)}%`;
    ui.loadText.textContent = text;
  });
  ui.loading.classList.add('hidden');
} catch (error) {
  console.error(error);
  ui.loading.innerHTML = `
    <div class="box">
      <h2>Không tải được đấu trường</h2>
      <p>Hãy kiểm tra kết nối mạng rồi thử lại.</p>
      <div class="actions"><button id="retry">Thử lại</button><a class="alt" href="index.html">Về sảnh</a></div>
    </div>`;
  ui.loading.querySelector('#retry').onclick = () => location.reload();
}

window.__survivor = game;
