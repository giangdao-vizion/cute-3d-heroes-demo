import * as THREE from 'three';
import { byId } from '../catalog.js';
import { selection } from '../state.js';
import { spawnModel, Animator, addLights, makeTree, makeRock, makeFlower } from '../engine.js';

const ARENA = 27;
const ENEMY_CAP = 55;
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

const UPGRADES = [
  { id:'damage', icon:'⚔', name:'Sức mạnh', desc:'+25% sát thương', max:5, apply:g => { g.power.damage *= 1.25; } },
  { id:'speed', icon:'👟', name:'Nhanh chân', desc:'+12% tốc độ chạy', max:5, apply:g => { g.hero.speed *= 1.12; } },
  { id:'rate', icon:'✦', name:'Liên hoàn', desc:'+18% tốc độ tấn công', max:5, apply:g => { g.power.interval /= 1.18; } },
  { id:'multi', icon:'➹', name:'Đa mục tiêu', desc:'+1 tia đạn mỗi lượt', max:3, apply:g => { g.power.multi++; } },
  { id:'pierce', icon:'➤', name:'Xuyên phá', desc:'Đạn xuyên thêm 1 quái', max:3, apply:g => { g.power.pierce++; } },
  { id:'size', icon:'◉', name:'Đạn khổng lồ', desc:'+25% kích thước và vùng trúng', max:4, apply:g => { g.power.size *= 1.25; } },
  { id:'health', icon:'♥', name:'Sinh lực', desc:'+30 máu tối đa và hồi đầy', max:5, apply:g => { g.hero.maxHp += 30; g.hero.hp = g.hero.maxHp; } },
  { id:'magnet', icon:'◆', name:'Nam châm', desc:'+35% phạm vi hút ngọc', max:4, apply:g => { g.power.magnet *= 1.35; } },
  { id:'armor', icon:'⬟', name:'Giáp hộ mệnh', desc:'Giảm 12% sát thương nhận', max:4, apply:g => { g.power.armor *= 0.88; } },
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
    scene.background = new THREE.Color(0x9fd8ff);
    scene.fog = new THREE.Fog(0x9fd8ff, 28, 62);
    this.camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 160);
    this.sun = addLights(scene, 24);
    this.buildArena();

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.elapsed = 0;
    this.kills = 0;
    this.gems = 0;
    this.level = 1;
    this.xp = 0;
    this.pendingLevels = 0;
    this.spawnClock = 0.8;
    this.hintClock = 5;
    this.upgradeLevels = {};
    this.power = { damage:1, interval:0.72, multi:1, pierce:0, size:1, magnet:1, attackClock:0.4, armor:1 };

    const heroEntry = byId[selection.hero] || byId.Knight;
    onProgress(0.25, `Đang tải ${heroEntry.name}`);
    const heroModel = await spawnModel(heroEntry);
    if (runId !== this.runId) return;
    this.hero = this.makeUnit(heroEntry, heroModel, { ...heroEntry.stats, team:'hero', speed:heroEntry.stats.speed * 1.18 });
    this.hero.hp = this.hero.maxHp = Math.max(150, heroEntry.stats.hp);
    this.hero.invulnerable = 0;
    this.hero.anim.play('idle');
    scene.add(this.hero.root);

    onProgress(0.52, 'Đang tải quái');
    await Promise.all(['Enemy','Rat','Skeleton_Minion'].map(id => spawnModel(byId[id])));
    if (runId !== this.runId) return;

    onProgress(0.82, 'Chuẩn bị chiến đấu');
    await Promise.all([this.spawnEnemy('Enemy'), this.spawnEnemy('Enemy'), this.spawnEnemy('Rat')]);
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
    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA + 11, 72),
      new THREE.MeshStandardMaterial({ color:0x79c968 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    world.add(grass);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA, 72),
      new THREE.MeshStandardMaterial({ color:0x98d77d })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.006;
    floor.receiveShadow = true;
    world.add(floor);

    const center = new THREE.Mesh(
      new THREE.RingGeometry(3.8, 4.15, 48),
      new THREE.MeshBasicMaterial({ color:0xe8d6a7, transparent:true, opacity:0.65 })
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.018;
    world.add(center);

    for (let i = 0; i < 58; i++) {
      const a = i / 58 * Math.PI * 2 + Math.random() * 0.04;
      const r = ARENA + 2.5 + Math.random() * 7;
      const tree = makeTree(0.85 + Math.random() * 0.9);
      tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      tree.rotation.y = Math.random() * Math.PI * 2;
      world.add(tree);
    }
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 7 + Math.random() * (ARENA - 9);
      const rock = makeRock(0.5 + Math.random() * 0.8);
      rock.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      world.add(rock);
    }
    for (let i = 0; i < 150; i++) {
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

  async spawnEnemy(id) {
    if (!this.scene || this.enemies.filter(e => !e.dead).length >= ENEMY_CAP) return;
    const runId = this.runId;
    const entry = byId[id] || byId.Enemy;
    const model = await spawnModel(entry);
    if (runId !== this.runId || !this.scene) return;
    const minutes = this.elapsed / 60;
    const hpScale = 0.56 + minutes * 0.28;
    const enemy = this.makeUnit(entry, model, {
      ...entry.stats,
      team:'enemy',
      hp:Math.max(5, Math.round(entry.stats.hp * hpScale)),
      speed:Math.min(entry.stats.speed * (0.72 + minutes * 0.025), 4.2),
      dmg:Math.max(4, Math.round(entry.stats.dmg * (0.72 + minutes * 0.12))),
    });
    enemy.maxHp = enemy.hp;
    enemy.spawn = 0;
    enemy.hitFlash = 0;
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
      this.updatePickups(dt);
      this.updateCamera(dt);
      this.hintClock -= dt;
      if (this.hintClock <= 0) this.ui.hint.style.opacity = '0';
      this.updateHud();
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
    const alive = this.enemies.filter(enemy => !enemy.dead);
    if (!alive.length) return;
    alive.sort((a,b) => a.root.position.distanceToSquared(this.hero.root.position) - b.root.position.distanceToSquared(this.hero.root.position));
    const targets = alive.slice(0, Math.min(this.power.multi, alive.length));
    this.hero.anim.play('attack', { once:true, speed:1.45, onDone:() => {
      if (this.state === 'playing') this.hero.anim.play(this.moveInput.lengthSq() > 0.02 ? 'run' : 'idle');
    }});
    for (const target of targets) this.makeProjectile(target);
  }

  makeProjectile(target) {
    const heroId = this.hero.entry.id;
    const colors = { Mage:0xa855f7, Rogue:0xf97316, Rogue_Hooded:0xfbbf24, Barbarian:0xef4444, Knight:0x60a5fa };
    const color = colors[heroId] || 0xfbbf24;
    const radius = 0.2 * this.power.size;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 10, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(this.hero.root.position);
    mesh.position.y = 1.05;
    const glow = new THREE.PointLight(color, 1.8, 3);
    mesh.add(glow);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh, target, speed:15, life:2.4,
      damage:this.hero.dmg * this.power.damage,
      hits:new Set(), remaining:this.power.pierce,
      radius:radius + 0.18,
    });
  }

  updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      projectile.life -= dt;
      let target = projectile.target;
      if (!target || target.dead) target = this.nearestEnemy(projectile.mesh.position, projectile.hits);
      projectile.target = target;
      if (!target || projectile.life <= 0) {
        this.removeProjectile(projectile);
        continue;
      }
      tmp.copy(target.root.position);
      tmp.y = target.root.userData.height * 0.48;
      const distance = projectile.mesh.position.distanceTo(tmp);
      const step = projectile.speed * dt;
      if (distance <= step + target.radius + projectile.radius) {
        this.hitEnemy(target, projectile.damage);
        projectile.hits.add(target);
        if (projectile.remaining > 0) {
          projectile.remaining--;
          projectile.target = this.nearestEnemy(projectile.mesh.position, projectile.hits);
        } else {
          this.removeProjectile(projectile);
        }
      } else {
        projectile.mesh.position.lerp(tmp, Math.min(1, step / distance));
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.removed);
  }

  nearestEnemy(position, excluded = new Set()) {
    let best = null, bestDistance = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.dead || excluded.has(enemy)) continue;
      const distance = enemy.root.position.distanceToSquared(position);
      if (distance < bestDistance) { bestDistance = distance; best = enemy; }
    }
    return best;
  }

  removeProjectile(projectile) {
    if (projectile.removed) return;
    projectile.removed = true;
    this.scene.remove(projectile.mesh);
    projectile.mesh.geometry.dispose();
    projectile.mesh.material.dispose();
  }

  updateSpawner(dt) {
    this.spawnClock -= dt;
    if (this.spawnClock > 0) return;
    const minute = this.elapsed / 60;
    this.spawnClock = Math.max(0.24, 0.92 - minute * 0.08);
    const roll = Math.random();
    const id = minute > 2.2 && roll < 0.22 ? 'Skeleton_Minion' : minute > 0.8 && roll < 0.48 ? 'Rat' : 'Enemy';
    this.spawnEnemy(id);
    if (minute > 1.5 && Math.random() < 0.18) this.spawnEnemy(id);
  }

  updateEnemies(dt) {
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
        enemy.root.scale.setScalar(easeOutBack(enemy.spawn));
      }

      const pos = enemy.root.position;
      let dx = heroPos.x - pos.x;
      let dz = heroPos.z - pos.z;
      let distance = Math.max(0.001, Math.hypot(dx, dz));

      for (const other of this.enemies) {
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

      dx = heroPos.x - pos.x;
      dz = heroPos.z - pos.z;
      distance = Math.max(0.001, Math.hypot(dx, dz));
      pos.x += dx / distance * enemy.speed * dt;
      pos.z += dz / distance * enemy.speed * dt;
      this.faceTo(enemy, heroPos.x, heroPos.z, dt);
      enemy.anim.play('run');

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

  hitEnemy(enemy, amount) {
    if (enemy.dead) return;
    enemy.hp -= amount;
    enemy.root.scale.multiplyScalar(1.04);
    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.deadTime = 0;
      enemy.anim.play('death', { once:true, clamp:true });
      this.kills++;
      this.spawnGem(enemy.root.position, enemy.entry.id === 'Skeleton_Minion' ? 2 : 1);
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
    const color = value > 1 ? 0xf472b6 : 0xa78bfa;
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(value > 1 ? 0.27 : 0.2, 0),
      new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:0.35, roughness:0.45 })
    );
    mesh.position.copy(position);
    mesh.position.y = 0.28;
    mesh.rotation.z = Math.PI / 4;
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.pickups.push({ mesh, value, age:0, phase:Math.random() * 6 });
  }

  updatePickups(dt) {
    const heroPos = this.hero.root.position;
    for (const pickup of this.pickups) {
      pickup.age += dt;
      pickup.phase += dt * 3;
      pickup.mesh.rotation.y += dt * 3;
      pickup.mesh.position.y = 0.28 + Math.sin(pickup.phase) * 0.08;
      const distance = pickup.mesh.position.distanceTo(heroPos);
      const magnet = 2.2 * this.power.magnet + (pickup.age > 20 ? 8 : 0);
      if (distance < magnet) {
        pickup.mesh.position.lerp(tmp2.set(heroPos.x, 0.7, heroPos.z), Math.min(1, dt * (3 + magnet / Math.max(distance, 0.2))));
      }
      if (distance < this.hero.radius + 0.45) this.collectGem(pickup);
    }
    this.pickups = this.pickups.filter(pickup => !pickup.collected);
  }

  collectGem(pickup) {
    if (pickup.collected) return;
    pickup.collected = true;
    this.scene.remove(pickup.mesh);
    pickup.mesh.geometry.dispose();
    pickup.mesh.material.dispose();
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
    return 5 + (this.level - 1) * 4;
  }

  showLevelUp() {
    this.state = 'levelup';
    this.clearMovement();
    const available = UPGRADES.filter(card => (this.upgradeLevels[card.id] || 0) < card.max);
    if (!available.length) {
      this.power.damage *= 1.1;
      this.pendingLevels--;
      this.toast('⚔ Sức mạnh vô hạn +10%');
      if (this.pendingLevels > 0) this.showLevelUp();
      else this.state = 'playing';
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
    else this.state = 'playing';
    this.updateHud();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.clearMovement();
      this.ui.modal.innerHTML = `<div class="box"><h2>Tạm dừng</h2><p>Trận đấu đang được đóng băng.</p><div class="actions"><button id="resume">Tiếp tục</button><a class="alt" href="index.html">Về sảnh</a></div></div>`;
      this.ui.modal.classList.remove('hidden');
      this.ui.modal.querySelector('#resume').onclick = () => this.togglePause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.ui.modal.classList.add('hidden');
    }
  }

  gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
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
    } catch (error) {
      console.error(error);
      this.ui.loading.innerHTML = `
        <div class="box">
          <h2>Không thể bắt đầu lại</h2>
          <p>Hãy kiểm tra kết nối mạng rồi thử lại.</p>
          <div class="actions"><button id="retry">Tải lại</button><a class="alt" href="index.html">Về sảnh</a></div>
        </div>`;
      this.ui.loading.querySelector('#retry').onclick = () => location.reload();
    }
  }

  updateCamera(dt) {
    const pos = this.hero.root.position;
    const portrait = innerHeight > innerWidth;
    const height = portrait ? 15.5 : 12.5;
    const offset = portrait ? 11.5 : 9.5;
    tmp.set(pos.x, height, pos.z + offset);
    this.camera.position.lerp(tmp, Math.min(1, dt * 5));
    this.camera.lookAt(this.camera.position.x, 0.55, this.camera.position.z - offset);
    this.sun.position.set(pos.x + 12, 22, pos.z + 10);
    this.sun.target.position.copy(pos);
  }

  updateHud() {
    const hpRatio = Math.max(0, this.hero.hp / this.hero.maxHp);
    this.ui.hpFill.style.width = `${hpRatio * 100}%`;
    this.ui.hpText.textContent = `${Math.ceil(Math.max(0, this.hero.hp))} / ${this.hero.maxHp}`;
    this.ui.heroName.textContent = this.hero.entry.name;
    this.ui.timer.textContent = this.formatTime(Math.floor(this.elapsed));
    this.ui.kills.textContent = this.kills;
    this.ui.gems.textContent = this.gems;
    this.ui.level.textContent = `Cấp ${this.level}`;
    this.ui.xpFill.style.width = `${Math.min(100, this.xp / this.xpNeeded() * 100)}%`;
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
    this.camera.updateProjectionMatrix();
  }

  render() {
    if (this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }

  disposeUnit(unit) {
    if (!unit || unit.disposed) return;
    unit.disposed = true;
    this.scene?.remove(unit.root);
    if (unit.ring) {
      unit.root.remove(unit.ring);
      unit.ring.geometry.dispose();
      unit.ring.material.dispose();
    }
    const skeletons = new Set();
    unit.model?.traverse(object => {
      if (object.isSkinnedMesh && object.skeleton) skeletons.add(object.skeleton);
    });
    for (const skeleton of skeletons) skeleton.dispose();
  }

  cleanupScene() {
    if (!this.scene) return;
    for (const projectile of this.projectiles || []) this.removeProjectile(projectile);
    for (const pickup of this.pickups || []) {
      this.scene.remove(pickup.mesh);
      pickup.mesh.geometry.dispose();
      pickup.mesh.material.dispose();
    }
    this.disposeUnit(this.hero);
    for (const enemy of this.enemies || []) this.disposeUnit(enemy);
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
    this.scene = null;
    this.world = null;
    this.hero = null;
  }
}
