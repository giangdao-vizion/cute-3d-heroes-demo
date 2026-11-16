// Chế độ "Giữ cổng": tướng đứng ở cuối cây cầu, bắn tự động, quái tràn tới vô tận.
// Bắn hòm để nhận quà, chọn cổng toán học (+lính, +% tốc bắn...), lên cấp chọn 1 trong 3 thẻ.
import * as THREE from 'three';
import { byId, CATALOG } from './catalog.js';
import { spawnModel, loadModel, Animator, addLights, makeTree, makeRock } from './engine.js';
import { selection } from './state.js';

const HALF = 4.5;          // nửa bề rộng cầu
const SPAWN_Z = -48;       // quái xuất hiện ở đầu cầu (ngoài mép trên màn hình)
const LEAK_Z = 1.8;        // vạch đích: quái chạm vạch này là trừ lính hoặc trừ máu cổng
const WALL_Z = 4.4;
const WAVE_DUR = 30;
const MAX_ALIVE = 90;
const META_KEY = 'cute3d.defense.meta.v1';

// Quái mở dần theo đợt. hp/spd là hệ số so với quái chuẩn.
const ROSTER = [
  { id: 'Enemy', from: 1, hp: 1, spd: 1, w: 3 },
  { id: 'Rat', from: 1, hp: 0.7, spd: 1.45, w: 2 },
  { id: 'Frog', from: 2, hp: 1, spd: 1.1, w: 2 },
  { id: 'Skeleton_Minion', from: 2, hp: 1.4, spd: 0.95, w: 3 },
  { id: 'Skull', from: 3, hp: 0.9, spd: 1.2, w: 2 },
  { id: 'Spider', from: 4, hp: 1.3, spd: 1.05, w: 2 },
  { id: 'Bee', from: 4, hp: 0.6, spd: 1.7, w: 2 },
  { id: 'Skeleton_Warrior', from: 5, hp: 3.2, spd: 0.72, w: 2 },
  { id: 'Snake_angry', from: 6, hp: 1.1, spd: 1, w: 1 },
  { id: 'Skeleton_Rogue', from: 7, hp: 1.5, spd: 1.25, w: 2, zig: true },
  { id: 'Wasp', from: 8, hp: 0.9, spd: 1.8, w: 2, zig: true },
  { id: 'Velociraptor', from: 9, hp: 2, spd: 1.6, w: 2 },
  { id: 'Skeleton_Mage', from: 10, hp: 2.6, spd: 0.9, w: 2 },
];

const BULLET_STYLE = {
  Mage: 'orb', Rogue_Hooded: 'bolt', Knight: 'slash', Barbarian: 'axe', Rogue: 'knife',
};

const CARDS = [
  { id: 'multi', fx: '+1', icon: 'arrows', name: 'Thêm tia đạn', desc: '+1 tia bắn song song', rar: 'epic', need: P => P.multi < 5, apply: P => P.multi = Math.min(5, P.multi + 1) },
  { id: 'rate', fx: '+20%', icon: 'chevron', name: 'Bắn nhanh', desc: '+20% tốc độ bắn', rar: 'common', apply: P => P.ratePct += 20 },
  { id: 'dmg', fx: '+30%', icon: 'sword', name: 'Sát thương', desc: '+30% sát thương', rar: 'common', apply: P => P.dmgPct += 30 },
  { id: 'pierce', fx: '+1', icon: 'target', name: 'Xuyên thấu', desc: 'Mỗi viên đạn xuyên thêm 1 quái', rar: 'rare', max: 4, apply: P => P.pierce++ },
  { id: 'crit', fx: '+12%', icon: 'burst', name: 'Chí mạng', desc: '+12% tỉ lệ chí mạng (x2.5 sát thương)', rar: 'common', max: 5, apply: P => P.crit += 0.12 },
  { id: 'splash', fx: '+1', icon: 'bomb', name: 'Đạn nổ', desc: 'Trúng đích nổ lan, gây 50% sát thương xung quanh', rar: 'epic', max: 4, apply: P => P.splash = P.splash ? P.splash + 0.6 : 1.5 },
  { id: 'slow', fx: '-35%', icon: 'snow', name: 'Đạn băng', desc: 'Quái trúng đạn chậm đi 35%', rar: 'rare', max: 1, apply: P => P.slow = 0.35 },
  { id: 'squad', fx: '+3', icon: 'soldier', name: 'Viện binh', desc: '+3 lính đứng bắn cùng bạn', rar: 'common', apply: (P, g) => g.addSoldiers(3) },
  { id: 'sdmg', fx: '+40%', icon: 'swordshield', name: 'Huấn luyện lính', desc: 'Lính +40% sát thương', rar: 'rare', max: 5, need: P => P.soldiers > 0, apply: P => P.soldierDmg += 0.18 },
  { id: 'bolt', fx: '+1', icon: 'boltBlue', name: 'Sét trời', desc: 'Mỗi 2.5 giây sét đánh thêm 1 quái', rar: 'epic', max: 5, apply: P => P.lightning++ },
  { id: 'pet', fx: '+1', icon: 'pet', name: 'Thú cưng', desc: 'Thú cưng lao lên cắn quái nhanh và mạnh hơn', rar: 'rare', max: 5, need: (P, g) => !!g.pet, apply: P => P.petLv++ },
  { id: 'wall', fx: '+4', icon: 'tower', name: 'Sửa cổng', desc: '+4 máu cổng tối đa, hồi đầy cổng', rar: 'common', apply: (P, g) => { g.gateMax += 4; g.gateHp = g.gateMax; } },
  { id: 'ult', fx: '+40%', icon: 'star', name: 'Nộ khí', desc: 'Chiêu cuối nạp nhanh hơn 40%', rar: 'rare', max: 3, apply: P => P.ultGain *= 1.4 },
];
const RAR = { common: { w: 10, label: 'Thường' }, rare: { w: 6, label: 'Hiếm' }, epic: { w: 3, label: 'Sử thi' } };

const GATE_TYPES = [
  { t: 'soldier', unit: 'soldier', pct: false, step: 1, cost: 50, max: 6, vals: [-3, -2, -1, 1, 2, 3] },
  { t: 'rate', unit: 'chevron', pct: true, step: 5, cost: 35, max: 40, vals: [-20, -10, 5, 10, 15] },
  { t: 'dmg', unit: 'sword', pct: true, step: 5, cost: 35, max: 40, vals: [-20, -10, 5, 10, 15] },
  { t: 'multi', unit: 'arrows', pct: false, step: 1, cost: 160, max: 2, vals: [-1, 1], rare: true },
];

const CRATES = [
  { k: 'weapon', icon: 'sword', w: 4, hp: 1.3 },
  { k: 'squad', icon: 'soldier', w: 4, hp: 1 },
  { k: 'heal', icon: 'heart', w: 2, hp: 0.8 },
  { k: 'bomb', icon: 'bomb', w: 2, hp: 0.9 },
  { k: 'ult', icon: 'star', w: 2, hp: 0.9 },
];

const META = [
  { id: 'dmg', fx: '+30%', icon: 'sword', name: 'Sát thương gốc', desc: '+10% mỗi cấp', max: 10, cost: l => 8 + l * 6 },
  { id: 'gate', icon: 'tower', name: 'Tường dày', desc: '+3 máu cổng mỗi cấp', max: 10, cost: l => 6 + l * 5 },
  { id: 'squad', fx: '+3', icon: 'soldier', name: 'Lính khởi đầu', desc: '+1 lính mỗi cấp', max: 8, cost: l => 10 + l * 8 },
  { id: 'ult', fx: '+40%', icon: 'star', name: 'Nộ khởi đầu', desc: '+25 nộ mỗi cấp', max: 4, cost: l => 8 + l * 8 },
];

const pick = a => a[Math.floor(Math.random() * a.length)];
// Icon 3D render sẵn (img/icons, tạo bằng tools/icon-studio.html từ model CC0).
const ic = (id, cls = '') => `<img class="ic ${cls}" src="img/icons/${id}.webp" alt="">`;
const ICON_IMG = {};
function iconImg(id) {
  if (!ICON_IMG[id]) { const im = new Image(); im.src = `img/icons/${id}.webp`; ICON_IMG[id] = im; }
  return ICON_IMG[id];
}
function pickW(list, wf = x => x.w) {
  let s = 0; for (const x of list) s += wf(x);
  let r = Math.random() * s;
  for (const x of list) { r -= wf(x); if (r <= 0) return x; }
  return list[list.length - 1];
}
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n));

function loadMeta() {
  let m = null; try { m = JSON.parse(localStorage.getItem(META_KEY)); } catch { /* bỏ qua */ }
  return Object.assign({ stars: 0, best: 0, bestWave: 0, runs: 0, lv: {} }, m || {});
}

export class Defense {
  constructor(renderer, ui) {
    this.renderer = renderer; this.ui = ui;
    this.meta = loadMeta();
    this.active = false; this.state = 'idle';
    this.keys = new Set();
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.layer = document.createElement('div'); this.layer.className = 'dlayer';
    ui.labels.appendChild(this.layer);
    const $ = id => document.getElementById(id);
    this.el = {
      hud: $('dhud'), modal: $('dmodal'), gateBar: $('dGateBar'), gateText: $('dGateText'), score: $('dScore'),
      best: $('dBest'), wave: $('dWave'), xp: $('dXp'), lv: $('dLv'), combo: $('dCombo'), boss: $('dBoss'),
      bossName: $('dBossName'), bossBar: $('dBossBar'), squad: $('dSquad'), ult: $('dUlt'), ultFill: $('dUltFill'),
      pause: $('dPause'), bestN: $('dBestN'), flash: $('dFlash'), hint: $('dHint'), waveRing: $('dWaveRing'),
    };
    const canvas = renderer.domElement;
    // Chuột: tướng theo con trỏ. Cảm ứng: kéo tương đối, ngón tay không che tướng.
    const aim = e => {
      if (!this.active || this.state !== 'play') return;
      if (e.pointerType === 'mouse') this.aimAt(e);
      else if (this.touching) {
        const k = (HALF * 2 + 1) / innerWidth * 1.35;
        this.targetX = THREE.MathUtils.clamp(this.dragX0 + (e.clientX - this.dragPx0) * k, -HALF + 0.5, HALF - 0.5);
      }
    };
    canvas.addEventListener('pointerdown', e => {
      if (!this.active) return;
      this.touching = true; this.dragPx0 = e.clientX; this.dragX0 = this.targetX; aim(e);
    });
    canvas.addEventListener('pointermove', aim);
    addEventListener('pointerup', () => this.touching = false);
    addEventListener('keydown', e => {
      if (!this.active) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === ' ') { e.preventDefault(); this.ultimate(); }
      if (k === 'p' || k === 'escape') this.togglePause();
      if (this.state === 'cards' && ['1', '2', '3'].includes(k)) this.chooseCard(+k - 1);
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.togglePause(); });
    this.el.ult.onclick = () => this.ultimate();
    this.el.pause.onclick = () => this.togglePause();
    this.onExit = null;
  }

  // ---------- Vào / ra chế độ ----------
  async open() {
    this.active = true;
    await this.newRun();
    this.state = 'menu';
    this.showMenu();
  }

  stop() {
    this.active = false; this.state = 'idle';
    this.el.hud.classList.add('hidden'); this.el.modal.classList.add('hidden');
    this.layer.innerHTML = ''; this.showHeader(true);
  }

  async newRun() {
    this.runId = (this.runId || 0) + 1;
    this.layer.innerHTML = '';
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fd8ff);
    scene.fog = new THREE.Fog(0x9fd8ff, 40, 90);
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
    this.sun = addLights(scene, 30);
    this.sun.position.set(10, 26, 6); this.sun.target.position.set(0, 0, -18);
    this.buildWorld();
    this.fitCamera();

    const lv = this.meta.lv;
    this.P = {
      dmgPct: 10 * (lv.dmg || 0), ratePct: 0, multi: 1,
      get dmg() { return 10 * (1 + this.dmgPct / 100); },
      get rate() { return Math.min(11, 3.2 * (1 + this.ratePct / 100)); }, pierce: 0, crit: 0.05, splash: 0, slow: 0,
      soldiers: 0, soldierDmg: 0.45, lightning: 0, petLv: 1, ultGain: 1,
    };
    this.picked = {};
    this.gateMax = 20 + 3 * (lv.gate || 0); this.gateHp = this.gateMax;
    this.wave = 0; this.waveT = 0; this.time = 0; this.score = 0; this.kills = 0; this.combo = 0; this.bestCombo = 0;
    this.level = 1; this.xp = 0; this.ult = Math.min(100, 25 * (lv.ult || 0)); this.newBestShown = false;
    this.spawnAcc = 0; this.packT = 10; this.crateT = 3; this.gateT = 9; this.boltT = 2.5; this.petT = 6;
    this.timeScale = 1; this.slowmo = 0; this.shake = 0; this.over = false; this.pendingLevels = 0;
    this.enemies = []; this.bullets = []; this.crates = []; this.gates = []; this.effects = []; this.floaters = [];
    this.meteors = []; this.soldierUnits = []; this.pool = {}; this.bulletPool = {}; this.boss = null;
    this.heroX = 0; this.targetX = 0;

    const hEntry = byId[selection.hero] || byId.Knight;
    this.heroEntry = hEntry;
    const h = await spawnModel(hEntry);
    this.hero = { root: h.root, anim: new Animator(h.model, h.clips, hEntry.anims), cd: 0 };
    h.root.rotation.y = Math.PI;
    scene.add(h.root);
    this.hero.anim.play('attack', { speed: 1.2 });
    this.addRing(h.root, 0.5, 0x60a5fa);
    this.bulletStyle = BULLET_STYLE[hEntry.id] || 'orb';

    // Lính: dùng các anh hùng còn lại, nhỏ hơn một chút.
    this.soldierEntries = CATALOG.filter(c => c.role === 'hero' && c.id !== hEntry.id);
    this.pet = null;
    if (selection.pet && byId[selection.pet]) {
      const pe = byId[selection.pet], p = await spawnModel(pe);
      this.pet = { entry: pe, root: p.root, anim: new Animator(p.model, p.clips, pe.anims), mode: 'home', hit: new Set() };
      p.root.position.set(-HALF + 0.7, 0, 2.4); p.root.rotation.y = Math.PI;
      this.pet.anim.play('idle'); scene.add(p.root);
    }
    await Promise.all([...ROSTER.map(r => byId[r.id]), ...this.soldierEntries, byId.Trex, byId.Triceratops]
      .filter(Boolean).map(e => spawnModel(e)));
    // Hòm quà dùng model rương KayKit Dungeon (CC0).
    const chest = (await loadModel({ id: 'prop_chest', file: 'models/props/kk_chest.glb' })).scene;
    const cb = new THREE.Box3().setFromObject(chest), cs = cb.getSize(new THREE.Vector3());
    this.chestScale = 1.05 / Math.max(cs.x, cs.z); this.chestY = -cb.min.y * this.chestScale;
    this.chestModel = chest;
    if (lv.squad) this.addSoldiers(lv.squad, true);
    this.updateHud();
  }

  buildWorld() {
    const s = this.scene;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: 0x4fb3e8, roughness: 0.35 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -1.6, -30); s.add(water);
    this.water = water;
    // Hai bờ cỏ hai bên sông.
    for (const side of [-1, 1]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(60, 2, 140), new THREE.MeshStandardMaterial({ color: 0x7cc96a }));
      bank.position.set(side * (HALF + 14 + 30), -1.2, -30); bank.receiveShadow = true; s.add(bank);
      for (let i = 0; i < 60; i++) {
        const t = makeTree(1 + Math.random() * 1.2);
        t.position.set(side * (HALF + 15 + Math.random() * 22), -0.2, 8 - Math.random() * 90); t.rotation.y = Math.random() * 6; s.add(t);
      }
      for (let i = 0; i < 14; i++) {
        const r = makeRock(0.8 + Math.random() * 1.4);
        r.position.set(side * (HALF + 3 + Math.random() * 9), -1.45, 4 - Math.random() * 80); s.add(r);
      }
    }
    // Cây cầu đá.
    const deck = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.6, 0.6, 84), new THREE.MeshStandardMaterial({ color: 0xd9c8a0 }));
    deck.position.set(0, -0.3, -36); deck.receiveShadow = true; s.add(deck);
    const planks = new THREE.MeshStandardMaterial({ color: 0xcbb68a });
    for (let z = 4; z > -78; z -= 2.2) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.6, 0.02, 0.12), planks);
      p.position.set(0, 0.01, z); p.receiveShadow = true; s.add(p);
    }
    const postMat = new THREE.MeshStandardMaterial({ color: 0xa88b62, flatShading: true });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xb9996b });
    for (const side of [-1, 1]) {
      for (let z = 4; z > -78; z -= 3) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), postMat);
        post.position.set(side * (HALF + 0.15), 0.45, z); post.castShadow = true; s.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 82), railMat);
      rail.position.set(side * (HALF + 0.15), 0.85, -37); s.add(rail);
      // Cột cầu dưới nước.
      for (let z = 0; z > -78; z -= 12) {
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 2, 8), postMat);
        pier.position.set(side * (HALF - 0.6), -1.4, z); s.add(pier);
      }
    }
    // Vạch đích phát sáng.
    const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 0.22), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.85 }));
    line.rotation.x = -Math.PI / 2; line.position.set(0, 0.03, LEAK_Z); s.add(line); this.leakLine = line;
    // Tường thành phía sau.
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a6, flatShading: true });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 5.6, 0.7, 0.9), wallMat);
    wall.position.set(0, 0.35, WALL_Z); wall.castShadow = true; s.add(wall);
    for (let x = -HALF - 2.4; x <= HALF + 2.5; x += 1.1) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.9), wallMat);
      c.position.set(x, 0.85, WALL_Z); s.add(c);
    }
    for (const side of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 2.6, 10), wallMat);
      tower.position.set(side * (HALF + 2.8), 1.3, WALL_Z); tower.castShadow = true; s.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0xe0605a, flatShading: true }));
      roof.position.set(side * (HALF + 2.8), 3.2, WALL_Z); s.add(roof);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), new THREE.MeshBasicMaterial({ color: 0x4f9dff, side: THREE.DoubleSide }));
      flag.position.set(side * (HALF + 2.8) + 0.35, 4.1, WALL_Z); s.add(flag);
    }
    this.wall = wall;
  }

  // Camera nhìn dốc từ trên cao, ưu tiên màn hình dọc của điện thoại:
  // cầu vừa khít bề ngang, tướng ở khoảng 78% chiều cao màn hình.
  fitCamera() {
    const a = innerWidth / innerHeight, cam = this.camera, deg = THREE.MathUtils.degToRad;
    const portrait = a < 0.85;
    cam.aspect = a; cam.fov = portrait ? 58 : 46;
    const halfV = deg(cam.fov / 2), halfW = Math.atan(Math.tan(halfV) * a);
    const pitch = deg(portrait ? 56 : 52);
    const heroAng = pitch + 0.56 * halfV;              // góc nhìn xuống tới hàng của tướng
    const dist = Math.max((HALF + 1) / Math.tan(halfW), portrait ? 0 : 19);
    const H = dist * Math.sin(heroAng), back = dist * Math.cos(heroAng);
    this.camBase = new THREE.Vector3(0, H, back);
    this.camLook = new THREE.Vector3(0, 0, back - H / Math.tan(pitch));
    cam.position.copy(this.camBase); cam.lookAt(this.camLook);
    cam.updateProjectionMatrix();
  }

  addRing(root, r, color) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; root.add(ring);
    return ring;
  }

  // ---------- Lính ----------
  addSoldiers(n, silent = false) {
    this.P.soldiers = THREE.MathUtils.clamp(this.P.soldiers + n, 0, 30);
    this.syncSoldiers();
    if (!silent && n > 0) this.toast(`+${n} ${ic('soldier')}`, '#22c55e');
  }

  async syncSoldiers() {
    const want = () => Math.min(16, this.P.soldiers), runId = this.runId;
    while (this.soldierUnits.length > want()) {
      const u = this.soldierUnits.pop();
      this.poof(u.root.position, 0xff6b6b);
      this.scene.remove(u.root);
    }
    // Tính lại số lính cần mỗi vòng: số lính có thể giảm trong lúc đang tải model.
    while (this.soldierUnits.length + (this.soldierLoading || 0) < want()) {
      this.soldierLoading = (this.soldierLoading || 0) + 1;
      const entry = this.soldierEntries[(this.soldierUnits.length + this.soldierLoading - 1) % this.soldierEntries.length];
      const m = await spawnModel(entry, 1.3);
      this.soldierLoading--;
      if (runId !== this.runId) return;
      if (this.soldierUnits.length >= want()) break;
      const u = { entry, root: m.root, anim: new Animator(m.model, m.clips, entry.anims), cd: Math.random(), slot: this.soldierUnits.length };
      m.root.rotation.y = Math.PI;
      u.anim.play('attack', { speed: 1 + Math.random() * 0.3 });
      this.addRing(m.root, 0.35, 0x93c5fd);
      m.root.position.set(this.heroX, 0, 1);
      this.scene.add(m.root);
      this.soldierUnits.push(u);
    }
  }

  slotPos(i) {
    const cols = [-0.9, 0.9, -1.8, 1.8];
    return { dx: cols[i % 4], dz: 0.55 + Math.floor(i / 4) * 0.55 };
  }

  // ---------- Điều khiển ----------
  aimAt(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit)) {
      this.targetX = THREE.MathUtils.clamp(hit.x, -HALF + 0.5, HALF - 0.5);
    }
  }

  togglePause() {
    if (this.state === 'play') {
      this.state = 'pause';
      this.modal(`<div class="dbig">⏸</div>
        <div class="row"><button data-a="resume" class="big">▶</button><button class="alt" data-a="restart">↻</button><button class="alt" data-a="exit">${ic('hero', 'btn')}</button></div>`);
    } else if (this.state === 'pause') { this.state = 'play'; this.el.modal.classList.add('hidden'); }
  }

  modal(html) {
    const m = this.el.modal;
    m.innerHTML = `<div class="dbox">${html}</div>`;
    m.classList.remove('hidden');
    m.querySelectorAll('[data-a]').forEach(b => b.onclick = () => this.action(b.dataset.a, b));
  }

  async action(a, btn) {
    if (a === 'resume') this.togglePause();
    if (a === 'start') {
      this.state = 'play'; this.el.modal.classList.add('hidden'); this.el.hud.classList.remove('hidden'); this.showHeader(false);
      if (this.meta.runs < 3) this.el.hint.classList.add('on');
      setTimeout(() => this.el.hint.classList.remove('on'), 4000);
      this.meta.runs++; this.saveMeta();
    }
    if (a === 'restart') {
      this.el.modal.classList.add('hidden'); this.state = 'loading';
      await this.newRun();
      this.action('start');
    }
    if (a === 'exit') this.onExit?.();
    if (a === 'card') this.chooseCard(+btn.dataset.i);
    if (a === 'buy') {
      const u = META.find(x => x.id === btn.dataset.id), l = this.meta.lv[u.id] || 0;
      if (l < u.max && this.meta.stars >= u.cost(l)) {
        this.meta.stars -= u.cost(l); this.meta.lv[u.id] = l + 1; this.saveMeta();
        if (this.state === 'menu') { await this.newRun(); this.showMenu(); } else this.showGameOver(true);
      }
    }
  }

  saveMeta() { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); }

  showHeader(on) { document.querySelector('header')?.classList.toggle('hidden', !on); }

  shopHtml() {
    return `<div class="shop">` + META.map(u => {
      const l = this.meta.lv[u.id] || 0, maxed = l >= u.max, c = u.cost(l);
      return `<button class="buy" data-a="buy" data-id="${u.id}" title="${u.name}: ${u.desc}" ${maxed || this.meta.stars < c ? 'disabled' : ''}>
        <span class="bi">${ic(u.icon)}</span><span class="bl">${l}/${u.max}</span><span class="bc">${maxed ? 'MAX' : ic('coin') + c}</span></button>`;
    }).join('') + '</div>';
  }

  showMenu() {
    this.el.hud.classList.add('hidden'); this.showHeader(true);
    this.modal(`<div class="dbig">${ic('shield')}</div>
      <div class="pills"><span>${ic('trophy')} ${fmt(this.meta.best)}</span><span>${ic('flag')} ${this.meta.bestWave}</span><span>${ic('coin')} ${this.meta.stars}</span></div>
      ${this.shopHtml()}
      <div class="row"><button data-a="start" class="big">▶</button><button class="alt" data-a="exit" title="Đổi tướng">${ic('hero', 'btn')}</button></div>`);
  }

  // ---------- Vòng lặp ----------
  update(rawDt) {
    if (!this.active || !this.hero) return;
    const realDt = Math.min(rawDt, 0.05);
    if (this.state !== 'play' && this.state !== 'over') { this.updateLabels(); return; }
    if (this.slowmo > 0) { this.slowmo -= realDt; this.timeScale = this.slowmo > 0 ? 0.3 : 1; }
    const dt = realDt * this.timeScale;
    this.time += dt;

    if (!this.over) {
      this.updateHero(dt);
      this.updateDirector(dt);
      this.updateLightning(dt);
      this.updatePet(dt);
    }
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateCrates(dt);
    this.updateGates(dt);
    this.updateMeteors(dt);
    this.updateEffects(dt);
    this.hero.anim.update(dt);
    for (const u of this.soldierUnits) u.anim.update(dt);
    this.pet?.anim.update(dt);
    this.water.position.z = -30 + Math.sin(this.time * 0.5) * 0.4;
    this.leakLine.material.opacity = 0.55 + Math.sin(this.time * 6) * 0.3;

    // Rung màn hình.
    this.shake = Math.max(0, this.shake - realDt * 2.2);
    const s = this.shake * this.shake * 0.6;
    this.camera.position.set(this.camBase.x + (Math.random() - 0.5) * s, this.camBase.y + (Math.random() - 0.5) * s, this.camBase.z);
    this.camera.lookAt(this.camLook);
    this.updateLabels();
    this.updateHud();
  }

  updateHero(dt) {
    const P = this.P;
    let k = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) k -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) k += 1;
    if (k) this.targetX = THREE.MathUtils.clamp(this.targetX + k * 9 * dt, -HALF + 0.5, HALF - 0.5);
    const dx = this.targetX - this.heroX;
    this.heroX += Math.sign(dx) * Math.min(Math.abs(dx), 13 * dt);
    const hr = this.hero.root;
    hr.position.set(this.heroX, 0, 0);
    hr.rotation.z = THREE.MathUtils.lerp(hr.rotation.z, -THREE.MathUtils.clamp(dx, -1, 1) * 0.12, Math.min(1, dt * 10));
    // Bắn.
    this.hero.cd -= dt;
    let guard = 0;
    while (this.hero.cd <= 0 && guard++ < 4) {
      this.hero.cd += 1 / P.rate;
      const n = P.multi;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.36;
        const crit = Math.random() < P.crit;
        this.fire(this.bulletStyle, this.heroX + off, -0.3, off * 0.15, P.dmg * (crit ? 2.5 : 1), P.pierce, crit);
      }
    }
    // Lính đi theo đội hình và bắn.
    const over = this.P.soldiers > 16 ? this.P.soldiers / 16 : 1;
    for (const u of this.soldierUnits) {
      const { dx: ox, dz } = this.slotPos(u.slot);
      const tx = THREE.MathUtils.clamp(this.heroX + ox, -HALF + 0.35, HALF - 0.35);
      const p = u.root.position;
      p.x += (tx - p.x) * Math.min(1, dt * 9); p.z += (dz - p.z) * Math.min(1, dt * 9);
      u.cd -= dt;
      if (u.cd <= 0) {
        u.cd += 1 / (1.15 * Math.sqrt(P.rate / 3.2));
        this.fire('soldier', p.x, p.z - 0.3, 0, P.dmg * P.soldierDmg * over, 0, false);
      }
    }
  }

  // ---------- Đạn ----------
  fire(style, x, z, vx, dmg, pierce, crit) {
    const pool = this.bulletPool[style] || (this.bulletPool[style] = []);
    let mesh = pool.pop();
    if (!mesh) {
      const geo = {
        orb: () => new THREE.SphereGeometry(0.15, 10, 8), bolt: () => new THREE.BoxGeometry(0.07, 0.07, 0.55),
        slash: () => new THREE.BoxGeometry(0.55, 0.06, 0.14), axe: () => new THREE.BoxGeometry(0.32, 0.06, 0.32),
        knife: () => new THREE.BoxGeometry(0.06, 0.05, 0.42), soldier: () => new THREE.SphereGeometry(0.085, 6, 5),
      }[style]();
      const color = { orb: 0xa78bfa, bolt: 0xfb923c, slash: 0x67e8f9, axe: 0xf97316, knife: 0xe5e7eb, soldier: 0xfde047 }[style];
      mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    }
    mesh.position.set(x, style === 'soldier' ? 0.8 : 1.05, z);
    mesh.scale.setScalar(crit ? 1.6 : 1);
    this.scene.add(mesh);
    this.bullets.push({ mesh, style, vx: vx * 30, vz: -30, dmg, pierce, crit, hit: pierce ? [] : null });
  }

  recycleBullet(b) { b.dead = true; this.scene.remove(b.mesh); this.bulletPool[b.style].push(b.mesh); }

  updateBullets(dt) {
    for (const b of this.bullets) {
      if (b.style === 'axe') b.mesh.rotation.y += dt * 18;
      // Chia nhỏ bước di chuyển để đạn không bay xuyên qua quái khi máy giật.
      const steps = Math.ceil(Math.abs(b.vz * dt) / 0.4);
      for (let i = 0; i < steps && !b.dead; i++) this.stepBullet(b, dt / steps);
    }
    this.bullets = this.bullets.filter(b => !b.dead);
  }

  stepBullet(b, dt) {
    {
      const p = b.mesh.position;
      p.x += b.vx * dt; p.z += b.vz * dt;
      if (p.z < SPAWN_Z - 6 || Math.abs(p.x) > HALF + 0.8) { this.recycleBullet(b); return; }
      // Cổng số.
      let used = false;
      for (const g of this.gates) {
        if (g.done || Math.abs(g.z - p.z) > 0.45) continue;
        const side = g.sides[p.x < 0 ? 0 : 1];
        this.gateHit(g, side, b.dmg); this.recycleBullet(b); used = true; break;
      }
      if (used) return;
      // Hòm quà.
      for (const c of this.crates) {
        if (c.dead || Math.abs(c.z - p.z) > 0.6 || Math.abs(c.x - p.x) > 0.65) continue;
        this.crateHit(c, b.dmg); this.recycleBullet(b); used = true; break;
      }
      if (used) return;
      // Quái.
      for (const e of this.enemies) {
        if (e.dead) continue;
        const ep = e.root.position, r = e.radius;
        if (Math.abs(ep.z - p.z) > r + 0.25 || Math.abs(ep.x - p.x) > r + 0.2) continue;
        if (b.hit) { if (b.hit.includes(e)) continue; b.hit.push(e); }
        this.hitEnemy(e, b.dmg, b.crit, true);
        if (b.pierce-- <= 0) { this.recycleBullet(b); break; }
      }
    }
  }

  hitEnemy(e, dmg, crit = false, fromBullet = false) {
    if (e.dead) return;
    e.hp -= dmg; e.punch = 0.18;
    if (this.P.slow && fromBullet) e.slowT = 1.3;
    if (crit || (e.boss && Math.random() < 0.15)) this.floatText(e.root.position, e.root.userData.height * e.root.scale.x, (crit ? ic('burst', 'sm') : '') + fmt(dmg), crit ? '#fbbf24' : '#fff', crit);
    if (fromBullet && this.P.splash) {
      const r = this.P.splash, c = e.root.position;
      if (Math.random() < 0.5) this.ring(c, r * 0.5, 0xfb923c, 0.3);
      for (const o of this.enemies) if (o !== e && !o.dead && o.root.position.distanceTo(c) < r) this.hitEnemy(o, dmg * 0.5);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  // ---------- Quái ----------
  hpMul() { return Math.pow(1.2, this.wave - 1); }

  async getInst(entry, height) {
    const key = entry.id + '|' + (height || '');
    const pool = this.pool[key];
    if (pool && pool.length) return pool.pop();
    const m = await spawnModel(entry, height);
    const anim = new Animator(m.model, m.clips, entry.anims);
    const ring = this.addRing(m.root, Math.max(m.root.userData.radius, 0.35), 0xf87171);
    const bar = document.createElement('div'); bar.className = 'hpbar'; bar.innerHTML = '<i></i>'; bar.style.display = 'none';
    this.layer.appendChild(bar);
    return { key, root: m.root, anim, ring, bar };
  }

  async spawnEnemy(def, x, z, opts = {}) {
    const entry = byId[def.id]; if (!entry) return;
    const runId = this.runId;
    const inst = await this.getInst(entry, opts.height);
    if (runId !== this.runId || this.over) return;
    const elite = !!opts.elite, boss = !!opts.boss;
    const base = 18 * this.hpMul() * def.hp;
    const hp = boss ? base * opts.bossMul : elite ? base * 4.5 : base;
    const scale = elite ? 1.35 : 1;
    const e = {
      ...inst, entry, def, elite, boss, hp, maxHp: hp, dead: false, deadT: 0, slowT: 0, punch: 0, scale,
      speed: (boss ? 1.25 : 2.6 * def.spd * Math.min(1.5, 1 + 0.025 * this.wave)) * (elite ? 0.85 : 1),
      radius: Math.max(inst.root.userData.radius, 0.35) * scale, phase: Math.random() * 6,
      leak: boss ? 8 : elite ? 3 : 1, xp: boss ? 25 : elite ? 4 : 1,
    };
    e.root.position.set(x, 0, z); e.root.rotation.set(0, 0, 0); e.root.scale.setScalar(scale);
    e.ring.material.color.setHex(boss ? 0xdc2626 : elite ? 0xfbbf24 : 0xf87171);
    e.bar.className = 'hpbar' + (boss ? ' boss' : elite ? ' elite' : '');
    e.bar.style.display = 'none';
    e.anim.play('run', { restart: true });
    this.scene.add(e.root);
    this.enemies.push(e);
    if (boss) { this.boss = e; this.el.bossName.innerHTML = ic('boss'); this.el.boss.classList.remove('hidden'); }
  }

  randomDef() { return pickW(ROSTER.filter(r => r.from <= this.wave)); }

  updateDirector(dt) {
    this.waveT += dt;
    if (this.wave === 0 || (this.waveT >= WAVE_DUR && !this.boss)) this.nextWave();
    const alive = this.enemies.filter(e => !e.dead).length;
    // Quái lẻ.
    this.spawnAcc += dt * (0.7 + this.wave * 0.24);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (alive < MAX_ALIVE) {
        const elite = this.wave >= 3 && Math.random() < Math.min(0.15, 0.03 + this.wave * 0.008);
        this.spawnEnemy(this.randomDef(), (Math.random() * 2 - 1) * (HALF - 0.6), SPAWN_Z, { elite });
      }
    }
    // Đạo quân: cả đàn cùng loại đi thành khối.
    this.packT -= dt;
    if (this.packT <= 0 && this.wave >= 2) {
      this.packT = Math.max(5, 10 - this.wave * 0.25);
      const def = this.randomDef(), n = Math.min(24, 4 + Math.floor(this.wave * 1.3));
      const cx = (Math.random() * 2 - 1) * (HALF - 2.2);
      for (let i = 0; i < n && alive + i < MAX_ALIVE; i++) {
        const col = i % 4, row = Math.floor(i / 4);
        this.spawnEnemy(def, THREE.MathUtils.clamp(cx + (col - 1.5) * 1, -HALF + 0.5, HALF - 0.5), SPAWN_Z - row * 1.1);
      }
      if (this.wave >= 3 && Math.random() < 0.5) this.toast(ic('skull') + ic('skull') + ic('skull'), '#fb923c', true);
    }
    // Hòm quà.
    this.crateT -= dt;
    if (this.crateT <= 0) { this.crateT = 6 + Math.random() * 4; this.spawnCrate(); }
    // Cổng số.
    this.gateT -= dt;
    if (this.gateT <= 0) { this.gateT = 18 + Math.random() * 6; this.spawnGatePair(); }
  }

  nextWave() {
    if (this.wave > 0) { this.gateHp = Math.min(this.gateMax, this.gateHp + 1); this.score += 50 * this.wave; }
    this.wave++; this.waveT = 0;
    if (this.wave % 5 === 0) {
      const bossN = this.wave / 5;
      const ids = [selection.boss, selection.boss === 'Trex' ? 'Triceratops' : 'Trex'].filter(id => byId[id]);
      const entry = byId[ids[(bossN - 1) % ids.length]] || byId.Trex;
      this.toast(`${ic('boss')} ${ic('flag')}${this.wave}`, '#ef4444', false, true);
      this.shake = 1;
      this.spawnEnemy({ id: entry.id, hp: 1, spd: 1 }, 0, SPAWN_Z + 4, { boss: true, bossMul: 55 * (1 + (bossN - 1) * 0.3) });
    } else this.toast(`${ic('flag')} ${this.wave}`, '#fff', false, true);
    if (this.wave > this.meta.bestWave && this.meta.bestWave > 0 && this.wave === this.meta.bestWave + 1) this.toast(ic('flag') + ic('trophy'), '#fbbf24', true);
  }

  updateEnemies(dt) {
    const alive = this.enemies.filter(e => !e.dead);
    for (const e of this.enemies) {
      e.anim.update(dt);
      const r = e.root, p = r.position;
      if (e.punch > 0) e.punch = Math.max(0, e.punch - dt * 1.2);
      r.scale.set(e.scale * (1 + e.punch * 0.5), e.scale * (1 - e.punch * 0.6), e.scale * (1 + e.punch * 0.5));
      if (e.dead) {
        e.deadT += dt;
        if (!e.anim.has('death')) r.scale.multiplyScalar(Math.max(0.01, 1 - e.deadT * 2.5));
        if (e.deadT > 0.9) p.y -= dt * 2;
        if (e.deadT > 1.5) this.releaseEnemy(e);
        continue;
      }
      if (this.over) { if (!e.won) { e.won = true; e.anim.play(e.anim.has('win') ? 'win' : 'idle'); } continue; }
      e.slowT -= dt;
      const sp = e.speed * (e.slowT > 0 ? 1 - this.P.slow : 1);
      p.z += sp * dt;
      if (e.def.zig) p.x += Math.sin(this.time * 2.4 + e.phase) * 1.8 * dt;
      if (!e.boss) {
        for (const o of alive) {
          if (o === e || o.boss) continue;
          const dx = p.x - o.root.position.x, dz = p.z - o.root.position.z, min = (e.radius + o.radius) * 0.8;
          if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
          const d = Math.hypot(dx, dz);
          if (d > 0.001 && d < min) { p.x += dx / d * (min - d) * 0.3; p.z += dz / d * (min - d) * 0.15; }
        }
      }
      const lim = HALF - Math.min(e.radius, 1.2);
      p.x = THREE.MathUtils.clamp(p.x, -lim, lim);
      if (p.z >= LEAK_Z) this.leak(e);
    }
    this.enemies = this.enemies.filter(e => !e.released);
  }

  leak(e) {
    e.dead = true; e.deadT = 1.4; e.bar.style.display = 'none';
    this.poof(e.root.position, 0xff4d4d);
    this.combo = 0;
    let soldierLoss = e.boss ? 5 : e.elite ? 2 : 1;
    if (!e.boss && this.P.soldiers >= soldierLoss) {
      this.addSoldiers(-soldierLoss, true);
      this.floatText(e.root.position, 1.5, `-${soldierLoss} ${ic('soldier')}`, '#ff6b6b', true);
    } else {
      if (e.boss) this.addSoldiers(-Math.min(this.P.soldiers, soldierLoss), true);
      this.gateHp -= e.leak; this.shake = Math.max(this.shake, e.boss ? 1.2 : 0.5);
      this.flashRed();
      this.floatText(new THREE.Vector3(e.root.position.x, 0, WALL_Z), 1.6, `-${e.leak} ${ic('tower')}`, '#ff4d4d', true);
      if (this.gateHp <= 0) this.gameOver();
    }
    if (e.boss) this.clearBoss();
  }

  killEnemy(e) {
    e.dead = true; e.deadT = 0; e.bar.style.display = 'none';
    e.anim.play('death', { once: true, clamp: true });
    this.kills++; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = this.comboMult();
    this.score += Math.round((e.boss ? 300 : e.elite ? 40 : 10) * this.wave * mult);
    this.ult = Math.min(100, this.ult + (e.boss ? 40 : e.elite ? 6 : 1.3) * this.P.ultGain);
    this.gainXp(e.xp);
    if (e.elite) this.poof(e.root.position, 0xfbbf24);
    if (this.combo > 0 && this.combo % 50 === 0) this.toast(`${ic('flame')}${this.combo} ×${mult.toFixed(1)}`, '#fbbf24', true);
    if (e.boss) {
      this.clearBoss(); this.slowmo = 0.8; this.shake = 1.3;
      this.toast(`${ic('boss')}${ic('skull')} ${ic('tower')}+5`, '#fbbf24', false, true);
      this.gateHp = Math.min(this.gateMax, this.gateHp + 5);
      this.pendingLevels++; this.tryCards();
    }
    if (!this.newBestShown && this.meta.best > 0 && this.score > this.meta.best) { this.newBestShown = true; this.toast(ic('trophy') + ' NEW!', '#fbbf24', true); }
  }

  comboMult() { return 1 + Math.min(4, Math.floor(this.combo / 25) * 0.5); }

  clearBoss() { this.boss = null; this.el.boss.classList.add('hidden'); }

  releaseEnemy(e) {
    e.released = true;
    this.scene.remove(e.root);
    e.bar.style.display = 'none';
    (this.pool[e.key] || (this.pool[e.key] = [])).push({ key: e.key, root: e.root, anim: e.anim, ring: e.ring, bar: e.bar });
  }

  // ---------- Lên cấp & thẻ ----------
  gainXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNeed()) { this.xp -= this.xpNeed(); this.level++; this.pendingLevels++; }
    this.tryCards();
  }

  xpNeed() { return 5 + this.level * 4; }

  tryCards() {
    if (this.pendingLevels <= 0 || this.state !== 'play' || this.over) return;
    this.pendingLevels--;
    const avail = CARDS.filter(c => (!c.max || (this.picked[c.id] || 0) < c.max) && (!c.need || c.need(this.P, this)));
    const hand = [];
    while (hand.length < 3 && avail.length) {
      const c = pickW(avail, x => RAR[x.rar].w);
      hand.push(c); avail.splice(avail.indexOf(c), 1);
    }
    this.hand = hand;
    this.state = 'cards';
    this.modal(`<div class="dlv">${ic('gem')} ${this.level}</div>
      <div class="cards">${hand.map((c, i) => `<button class="card ${c.rar}" data-a="card" data-i="${i}" title="${c.desc}">
        <span class="ci">${ic(c.icon)}</span><b>${c.fx}</b><small>${c.name}</small>
        ${this.picked[c.id] ? `<em>×${this.picked[c.id]}</em>` : ''}</button>`).join('')}</div>`);
  }

  chooseCard(i) {
    if (this.state !== 'cards' || !this.hand[i]) return;
    const c = this.hand[i];
    c.apply(this.P, this);
    this.picked[c.id] = (this.picked[c.id] || 0) + 1;
    this.state = 'play';
    this.el.modal.classList.add('hidden');
    this.toast(`${ic(c.icon)} ${c.fx}`, '#fff', true);
    this.tryCards();
  }

  // ---------- Hòm quà ----------
  spawnCrate() {
    const kind = pickW(CRATES);
    const g = new THREE.Group();
    const m = this.chestModel.clone();
    m.scale.setScalar(this.chestScale); m.position.y = this.chestY - 0.5;
    m.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(m);
    const x = (Math.random() * 2 - 1) * (HALF - 0.9);
    g.position.set(x, 0.55, SPAWN_Z);
    this.scene.add(g);
    const hp = 22 * this.hpMul() * kind.hp * (this.wave <= 1 ? 0.6 : 1);
    const label = document.createElement('div'); label.className = 'dcrate'; this.layer.appendChild(label);
    this.crates.push({ g, kind, hp, maxHp: hp, x, z: SPAWN_Z, label, punch: 0 });
  }

  crateHit(c, dmg) {
    c.hp -= dmg; c.punch = 0.2;
    if (c.hp <= 0) this.openCrate(c);
  }

  openCrate(c) {
    c.dead = true; this.scene.remove(c.g); c.label.remove();
    const pos = new THREE.Vector3(c.x, 0, c.z);
    this.poof(pos, 0xfacc15); this.ring(pos, 1.2, 0xfde047, 0.5);
    const P = this.P;
    switch (c.kind.k) {
      case 'weapon': {
        const opts = [];
        if (P.multi < 3) opts.push([ic('arrows') + '+1', () => P.multi++]);
        opts.push([ic('chevron') + '+15%', () => P.ratePct += 15], [ic('sword') + '+15%', () => P.dmgPct += 15]);
        if (P.pierce < 5) opts.push([ic('target') + '+1', () => P.pierce++]);
        const [t, f] = pick(opts); f(); this.toast(t, '#67e8f9', true); break;
      }
      case 'squad': this.addSoldiers(2 + Math.floor(Math.random() * 2)); break;
      case 'heal': this.gateHp = Math.min(this.gateMax, this.gateHp + 3); this.toast(ic('heart') + '+3', '#f87171', true); break;
      case 'bomb':
        this.ring(pos, 7, 0xf97316, 0.6); this.shake = Math.max(this.shake, 0.7);
        for (const e of this.enemies) if (!e.dead && e.root.position.distanceTo(pos) < 7) this.hitEnemy(e, P.dmg * 15);
        this.toast(ic('bomb') + ic('burst'), '#fb923c', true); break;
      case 'ult': this.ult = Math.min(100, this.ult + 50); this.toast(ic('star') + '+50', '#fde047', true); break;
    }
  }

  updateCrates(dt) {
    for (const c of this.crates) {
      if (c.dead) continue;
      if (!this.over) c.z += 2.9 * dt;
      c.punch = Math.max(0, c.punch - dt * 1.5);
      c.g.position.set(c.x, 0.55 + Math.sin(this.time * 3 + c.x) * 0.08, c.z);
      c.g.rotation.y = Math.sin(this.time * 2 + c.x) * 0.25;
      c.g.scale.setScalar(1 + c.punch);
      if (c.z > LEAK_Z) { c.dead = true; this.scene.remove(c.g); c.label.remove(); }
    }
    this.crates = this.crates.filter(c => !c.dead);
  }

  // ---------- Cổng số ----------
  spawnGatePair() {
    const pool = GATE_TYPES.filter(t => !t.rare || (this.wave >= 3 && this.P.multi < 5));
    const types = [pick(pool), pick(pool)];
    const z = SPAWN_Z;
    const g = { z, sides: [], group: new THREE.Group(), done: false };
    types.forEach((t, i) => {
      let v = pick(t.vals);
      if (i === 1 && g.sides[0].v > 0 && v > 0 && Math.random() < 0.6) v = -Math.abs(v); // thường có một bên âm
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(HALF - 0.25, 1.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false }));
      const x = (i === 0 ? -1 : 1) * HALF / 2;
      mesh.position.set(x, 1.25, 0);
      g.group.add(mesh);
      for (const px of [x - HALF / 2 + 0.1, x + HALF / 2 - 0.1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 0.16), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
        post.position.set(px, 1.15, 0); g.group.add(post);
      }
      const side = { t, v, progress: 0, canvas, tex, mesh };
      g.sides.push(side); this.drawGate(side);
    });
    g.group.position.z = z;
    this.scene.add(g.group);
    this.gates.push(g);
  }

  drawGate(s) {
    const ctx = s.canvas.getContext('2d'), pos = s.v >= 0;
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = pos ? 'rgba(59,130,246,0.85)' : 'rgba(239,68,68,0.85)';
    ctx.beginPath(); ctx.roundRect(4, 4, 248, 120, 18); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 54px "Baloo 2", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${pos ? '+' : ''}${s.v}${s.t.pct ? '%' : ''}`, 98, 68);
    const im = iconImg(s.t.unit);
    if (im.complete && im.naturalWidth) ctx.drawImage(im, 160, 14, 96, 96);
    else im.addEventListener('load', () => this.drawGate(s), { once: true });
    s.tex.needsUpdate = true;
  }

  gateHit(g, s, dmg) {
    s.progress += dmg;
    const cost = s.t.cost * this.hpMul();
    let changed = false;
    while (s.progress >= cost && s.v < s.t.max) { s.progress -= cost; s.v += s.t.step; changed = true; }
    if (changed) { this.drawGate(s); s.mesh.scale.set(1.08, 1.08, 1); }
  }

  updateGates(dt) {
    for (const g of this.gates) {
      if (g.done) continue;
      if (!this.over) g.z += 3.1 * dt;
      g.group.position.z = g.z;
      for (const s of g.sides) s.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 8));
      if (g.z >= 0) {
        g.done = true;
        const s = g.sides[this.heroX < 0 ? 0 : 1];
        this.applyGate(s);
        this.scene.remove(g.group);
        for (const x of g.sides) { x.tex.dispose(); }
      }
    }
    this.gates = this.gates.filter(g => !g.done);
  }

  applyGate(s) {
    const P = this.P, v = s.v, sign = v >= 0 ? '+' : '';
    const col = v >= 0 ? '#60a5fa' : '#f87171';
    if (s.t.t === 'soldier') { this.addSoldiers(v, true); }
    if (s.t.t === 'rate') P.ratePct = Math.max(-60, P.ratePct + v);
    if (s.t.t === 'dmg') P.dmgPct = Math.max(-60, P.dmgPct + v);
    if (s.t.t === 'multi') P.multi = THREE.MathUtils.clamp(P.multi + v, 1, 5);
    this.toast(`${sign}${v}${s.t.pct ? '%' : ''} ${ic(s.t.unit)}`, col, true);
    this.ring(new THREE.Vector3(this.heroX, 0, 0), 1.5, v >= 0 ? 0x60a5fa : 0xf87171, 0.5);
  }

  // ---------- Kỹ năng ----------
  ultimate() {
    if (this.state !== 'play' || this.over || this.ult < 100) return;
    this.ult = 0;
    this.toast(ic('star') + ic('star') + ic('star'), '#fde047', false, true);
    for (let i = 0; i < 16; i++) {
      const x = (Math.random() * 2 - 1) * (HALF - 0.5), z = -3 - Math.random() * 38;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false }));
      mesh.position.set(x + 4, 16, z - 6);
      this.scene.add(mesh);
      this.meteors.push({ mesh, x, z, t: -i * 0.07 });
    }
  }

  updateMeteors(dt) {
    for (const m of this.meteors) {
      m.t += dt;
      if (m.t < 0) continue;
      const k = Math.min(1, m.t / 0.45);
      m.mesh.position.set(m.x + 4 * (1 - k), 16 * (1 - k), m.z - 6 * (1 - k));
      if (k >= 1) {
        m.done = true; this.scene.remove(m.mesh);
        const p = new THREE.Vector3(m.x, 0, m.z);
        this.ring(p, 2.6, 0xff9f1c, 0.5); this.shake = Math.max(this.shake, 0.6);
        for (const e of this.enemies) if (!e.dead && e.root.position.distanceTo(p) < 2.8 + e.radius) { this.hitEnemy(e, this.P.dmg * 14); if (!e.boss) e.root.position.z -= 1; }
      }
    }
    this.meteors = this.meteors.filter(m => !m.done);
  }

  updateLightning(dt) {
    if (!this.P.lightning) return;
    this.boltT -= dt;
    if (this.boltT > 0) return;
    this.boltT = 2.5;
    const cands = this.enemies.filter(e => !e.dead && e.root.position.z > -45).sort(() => Math.random() - 0.5);
    for (const e of cands.slice(0, this.P.lightning)) {
      const p = e.root.position;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 14, 5), new THREE.MeshBasicMaterial({ color: 0xbfdbfe, transparent: true, toneMapped: false }));
      bolt.position.set(p.x, 7, p.z); this.scene.add(bolt);
      this.effects.push({ mesh: bolt, t: 0, life: 0.25, fade: true });
      this.ring(p, 1.2, 0x93c5fd, 0.3);
      this.hitEnemy(e, this.P.dmg * 6);
    }
  }

  updatePet(dt) {
    const pt = this.pet; if (!pt) return;
    const p = pt.root.position, lv = this.P.petLv;
    if (pt.mode === 'home') {
      this.petT -= dt;
      const hx = -HALF + 0.7;
      if (Math.abs(p.x - hx) > 0.1 || Math.abs(p.z - 2.4) > 0.1) { p.x += (hx - p.x) * dt * 4; p.z += (2.4 - p.z) * dt * 4; }
      if (this.petT <= 0 && this.enemies.some(e => !e.dead && e.root.position.z > -30)) {
        pt.mode = 'charge'; pt.hit.clear(); pt.x = this.heroX; pt.anim.play('run');
        pt.root.rotation.y = Math.PI;
      }
    } else if (pt.mode === 'charge') {
      p.x += (pt.x - p.x) * Math.min(1, dt * 8);
      p.z -= 17 * dt;
      for (const e of this.enemies) {
        if (e.dead || pt.hit.has(e)) continue;
        const ep = e.root.position;
        if (Math.abs(ep.x - p.x) < 1.3 + e.radius && Math.abs(ep.z - p.z) < 0.9 + e.radius) {
          pt.hit.add(e); this.hitEnemy(e, this.P.dmg * (3 + lv * 2));
          if (!e.boss) ep.z -= 1.2;
        }
      }
      if (p.z < -32) { pt.mode = 'back'; pt.root.rotation.y = 0; }
    } else {
      p.z += 15 * dt;
      if (p.z >= 2.4) { pt.mode = 'home'; this.petT = Math.max(3, 9 - lv * 1.2); pt.anim.play('idle'); pt.root.rotation.y = Math.PI; }
    }
  }

  // ---------- Thua ----------
  gameOver() {
    if (this.over) return;
    this.over = true; this.gateHp = 0; this.slowmo = 1.2; this.shake = 1.5;
    this.state = 'over';
    this.hero.anim.play('death', { once: true, clamp: true });
    const stars = Math.floor(this.wave * 1.5 + this.kills / 25);
    this.lastStars = stars;
    this.newBest = this.score > this.meta.best;
    this.meta.stars += stars;
    this.meta.best = Math.max(this.meta.best, this.score);
    this.meta.bestWave = Math.max(this.meta.bestWave, this.wave);
    this.saveMeta();
    setTimeout(() => { if (this.over && this.active) this.showGameOver(); }, 1500);
  }

  showGameOver() {
    this.el.hud.classList.add('hidden'); this.showHeader(true);
    const gap = this.meta.best - this.score;
    this.modal(`<div class="dbig">${this.newBest ? ic('trophy') : ic('tower') + ic('burst')}</div>
      <div class="dscoreBig">${fmt(this.score)}</div>
      ${this.newBest ? '<div class="newbest">NEW!</div>' : `<div class="gap">${ic('trophy')} ${fmt(this.meta.best)} <small>(-${fmt(gap)})</small></div>`}
      <div class="stats"><div>${ic('flag')}<b>${this.wave}</b></div><div>${ic('skull')}<b>${fmt(this.kills)}</b></div><div>${ic('flame')}<b>${this.bestCombo}</b></div><div>${ic('coin')}<b>+${this.lastStars}</b></div></div>
      ${this.shopHtml()}
      <div class="row"><button data-a="restart" class="big">↻</button><button class="alt" data-a="exit" title="Đổi tướng">${ic('hero', 'btn')}</button></div>`);
  }

  // ---------- Hiệu ứng ----------
  ring(pos, radius, color, life = 0.45) {
    if (this.effects.length > 60) return;
    const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.32, 32), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.08, pos.z);
    this.scene.add(m);
    this.effects.push({ mesh: m, t: 0, life, radius });
  }

  poof(pos, color) {
    for (let i = 0; i < 6; i++) {
      if (this.effects.length > 80) return;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false }));
      m.position.set(pos.x, 0.6, pos.z);
      this.scene.add(m);
      this.effects.push({ mesh: m, t: 0, life: 0.5, vel: new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5), fade: true });
    }
  }

  updateEffects(dt) {
    for (const e of this.effects) {
      e.t += dt; const k = e.t / e.life;
      if (e.radius) e.mesh.scale.setScalar(0.3 + k * e.radius * 2.6);
      if (e.vel) { e.mesh.position.addScaledVector(e.vel, dt); e.vel.y -= 12 * dt; }
      e.mesh.material.opacity = 1 - k;
      if (k >= 1) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); e.done = true; }
    }
    this.effects = this.effects.filter(e => !e.done);
    for (const f of this.floaters) { f.t += dt; f.y += dt * 1.5; if (f.t > 0.9) { f.el.remove(); f.done = true; } }
    this.floaters = this.floaters.filter(f => !f.done);
  }

  floatText(pos, y, text, color, big = false) {
    if (this.floaters.length > 30) return;
    const el = document.createElement('div');
    el.className = 'dmg' + (big ? ' big' : ''); el.innerHTML = text; el.style.color = color;
    this.layer.appendChild(el);
    this.floaters.push({ el, t: 0, pos: pos.clone(), y: y + 0.3, dx: (Math.random() - 0.5) * 0.6 });
  }

  flashRed() {
    const f = this.el.flash; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  }

  toast(text, color = '#fff', small = false, banner = false) {
    const el = document.createElement('div');
    el.className = 'dtoast' + (small ? ' small' : '') + (banner ? ' banner' : '');
    el.innerHTML = text; el.style.color = color;
    const host = document.getElementById('dtoasts');
    host.appendChild(el);
    while (host.children.length > 4) host.firstChild.remove();
    setTimeout(() => el.remove(), banner ? 2000 : 1500);
  }

  project(pos, yOff) {
    const v = new THREE.Vector3(pos.x, pos.y + yOff, pos.z).project(this.camera);
    const w = innerWidth, h = innerHeight; // canvas phủ toàn màn hình; tránh đọc layout mỗi lần
    return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h, v.z < 1];
  }

  updateLabels() {
    for (const e of this.enemies) {
      if (e.dead || e.boss) continue;
      const show = e.elite || e.hp < e.maxHp;
      if (!show || e.root.position.z < -48) { e.bar.style.display = 'none'; continue; }
      const [x, y] = this.project(e.root.position, e.root.userData.height * e.scale + 0.25);
      e.bar.style.display = y < 130 ? 'none' : '';
      e.bar.style.transform = `translate(-50%,-100%) translate(${x}px,${y}px)`;
      e.bar.firstChild.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
    }
    for (const c of this.crates) {
      const [x, y] = this.project(c.g.position, 0.9);
      c.label.style.transform = `translate(-50%,-100%) translate(${x}px,${y}px)`;
      c.label.style.opacity = y < 130 ? 0 : 1; // không đè lên HUD phía trên
      const hpTxt = fmt(Math.max(1, c.hp));
      if (c.labelTxt !== hpTxt) { c.labelTxt = hpTxt; c.label.innerHTML = `${ic(c.kind.icon)}<b>${hpTxt}</b>`; }
    }
    for (const f of this.floaters) {
      const [x, y] = this.project(f.pos, f.y);
      f.el.style.transform = `translate(-50%,-100%) translate(${x + f.dx * 40}px,${y}px)`;
      f.el.style.opacity = 1 - f.t / 0.9;
    }
    // Nhãn số lính trên đầu đội hình.
    const sq = this.el.squad;
    if (this.P && this.P.soldiers > 0 && this.state === 'play') {
      const [x, y] = this.project(new THREE.Vector3(this.heroX, 0, 0.6), 2.2);
      sq.style.display = ''; sq.style.transform = `translate(-50%,-100%) translate(${x}px,${y}px)`;
      if (sq.dataset.n !== String(this.P.soldiers)) { sq.dataset.n = this.P.soldiers; sq.innerHTML = `${ic('soldier')}${this.P.soldiers}`; }
    } else sq.style.display = 'none';
  }

  updateHud() {
    if (!this.P) return;
    const el = this.el;
    el.gateBar.style.width = Math.max(0, this.gateHp / this.gateMax * 100) + '%';
    el.gateText.textContent = Math.max(0, this.gateHp);
    el.score.textContent = fmt(this.score);
    el.bestN.textContent = fmt(Math.max(this.meta.best, this.score));
    el.wave.textContent = this.wave;
    el.waveRing.style.setProperty('--p', Math.min(1, this.waveT / WAVE_DUR));
    el.xp.style.width = (this.xp / this.xpNeed() * 100) + '%';
    el.lv.textContent = this.level;
    const m = this.comboMult();
    const ck = this.combo >= 10 ? this.combo + '|' + m : '';
    if (el.combo.dataset.k !== ck) { el.combo.dataset.k = ck; el.combo.innerHTML = ck ? `${ic('flame')}<b>${this.combo}</b>${m > 1 ? ` <small>×${m.toFixed(1)}</small>` : ''}` : ''; }
    el.ultFill.style.height = this.ult + '%';
    el.ult.classList.toggle('ready', this.ult >= 100);
    if (this.boss) el.bossBar.style.width = Math.max(0, this.boss.hp / this.boss.maxHp * 100) + '%';
  }

  render() { if (this.scene && this.camera) this.renderer.render(this.scene, this.camera); }
  resize() { if (this.camera) this.fitCamera(); }
}
