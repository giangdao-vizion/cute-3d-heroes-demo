// Game nhỏ kiểu MOBA/arena: điều khiển tướng, đánh các đợt quái, đợt 5 có boss.
import * as THREE from 'three';
import { byId } from './catalog.js';
import { spawnModel, Animator, addLights, makeTree, makeRock, makeFlower } from './engine.js';
import { selection } from './state.js';

const ARENA = 20;           // bán kính khu vực chơi
const tmp = new THREE.Vector3();

export class Game {
  constructor(renderer, ui) {
    this.renderer = renderer; this.ui = ui;
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.keys = new Set();
    this.active = false;
    const el = renderer.domElement;
    el.addEventListener('contextmenu', e => { if (this.active) e.preventDefault(); });
    el.addEventListener('pointerdown', e => { if (this.active) { this.pointerHeld = true; this.onPointer(e, true); } });
    el.addEventListener('pointermove', e => { if (this.active && this.pointerHeld) this.onPointer(e, false); });
    addEventListener('pointerup', () => this.pointerHeld = false);
    addEventListener('keydown', e => {
      if (!this.active) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === 'q') this.castSkill();
      if (k === ' ') { e.preventDefault(); this.dash(); }
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    ui.btnSkill.onclick = () => this.castSkill();
    ui.btnDash.onclick = () => this.dash();
  }

  // ---------- Khởi tạo ----------
  async start() {
    this.cleanup();
    this.active = true; this.over = false;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fd8ff);
    scene.fog = new THREE.Fog(0x9fd8ff, 28, 55);
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
    this.sun = addLights(scene, 18);
    this.buildArena();
    this.monsters = []; this.projectiles = []; this.effects = []; this.floaters = [];
    this.wave = 0; this.kills = 0; this.score = 0; this.level = 1;
    this.skillCd = 0; this.dashCd = 0; this.waveTimer = 1.5;

    const hEntry = byId[selection.hero] || byId.Knight;
    const h = await spawnModel(hEntry);
    this.hero = this.makeUnit(hEntry, h, { ...hEntry.stats, team: 'hero' });
    this.hero.maxHp = this.hero.hp = hEntry.stats.hp;
    scene.add(this.hero.root);
    this.hero.bar = this.makeBar('hero');
    this.ui.heroName.textContent = hEntry.name;

    if (selection.pet && byId[selection.pet]) {
      const pEntry = byId[selection.pet];
      const p = await spawnModel(pEntry);
      this.pet = this.makeUnit(pEntry, p, { speed: 5.5, dmg: 6, rate: 1.3, range: 1.2, team: 'hero' });
      this.pet.root.position.set(-1.5, 0, 1);
      scene.add(this.pet.root);
    }
    // Tải trước model quái để đợt đầu không bị khựng.
    await Promise.all([...selection.monsters, selection.boss].map(id => byId[id] && spawnModel(byId[id])));
    this.ui.hud.classList.remove('hidden');
    this.ui.overlay.classList.add('hidden');
    this.updateHud();
  }

  buildArena() {
    const s = this.scene;
    const grass = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0x7cc96a }));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; s.add(grass);
    const arena = new THREE.Mesh(new THREE.CircleGeometry(ARENA + 0.5, 64), new THREE.MeshStandardMaterial({ color: 0x9ad97f }));
    arena.rotation.x = -Math.PI / 2; arena.position.y = 0.005; arena.receiveShadow = true; s.add(arena);
    // Lối đi chữ thập kiểu bản đồ MOBA.
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xe9d6a8 });
    for (const rot of [0, Math.PI / 2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3, ARENA * 2), pathMat);
      p.rotation.x = -Math.PI / 2; p.rotation.z = rot; p.position.y = 0.01; p.receiveShadow = true; s.add(p);
    }
    const center = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), pathMat);
    center.rotation.x = -Math.PI / 2; center.position.y = 0.012; center.receiveShadow = true; s.add(center);
    this.ground = grass;
    // Hàng rào cây quanh sân.
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + Math.random() * 0.05, r = ARENA + 2 + Math.random() * 7;
      const t = makeTree(0.9 + Math.random() * 0.9); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); t.rotation.y = Math.random() * 6; s.add(t);
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * (ARENA - 7);
      if (Math.abs(Math.cos(a) * r) < 2.5 || Math.abs(Math.sin(a) * r) < 2.5) continue;
      const k = makeRock(0.6 + Math.random() * 1.2); k.position.x = Math.cos(a) * r; k.position.z = Math.sin(a) * r; s.add(k);
    }
    for (let i = 0; i < 260; i++) {
      const f = makeFlower(); const a = Math.random() * Math.PI * 2, r = Math.random() * (ARENA + 6);
      f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); s.add(f);
    }
    // Vòng chỉ điểm click.
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.38, 24), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = 0.03; this.marker.visible = false; s.add(this.marker);
  }

  makeUnit(entry, { root, model, clips }, stats) {
    const anim = new Animator(model, clips, entry.anims);
    anim.play('idle');
    // Vòng bóng dưới chân cho dễ nhìn.
    const ringColor = stats.team === 'hero' ? 0x60a5fa : 0xf87171;
    const r = Math.max(root.userData.radius, 0.35);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r * 1.08, 28), new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.7 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; root.add(ring);
    return { entry, root, model, anim, ...stats, hp: stats.hp || 1, maxHp: stats.hp || 1, cd: 0, busy: 0, dead: false, target: null, radius: r, flash: 0 };
  }

  makeBar(kind) {
    const el = document.createElement('div');
    el.className = 'hpbar ' + kind; el.innerHTML = '<i></i>';
    this.ui.labels.appendChild(el);
    return el;
  }

  // ---------- Điều khiển ----------
  onPointer(e, isDown) {
    if (this.over || !this.hero || this.hero.dead) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (isDown) {
      // Bấm trúng quái → nhắm đánh con đó.
      let best = null, bestD = Infinity;
      for (const m of this.monsters) {
        if (m.dead) continue;
        const p = m.root.position, rr = Math.max(m.radius, 0.6);
        const box = new THREE.Box3(new THREE.Vector3(p.x - rr, 0, p.z - rr), new THREE.Vector3(p.x + rr, m.root.userData.height, p.z + rr));
        const hit = this.raycaster.ray.intersectBox(box, tmp);
        if (hit) { const d = hit.distanceTo(this.camera.position); if (d < bestD) { bestD = d; best = m; } }
      }
      if (best) { this.hero.target = best; this.hero.moveTo = null; return; }
    }
    const hit = this.raycaster.intersectObject(this.ground)[0];
    if (hit) {
      const p = hit.point; p.y = 0;
      if (p.length() > ARENA) p.setLength(ARENA);
      this.hero.moveTo = p.clone(); this.hero.target = null;
      this.marker.position.set(p.x, 0.03, p.z); this.marker.visible = true; this.marker.scale.setScalar(1.6); this.marker.material.opacity = 1;
    }
  }

  castSkill() {
    const h = this.hero;
    if (!h || h.dead || this.over || this.skillCd > 0) return;
    this.skillCd = 6;
    h.busy = 0.7; h.moveTo = null;
    h.anim.play('skill', { once: true, onDone: () => h.anim.play('idle') });
    const radius = 3.6;
    setTimeout(() => {
      if (!this.active) return;
      this.ringEffect(h.root.position, radius, h.entry.ranged ? 0xa78bfa : 0xfbbf24);
      for (const m of this.monsters) {
        if (!m.dead && m.root.position.distanceTo(h.root.position) < radius + m.radius) this.damage(m, h.dmg * 2.5 * this.dmgMul(), true);
      }
    }, 300);
    this.updateHud();
  }

  dash() {
    const h = this.hero;
    if (!h || h.dead || this.over || this.dashCd > 0) return;
    this.dashCd = 4;
    const dir = new THREE.Vector3(Math.sin(h.root.rotation.y), 0, Math.cos(h.root.rotation.y));
    h.dashing = 0.22; h.dashDir = dir; h.moveTo = null;
    h.anim.play('Dodge_Forward', { once: true, speed: 1.4, onDone: () => h.anim.play('idle') });
    this.updateHud();
  }

  dmgMul() { return 1 + (this.level - 1) * 0.12; }

  // ---------- Vòng lặp ----------
  update(dt) {
    if (!this.active || !this.hero) return;
    dt = Math.min(dt, 0.05);
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    if (!this.over) { this.updateHero(dt); this.updatePet(dt); this.updateWaves(dt); }
    for (const m of this.monsters) this.updateMonster(m, dt);
    this.monsters = this.monsters.filter(m => !m.removed);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.hero.anim.update(dt);
    this.pet?.anim.update(dt);
    // Camera nghiêng kiểu MOBA, đi theo tướng.
    const hp = this.hero.root.position;
    const want = tmp.set(hp.x, 10.5, hp.z + 8.5);
    this.camera.position.lerp(want, Math.min(1, dt * 5));
    this.camera.lookAt(this.camera.position.x, 0.6, this.camera.position.z - 8.5);
    this.sun.position.set(hp.x + 12, 22, hp.z + 10); this.sun.target.position.copy(hp);
    if (this.marker.visible) {
      this.marker.material.opacity -= dt * 1.6; this.marker.scale.multiplyScalar(1 - dt * 2);
      if (this.marker.material.opacity <= 0) this.marker.visible = false;
    }
    this.updateBars();
    this.ui.cdSkill.style.height = (this.skillCd / 6 * 100) + '%';
    this.ui.cdDash.style.height = (this.dashCd / 4 * 100) + '%';
  }

  faceTo(u, x, z, dt, speed = 12) {
    const want = Math.atan2(x - u.root.position.x, z - u.root.position.z);
    let d = want - u.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    u.root.rotation.y += d * Math.min(1, dt * speed);
  }

  moveToward(u, x, z, dt, stopDist = 0.05) {
    const p = u.root.position;
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d <= stopDist) return true;
    const step = Math.min(d - stopDist, u.speed * dt);
    p.x += dx / d * step; p.z += dz / d * step;
    this.faceTo(u, x, z, dt);
    return false;
  }

  updateHero(dt) {
    const h = this.hero;
    if (h.dead) return;
    h.cd -= dt; h.busy -= dt;
    h.hp = Math.min(h.maxHp, h.hp + dt * 2); // hồi máu chậm
    const p = h.root.position;
    if (h.dashing > 0) {
      h.dashing -= dt; p.addScaledVector(h.dashDir, 22 * dt);
      if (p.length() > ARENA) p.setLength(ARENA);
      return;
    }
    // Bàn phím WASD / mũi tên.
    let kx = 0, kz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) kz -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) kz += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;
    if (kx || kz) { h.moveTo = new THREE.Vector3(p.x + kx * 1.5, 0, p.z + kz * 1.5); h.target = null; }

    if (h.busy > 0) return;
    if (h.moveTo) {
      h.anim.play('run');
      if (this.moveToward(h, h.moveTo.x, h.moveTo.z, dt)) { h.moveTo = null; h.anim.play('idle'); }
      if (p.length() > ARENA) p.setLength(ARENA);
      return;
    }
    if (h.target && h.target.dead) h.target = null;
    if (!h.target) {
      // Tự tìm quái gần nhất khi đứng yên.
      let best = null, bd = h.range + 3;
      for (const m of this.monsters) { if (m.dead) continue; const d = m.root.position.distanceTo(p) - m.radius; if (d < bd) { bd = d; best = m; } }
      h.target = best;
    }
    if (!h.target) { h.anim.play('idle'); return; }
    const t = h.target, tp = t.root.position;
    const dist = tp.distanceTo(p) - t.radius;
    if (dist > h.range) { h.anim.play('run'); this.moveToward(h, tp.x, tp.z, dt); return; }
    this.faceTo(h, tp.x, tp.z, dt, 20);
    if (h.cd <= 0) {
      h.cd = h.rate; h.busy = Math.min(h.rate, 0.45);
      h.anim.play('attack', { once: true, speed: 1.3, onDone: () => h.anim.play('idle') });
      const dmg = h.dmg * this.dmgMul() * (0.85 + Math.random() * 0.3);
      if (h.entry.ranged) setTimeout(() => this.active && this.shoot(h, t, dmg), 180);
      else setTimeout(() => { if (this.active && !t.dead) this.damage(t, dmg); }, 220);
    } else h.anim.play('idle');
  }

  updatePet(dt) {
    const pt = this.pet; if (!pt) return;
    pt.cd -= dt;
    const h = this.hero.root, p = pt.root.position;
    // Cắn quái gần tướng, nếu không thì chạy theo sau lưng.
    let target = null, bd = 4;
    for (const m of this.monsters) { if (m.dead) continue; const d = m.root.position.distanceTo(h.position); if (d < bd) { bd = d; target = m; } }
    if (target) {
      const tp = target.root.position;
      if (tp.distanceTo(p) > pt.range + target.radius) { pt.anim.play('run'); this.moveToward(pt, tp.x, tp.z, dt); }
      else {
        this.faceTo(pt, tp.x, tp.z, dt);
        if (pt.cd <= 0) { pt.cd = pt.rate; pt.anim.play('attack', { once: true, onDone: () => pt.anim.play('idle') }); setTimeout(() => !target.dead && this.damage(target, pt.dmg * this.dmgMul()), 250); }
      }
      return;
    }
    const back = new THREE.Vector3(-Math.sin(h.rotation.y) * 1.4 - 0.9, 0, -Math.cos(h.rotation.y) * 1.4);
    const goal = h.position.clone().add(back);
    if (goal.distanceTo(p) > 0.6) { pt.anim.play('run'); this.moveToward(pt, goal.x, goal.z, dt, 0.3); }
    else if (pt.cd <= -0.2 || pt.anim.currentKey === 'run') pt.anim.play('idle');
  }

  updateWaves(dt) {
    const alive = this.monsters.filter(m => !m.dead).length;
    if (alive > 0) return;
    this.waveTimer -= dt;
    if (this.waveTimer > 0) return;
    this.wave++; this.waveTimer = 2.5;
    const isBoss = this.wave % 5 === 0;
    this.toast(isBoss ? `Đợt ${this.wave}: BOSS xuất hiện!` : `Đợt ${this.wave}`);
    const n = isBoss ? 4 : 3 + this.wave * 2;
    const pool = selection.monsters.filter(id => byId[id]);
    for (let i = 0; i < n; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      setTimeout(() => this.active && this.spawnMonster(byId[id]), i * 250);
    }
    if (isBoss && byId[selection.boss]) setTimeout(() => this.active && this.spawnMonster(byId[selection.boss], true), 600);
    this.updateHud();
  }

  async spawnMonster(entry, boss = false) {
    const m = await spawnModel(entry);
    if (!this.active) return;
    const scale = 1 + (this.wave - 1) * 0.12;
    const u = this.makeUnit(entry, m, { ...entry.stats, team: 'enemy' });
    u.hp = u.maxHp = Math.round(entry.stats.hp * scale);
    u.dmg = entry.stats.dmg * (1 + (this.wave - 1) * 0.06);
    u.boss = boss; u.rate = boss ? 1.6 : 1.5; u.range = boss ? 1.6 : 0.6;
    const a = Math.random() * Math.PI * 2;
    u.root.position.set(Math.cos(a) * (ARENA - 1), 0, Math.sin(a) * (ARENA - 1));
    u.root.scale.setScalar(0.01); u.spawn = 0;
    u.bar = this.makeBar(boss ? 'boss' : 'enemy');
    this.scene.add(u.root);
    this.monsters.push(u);
  }

  updateMonster(m, dt) {
    m.anim.update(dt);
    if (m.spawn !== undefined && m.spawn < 1) { m.spawn = Math.min(1, m.spawn + dt * 3); m.root.scale.setScalar(easeOutBack(m.spawn)); }
    if (m.flash > 0) { m.flash -= dt; }
    if (m.dead) {
      m.deadT += dt;
      if (!m.anim.has('death')) m.root.scale.setScalar(Math.max(0.01, 1 - m.deadT * 2));
      if (m.deadT > 1.6) m.root.position.y -= dt * 1.2;
      if (m.deadT > 2.6) { this.scene.remove(m.root); m.bar.remove(); m.removed = true; }
      return;
    }
    if (this.over) { m.anim.play(m.anim.has('win') ? 'win' : 'idle'); return; }
    m.cd -= dt; m.busy -= dt;
    const h = this.hero, p = m.root.position, hp = h.root.position;
    // Tách nhau ra cho khỏi chồng lên.
    for (const o of this.monsters) {
      if (o === m || o.dead) continue;
      const dx = p.x - o.root.position.x, dz = p.z - o.root.position.z, d = Math.hypot(dx, dz), min = m.radius + o.radius;
      if (d > 0.001 && d < min) { p.x += dx / d * (min - d) * 0.5; p.z += dz / d * (min - d) * 0.5; }
    }
    if (m.busy > 0) return;
    const dist = hp.distanceTo(p) - h.radius - m.radius;
    if (dist > m.range) { m.anim.play('run'); this.moveToward(m, hp.x, hp.z, dt); return; }
    this.faceTo(m, hp.x, hp.z, dt);
    if (m.cd <= 0) {
      m.cd = m.rate; m.busy = 0.5;
      m.anim.play('attack', { once: true, onDone: () => !m.dead && m.anim.play('idle') });
      setTimeout(() => {
        if (!this.active || m.dead || this.over) return;
        if (hp.distanceTo(m.root.position) - h.radius - m.radius < m.range + 0.6) this.damage(h, m.dmg);
      }, 300);
    } else if (m.anim.currentKey === 'run') m.anim.play('idle');
  }

  shoot(from, target, dmg) {
    const color = from.entry.id === 'Mage' ? 0x8b5cf6 : 0xf59e0b;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color }));
    const glow = new THREE.PointLight(color, 3, 3); mesh.add(glow);
    mesh.position.copy(from.root.position).add(new THREE.Vector3(0, 1.1, 0));
    this.scene.add(mesh);
    this.projectiles.push({ mesh, target, dmg, speed: 16 });
  }

  updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      const t = pr.target;
      const goal = t.root.position.clone().setY(t.root.userData.height * 0.5);
      const d = goal.distanceTo(pr.mesh.position);
      if (t.dead || d < 0.3) {
        if (!t.dead) { this.damage(t, pr.dmg); this.ringEffect(goal.setY(0), 0.8, 0xc4b5fd, 0.25); }
        this.scene.remove(pr.mesh); pr.done = true; continue;
      }
      pr.mesh.position.addScaledVector(goal.sub(pr.mesh.position).normalize(), pr.speed * dt);
    }
    this.projectiles = this.projectiles.filter(p => !p.done);
  }

  damage(u, amount, crit = false) {
    if (u.dead || this.over) return;
    amount = Math.round(amount);
    u.hp -= amount;
    this.floatText(u, (crit ? '💥 ' : '') + amount, u.team === 'hero' ? '#ff6b6b' : crit ? '#fbbf24' : '#ffffff');
    if (u.hp <= 0) return this.kill(u);
    if (u.team === 'enemy' && !u.boss && u.anim.has('hit') && u.busy <= 0) {
      u.busy = 0.25; u.anim.play('hit', { once: true, speed: 1.5, onDone: () => !u.dead && u.anim.play('idle') });
    }
    if (u === this.hero) this.updateHud();
  }

  kill(u) {
    u.dead = true; u.hp = 0; u.deadT = 0;
    u.anim.play('death', { once: true, clamp: true });
    if (u === this.hero) { this.gameOver(); return; }
    this.kills++; this.score += u.boss ? 500 : 10 * this.wave;
    if (this.kills % 10 === 0) { this.level++; this.toast(`Lên cấp ${this.level}! Sát thương +12%`); this.hero.maxHp += 20; this.hero.hp += 40; }
    if (u.boss) this.toast('Hạ boss! +500 điểm');
    u.bar.style.display = 'none';
    this.updateHud();
  }

  gameOver() {
    this.over = true; this.updateHud();
    this.hero.bar.style.display = 'none';
    this.ui.overlay.classList.remove('hidden');
    this.ui.overlayText.innerHTML = `<h2>Thua rồi!</h2><p>Bạn trụ được đến <b>đợt ${this.wave}</b>, hạ <b>${this.kills}</b> quái, <b>${this.score}</b> điểm.</p>`;
  }

  // ---------- Hiệu ứng & HUD ----------
  ringEffect(pos, radius, color, life = 0.45) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.35, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.06, pos.z);
    this.scene.add(m);
    this.effects.push({ mesh: m, t: 0, life, radius });
  }

  updateEffects(dt) {
    for (const e of this.effects) {
      e.t += dt; const k = e.t / e.life;
      e.mesh.scale.setScalar(0.3 + k * e.radius * 2.6);
      e.mesh.material.opacity = 1 - k;
      if (k >= 1) { this.scene.remove(e.mesh); e.done = true; }
    }
    this.effects = this.effects.filter(e => !e.done);
    for (const f of this.floaters) {
      f.t += dt; f.y += dt * 1.4;
      if (f.t > 0.9) { f.el.remove(); f.done = true; }
    }
    this.floaters = this.floaters.filter(f => !f.done);
  }

  floatText(u, text, color) {
    const el = document.createElement('div');
    el.className = 'dmg'; el.textContent = text; el.style.color = color;
    this.ui.labels.appendChild(el);
    this.floaters.push({ el, t: 0, pos: u.root.position.clone(), y: u.root.userData.height + 0.3, dx: (Math.random() - 0.5) * 0.6 });
  }

  project(pos, yOff) {
    const v = tmp.copy(pos); v.y += yOff; v.project(this.camera);
    const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight;
    return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h, v.z < 1];
  }

  updateBars() {
    const all = [this.hero, ...this.monsters];
    for (const u of all) {
      if (!u.bar || u.dead) continue;
      const [x, y, vis] = this.project(u.root.position, u.root.userData.height * (u.root.scale.x) + 0.35);
      u.bar.style.display = vis ? '' : 'none';
      u.bar.style.transform = `translate(-50%,-100%) translate(${x}px,${y}px)`;
      u.bar.firstChild.style.width = Math.max(0, u.hp / u.maxHp * 100) + '%';
    }
    for (const f of this.floaters) {
      const [x, y] = this.project(f.pos, f.y);
      f.el.style.transform = `translate(-50%,-100%) translate(${x + f.dx * 40}px,${y}px)`;
      f.el.style.opacity = 1 - f.t / 0.9;
    }
  }

  updateHud() {
    const h = this.hero; if (!h) return;
    this.ui.heroHp.style.width = (h.hp / h.maxHp * 100) + '%';
    this.ui.heroHpText.textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
    this.ui.stats.innerHTML = `Đợt <b>${this.wave}</b> · Hạ <b>${this.kills}</b> · Cấp <b>${this.level}</b> · Điểm <b>${this.score}</b>`;
  }

  toast(text) {
    const el = this.ui.toast;
    el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  cleanup() {
    this.active = false;
    this.ui.labels.querySelectorAll('.hpbar,.dmg').forEach(e => e.remove());
    this.hero = null; this.pet = null; this.monsters = []; this.floaters = [];
  }

  stop() { this.cleanup(); this.ui.hud.classList.add('hidden'); this.ui.overlay.classList.add('hidden'); }

  render() { if (this.scene && this.camera) this.renderer.render(this.scene, this.camera); }
  resize(w, h) { if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); } }
}

function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
