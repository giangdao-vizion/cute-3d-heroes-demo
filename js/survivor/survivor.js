import * as THREE from 'three';
import { byId } from '../catalog.js';
import { selection } from '../state.js';
import { spawnModel, Animator, addLights, makeTree, makeRock, makeFlower, isMobileGraphics } from '../engine.js';
import { bindLobbyLinks } from '../lobby-nav.js';

const ARENA = 27;
const ENEMY_CAP = 55;
const STAGE_DURATION = 50;
const BASE_ATTACK_RANGE = 6.2;
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const FIREBALL_ENTRY = {
  id:'ember_projectile',
  file:'models/props/ember_projectile.glb',
  height:0.78,
};

const ENEMY_VARIANTS = {
  sprout: { entryId:'Enemy', name:'Mầm xanh', icon:'🌱', hp:24, defense:0, speed:1.75, dmg:4, scale:1, gem:1 },
  sproutBrute: { entryId:'Enemy', name:'Mầm xanh lực sĩ', icon:'🌿', hp:58, defense:2, speed:1.42, dmg:7, scale:1.38, gem:3 },
  ratScout: { entryId:'Rat', name:'Chuột trinh sát', icon:'🐭', hp:28, defense:0, speed:3.15, dmg:5, scale:1.04, gem:3 },
  skeletonGuard: { entryId:'Skeleton_Minion', name:'Vệ binh xương', icon:'💀', hp:72, defense:3, speed:1.82, dmg:8, scale:1.12, gem:6 },
  skeletonRaider: { entryId:'Skeleton_Minion', name:'Xương đột kích', icon:'☠', hp:48, defense:1, speed:2.75, dmg:9, scale:0.94, gem:10 },
};

const STAGES = [
  { name:'Mầm non', featured:'sprout', pool:['sprout'], interval:1.55, cap:14, pack:1 },
  { name:'Lực sĩ', featured:'sproutBrute', pool:['sprout','sprout','sproutBrute'], interval:1.38, cap:18, pack:1 },
  { name:'Trinh sát', featured:'ratScout', pool:['sprout','sproutBrute','ratScout','ratScout'], interval:1.22, cap:24, pack:2 },
  { name:'Vệ binh', featured:'skeletonGuard', pool:['sproutBrute','ratScout','skeletonGuard'], interval:1.08, cap:31, pack:2 },
  { name:'Đột kích', featured:'skeletonRaider', pool:['ratScout','skeletonGuard','skeletonRaider','skeletonRaider'], interval:0.94, cap:38, pack:3 },
];

const GEM_TIERS = [
  { min:10, color:0xffd21f, size:0.34, pulse:0.15, glow:true },
  { min:6, color:0xef4444, size:0.29, pulse:0.1 },
  { min:3, color:0x38bdf8, size:0.25, pulse:0.08 },
  { min:1, color:0xa78bfa, size:0.21, pulse:0.06 },
];

const UPGRADES = [
  { id:'damage', icon:'⚔', name:'Sức mạnh', desc:'+25% sát thương', max:5, apply:g => { g.power.damage *= 1.25; } },
  { id:'speed', icon:'👟', name:'Nhanh chân', desc:'+12% tốc độ chạy', max:5, apply:g => { g.hero.speed *= 1.12; } },
  { id:'rate', icon:'✦', name:'Liên hoàn', desc:'+18% tốc độ tấn công', max:5, apply:g => { g.power.interval /= 1.18; } },
  { id:'multi', icon:'➹', name:'Đa mục tiêu', desc:'+1 tia đạn mỗi lượt', max:3, apply:g => { g.power.multi++; } },
  { id:'pierce', icon:'➤', name:'Xuyên phá', desc:'Đạn xuyên thêm 1 quái', max:3, apply:g => { g.power.pierce++; } },
  { id:'size', icon:'◉', name:'Đạn khổng lồ', desc:'+25% kích thước và vùng trúng', max:4, apply:g => { g.power.size *= 1.25; } },
  { id:'health', icon:'♥', name:'Sinh lực', desc:'+30 máu tối đa và hồi đầy', max:5, apply:g => { g.hero.maxHp += 30; g.hero.hp = g.hero.maxHp; } },
  { id:'magnet', icon:'◆', name:'Nam châm', desc:'+35% phạm vi hút ngọc', max:4, apply:g => { g.power.magnet *= 1.35; g.updateMagnetRing(); } },
  { id:'armor', icon:'⬟', name:'Giáp hộ mệnh', desc:'Giảm 12% sát thương nhận', max:4, apply:g => { g.power.armor *= 0.88; } },
  { id:'range', icon:'◎', name:'Tầm bắn', desc:'+15% tầm bắn', max:5, apply:g => { g.power.range *= 1.15; g.updateRangeRing(); } },
  { id:'chain', icon:'ϟ', name:'Sét lan', desc:'Tia sét lan thêm 1 quái gần đó', max:4, apply:g => { g.power.chain++; } },
  { id:'blast', icon:'✹', name:'Nổ lan', desc:'Fireball gây nổ quanh mục tiêu', max:4, apply:g => { g.power.blast++; } },
  { id:'freeze', icon:'❄', name:'Băng giá', desc:'Làm chậm, có cơ hội đóng băng quái', max:4, apply:g => { g.power.freeze++; } },
];

function easeOutBack(x) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export class SurvivorGame {
  constructor(renderer, ui) {
    this.renderer = renderer;
    this.ui = ui;
    this.keys = new Set();
    this.moveInput = new THREE.Vector2();
    this.runId = 0;
    this.state = 'loading';
    this.bindInput();
  }

  bindInput() {
    addEventListener('keydown', e => {
      const key = e.key.toLowerCase();
      this.keys.add(key);
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault();
      if (this.state === 'levelup' && ['1','2','3'].includes(key)) this.chooseUpgrade(Number(key) - 1);
      if (!e.repeat && (key === 'p' || key === 'escape')) this.togglePause();
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.clearMovement());

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', e => {
      if (this.state !== 'playing') return;
      this.pointerId = e.pointerId;
      this.joyStart = { x:e.clientX, y:e.clientY };
      this.ui.joystick.style.left = `${e.clientX}px`;
      this.ui.joystick.style.top = `${e.clientY}px`;
      this.ui.joystick.classList.remove('hidden');
      canvas.setPointerCapture(e.pointerId);
      this.updateJoystick(e);
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId === this.pointerId) this.updateJoystick(e);
    });
    const stop = e => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.moveInput.set(0, 0);
      this.ui.stick.style.transform = '';
      this.ui.joystick.classList.add('hidden');
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    this.ui.pause.onclick = () => this.togglePause();
  }

  updateJoystick(e) {
    const dx = e.clientX - this.joyStart.x;
    const dy = e.clientY - this.joyStart.y;
    const distance = Math.hypot(dx, dy);
    const limit = 38;
    const scale = distance > limit ? limit / distance : 1;
    const x = dx * scale, y = dy * scale;
    this.ui.stick.style.transform = `translate(${x}px,${y}px)`;
    this.moveInput.set(x / limit, y / limit);
  }

  clearMovement() {
    this.keys.clear();
    this.pointerId = null;
    this.moveInput.set(0, 0);
    this.ui.stick.style.transform = '';
    this.ui.joystick.classList.add('hidden');
  }

  async start(onProgress = () => {}) {
    const runId = ++this.runId;
    this.state = 'loading';
    this.cleanupScene();
    onProgress(0.08, 'Đang dựng đấu trường');

    const scene = this.scene = new THREE.Scene();
    const mobile = isMobileGraphics();
    scene.background = new THREE.Color(0x9fd8ff);
    // Fog is fill-rate heavy on phones; keep a shorter band or skip it.
    scene.fog = mobile ? null : new THREE.Fog(0x9fd8ff, 28, 62);
    this.camera = new THREE.PerspectiveCamera(innerHeight > innerWidth ? 50 : 45, innerWidth / innerHeight, 0.1, 160);
    this.sun = addLights(scene, 24);
    this.buildArena();

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.combatEffects = [];
    this.effectPool = { blast:[], chain:[] };
    this.gemPool = new Map();
    this.pendingSpawns = 0;
    this.enemyGrid = new Map();
    this.enemyGridPool = [];
    this.elapsed = 0;
    this.kills = 0;
    this.gems = 0;
    this.level = 1;
    this.xp = 0;
    this.pendingLevels = 0;
    this.stageIndex = 0;
    this.spawnClock = 1.2;
    this.hintClock = 5;
    this.labelClock = 0;
    this.hudCache = {};
    this.needsRender = true;
    this.currentIntro = null;
    this.introRemaining = 0;
    this.upgradeLevels = {};
    this.power = {
      damage:1, interval:0.72, multi:1, pierce:0, size:1,
      magnet:1, range:BASE_ATTACK_RANGE, attackClock:0.4, armor:1,
      chain:0, blast:0, freeze:0,
    };

    const heroEntry = byId[selection.hero] || byId.Knight;
    onProgress(0.25, `Đang tải ${heroEntry.name}`);
    const heroModel = await spawnModel(heroEntry);
    if (runId !== this.runId) return;
    this.hero = this.makeUnit(heroEntry, heroModel, { ...heroEntry.stats, team:'hero', speed:heroEntry.stats.speed * 1.18 });
    this.hero.hp = this.hero.maxHp = Math.max(150, heroEntry.stats.hp);
    this.hero.invulnerable = 0;
    this.hero.anim.play('idle');
    scene.add(this.hero.root);
    this.updateRangeRing();
    this.updateMagnetRing();

    onProgress(0.52, 'Đang tải quái');
    await Promise.all(['Enemy','Rat','Skeleton_Minion'].map(id => spawnModel(byId[id])));
    if (runId !== this.runId) return;

    onProgress(0.68, 'Đang nạp cầu lửa');
    const fireball = await spawnModel(FIREBALL_ENTRY, FIREBALL_ENTRY.height);
    if (runId !== this.runId) return;
    this.prepareFireball(fireball.root);

    onProgress(0.82, 'Chuẩn bị chiến đấu');
    await Promise.all([this.spawnEnemy('sprout'), this.spawnEnemy('sprout')]);
    if (runId !== this.runId) return;

    this.camera.position.set(0, 13, 10);
    this.camera.lookAt(0, 0.6, 0);
    this.state = 'playing';
    this.ui.hud.classList.remove('hidden');
    this.ui.modal.classList.add('hidden');
    this.updateHud();
    onProgress(1, 'Sẵn sàng!');
  }

  buildArena() {
    const world = this.world = new THREE.Group();
    this.scene.add(world);
    const mobile = isMobileGraphics();
    const segs = mobile ? 48 : 72;
    const FloorMat = mobile ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA + 11, segs),
      new FloorMat({ color:0x79c968 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    world.add(grass);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA, segs),
      new FloorMat({ color:0x98d77d })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.006;
    floor.receiveShadow = true;
    world.add(floor);

    const center = new THREE.Mesh(
      new THREE.RingGeometry(3.8, 4.15, mobile ? 32 : 48),
      new THREE.MeshBasicMaterial({ color:0xe8d6a7, transparent:true, opacity:0.65 })
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.018;
    world.add(center);

    const treeCount = mobile ? 28 : 58;
    for (let i = 0; i < treeCount; i++) {
      const a = i / treeCount * Math.PI * 2 + Math.random() * 0.04;
      const r = ARENA + 2.5 + Math.random() * 7;
      const tree = makeTree(0.85 + Math.random() * 0.9);
      tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      tree.rotation.y = Math.random() * Math.PI * 2;
      world.add(tree);
    }
    const rockCount = mobile ? 12 : 22;
    for (let i = 0; i < rockCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 7 + Math.random() * (ARENA - 9);
      const rock = makeRock(0.5 + Math.random() * 0.8);
      rock.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      world.add(rock);
    }
    const flowerCount = mobile ? 36 : 150;
    for (let i = 0; i < flowerCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ARENA - 1);
      const flower = makeFlower();
      flower.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      world.add(flower);
    }
  }

  makeUnit(entry, { root, model, clips }, stats) {
    const anim = new Animator(model, clips, entry.anims);
    const radius = Math.max(root.userData.radius, 0.34);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.84, radius * 1.08, 24),
      new THREE.MeshBasicMaterial({ color:stats.team === 'hero' ? 0x60a5fa : 0xf87171, transparent:true, opacity:0.65 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    root.add(ring);
    return { entry, root, model, anim, ring, radius, ...stats, hp:stats.hp || 1, maxHp:stats.hp || 1, dead:false };
  }

  prepareFireball(root) {
    this.fireballMaterials = new Set();
    this.fireballGeometries = new Set();
    root.traverse(object => {
      if (!object.isMesh) return;
      const materials = [].concat(object.material).map(material => {
        const clone = material.clone();
        clone.emissive?.set(0xff4d00);
        if (clone.emissiveIntensity !== undefined) clone.emissiveIntensity = 2.2;
        this.fireballMaterials.add(clone);
        return clone;
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];
      object.castShadow = false;
    });
    const trail = [
      { radius:0.16, y:0.34, color:0xfff1a8, opacity:0.92 },
      { radius:0.13, y:0.02, color:0xff8a1f, opacity:0.72 },
      { radius:0.09, y:-0.20, color:0xef3b0a, opacity:0.5 },
    ];
    for (const part of trail) {
      const geometry = new THREE.SphereGeometry(part.radius, 8, 6);
      const material = new THREE.MeshBasicMaterial({
        color:part.color, transparent:true, opacity:part.opacity,
        depthWrite:false, blending:THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = part.y;
      root.add(mesh);
      this.fireballGeometries.add(geometry);
      this.fireballMaterials.add(material);
    }
    root.position.y = -FIREBALL_ENTRY.height * 0.5;
    const template = new THREE.Group();
    template.add(root);
    this.fireballTemplate = template;
  }

  updateRangeRing() {
    if (!this.hero) return;
    if (this.hero.rangeRing) {
      this.hero.root.remove(this.hero.rangeRing);
      this.hero.rangeRing.geometry.dispose();
    }
    const rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.1, this.power.range - 0.055), this.power.range + 0.055, 72),
      this.hero.rangeRing?.material || new THREE.MeshBasicMaterial({ color:0xdbeafe, transparent:true, opacity:0.2, depthWrite:false })
    );
    rangeRing.rotation.x = -Math.PI / 2;
    rangeRing.position.y = 0.035;
    this.hero.root.add(rangeRing);
    this.hero.rangeRing = rangeRing;
    this.updateCameraFov();
  }

  updateMagnetRing() {
    if (!this.hero) return;
    if (this.hero.magnetRing) {
      this.hero.root.remove(this.hero.magnetRing);
      this.hero.magnetRing.geometry.dispose();
    }
    const radius = 2.2 * this.power.magnet;
    const magnetRing = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.1, radius - 0.045), radius + 0.045, 64),
      this.hero.magnetRing?.material || new THREE.MeshBasicMaterial({ color:0xc084fc, transparent:true, opacity:0.38, depthWrite:false })
    );
    magnetRing.rotation.x = -Math.PI / 2;
    magnetRing.position.y = 0.042;
    this.hero.root.add(magnetRing);
    this.hero.magnetRing = magnetRing;
  }

  updateCameraFov() {
    if (!this.camera || !this.power) return;
    const baseFov = innerHeight > innerWidth ? 50 : 45;
    const rangeRatio = Math.max(1, this.power.range / BASE_ATTACK_RANGE);
    this.camera.fov = baseFov + Math.min(16, (rangeRatio - 1) * 16);
    this.camera.updateProjectionMatrix();
  }

  variantStats(variant, stageIndex = this.stageIndex) {
    const cycle = Math.floor(stageIndex / STAGES.length);
    const scale = 1 + stageIndex * 0.055 + cycle * 0.12;
    return {
      hp:Math.round(variant.hp * scale),
      defense:variant.defense + Math.floor(stageIndex / 4),
      speed:Math.min(variant.speed * (1 + stageIndex * 0.012), 4.2),
      dmg:Math.round(variant.dmg * (1 + stageIndex * 0.06)),
    };
  }

  async spawnEnemy(variantId) {
    const alive = this.enemies.filter(e => !e.dead).length;
    if (!this.scene || alive + this.pendingSpawns >= ENEMY_CAP) return;
    this.pendingSpawns++;
    const runId = this.runId;
    const variant = ENEMY_VARIANTS[variantId] || ENEMY_VARIANTS.sprout;
    const entry = byId[variant.entryId] || byId.Enemy;
    let model;
    try {
      model = await spawnModel(entry);
    } finally {
      this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
    }
    if (runId !== this.runId || !this.scene || this.enemies.filter(e => !e.dead).length >= ENEMY_CAP) return;
    const stats = this.variantStats(variant);
    const enemy = this.makeUnit(entry, model, {
      ...entry.stats,
      team:'enemy',
      hp:stats.hp,
      speed:stats.speed,
      dmg:stats.dmg,
    });
    enemy.maxHp = enemy.hp;
    enemy.variant = variant;
    enemy.variantId = variantId;
    enemy.defense = stats.defense;
    enemy.gem = variant.gem;
    enemy.visualScale = variant.scale;
    enemy.radius *= variant.scale;
    enemy.spawn = 0;
    enemy.hitFlash = 0;
    enemy.slowT = 0;
    enemy.slowFactor = 1;
    enemy.paralyzeT = 0;
    const heroPos = this.hero?.root.position || tmp.set(0,0,0);
    let placed = false;
    for (let attempt = 0; attempt < 16; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = 15 + Math.random() * 5;
      enemy.root.position.set(heroPos.x + Math.cos(a) * r, 0, heroPos.z + Math.sin(a) * r);
      if (enemy.root.position.length() <= ARENA - 1) { placed = true; break; }
    }
    if (!placed) {
      tmp2.set(-heroPos.x, 0, -heroPos.z);
      if (tmp2.lengthSq() < 0.01) tmp2.set(1, 0, 0);
      tmp2.setLength(15);
      enemy.root.position.copy(heroPos).add(tmp2);
    }
    enemy.root.scale.setScalar(0.01);
    enemy.anim.play('run');
    this.scene.add(enemy.root);
    this.enemies.push(enemy);
  }

  update(dt) {
    if (!this.scene || !this.hero) return;
    dt = Math.min(dt, 0.05);
    if (this.state === 'playing') {
      this.elapsed += dt;
      this.updateHero(dt);
      this.updateSpawner(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateCombatEffects(dt);
      this.updatePickups(dt);
      this.updateEnemyIntro(dt);
      this.updateCamera(dt);
      this.hintClock -= dt;
      if (this.hintClock <= 0) this.ui.hint.style.opacity = '0';
      this.updateHud();
      this.labelClock += dt;
      if (this.labelClock >= 0.07) {
        this.labelClock = 0;
        this.updateEnemyLabels();
      }
      this.needsRender = true;
    }
    if (this.state !== 'levelup' && this.state !== 'paused') {
      this.hero.anim.update(dt);
      for (const enemy of this.enemies) enemy.anim.update(dt);
    }
  }

  updateHero(dt) {
    const hero = this.hero;
    hero.invulnerable = Math.max(0, hero.invulnerable - dt);
    this.power.attackClock -= dt;

    let x = this.moveInput.x;
    let z = this.moveInput.y;
    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    const length = Math.hypot(x, z);
    if (length > 0.08) {
      x /= Math.max(1, length);
      z /= Math.max(1, length);
      hero.root.position.x += x * hero.speed * dt;
      hero.root.position.z += z * hero.speed * dt;
      this.faceTo(hero, hero.root.position.x + x, hero.root.position.z + z, dt, 16);
      hero.anim.play('run');
      if (hero.root.position.length() > ARENA - 0.8) hero.root.position.setLength(ARENA - 0.8);
    } else if (hero.anim.currentKey === 'run') {
      hero.anim.play('idle');
    }

    while (this.power.attackClock <= 0) {
      this.power.attackClock += this.power.interval;
      this.autoAttack();
    }
  }

  autoAttack() {
    const rangeSq = this.power.range * this.power.range;
    const alive = this.enemies.filter(enemy =>
      !enemy.dead && enemy.root.position.distanceToSquared(this.hero.root.position) <= rangeSq
    );
    if (!alive.length) return;
    alive.sort((a,b) => a.root.position.distanceToSquared(this.hero.root.position) - b.root.position.distanceToSquared(this.hero.root.position));
    const targets = alive.slice(0, Math.min(this.power.multi, alive.length));
    this.hero.anim.play('attack', { once:true, speed:1.45, onDone:() => {
      if (this.state === 'playing') this.hero.anim.play(this.moveInput.lengthSq() > 0.02 ? 'run' : 'idle');
    }});
    for (const target of targets) this.makeProjectile(target);
  }

  makeProjectile(target) {
    const radius = 0.24 * this.power.size;
    const mesh = this.fireballTemplate.clone(true);
    mesh.position.copy(this.hero.root.position);
    mesh.position.y = 0.85;
    tmp.copy(target.root.position).sub(this.hero.root.position);
    tmp.y = 0;
    if (tmp.lengthSq() < 0.001) tmp.set(0, 0, -1);
    tmp.normalize();
    mesh.quaternion.setFromUnitVectors(Y_AXIS, tmp);
    mesh.scale.setScalar(this.power.size);
    this.scene.add(mesh);
    const speed = 14;
    const curveSign = Math.random() < 0.5 ? -1 : 1;
    this.projectiles.push({
      mesh,
      velocity:tmp.clone().multiplyScalar(speed),
      curve:new THREE.Vector3(-tmp.z * curveSign, 0, tmp.x * curveSign).multiplyScalar(1.1),
      speed,
      distance:0,
      maxDistance:this.power.range,
      damage:this.hero.dmg * this.power.damage,
      hits:new Set(), remaining:this.power.pierce,
      secondaryHits:new Set(),
      radius:radius + 0.18,
      age:Math.random() * Math.PI * 2,
      visualScale:this.power.size,
    });
  }

  updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      const travel = projectile.speed * dt;
      const steps = Math.max(1, Math.ceil(travel / 0.32));
      const stepDt = dt / steps;
      for (let step = 0; step < steps && !projectile.removed; step++) {
        projectile.age += stepDt * 12;
        projectile.velocity.addScaledVector(projectile.curve, stepDt);
        tmp.copy(projectile.velocity).multiplyScalar(stepDt);
        const remainingDistance = projectile.maxDistance - projectile.distance;
        if (remainingDistance <= 0) {
          this.removeProjectile(projectile);
          break;
        }
        if (tmp.length() > remainingDistance) tmp.setLength(remainingDistance);
        projectile.mesh.position.add(tmp);
        projectile.distance += tmp.length();
        tmp2.copy(projectile.velocity).normalize();
        projectile.mesh.quaternion.setFromUnitVectors(Y_AXIS, tmp2);
        projectile.mesh.scale.setScalar(projectile.visualScale * (1 + Math.sin(projectile.age) * 0.07));

        for (const enemy of this.enemies) {
          if (enemy.dead || projectile.hits.has(enemy)) continue;
          const dx = enemy.root.position.x - projectile.mesh.position.x;
          const dz = enemy.root.position.z - projectile.mesh.position.z;
          const hitRadius = enemy.radius + projectile.radius;
          if (dx * dx + dz * dz > hitRadius * hitRadius) continue;
          this.hitEnemy(enemy, projectile.damage);
          this.applyProjectileEffects(enemy, projectile.damage, projectile);
          projectile.hits.add(enemy);
          if (projectile.remaining > 0) projectile.remaining--;
          else this.removeProjectile(projectile);
          break;
        }
        if (projectile.distance >= projectile.maxDistance) this.removeProjectile(projectile);
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.removed);
  }

  removeProjectile(projectile) {
    if (projectile.removed) return;
    projectile.removed = true;
    this.scene.remove(projectile.mesh);
  }

  applyProjectileEffects(primary, damage, projectile) {
    const P = this.power;
    const origin = primary.root.position.clone();
    projectile.secondaryHits.add(primary);

    if (P.freeze > 0 && !primary.dead) {
      primary.slowT = Math.max(primary.slowT, 1.4 + P.freeze * 0.35);
      primary.slowFactor = Math.min(primary.slowFactor, Math.max(0.38, 0.82 - P.freeze * 0.1));
      if (Math.random() < 0.06 + P.freeze * 0.04) {
        primary.paralyzeT = Math.max(primary.paralyzeT, 0.45 + P.freeze * 0.1);
      }
    }

    if (P.blast > 0) {
      const radius = 1.2 + P.blast * 0.35;
      const splashDamage = damage * (0.25 + P.blast * 0.05);
      for (const enemy of this.enemies) {
        if (enemy.dead || projectile.secondaryHits.has(enemy)) continue;
        if (enemy.root.position.distanceToSquared(origin) <= radius * radius) {
          projectile.secondaryHits.add(enemy);
          this.hitEnemy(enemy, splashDamage);
        }
      }
      this.addBlastEffect(origin, radius);
    }

    if (P.chain > 0) {
      const used = projectile.secondaryHits;
      const chainRange = 4.1 + P.chain * 0.35;
      const chainDamage = damage * (0.3 + P.chain * 0.04);
      let from = primary;
      for (let jump = 0; jump < P.chain; jump++) {
        let target = null, best = chainRange * chainRange;
        for (const enemy of this.enemies) {
          if (enemy.dead || used.has(enemy)) continue;
          const distance = enemy.root.position.distanceToSquared(from.root.position);
          if (distance < best) { best = distance; target = enemy; }
        }
        if (!target) break;
        this.addChainEffect(from.root.position, target.root.position);
        used.add(target);
        this.hitEnemy(target, chainDamage);
        from = target;
      }
    }
  }

  addBlastEffect(position, radius) {
    if (this.combatEffects.length >= 28) return;
    let mesh = this.effectPool.blast.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.72, 1, 40),
        new THREE.MeshBasicMaterial({ color:0xff8a1f, transparent:true, opacity:0.72, depthWrite:false, side:THREE.DoubleSide })
      );
      mesh.rotation.x = -Math.PI / 2;
    }
    mesh.position.copy(position);
    mesh.position.y = 0.06;
    mesh.scale.setScalar(radius * 0.35);
    mesh.material.opacity = 0.72;
    this.scene.add(mesh);
    this.combatEffects.push({ mesh, t:0, life:0.28, kind:'blast', radius });
  }

  addChainEffect(from, to) {
    if (this.combatEffects.length >= 28) return;
    let mesh = this.effectPool.chain.pop();
    if (!mesh) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      mesh = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color:0x67e8f9, transparent:true, opacity:0.95, depthWrite:false })
      );
    }
    const positions = mesh.geometry.attributes.position.array;
    positions[0] = from.x; positions[1] = 0.7; positions[2] = from.z;
    positions[3] = (from.x + to.x) * 0.5 + (Math.random() - 0.5) * 0.35;
    positions[4] = 0.82;
    positions[5] = (from.z + to.z) * 0.5 + (Math.random() - 0.5) * 0.35;
    positions[6] = to.x; positions[7] = 0.7; positions[8] = to.z;
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
    mesh.material.opacity = 0.95;
    this.scene.add(mesh);
    this.combatEffects.push({ mesh, t:0, life:0.16, kind:'chain' });
  }

  updateCombatEffects(dt) {
    for (const effect of this.combatEffects) {
      effect.t += dt;
      const progress = Math.min(1, effect.t / effect.life);
      effect.mesh.material.opacity = 1 - progress;
      if (effect.kind === 'blast') effect.mesh.scale.setScalar(effect.radius * (0.35 + progress * 0.8));
      if (progress < 1) continue;
      this.scene.remove(effect.mesh);
      this.effectPool[effect.kind].push(effect.mesh);
      effect.dead = true;
    }
    this.combatEffects = this.combatEffects.filter(effect => !effect.dead);
  }

  showEnemyIntro(variantId, duration = 5, stageNumber = this.stageIndex + 1) {
    const variant = ENEMY_VARIANTS[variantId];
    if (!variant || !this.ui.enemyIntro) return;
    this.currentIntro = { variantId, stageNumber };
    this.introRemaining = duration;
    const stats = this.variantStats(variant);
    this.ui.enemyIntro.innerHTML = `
      <div class="enemy-head">
        <span class="enemy-icon">${variant.icon}</span>
        <span class="enemy-title"><small>QUÁI MỚI · MÀN ${stageNumber}</small><b>${variant.name}</b></span>
      </div>
      <div class="enemy-stats">
        <span>♥ ${stats.hp} máu</span>
        <span>⬟ ${stats.defense} giáp</span>
        <span>➜ ${stats.speed.toFixed(1)} tốc</span>
      </div>`;
    this.ui.enemyIntro.className = 'show';
    void this.ui.enemyIntro.offsetWidth;
  }

  showCurrentStageIntro() {
    const stage = STAGES[Math.min(this.stageIndex, STAGES.length - 1)];
    this.showEnemyIntro(stage.featured, 5, this.stageIndex + 1);
  }

  updateEnemyIntro(dt) {
    if (!this.currentIntro || this.state !== 'playing') return;
    this.introRemaining -= dt;
    if (this.introRemaining > 0) return;
    this.currentIntro = null;
    this.introRemaining = 0;
    this.ui.enemyIntro.className = 'hidden';
  }

  updateSpawner(dt) {
    const nextStage = Math.floor(this.elapsed / STAGE_DURATION);
    if (nextStage !== this.stageIndex) {
      this.stageIndex = nextStage;
      if (this.stageIndex < STAGES.length) this.showEnemyIntro(STAGES[this.stageIndex].featured, 5, this.stageIndex + 1);
      this.toast(`Màn ${this.stageIndex + 1}`);
    }
    this.spawnClock -= dt;
    if (this.spawnClock > 0) return;
    const stage = STAGES[Math.min(this.stageIndex, STAGES.length - 1)];
    const cycle = Math.floor(this.stageIndex / STAGES.length);
    this.spawnClock = Math.max(0.68, stage.interval - cycle * 0.08);
    const alive = this.enemies.filter(enemy => !enemy.dead).length + this.pendingSpawns;
    const cap = Math.min(ENEMY_CAP, stage.cap + cycle * 7);
    if (alive >= cap) return;
    const pack = Math.min(5, stage.pack + cycle);
    const count = Math.min(pack, cap - alive);
    for (let i = 0; i < count; i++) {
      const variantId = stage.pool[Math.floor(Math.random() * stage.pool.length)];
      this.spawnEnemy(variantId);
    }
  }

  rebuildEnemyGrid() {
    for (const bucket of this.enemyGrid.values()) {
      bucket.length = 0;
      this.enemyGridPool.push(bucket);
    }
    this.enemyGrid.clear();
    const cellSize = 1.6;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const p = enemy.root.position;
      const gx = Math.floor(p.x / cellSize);
      const gz = Math.floor(p.z / cellSize);
      const key = (gx + 64) * 256 + gz + 64;
      let bucket = this.enemyGrid.get(key);
      if (!bucket) {
        bucket = this.enemyGridPool.pop() || [];
        this.enemyGrid.set(key, bucket);
      }
      bucket.push(enemy);
      enemy.gridX = gx;
      enemy.gridZ = gz;
    }
  }

  updateEnemies(dt) {
    this.rebuildEnemyGrid();
    const heroPos = this.hero.root.position;
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        enemy.deadTime += dt;
        if (!enemy.anim.has('death')) enemy.root.scale.multiplyScalar(Math.max(0.8, 1 - dt * 4));
        if (enemy.deadTime > 0.72) {
          this.disposeUnit(enemy);
          enemy.removed = true;
        }
        continue;
      }
      if (enemy.spawn < 1) {
        enemy.spawn = Math.min(1, enemy.spawn + dt * 4);
        enemy.root.scale.setScalar(easeOutBack(enemy.spawn) * enemy.visualScale);
      }
      enemy.slowT = Math.max(0, enemy.slowT - dt);
      enemy.paralyzeT = Math.max(0, enemy.paralyzeT - dt);
      const status = enemy.paralyzeT > 0 ? 2 : enemy.slowT > 0 ? 1 : 0;
      if (status !== enemy.status) {
        enemy.status = status;
        enemy.ring.material.color.setHex(status === 2 ? 0xfde047 : status === 1 ? 0x38bdf8 : 0xf87171);
      }

      const pos = enemy.root.position;
      let dx = heroPos.x - pos.x;
      let dz = heroPos.z - pos.z;
      let distance = Math.max(0.001, Math.hypot(dx, dz));

      for (let gx = enemy.gridX - 1; gx <= enemy.gridX + 1; gx++) {
        for (let gz = enemy.gridZ - 1; gz <= enemy.gridZ + 1; gz++) {
          const bucket = this.enemyGrid.get((gx + 64) * 256 + gz + 64);
          if (!bucket) continue;
          for (const other of bucket) {
            if (other === enemy || other.dead) continue;
            const ox = pos.x - other.root.position.x;
            const oz = pos.z - other.root.position.z;
            const od = Math.hypot(ox, oz);
            const minimum = (enemy.radius + other.radius) * 0.72;
            if (od > 0.001 && od < minimum) {
              pos.x += ox / od * (minimum - od) * 0.18;
              pos.z += oz / od * (minimum - od) * 0.18;
            }
          }
        }
      }

      dx = heroPos.x - pos.x;
      dz = heroPos.z - pos.z;
      distance = Math.max(0.001, Math.hypot(dx, dz));
      const moveScale = enemy.paralyzeT > 0 ? 0 : enemy.slowT > 0 ? enemy.slowFactor : 1;
      pos.x += dx / distance * enemy.speed * moveScale * dt;
      pos.z += dz / distance * enemy.speed * moveScale * dt;
      this.faceTo(enemy, heroPos.x, heroPos.z, dt);
      enemy.anim.play(moveScale > 0 ? 'run' : 'idle');

      if (distance < this.hero.radius + enemy.radius + 0.12 && this.hero.invulnerable <= 0) {
        this.damageHero(enemy.dmg, dx / distance, dz / distance);
      }
    }
    this.enemies = this.enemies.filter(enemy => !enemy.removed);
  }

  faceTo(unit, x, z, dt, speed = 12) {
    const wanted = Math.atan2(x - unit.root.position.x, z - unit.root.position.z);
    const delta = Math.atan2(Math.sin(wanted - unit.root.rotation.y), Math.cos(wanted - unit.root.rotation.y));
    unit.root.rotation.y += delta * Math.min(1, dt * speed);
  }

  ensureEnemyHealth(enemy) {
    if (enemy.healthLabel) return enemy.healthLabel;
    const label = document.createElement('div');
    label.className = 'enemy-hp';
    label.innerHTML = '<i></i><b></b>';
    this.ui.enemyLabels.appendChild(label);
    enemy.healthLabel = label;
    enemy.healthFill = label.querySelector('i');
    enemy.healthText = label.querySelector('b');
    return label;
  }

  updateEnemyHealth(enemy) {
    if (!enemy.healthLabel) return;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.healthFill.style.transform = `scaleX(${ratio})`;
    enemy.healthText.textContent = `${Math.ceil(Math.max(0, enemy.hp))}`;
  }

  updateEnemyLabels() {
    const width = innerWidth, height = innerHeight;
    for (const enemy of this.enemies) {
      const label = enemy.healthLabel;
      if (!label || enemy.dead) continue;
      tmp.copy(enemy.root.position);
      tmp.y = enemy.root.userData.height * enemy.visualScale + 0.28;
      tmp.project(this.camera);
      const visible = tmp.z > -1 && tmp.z < 1 && Math.abs(tmp.x) < 1.12 && Math.abs(tmp.y) < 1.12;
      if (visible !== enemy.healthLabelVisible) {
        enemy.healthLabelVisible = visible;
        label.style.display = visible ? '' : 'none';
      }
      if (!visible) continue;
      const x = Math.round((tmp.x * 0.5 + 0.5) * width);
      const y = Math.round((-tmp.y * 0.5 + 0.5) * height);
      label.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    }
  }

  hitEnemy(enemy, amount) {
    if (enemy.dead) return;
    enemy.hp -= Math.max(1, amount - enemy.defense);
    if (enemy.hp > 0) {
      this.ensureEnemyHealth(enemy);
      this.updateEnemyHealth(enemy);
    }
    if (enemy.hp <= 0) {
      enemy.healthLabel?.remove();
      enemy.healthLabel = null;
      enemy.healthFill = null;
      enemy.healthText = null;
      enemy.dead = true;
      enemy.deadTime = 0;
      enemy.anim.play('death', { once:true, clamp:true });
      this.kills++;
      this.spawnGem(enemy.root.position, enemy.gem);
    }
  }

  damageHero(amount, dx, dz) {
    const damage = Math.max(1, Math.round(amount * this.power.armor));
    this.hero.hp -= damage;
    this.hero.invulnerable = 0.62;
    this.hero.root.position.x += dx * 0.85;
    this.hero.root.position.z += dz * 0.85;
    if (this.hero.root.position.length() > ARENA - 0.8) this.hero.root.position.setLength(ARENA - 0.8);
    this.hero.anim.play('hit', { once:true, speed:1.5, onDone:() => !this.hero.dead && this.hero.anim.play('idle') });
    this.ui.damageFlash.classList.remove('on');
    void this.ui.damageFlash.offsetWidth;
    this.ui.damageFlash.classList.add('on');
    if (this.hero.hp <= 0) this.gameOver();
  }

  spawnGem(position, value) {
    const tier = GEM_TIERS.find(item => value >= item.min) || GEM_TIERS[GEM_TIERS.length - 1];
    const key = `${tier.min}:${tier.size}:${tier.color}`;
    let pool = this.gemPool.get(key);
    if (!pool) {
      pool = [];
      this.gemPool.set(key, pool);
    }
    let mesh = pool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(tier.size, 0),
        new THREE.MeshBasicMaterial({ color:tier.color, toneMapped:false })
      );
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.rotation.z = Math.PI / 4;
    }
    mesh.visible = true;
    mesh.position.copy(position);
    mesh.position.y = 0.3;
    mesh.scale.setScalar(1);
    this.scene.add(mesh);
    this.pickups.push({ mesh, value, tier, poolKey:key, age:0, phase:Math.random() * 6, collected:false });
  }

  updatePickups(dt) {
    const heroPos = this.hero.root.position;
    for (const pickup of this.pickups) {
      pickup.age += dt;
      pickup.phase += dt * 3;
      pickup.mesh.rotation.y += dt * 3;
      pickup.mesh.position.y = 0.3 + Math.sin(pickup.phase) * 0.08;
      pickup.mesh.scale.setScalar(1 + Math.sin(pickup.phase * 1.3) * pickup.tier.pulse);
      const dx = pickup.mesh.position.x - heroPos.x;
      const dz = pickup.mesh.position.z - heroPos.z;
      const distanceSq = dx * dx + dz * dz;
      const magnet = 2.2 * this.power.magnet;
      if (distanceSq < magnet * magnet) {
        const distance = Math.sqrt(distanceSq) || 0.001;
        pickup.mesh.position.lerp(tmp2.set(heroPos.x, 0.7, heroPos.z), Math.min(1, dt * (3 + magnet / distance)));
      }
      if (distanceSq < (this.hero.radius + 0.45) ** 2 || pickup.age > 45) this.collectGem(pickup);
    }
    this.pickups = this.pickups.filter(pickup => !pickup.collected);
  }

  releaseGem(pickup) {
    if (!pickup?.mesh) return;
    this.scene?.remove(pickup.mesh);
    pickup.mesh.visible = false;
    const pool = this.gemPool?.get(pickup.poolKey);
    if (pool) pool.push(pickup.mesh);
    else {
      pickup.mesh.geometry.dispose();
      pickup.mesh.material.dispose();
    }
  }

  collectGem(pickup) {
    if (pickup.collected) return;
    pickup.collected = true;
    this.releaseGem(pickup);
    this.gems += pickup.value;
    this.xp += pickup.value;
    while (this.xp >= this.xpNeeded()) {
      this.xp -= this.xpNeeded();
      this.level++;
      this.pendingLevels++;
    }
    if (this.pendingLevels > 0 && this.state === 'playing') this.showLevelUp();
  }

  xpNeeded() {
    return 6 + (this.level - 1) * 7;
  }

  showLevelUp() {
    this.state = 'levelup';
    this.needsRender = true;
    this.clearMovement();
    const available = UPGRADES.filter(card => (this.upgradeLevels[card.id] || 0) < card.max);
    if (!available.length) {
      this.power.damage *= 1.1;
      this.pendingLevels--;
      this.toast('⚔ Sức mạnh vô hạn +10%');
      if (this.pendingLevels > 0) this.showLevelUp();
      else {
        this.state = 'playing';
      }
      return;
    }
    this.hand = shuffle([...available]).slice(0, 3);
    this.ui.modal.innerHTML = `
      <div class="box">
        <h2>✨ Lên cấp ${this.level}!</h2>
        <p>Chọn một sức mạnh mới</p>
        <div class="cards">${this.hand.map((card, i) => `
          <button class="card" data-card="${i}">
            <span class="icon">${card.icon}</span><b>${card.name}</b>
            <small>${card.desc}</small>
            <em>Cấp ${(this.upgradeLevels[card.id] || 0) + 1}/${card.max}</em>
          </button>`).join('')}
        </div>
        <p>Phím 1 · 2 · 3</p>
      </div>`;
    this.ui.modal.classList.remove('hidden');
    this.ui.modal.querySelectorAll('[data-card]').forEach(button => {
      button.onclick = () => this.chooseUpgrade(Number(button.dataset.card));
    });
  }

  chooseUpgrade(index) {
    if (this.state !== 'levelup') return;
    const card = this.hand[index];
    if (!card) return;
    this.upgradeLevels[card.id] = (this.upgradeLevels[card.id] || 0) + 1;
    card.apply(this);
    this.pendingLevels--;
    this.ui.modal.classList.add('hidden');
    this.toast(`${card.icon} ${card.name} cấp ${this.upgradeLevels[card.id]}`);
    if (this.pendingLevels > 0) this.showLevelUp();
    else {
      this.state = 'playing';
    }
    this.updateHud();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.clearMovement();
      this.ui.modal.innerHTML = `<div class="box"><h2>Tạm dừng</h2><p>Trận đấu đang được đóng băng.</p><div class="actions"><button id="resume">Tiếp tục</button><a class="alt" href="index.html">Về sảnh</a></div></div>`;
      this.ui.modal.classList.remove('hidden');
      this.ui.modal.querySelector('#resume').onclick = () => this.togglePause();
      bindLobbyLinks(this.ui.modal);
      this.needsRender = true;
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.ui.modal.classList.add('hidden');
      this.needsRender = true;
    }
  }

  gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.needsRender = true;
    this.hero.dead = true;
    this.hero.hp = 0;
    this.hero.anim.play('death', { once:true, clamp:true });
    const seconds = Math.floor(this.elapsed);
    const best = Math.max(seconds, Number(localStorage.getItem('cute3d.survivor.bestTime') || 0));
    localStorage.setItem('cute3d.survivor.bestTime', String(best));
    localStorage.setItem('cute3d.survivor.bestKills', String(Math.max(this.kills, Number(localStorage.getItem('cute3d.survivor.bestKills') || 0))));
    setTimeout(() => {
      if (this.state !== 'over') return;
      this.ui.modal.innerHTML = `
        <div class="box">
          <h1>Trận đấu kết thúc</h1>
          <p>Đàn quái đã áp đảo anh hùng.</p>
          <div class="summary">
            <span>⏱ ${this.formatTime(seconds)}</span>
            <span>☠ ${this.kills} quái</span>
            <span>⬆ Cấp ${this.level}</span>
            <span>★ Kỷ lục ${this.formatTime(best)}</span>
          </div>
          <div class="actions"><button id="restart">Chơi lại</button><a class="alt" href="index.html">Về sảnh</a></div>
        </div>`;
      this.ui.modal.classList.remove('hidden');
      this.ui.modal.querySelector('#restart').onclick = () => this.restart();
      bindLobbyLinks(this.ui.modal);
    }, 650);
  }

  async restart() {
    this.ui.modal.classList.add('hidden');
    this.ui.loading.classList.remove('hidden');
    try {
      await this.start((progress, text) => {
        this.ui.loadFill.style.width = `${Math.round(progress * 100)}%`;
        this.ui.loadText.textContent = text;
      });
      this.ui.loading.classList.add('hidden');
      requestAnimationFrame(() => this.showCurrentStageIntro());
    } catch (error) {
      console.error(error);
      this.ui.loading.innerHTML = `
        <div class="box">
          <h2>Không thể bắt đầu lại</h2>
          <p>Hãy kiểm tra kết nối mạng rồi thử lại.</p>
          <div class="actions"><button id="retry">Tải lại</button><a class="alt" href="index.html">Về sảnh</a></div>
        </div>`;
      this.ui.loading.querySelector('#retry').onclick = () => location.reload();
      bindLobbyLinks(this.ui.loading);
    }
  }

  updateCamera(dt) {
    const pos = this.hero.root.position;
    const portrait = innerHeight > innerWidth;
    const rangeRatio = Math.max(1, this.power.range / BASE_ATTACK_RANGE);
    const aspect = innerWidth / Math.max(1, innerHeight);
    const narrowPhoneScale = portrait ? Math.max(1, 0.47 / aspect) : 1;
    // Camera lùi theo đúng tầm bắn và bù thêm cho điện thoại rất dài/hẹp.
    const viewScale = 1.38 * rangeRatio * narrowPhoneScale;
    const height = (portrait ? 17 : 13) * viewScale;
    const offset = (portrait ? 12.5 : 10) * viewScale;
    tmp.set(pos.x, height, pos.z + offset);
    this.camera.position.lerp(tmp, Math.min(1, dt * 5));
    this.camera.lookAt(this.camera.position.x, 0.55, this.camera.position.z - offset);
    // Keep the sun fixed — moving it every frame rebuilds the shadow map and heats phones.
  }

  updateHud() {
    const cache = this.hudCache || (this.hudCache = {});
    const hp = Math.ceil(Math.max(0, this.hero.hp));
    const maxHp = this.hero.maxHp;
    if (cache.hp !== hp || cache.maxHp !== maxHp) {
      cache.hp = hp;
      cache.maxHp = maxHp;
      this.ui.hpFill.style.width = `${Math.max(0, hp / maxHp) * 100}%`;
      this.ui.hpText.textContent = `${hp} / ${maxHp}`;
    }
    if (cache.name !== this.hero.entry.name) {
      cache.name = this.hero.entry.name;
      this.ui.heroName.textContent = cache.name;
    }
    const seconds = Math.floor(this.elapsed);
    if (cache.seconds !== seconds) {
      cache.seconds = seconds;
      this.ui.timer.textContent = this.formatTime(seconds);
    }
    if (cache.stage !== this.stageIndex) {
      cache.stage = this.stageIndex;
      this.ui.stage.textContent = `MÀN ${this.stageIndex + 1}`;
    }
    if (cache.kills !== this.kills) {
      cache.kills = this.kills;
      this.ui.kills.textContent = this.kills;
    }
    if (cache.gems !== this.gems) {
      cache.gems = this.gems;
      this.ui.gems.textContent = this.gems;
    }
    if (cache.level !== this.level) {
      cache.level = this.level;
      this.ui.level.textContent = `Cấp ${this.level}`;
    }
    const xpPct = Math.min(100, this.xp / this.xpNeeded() * 100);
    if (cache.xpPct !== xpPct) {
      cache.xpPct = xpPct;
      this.ui.xpFill.style.width = `${xpPct}%`;
    }
  }

  formatTime(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  }

  toast(text) {
    this.ui.toast.textContent = text;
    this.ui.toast.classList.remove('show');
    void this.ui.toast.offsetWidth;
    this.ui.toast.classList.add('show');
  }

  resize(width, height) {
    if (!this.camera) return;
    this.camera.aspect = width / height;
    this.updateCameraFov();
    this.updateEnemyLabels();
  }

  render() {
    if (!this.scene || !this.camera) return;
    if (!this.needsRender && this.state !== 'playing' && this.state !== 'loading') return;
    this.renderer.render(this.scene, this.camera);
    if (this.state !== 'playing' && this.state !== 'loading') this.needsRender = false;
  }

  disposeUnit(unit) {
    if (!unit || unit.disposed) return;
    unit.disposed = true;
    unit.healthLabel?.remove();
    unit.healthLabel = null;
    unit.healthFill = null;
    unit.healthText = null;
    this.scene?.remove(unit.root);
    if (unit.ring) {
      unit.root.remove(unit.ring);
      unit.ring.geometry.dispose();
      unit.ring.material.dispose();
    }
    if (unit.rangeRing) {
      unit.root.remove(unit.rangeRing);
      unit.rangeRing.geometry.dispose();
      unit.rangeRing.material.dispose();
    }
    if (unit.magnetRing) {
      unit.root.remove(unit.magnetRing);
      unit.magnetRing.geometry.dispose();
      unit.magnetRing.material.dispose();
    }
    const skeletons = new Set();
    unit.model?.traverse(object => {
      if (object.isSkinnedMesh && object.skeleton) skeletons.add(object.skeleton);
    });
    for (const skeleton of skeletons) skeleton.dispose();
  }

  cleanupScene() {
    if (!this.scene) return;
    this.currentIntro = null;
    this.introRemaining = 0;
    this.ui.enemyIntro?.classList.add('hidden');
    for (const projectile of this.projectiles || []) this.removeProjectile(projectile);
    for (const pickup of this.pickups || []) this.releaseGem(pickup);
    for (const pool of this.gemPool?.values?.() || []) {
      for (const mesh of pool) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
    this.gemPool?.clear?.();
    for (const effect of this.combatEffects || []) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      effect.mesh.material.dispose();
    }
    for (const pool of Object.values(this.effectPool || {})) {
      for (const mesh of pool) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
    this.disposeUnit(this.hero);
    for (const enemy of this.enemies || []) this.disposeUnit(enemy);
    for (const geometry of this.fireballGeometries || []) geometry.dispose();
    for (const material of this.fireballMaterials || []) material.dispose();
    this.fireballTemplate = null;
    this.fireballGeometries = null;
    this.fireballMaterials = null;
    if (this.world) {
      const geometries = new Set();
      const materials = new Set();
      this.world.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of [].concat(object.material || [])) if (material) materials.add(material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
    this.sun?.shadow.map?.dispose();
    this.scene.clear();
    if (this.ui.enemyLabels) this.ui.enemyLabels.textContent = '';
    this.scene = null;
    this.world = null;
    this.hero = null;
  }
}
