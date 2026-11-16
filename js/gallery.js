// Showroom: tất cả model đứng trên sân khấu, bấm vào từng con để xem animation và chọn.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CATALOG, ROLE_LABEL, byId } from './catalog.js';
import { spawnModel, Animator, addLights, shortName, makeTree, makeFlower } from './engine.js';
import { selection, saveSelection } from './state.js';

const ROWS = [
  { title: 'Anh hùng – KayKit Adventurers', filter: c => c.role === 'hero' },
  { title: 'Quái xương – KayKit Skeletons', filter: c => c.role === 'monster' && c.source.startsWith('KayKit') },
  { title: 'Quái dễ thương – Quaternius', filter: c => c.role === 'monster' && c.source === 'Quaternius' },
  { title: 'Boss & thú cưng – Quaternius', filter: c => c.role === 'boss' || c.role === 'pet' },
];

export class Gallery {
  constructor(renderer, ui) {
    this.renderer = renderer; this.ui = ui;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe6ff);
    this.scene.fog = new THREE.Fog(0xbfe6ff, 30, 70);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    this.camera.position.set(2.6, 11.5, 22);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 3; this.controls.maxDistance = 40;
    this.controls.target.set(2.6, 0.8, 2.5);
    addLights(this.scene, 20);
    this.units = []; this.selected = null; this.focus = null;
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.buildStage();
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.03; this.ring.visible = false;
    this.scene.add(this.ring);
    this.labelLayer = document.getElementById('labels');
    this.downPos = null;
    renderer.domElement.addEventListener('pointerdown', e => { if (this.active) this.downPos = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => this.onClick(e));
  }

  buildStage() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0x8fd17a }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0xf4e3c1 }));
    stage.position.set(0, -0.09, 2); stage.receiveShadow = true; this.scene.add(stage);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 13 + Math.random() * 12;
      const t = makeTree(0.9 + Math.random() * 0.8); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r + 2); this.scene.add(t);
    }
    for (let i = 0; i < 120; i++) {
      const f = makeFlower(); const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 16;
      f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r + 2); this.scene.add(f);
    }
  }

  async load(onProgress) {
    let done = 0;
    const jobs = [];
    ROWS.forEach((row, ri) => {
      const items = CATALOG.filter(row.filter);
      const spacing = row.filter(byId.Trex) ? 2.6 : 2.2;
      items.forEach((entry, i) => {
        const x = (i - (items.length - 1) / 2) * spacing;
        const z = 7 - ri * 3.4;
        jobs.push(spawnModel(entry).then(({ root, model, clips }) => {
          root.position.set(x, 0, z);
          root.userData.entry = entry;
          this.scene.add(root);
          const anim = new Animator(model, clips, entry.anims);
          anim.play('idle');
          anim.mixer.setTime(Math.random() * 2);
          const label = document.createElement('div');
          label.className = 'label'; label.textContent = entry.name;
          this.labelLayer.appendChild(label);
          this.units.push({ root, model, clips, anim, entry, label });
          onProgress?.(++done, CATALOG.length);
        }));
      });
    });
    await Promise.all(jobs);
  }

  show() {
    this.active = true; this.controls.enabled = true;
    this.units.forEach(u => u.label.style.display = '');
    this.renderPanel();
  }
  hide() { this.active = false; this.controls.enabled = false; this.units.forEach(u => u.label.style.display = 'none'); }

  onClick(e) {
    if (!this.active || !this.downPos) return;
    if (Math.hypot(e.clientX - this.downPos[0], e.clientY - this.downPos[1]) > 6) return; // đang xoay camera
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Dùng hộp bao để bấm dễ hơn so với raycast mesh skinned.
    let best = null, bestD = Infinity;
    for (const u of this.units) {
      const p = u.root.position, h = u.root.userData.height, r = Math.max(u.root.userData.radius, 0.5);
      const box = new THREE.Box3(new THREE.Vector3(p.x - r, 0, p.z - r), new THREE.Vector3(p.x + r, h, p.z + r));
      const hit = this.raycaster.ray.intersectBox(box, new THREE.Vector3());
      if (hit) { const d = hit.distanceTo(this.camera.position); if (d < bestD) { bestD = d; best = u; } }
    }
    if (best) this.select(best);
  }

  select(u) {
    this.selected = u;
    this.ring.visible = true;
    this.ring.position.x = u.root.position.x; this.ring.position.z = u.root.position.z;
    const s = Math.max(u.root.userData.radius * 1.4, 0.7); this.ring.scale.setScalar(s);
    this.focus = u.root.position.clone().setY(u.root.userData.height * 0.5);
    this.renderPanel();
  }

  renderPanel() {
    const panel = this.ui.panel;
    const u = this.selected;
    const sel = selection;
    const picks = `
      <div class="picks">
        <div><b>Tướng:</b> ${byId[sel.hero]?.name || '-'}</div>
        <div><b>Thú cưng:</b> ${byId[sel.pet]?.name || 'không'}</div>
        <div><b>Boss:</b> ${byId[sel.boss]?.name || '-'}</div>
        <div><b>Quái (${sel.monsters.length}):</b> ${sel.monsters.map(id => byId[id]?.name).join(', ') || '-'}</div>
      </div>`;
    if (!u) {
      panel.innerHTML = `<h2>Showroom nhân vật</h2>
        <p class="muted">Bấm vào một nhân vật trên sân khấu để xem animation và chọn đưa vào game. Kéo chuột để xoay, cuộn để zoom.</p>
        ${picks}`;
      return;
    }
    const e = u.entry;
    const role = e.role;
    let btn = '';
    if (role === 'hero') btn = sel.hero === e.id ? `<button class="on" disabled>✓ Đang là tướng của bạn</button>` : `<button data-act="hero">Chọn làm tướng</button>`;
    if (role === 'pet') btn = sel.pet === e.id ? `<button class="on" data-act="pet-off">✓ Thú cưng đi theo (bấm để bỏ)</button>` : `<button data-act="pet">Chọn làm thú cưng</button>`;
    if (role === 'boss') btn = sel.boss === e.id ? `<button class="on" disabled>✓ Đang là boss</button>` : `<button data-act="boss">Chọn làm boss</button>`;
    if (role === 'monster') btn = sel.monsters.includes(e.id) ? `<button class="on" data-act="mon">✓ Có trong đợt quái (bấm để bỏ)</button>` : `<button data-act="mon">Thêm vào đợt quái</button>`;
    const anims = u.clips.map(c => shortName(c)).filter(n => !/Pose$|T-Pose/.test(n));
    panel.innerHTML = `
      <h2>${e.name}</h2>
      <div class="tags"><span>${ROLE_LABEL[role]}</span><span>${e.source}</span><span>${e.pack}</span><span>CC0</span></div>
      ${btn}
      <h3>Animation có sẵn (${anims.length})</h3>
      <div class="anims">${anims.map(n => `<button class="chip" data-anim="${n}">${n.replace(/_/g, ' ')}</button>`).join('')}</div>
      ${picks}`;
    panel.querySelectorAll('[data-anim]').forEach(b => b.onclick = () => {
      panel.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); b.classList.add('on');
      u.anim.play(b.dataset.anim, { restart: true });
    });
    panel.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'hero') sel.hero = e.id;
      if (a === 'pet') sel.pet = e.id;
      if (a === 'pet-off') sel.pet = null;
      if (a === 'boss') sel.boss = e.id;
      if (a === 'mon') {
        if (sel.monsters.includes(e.id)) { if (sel.monsters.length > 1) sel.monsters = sel.monsters.filter(x => x !== e.id); }
        else sel.monsters.push(e.id);
      }
      saveSelection(); this.renderPanel();
    });
  }

  update(dt) {
    this.units.forEach(u => u.anim.update(dt));
    if (this.focus) {
      this.controls.target.lerp(this.focus, Math.min(1, dt * 4));
      if (this.controls.target.distanceTo(this.focus) < 0.01) this.focus = null;
    }
    this.controls.update();
    this.ring.rotation.z += dt;
    // Nhãn tên trên đầu.
    const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight;
    const v = new THREE.Vector3();
    for (const u of this.units) {
      v.copy(u.root.position); v.y += u.root.userData.height + 0.25; v.project(this.camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      u.label.style.display = vis ? '' : 'none';
      u.label.style.transform = `translate(-50%,-100%) translate(${(v.x + 1) / 2 * w}px,${(1 - v.y) / 2 * h}px)`;
      u.label.classList.toggle('sel', u === this.selected);
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
}
