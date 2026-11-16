import * as THREE from 'three';
import { makeRenderer } from './engine.js';
import { Gallery } from './gallery.js';
import { Game } from './game.js';

const $ = id => document.getElementById(id);
const renderer = makeRenderer($('c'));
const ui = {
  panel: $('panel'), labels: $('labels'), hud: $('hud'), stats: $('stats'), heroName: $('heroName'),
  heroHp: $('heroHp'), heroHpText: $('heroHpText'), btnSkill: $('btnSkill'), btnDash: $('btnDash'),
  cdSkill: $('cdSkill'), cdDash: $('cdDash'), toast: $('toast'), overlay: $('overlay'), overlayText: $('overlayText'),
};

const gallery = new Gallery(renderer, ui);
const game = new Game(renderer, ui);
let mode = 'gallery';

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  gallery.resize(w, h); game.resize(w, h);
}
addEventListener('resize', resize); resize();

// Thêm nút "Vào game" dưới panel showroom.
const origRender = gallery.renderPanel.bind(gallery);
gallery.renderPanel = () => {
  origRender();
  const b = document.createElement('button');
  b.id = 'play'; b.textContent = '⚔️ Vào game với lựa chọn này';
  b.onclick = () => setMode('game');
  ui.panel.appendChild(b);
};

async function setMode(m) {
  mode = m;
  $('tabGallery').classList.toggle('on', m === 'gallery');
  $('tabGame').classList.toggle('on', m === 'game');
  if (m === 'gallery') { game.stop(); ui.panel.classList.remove('hidden'); gallery.show(); }
  else { gallery.hide(); ui.panel.classList.add('hidden'); await game.start(); resize(); }
}
$('tabGallery').onclick = () => setMode('gallery');
$('tabGame').onclick = () => setMode('game');
$('again').onclick = () => setMode('game');
$('back').onclick = () => setMode('gallery');

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (mode === 'gallery') { gallery.update(dt); gallery.render(); }
  else { game.update(dt); game.render(); }
});

await gallery.load((done, total) => {
  $('loadBar').style.width = (done / total * 100) + '%';
  $('loadText').textContent = `${done} / ${total} model`;
});
$('loading').classList.add('hidden');
gallery.show();
window.__app = { gallery, game, setMode }; // để kiểm tra khi debug
