import * as THREE from 'three';
import { makeRenderer } from './engine.js';
import { Gallery } from './gallery.js';
import { Game } from './game.js';
import { Defense } from './defense.js';

const $ = id => document.getElementById(id);
const renderer = makeRenderer($('c'));
const ui = {
  panel: $('panel'), labels: $('labels'), hud: $('hud'), stats: $('stats'), heroName: $('heroName'),
  heroHp: $('heroHp'), heroHpText: $('heroHpText'), btnSkill: $('btnSkill'), btnDash: $('btnDash'),
  cdSkill: $('cdSkill'), cdDash: $('cdDash'), toast: $('toast'), overlay: $('overlay'), overlayText: $('overlayText'),
};

const gallery = new Gallery(renderer, ui);
const game = new Game(renderer, ui);
const defense = new Defense(renderer, ui);
defense.onExit = () => setMode('gallery');
let mode = 'gallery';

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  gallery.resize(w, h); game.resize(w, h); defense.resize(w, h);
}
addEventListener('resize', resize); resize();

// Thêm nút "Vào game" dưới panel showroom.
const origRender = gallery.renderPanel.bind(gallery);
gallery.renderPanel = () => {
  origRender();
  const b = document.createElement('button');
  b.id = 'play'; b.textContent = '⚔️ Vào game với lựa chọn này';
  b.onclick = () => setMode('game');
  const d = document.createElement('button');
  d.id = 'play'; d.style.background = '#2563eb'; d.textContent = '🛡️ Giữ cổng (vô tận)';
  d.onclick = () => setMode('defense');
  ui.panel.appendChild(d);
  ui.panel.appendChild(b);
};

async function setMode(m) {
  mode = m;
  $('tabGallery').classList.toggle('on', m === 'gallery');
  $('tabGame').classList.toggle('on', m === 'game');
  $('tabDefense').classList.toggle('on', m === 'defense');
  game.stop(); defense.stop();
  if (m === 'gallery') { ui.panel.classList.remove('hidden'); gallery.show(); }
  else if (m === 'defense') { gallery.hide(); ui.panel.classList.add('hidden'); await defense.open(); resize(); }
  else { gallery.hide(); ui.panel.classList.add('hidden'); await game.start(); resize(); }
}
$('tabGallery').onclick = () => setMode('gallery');
$('tabGame').onclick = () => setMode('game');
$('tabDefense').onclick = () => setMode('defense');
$('again').onclick = () => setMode('game');
$('back').onclick = () => setMode('gallery');

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (mode === 'gallery') { gallery.update(dt); gallery.render(); }
  else if (mode === 'defense') { defense.update(dt); defense.render(); }
  else { game.update(dt); game.render(); }
});

await gallery.load((done, total) => {
  $('loadBar').style.width = (done / total * 100) + '%';
  $('loadText').textContent = `${done} / ${total} model`;
});
$('loading').classList.add('hidden');
gallery.show();
window.__app = { gallery, game, defense, setMode };
if (location.hash === '#defense') setMode('defense'); // để kiểm tra khi debug
