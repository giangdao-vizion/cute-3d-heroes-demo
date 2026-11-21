import * as THREE from 'three';
import { byId } from '../catalog.js';
import { selection } from '../state.js';
import { spawnModel, Animator, addLights, makeTree, makeRock, makeFlower, isMobileGraphics } from '../engine.js';
import { bindLobbyLinks } from '../lobby-nav.js';

const ARENA = 27;
const ARENA_MIN = 12;
const RING_START_AT = 180;       // giây: bắt đầu thu hẹp
const RING_SHRINK_PER_SEC = 0.042;
const ENEMY_CAP = 55;
const STAGE_DURATION = 50;
const BASE_ATTACK_RANGE = 6.2;
const FIELD_DROP_MAX = 2;
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
  { min:10, color:0xffe066, accent:0xfff6c2, size:0.55 },
  { min:6, color:0xff4d6d, accent:0xffb3c1, size:0.48 },
  { min:3, color:0x38bdf8, accent:0xbae6fd, size:0.42 },
  { min:1, color:0xa78bfa, accent:0xddd6fe, size:0.36 },
];

/** Shared GPU assets: one texture/material per gem tier, reused by every drop. */
const SHARED_PICKUPS = {
  gemMats: new Map(),
  potionMat: null,
};

function cssHex(hex) {
  return `#${(hex >>> 0).toString(16).padStart(6, '0')}`;
}

function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function fillPoly(ctx, points, fill) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokePoly(ctx, points, stroke, width = 2) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Vẽ kim cương kiểu SVG/facet rồi cache thành texture dùng chung. */
function makeDiamondTexture(color, accent) {
  const S = 160;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const main = cssHex(color);
  const light = cssHex(accent);
  const dark = cssHex(mixHex(color, 0x000000, 0.38));
  const mid = cssHex(mixHex(color, accent, 0.28));
  const deep = cssHex(mixHex(color, 0x000000, 0.55));

  // Bóng dưới cho cảm giác đặt trên sàn.
  const glow = ctx.createRadialGradient(80, 132, 2, 80, 132, 46);
  glow.addColorStop(0, `${main}66`);
  glow.addColorStop(1, `${main}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(80, 134, 42, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Các mặt cắt (facet) — nhìn như kim cương 3D phẳng đẹp.
  fillPoly(ctx, [[80, 12], [118, 48], [80, 68], [42, 48]], light);           // table / top
  fillPoly(ctx, [[80, 12], [42, 48], [28, 66], [80, 68]], dark);            // upper left
  fillPoly(ctx, [[80, 12], [118, 48], [132, 66], [80, 68]], mid);           // upper right
  fillPoly(ctx, [[28, 66], [80, 68], [80, 148]], deep);                    // pavilion left
  fillPoly(ctx, [[132, 66], [80, 68], [80, 148]], dark);                   // pavilion right
  fillPoly(ctx, [[42, 48], [80, 68], [118, 48]], `${light}cc`);            // crown highlight
  fillPoly(ctx, [[64, 40], [80, 28], [96, 40], [80, 54]], '#ffffffaa');    // sparkle

  strokePoly(ctx, [[80, 12], [118, 48], [132, 66], [80, 148], [28, 66], [42, 48]], 'rgba(255,255,255,0.65)', 2.4);
  ctx.beginPath();
  ctx.moveTo(80, 12); ctx.lineTo(80, 148);
  ctx.moveTo(28, 66); ctx.lineTo(132, 66);
  ctx.moveTo(42, 48); ctx.lineTo(80, 68); ctx.lineTo(118, 48);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makePotionTexture() {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  const glow = ctx.createRadialGradient(64, 110, 2, 64, 110, 36);
  glow.addColorStop(0, 'rgba(255,90,122,0.35)');
  glow.addColorStop(1, 'rgba(255,90,122,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(64, 112, 34, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Flask body
  const body = ctx.createLinearGradient(40, 40, 90, 110);
  body.addColorStop(0, '#ffd0da');
  body.addColorStop(0.45, '#ff5a7a');
  body.addColorStop(1, '#c81e4a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(44, 52);
  ctx.quadraticCurveTo(40, 100, 64, 112);
  ctx.quadraticCurveTo(88, 100, 84, 52);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Neck + cork
  ctx.fillStyle = '#ff7a93';
  ctx.fillRect(56, 34, 16, 22);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(54, 26, 20, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(56, 72, 6, 10, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('+', 64, 82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function getGemMaterial(tier) {
  const key = tier.color;
  let mat = SHARED_PICKUPS.gemMats.get(key);
  if (mat) return mat;
  mat = new THREE.SpriteMaterial({
    map: makeDiamondTexture(tier.color, tier.accent),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  SHARED_PICKUPS.gemMats.set(key, mat);
  return mat;
}

function getPotionMaterial() {
  if (SHARED_PICKUPS.potionMat) return SHARED_PICKUPS.potionMat;
  SHARED_PICKUPS.potionMat = new THREE.SpriteMaterial({
    map: makePotionTexture(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  return SHARED_PICKUPS.potionMat;
}

function createGemMesh(tier) {
  const sprite = new THREE.Sprite(getGemMaterial(tier));
  sprite.scale.set(tier.size * 1.85, tier.size * 2.25, 1);
  sprite.center.set(0.5, 0.08);
  sprite.userData.sharedPickup = true;
  return sprite;
}

function createPotionMesh() {
  const sprite = new THREE.Sprite(getPotionMaterial());
  sprite.scale.set(0.85, 0.95, 1);
  sprite.center.set(0.5, 0.05);
  sprite.userData.sharedPickup = true;
  return sprite;
}

function disposeSharedPickups() {
  for (const mat of SHARED_PICKUPS.gemMats.values()) {
    mat.map?.dispose();
    mat.dispose();
  }
  SHARED_PICKUPS.gemMats.clear();
  if (SHARED_PICKUPS.potionMat) {
    SHARED_PICKUPS.potionMat.map?.dispose();
    SHARED_PICKUPS.potionMat.dispose();
    SHARED_PICKUPS.potionMat = null;
  }
}

/** Chỉ số cơ bản — cộng bằng điểm thuộc tính trong bảng nhân vật. */
const ATTR_DEFS = [
  { id:'str', icon:'⚔', name:'Sức mạnh', desc:'+12% sát thương mỗi điểm', max:12 },
  { id:'agi', icon:'👟', name:'Tốc độ', desc:'+8% tốc độ chạy mỗi điểm', max:12 },
  { id:'vit', icon:'♥', name:'Sinh lực', desc:'+22 máu tối đa mỗi điểm', max:12 },
  { id:'def', icon:'⬟', name:'Phòng thủ', desc:'Giảm 6% sát thương nhận mỗi điểm', max:10 },
  { id:'cri', icon:'✴', name:'Chí mạng', desc:'+4% tỉ lệ chí mạng mỗi điểm', max:10 },
  { id:'vamp', icon:'🩸', name:'Hút máu', desc:'Hồi 2% sát thương gây ra mỗi điểm', max:8 },
  { id:'pull', icon:'🧲', name:'Hút ngọc', desc:'+10% tầm hút ngọc mỗi điểm', max:8 },
  { id:'luck', icon:'🍀', name:'May mắn', desc:'+8% XP ngọc & vật phẩm map xuất hiện nhanh hơn', max:8 },
  { id:'regen', icon:'🌿', name:'Hồi phục', desc:'+0.45 máu/giây mỗi điểm khi không vừa bị đánh', max:8 },
  { id:'mass', icon:'🪨', name:'Khối lượng', desc:'Giảm 8% đẩy lùi mỗi điểm', max:8 },
  { id:'elite', icon:'👑', name:'Tinh anh', desc:'+8% sát thương lên boss/elite mỗi điểm', max:10 },
];

/** Phần thưởng lên cấp: kỹ năng bổ trợ (không gồm chỉ số cơ bản). */
const SPECIAL_UPGRADES = [
  { id:'rate', icon:'✦', name:'Liên hoàn', desc:'+18% tốc độ tấn công', max:5, apply:g => { g.power.interval /= 1.18; } },
  { id:'multi', icon:'➹', name:'Đa mục tiêu', desc:'+1 tia đạn mỗi lượt', max:3, apply:g => { g.power.multi++; } },
  { id:'pierce', icon:'➤', name:'Xuyên phá', desc:'Đạn xuyên thêm 1 quái', max:3, apply:g => { g.power.pierce++; } },
  { id:'size', icon:'◉', name:'Đạn khổng lồ', desc:'+25% kích thước và vùng trúng', max:4, apply:g => { g.power.size *= 1.25; } },
  { id:'magnet', icon:'◆', name:'Nam châm', desc:'+35% phạm vi hút ngọc', max:4, apply:g => { g.power.magnet *= 1.35; g.updateMagnetRing(); } },
  { id:'range', icon:'◎', name:'Tầm bắn', desc:'+15% tầm bắn', max:5, apply:g => { g.power.range *= 1.15; g.updateRangeRing(); } },
  { id:'chain', icon:'ϟ', name:'Sét lan', desc:'Tia sét lan thêm 1 quái gần đó', max:4, apply:g => { g.power.chain++; } },
  { id:'blast', icon:'✹', name:'Nổ lan', desc:'Fireball gây nổ quanh mục tiêu', max:4, apply:g => { g.power.blast++; } },
  { id:'freeze', icon:'❄', name:'Băng giá', desc:'Làm chậm, có cơ hội đóng băng quái', max:4, apply:g => { g.power.freeze++; } },
  { id:'burnAura', icon:'🔥', name:'Vòng lửa', desc:'Thiêu đốt quái đi vào vòng quanh bạn', max:5, apply:g => { g.power.burnAura++; g.updateBurnAura(); } },
];

/** Thẻ rủi ro: mạnh hơn nhưng có đánh đổi. */
const RISK_UPGRADES = [
  {
    id:'riskPower', icon:'⚖', name:'Giao kèo máu', kind:'risk', max:1,
    desc:'+45% sát thương · −20% máu tối đa',
    apply:g => {
      g.power.damageBonus *= 1.45;
      g.hero.baseMaxHp = Math.max(80, Math.round(g.hero.baseMaxHp * 0.8));
      g.recalcAttributes();
      g.hero.hp = Math.min(g.hero.hp, g.hero.maxHp);
    },
  },
  {
    id:'riskGlass', icon:'🪞', name:'Thủy tinh sắc', kind:'risk', max:1,
    desc:'+1 xuyên phá · nhận thêm 25% sát thương',
    apply:g => {
      g.power.pierce++;
      g.power.takenDamageMult *= 1.25;
    },
  },
  {
    id:'riskSwift', icon:'💨', name:'Gió đổi mạng', kind:'risk', max:1,
    desc:'+22% tốc chạy · −12% tầm bắn',
    apply:g => {
      g.hero.baseSpeed *= 1.22;
      g.power.range *= 0.88;
      g.recalcAttributes();
      g.updateRangeRing();
    },
  },
];

/** Đồng bộ tự mở khi đủ 2 skill gốc. */
const SYNERGY_DEFS = [
  {
    id:'frostBurst', requires:['freeze','blast'], icon:'❄✹',
    name:'Nổ băng', desc:'Vụ nổ cũng đóng băng quái xung quanh',
  },
  {
    id:'stormVolley', requires:['chain','multi'], icon:'ϟ➹',
    name:'Mưa sét', desc:'Mỗi tia đạn thêm 1 nhảy sét',
  },
  {
    id:'shrapnel', requires:['pierce','blast'], icon:'➤✹',
    name:'Mảnh nổ', desc:'Mỗi lần xuyên kích hoạt nổ nhỏ',
  },
  {
    id:'frostburn', requires:['freeze','burnAura'], icon:'❄🔥',
    name:'Băng lửa', desc:'Vòng lửa cũng làm chậm quái',
  },
];

const ATTR_POINT_CARD = {
  id:'attrPoint',
  icon:'◎',
  name:'Điểm thuộc tính',
  desc:'+1 điểm để cộng trong bảng nhân vật',
  kind:'attr',
  max:999,
};

const BOSS_EVENTS = [
  { at:120, variantId:'bossRex', entryId:'Trex', name:'T-Rex Hung Hãn', icon:'🦖', hp:560, defense:4, speed:2.15, dmg:16, scale:1.12, gem:28 },
  { at:240, variantId:'bossTri', entryId:'Triceratops', name:'Tri Sừng Thép', icon:'🦕', hp:820, defense:6, speed:2.3, dmg:20, scale:1.05, gem:42 },
  { at:360, variantId:'bossRex2', entryId:'Trex', name:'T-Rex Ác Mộng', icon:'🦖', hp:1200, defense:8, speed:2.45, dmg:26, scale:1.26, gem:65 },
];

const FIELD_DROPS = [
  { id:'fieldAttr', icon:'◎', color:0xa78bfa, name:'Điểm thuộc tính', apply:g => { g.attrPoints++; g.updateAttrBadge(); g.renderAttrRows(); } },
  { id:'fieldHeal', icon:'♥', color:0x22c55e, name:'Hồi máu', apply:g => { g.hero.hp = Math.min(g.hero.maxHp, g.hero.hp + Math.round(g.hero.maxHp * 0.28)); } },
  { id:'fieldXp', icon:'✦', color:0xfbbf24, name:'Bùng nổ XP', apply:g => { g.grantXp(14); } },
  { id:'fieldShield', icon:'⛨', color:0x60a5fa, name:'Khiên tạm', apply:g => { g.hero.invulnerable = Math.max(g.hero.invulnerable, 2.4); } },
  { id:'fieldRage', icon:'⚔', color:0xef4444, name:'Nộ chiến', apply:g => { g.tempBuffs.damage = { t:9, mult:1.4 }; } },
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
      if (!e.repeat && key === 'c') this.toggleAttrSheet();
      if (!e.repeat && (key === 'p' || key === 'escape')) {
        if (this.attrSheetOpen) this.closeAttrSheet();
        else this.togglePause();
      }
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
    this.ui.heroPanel?.addEventListener('click', () => this.toggleAttrSheet());
    this.ui.attrClose?.addEventListener('click', () => this.closeAttrSheet());
    this.ui.attrSheet?.addEventListener('click', e => {
      if (e.target === this.ui.attrSheet) this.closeAttrSheet();
    });
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
    this.fieldDrops = [];
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
    this.attrSheetOpen = false;
    this.currentIntro = null;
    this.introRemaining = 0;
    this.upgradeLevels = {};
    this.attrPoints = 0;
    this.attrs = { str:0, agi:0, vit:0, def:0, cri:0, vamp:0, pull:0, luck:0, regen:0, mass:0, elite:0 };
    this.regenGate = 0;
    this.synergies = { frostBurst:false, stormVolley:false, shrapnel:false, frostburn:false };
    this.burnTick = 0;
    this.bossSpawned = {};
    this.arenaRadius = ARENA;
    this.ringDamageClock = 0;
    this.fieldDropClock = 12 + Math.random() * 6;
    this.tempBuffs = {};
    this.eventBannerText = '';
    this.eventBannerT = 0;
    this.power = {
      damage:1, damageBonus:1, interval:0.72, multi:1, pierce:0, size:1,
      magnet:1, range:BASE_ATTACK_RANGE, attackClock:0.4, armor:1,
      chain:0, blast:0, freeze:0, burnAura:0, takenDamageMult:1,
    };

    const heroEntry = byId[selection.hero] || byId.Knight;
    onProgress(0.25, `Đang tải ${heroEntry.name}`);
    const heroModel = await spawnModel(heroEntry);
    if (runId !== this.runId) return;
    this.hero = this.makeUnit(heroEntry, heroModel, { ...heroEntry.stats, team:'hero', speed:heroEntry.stats.speed * 1.18 });
    this.hero.baseSpeed = this.hero.speed;
    this.hero.baseMaxHp = Math.max(150, heroEntry.stats.hp);
    this.hero.hp = this.hero.maxHp = this.hero.baseMaxHp;
    this.hero.invulnerable = 0;
    this.hero.anim.play('idle');
    scene.add(this.hero.root);
    this.recalcAttributes();
    this.updateRangeRing();
    this.updateMagnetRing();
    this.updateBurnAura();
    this.renderAttrRows();
    this.updateAttrBadge();

    onProgress(0.52, 'Đang tải quái');
    await Promise.all(['Enemy','Rat','Skeleton_Minion','Trex','Triceratops'].map(id => spawnModel(byId[id])));
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

    // Vòng lửa thu hẹp — scale theo arenaRadius.
    const ringSegs = mobile ? 48 : 64;
    this.safeRing = new THREE.Mesh(
      new THREE.RingGeometry(ARENA - 0.22, ARENA + 0.18, ringSegs),
      new THREE.MeshBasicMaterial({ color:0xff7a59, transparent:true, opacity:0.0, depthWrite:false, side:THREE.DoubleSide })
    );
    this.safeRing.rotation.x = -Math.PI / 2;
    this.safeRing.position.y = 0.05;
    world.add(this.safeRing);
    this.dangerDisk = new THREE.Mesh(
      new THREE.RingGeometry(ARENA + 0.2, ARENA + 14, ringSegs),
      new THREE.MeshBasicMaterial({ color:0xef4444, transparent:true, opacity:0.0, depthWrite:false, side:THREE.DoubleSide })
    );
    this.dangerDisk.rotation.x = -Math.PI / 2;
    this.dangerDisk.position.y = 0.04;
    world.add(this.dangerDisk);
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
    const radius = 2.2 * this.power.magnet * (this.power.attrMagnet || 1);
    const magnetRing = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.1, radius - 0.045), radius + 0.045, 64),
      this.hero.magnetRing?.material || new THREE.MeshBasicMaterial({ color:0xc084fc, transparent:true, opacity:0.38, depthWrite:false })
    );
    magnetRing.rotation.x = -Math.PI / 2;
    magnetRing.position.y = 0.042;
    this.hero.root.add(magnetRing);
    this.hero.magnetRing = magnetRing;
  }

  burnAuraRadius() {
    const level = this.power.burnAura || 0;
    if (level <= 0) return 0;
    return 1.55 + level * 0.42;
  }

  burnAuraDps() {
    const level = this.power.burnAura || 0;
    if (level <= 0) return 0;
    return (5.5 + level * 2.8) * this.power.damage * (this.tempBuffs.damage?.mult || 1);
  }

  clearBurnAura() {
    if (!this.hero?.burnRings) return;
    for (const ring of this.hero.burnRings) {
      this.hero.root.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    }
    this.hero.burnRings = [];
  }

  updateBurnAura() {
    if (!this.hero) return;
    this.clearBurnAura();
    const level = this.power.burnAura || 0;
    if (level <= 0) return;
    const radius = this.burnAuraRadius();
    const rings = [];
    const count = Math.min(3, 1 + Math.floor((level - 1) / 2));
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 1 : i / (count - 1);
      const r = radius * (0.42 + t * 0.58);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0.08, r - 0.07), r + 0.07, 48),
        new THREE.MeshBasicMaterial({
          color:i === count - 1 ? 0xff6b2d : 0xffb347,
          transparent:true,
          opacity:0.22 + t * 0.28,
          depthWrite:false,
          blending:THREE.AdditiveBlending,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05 + i * 0.012;
      this.hero.root.add(ring);
      rings.push(ring);
    }
    // Soft fill disk so the burn zone reads clearly on mobile.
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({
        color:0xff4d1a, transparent:true, opacity:0.1, depthWrite:false, blending:THREE.AdditiveBlending,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.03;
    this.hero.root.add(fill);
    rings.push(fill);
    this.hero.burnRings = rings;
  }

  updateBurnAuraCombat(dt) {
    const level = this.power.burnAura || 0;
    if (level <= 0 || !this.hero) return;
    if (this.hero.burnRings?.length) {
      const pulse = 0.92 + Math.sin(this.elapsed * 5.5) * 0.08;
      for (const ring of this.hero.burnRings) {
        if (ring.geometry?.type === 'CircleGeometry') ring.material.opacity = 0.08 + Math.sin(this.elapsed * 4) * 0.04;
        else ring.scale.setScalar(pulse);
      }
    }
    this.burnTick -= dt;
    if (this.burnTick > 0) return;
    this.burnTick = 0.22;
    const radius = this.burnAuraRadius();
    const radiusSq = radius * radius;
    const damage = this.burnAuraDps() * 0.22;
    const heroPos = this.hero.root.position;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.root.position.x - heroPos.x;
      const dz = enemy.root.position.z - heroPos.z;
      if (dx * dx + dz * dz > radiusSq) continue;
      this.hitEnemy(enemy, damage);
      if (this.synergies.frostburn) {
        enemy.slowT = Math.max(enemy.slowT, 0.55);
        enemy.slowFactor = Math.min(enemy.slowFactor, 0.72);
      }
    }
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
    enemy.vx = 0;
    enemy.vz = 0;
    enemy.isElite = variantId === 'sproutBrute' || variantId === 'skeletonGuard' || variantId === 'skeletonRaider';
    const heroPos = this.hero?.root.position || tmp.set(0,0,0);
    let placed = false;
    for (let attempt = 0; attempt < 16; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = 15 + Math.random() * 5;
      enemy.root.position.set(heroPos.x + Math.cos(a) * r, 0, heroPos.z + Math.sin(a) * r);
      if (enemy.root.position.length() <= this.arenaRadius - 1.2) { placed = true; break; }
    }
    if (!placed) {
      tmp2.set(-heroPos.x, 0, -heroPos.z);
      if (tmp2.lengthSq() < 0.01) tmp2.set(1, 0, 0);
      tmp2.setLength(Math.min(15, this.arenaRadius - 2));
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
      this.updateTempBuffs(dt);
      this.updateHero(dt);
      this.updateRegen(dt);
      this.updateBurnAuraCombat(dt);
      this.updateSpawner(dt);
      this.updateBossEvents();
      this.updateSafeRing(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateCombatEffects(dt);
      this.updatePickups(dt);
      this.updateFieldDrops(dt);
      this.updateEnemyIntro(dt);
      this.updateEventBanner(dt);
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

  canSpendAnyAttr() {
    return ATTR_DEFS.some(def => (this.attrs[def.id] || 0) < def.max);
  }

  recalcAttributes() {
    if (!this.hero) return;
    const a = this.attrs;
    this.power.damage = (1 + (a.str || 0) * 0.12) * (this.power.damageBonus || 1);
    this.hero.speed = this.hero.baseSpeed * (1 + (a.agi || 0) * 0.08);
    const nextMax = this.hero.baseMaxHp + (a.vit || 0) * 22;
    const gained = nextMax - this.hero.maxHp;
    this.hero.maxHp = nextMax;
    if (gained > 0) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + gained);
    this.power.armor = Math.pow(0.94, a.def || 0);
    this.power.attrMagnet = 1 + (a.pull || 0) * 0.1;
    this.power.critChance = Math.min(0.55, (a.cri || 0) * 0.04);
    this.power.critMult = 1.55 + (a.cri || 0) * 0.03;
    this.power.vampRate = (a.vamp || 0) * 0.02;
    this.power.luckXp = 1 + (a.luck || 0) * 0.08;
    this.power.regenPerSec = (a.regen || 0) * 0.45;
    this.power.massResist = Math.min(0.75, (a.mass || 0) * 0.08);
    this.power.eliteMult = 1 + (a.elite || 0) * 0.08;
    this.updateMagnetRing();
  }

  spendAttr(id) {
    if (this.attrPoints <= 0) return;
    const def = ATTR_DEFS.find(item => item.id === id);
    if (!def || (this.attrs[id] || 0) >= def.max) return;
    this.attrPoints--;
    this.attrs[id] = (this.attrs[id] || 0) + 1;
    this.recalcAttributes();
    this.renderAttrRows();
    this.updateAttrBadge();
    this.updateHud();
    this.toast(`${def.icon} ${def.name} +1`);
    this.needsRender = true;
  }

  renderAttrRows() {
    if (!this.ui.attrRows) return;
    this.ui.attrRows.innerHTML = ATTR_DEFS.map(def => {
      const level = this.attrs[def.id] || 0;
      const full = level >= def.max;
      const can = this.attrPoints > 0 && !full;
      return `<div class="attr-row">
        <div class="attr-icon">${def.icon}</div>
        <div class="attr-copy">
          <b>${def.name}</b>
          <small>${def.desc}</small>
          <em>Cấp ${level}/${def.max}</em>
        </div>
        <button class="attr-plus" type="button" data-attr="${def.id}" ${can ? '' : 'disabled'} aria-label="Cộng ${def.name}">+</button>
      </div>`;
    }).join('');
    if (this.ui.attrPointsLabel) this.ui.attrPointsLabel.textContent = String(this.attrPoints);
    this.ui.attrRows.querySelectorAll('[data-attr]').forEach(button => {
      button.onclick = () => this.spendAttr(button.dataset.attr);
    });
  }

  updateAttrBadge() {
    const badge = this.ui.attrBadge;
    if (!badge) return;
    if (this.attrPoints > 0) {
      badge.textContent = String(this.attrPoints);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  toggleAttrSheet() {
    if (this.attrSheetOpen) this.closeAttrSheet();
    else this.openAttrSheet();
  }

  openAttrSheet() {
    if (!this.ui.attrSheet || this.state === 'levelup' || this.state === 'over' || this.state === 'loading') return;
    // Giữ trận đấu chạy khi mở bảng — tạo áp lực thao tác nhanh.
    if (this.state === 'paused') {
      this.ui.modal.classList.add('hidden');
      this.state = 'playing';
    }
    if (this.state !== 'playing') return;
    this.attrSheetOpen = true;
    this.renderAttrRows();
    this.ui.attrSheet.classList.remove('hidden');
    this.needsRender = true;
  }

  closeAttrSheet() {
    if (!this.attrSheetOpen) return;
    this.attrSheetOpen = false;
    this.ui.attrSheet?.classList.add('hidden');
    this.needsRender = true;
  }

  showPauseModal() {
    this.ui.modal.innerHTML = `<div class="box"><h2>Tạm dừng</h2><p>Trận đấu đang được đóng băng.</p><div class="actions"><button id="resume">Tiếp tục</button><button id="pauseAttrs" class="alt">Thuộc tính</button><a class="alt" href="index.html">Về sảnh</a></div></div>`;
    this.ui.modal.classList.remove('hidden');
    this.ui.modal.querySelector('#resume').onclick = () => this.togglePause();
    this.ui.modal.querySelector('#pauseAttrs').onclick = () => this.openAttrSheet();
    bindLobbyLinks(this.ui.modal);
  }

  buildLevelUpHand() {
    const specials = SPECIAL_UPGRADES.filter(card => (this.upgradeLevels[card.id] || 0) < card.max);
    const risks = RISK_UPGRADES.filter(card => (this.upgradeLevels[card.id] || 0) < card.max);
    const hand = [];
    const seen = new Set();
    const pool = [...specials, ...risks];
    if (this.canSpendAnyAttr()) {
      // Bias lightly toward offering an attribute point each level-up.
      pool.push(ATTR_POINT_CARD, ATTR_POINT_CARD);
    }
    // After level 8, attribute points appear less often.
    if (this.level >= 8 && Math.random() < 0.45) {
      for (let i = pool.length - 1; i >= 0; i--) {
        if (pool[i].id === 'attrPoint') pool.splice(i, 1);
      }
    }
    shuffle(pool);
    for (const card of pool) {
      if (hand.length >= 3) break;
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      hand.push(card);
    }
    if (hand.length < 3 && this.canSpendAnyAttr() && !seen.has(ATTR_POINT_CARD.id)) {
      seen.add(ATTR_POINT_CARD.id);
      hand.push(ATTR_POINT_CARD);
    }
    for (const card of [...specials, ...risks]) {
      if (hand.length >= 3) break;
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      hand.push(card);
    }
    if (!hand.length) {
      hand.push({
        id:'overflowDamage',
        icon:'⚔',
        name:'Sức mạnh vô hạn',
        desc:'+10% sát thương',
        kind:'overflow',
        max:999,
        apply:g => { g.power.damageBonus *= 1.1; g.recalcAttributes(); },
      });
    }
    return hand.slice(0, 3);
  }

  flashEvent(text, duration = 3.2) {
    this.eventBannerText = text;
    this.eventBannerT = duration;
    if (this.ui.eventBanner) {
      this.ui.eventBanner.textContent = text;
      this.ui.eventBanner.classList.remove('hidden');
    }
  }

  updateEventBanner(dt) {
    if (this.eventBannerT <= 0) return;
    this.eventBannerT -= dt;
    if (this.eventBannerT > 0) return;
    this.eventBannerText = '';
    this.ui.eventBanner?.classList.add('hidden');
  }

  updateTempBuffs(dt) {
    for (const [key, buff] of Object.entries(this.tempBuffs)) {
      buff.t -= dt;
      if (buff.t <= 0) delete this.tempBuffs[key];
    }
  }

  grantXp(amount) {
    this.xp += Math.max(0, amount);
    while (this.xp >= this.xpNeeded()) {
      this.xp -= this.xpNeeded();
      this.level++;
      this.pendingLevels++;
    }
    if (this.pendingLevels > 0 && this.state === 'playing') this.showLevelUp();
  }

  checkSynergies() {
    const owned = this.upgradeLevels;
    for (const syn of SYNERGY_DEFS) {
      if (this.synergies[syn.id]) continue;
      if (!syn.requires.every(id => (owned[id] || 0) > 0)) continue;
      this.synergies[syn.id] = true;
      this.toast(`${syn.icon} Đồng bộ: ${syn.name}`);
      this.flashEvent(`${syn.icon} ${syn.name} — ${syn.desc}`, 3.6);
    }
  }

  updateSafeRing(dt) {
    if (!this._ringWarned && this.elapsed >= RING_START_AT - 8) {
      this._ringWarned = true;
      this.flashEvent('⚠ Vòng lửa sắp thu hẹp!', 3.5);
    }
    if (this.elapsed >= RING_START_AT) {
      if (!this._ringStarted) {
        this._ringStarted = true;
        this.flashEvent('🔥 Vòng lửa đang thu hẹp!', 3.8);
        this.toast('🔥 Vòng lửa thu hẹp');
      }
      this.arenaRadius = Math.max(ARENA_MIN, this.arenaRadius - RING_SHRINK_PER_SEC * dt);
    }
    const radius = this.arenaRadius;
    if (this.safeRing) {
      const visible = this.elapsed >= RING_START_AT - 10;
      this.safeRing.material.opacity = visible ? 0.72 : 0;
      this.safeRing.scale.setScalar(radius / ARENA);
      this.dangerDisk.material.opacity = visible ? 0.16 : 0;
      this.dangerDisk.scale.setScalar(radius / ARENA);
    }
    const hero = this.hero;
    if (!hero || hero.dead) return;
    const dist = hero.root.position.length();
    if (dist > radius - 0.55) {
      this.ringDamageClock -= dt;
      hero.root.position.setLength(Math.min(dist, radius - 0.35));
      if (this.ringDamageClock <= 0) {
        this.ringDamageClock = 0.45;
        this.damageHero(7 + Math.floor((ARENA - radius) * 0.35), -hero.root.position.x, -hero.root.position.z);
      }
    } else {
      this.ringDamageClock = 0;
    }
  }

  async updateBossEvents() {
    for (const event of BOSS_EVENTS) {
      if (this.elapsed < event.at || this.bossSpawned[event.variantId]) continue;
      this.bossSpawned[event.variantId] = true;
      this.flashEvent(`${event.icon} Boss: ${event.name}`, 4.2);
      this.toast(`${event.icon} ${event.name}`);
      this.spawnBoss(event);
    }
  }

  async spawnBoss(event) {
    if (!this.scene) return;
    const runId = this.runId;
    const entry = byId[event.entryId];
    if (!entry) return;
    this.pendingSpawns++;
    let model;
    try {
      model = await spawnModel(entry, entry.height);
    } finally {
      this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
    }
    if (runId !== this.runId || !this.scene) return;
    const enemy = this.makeUnit(entry, model, {
      ...entry.stats,
      team:'enemy',
      hp:event.hp,
      speed:event.speed,
      dmg:event.dmg,
    });
    enemy.maxHp = enemy.hp;
    enemy.defense = event.defense;
    enemy.gem = event.gem;
    enemy.visualScale = event.scale;
    enemy.radius *= event.scale * 1.15;
    enemy.isBoss = true;
    enemy.bossName = event.name;
    enemy.bossIcon = event.icon;
    enemy.spawn = 0;
    enemy.hitFlash = 0;
    enemy.slowT = 0;
    enemy.slowFactor = 1;
    enemy.paralyzeT = 0;
    enemy.vx = 0;
    enemy.vz = 0;
    enemy.bossCd = 2.5;
    enemy.telegraphT = 0;
    enemy.chargeT = 0;
    enemy.chargeDir = new THREE.Vector3();
    const a = Math.random() * Math.PI * 2;
    const r = Math.min(this.arenaRadius - 2.5, 14);
    enemy.root.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    enemy.root.scale.setScalar(0.01);
    enemy.ring.material.color.setHex(0xa855f7);
    enemy.anim.play('run');
    this.scene.add(enemy.root);
    this.enemies.push(enemy);
    this.ensureEnemyHealth(enemy);
    this.updateEnemyHealth(enemy);
  }

  updateFieldDrops(dt) {
    this.fieldDropClock -= dt;
    if (this.fieldDropClock <= 0 && this.fieldDrops.length < FIELD_DROP_MAX) {
      const luck = this.attrs.luck || 0;
      this.fieldDropClock = (16 + Math.random() * 12) / (1 + luck * 0.07);
      this.spawnFieldDrop();
    }
    for (const drop of this.fieldDrops) {
      drop.life -= dt;
      drop.phase += dt * 3.2;
      drop.mesh.rotation.y += dt * 2.4;
      drop.mesh.position.y = 0.55 + Math.sin(drop.phase) * 0.12;
      drop.halo.material.opacity = 0.35 + Math.sin(drop.phase * 1.4) * 0.2;
      if (drop.life < 4) drop.mesh.scale.setScalar(0.75 + Math.sin(drop.phase * 8) * 0.12);
      const dx = drop.mesh.position.x - this.hero.root.position.x;
      const dz = drop.mesh.position.z - this.hero.root.position.z;
      if (dx * dx + dz * dz < (this.hero.radius + 0.7) ** 2) {
        drop.def.apply(this);
        this.toast(`${drop.def.icon} ${drop.def.name}`);
        this.flashEvent(`${drop.def.icon} Nhặt được: ${drop.def.name}`, 2.4);
        drop.dead = true;
        this.updateHud();
      } else if (drop.life <= 0) {
        drop.dead = true;
      }
    }
    for (const drop of this.fieldDrops) {
      if (!drop.dead) continue;
      this.scene.remove(drop.mesh);
      drop.mesh.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }
    this.fieldDrops = this.fieldDrops.filter(drop => !drop.dead);
  }

  spawnFieldDrop() {
    if (!this.scene || !this.hero) return;
    let def = FIELD_DROPS[Math.floor(Math.random() * FIELD_DROPS.length)];
    // May mắn lệch nhẹ về phần thưởng điểm thuộc tính.
    if ((this.attrs.luck || 0) > 0 && Math.random() < this.attrs.luck * 0.03) {
      def = FIELD_DROPS.find(item => item.id === 'fieldAttr') || def;
    }
    const life = 15 + Math.random() * 15;
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.38, 0),
      new THREE.MeshBasicMaterial({ color:def.color, toneMapped:false })
    );
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.68, 28),
      new THREE.MeshBasicMaterial({ color:def.color, transparent:true, opacity:0.5, depthWrite:false, side:THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    group.add(core);
    group.add(halo);
    let placed = false;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * Math.max(3, this.arenaRadius - 5);
      group.position.set(Math.cos(a) * r, 0.55, Math.sin(a) * r);
      const dx = group.position.x - this.hero.root.position.x;
      const dz = group.position.z - this.hero.root.position.z;
      if (dx * dx + dz * dz > 16 && group.position.length() < this.arenaRadius - 1.2) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const a = Math.random() * Math.PI * 2;
      group.position.set(Math.cos(a) * (this.arenaRadius * 0.55), 0.55, Math.sin(a) * (this.arenaRadius * 0.55));
    }
    this.scene.add(group);
    this.fieldDrops.push({ mesh:group, halo, def, life, phase:Math.random() * 6, dead:false });
    this.flashEvent(`${def.icon} Phần thưởng xuất hiện trên bản đồ!`, 2.8);
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
      if (hero.root.position.length() > this.arenaRadius - 0.8) hero.root.position.setLength(this.arenaRadius - 0.8);
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
      damage:this.hero.dmg * this.power.damage * (this.tempBuffs.damage?.mult || 1),
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
          this.hitEnemy(enemy, projectile.damage, { canCrit:true });
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

  applyFreeze(enemy, strength = this.power.freeze) {
    if (!enemy || enemy.dead || strength <= 0) return;
    enemy.slowT = Math.max(enemy.slowT, 1.4 + strength * 0.35);
    enemy.slowFactor = Math.min(enemy.slowFactor, Math.max(0.38, 0.82 - strength * 0.1));
    if (Math.random() < 0.06 + strength * 0.04) {
      enemy.paralyzeT = Math.max(enemy.paralyzeT, 0.45 + strength * 0.1);
    }
  }

  applyProjectileEffects(primary, damage, projectile) {
    const P = this.power;
    const origin = primary.root.position.clone();
    projectile.secondaryHits.add(primary);
    const hitCount = projectile.hits.size;

    if (P.freeze > 0 && !primary.dead) this.applyFreeze(primary);

    if (P.blast > 0) {
      const radius = 1.2 + P.blast * 0.35;
      const splashDamage = damage * (0.25 + P.blast * 0.05);
      for (const enemy of this.enemies) {
        if (enemy.dead || projectile.secondaryHits.has(enemy)) continue;
        if (enemy.root.position.distanceToSquared(origin) <= radius * radius) {
          projectile.secondaryHits.add(enemy);
          this.hitEnemy(enemy, splashDamage);
          if (this.synergies.frostBurst) this.applyFreeze(enemy, Math.max(1, P.freeze));
        }
      }
      this.addBlastEffect(origin, radius);
    }

    // Mảnh nổ: mỗi lần xuyên (từ hit thứ 2) nổ nhỏ quanh mục tiêu.
    if (this.synergies.shrapnel && hitCount >= 2) {
      const radius = 0.95;
      for (const enemy of this.enemies) {
        if (enemy.dead || enemy === primary) continue;
        if (enemy.root.position.distanceToSquared(origin) <= radius * radius) {
          this.hitEnemy(enemy, damage * 0.22);
        }
      }
      this.addBlastEffect(origin, radius);
    }

    const chainJumps = P.chain + (this.synergies.stormVolley ? Math.max(0, P.multi - 1) : 0);
    if (chainJumps > 0) {
      const used = projectile.secondaryHits;
      const chainRange = 4.1 + P.chain * 0.35;
      const chainDamage = damage * (0.3 + P.chain * 0.04);
      let from = primary;
      for (let jump = 0; jump < chainJumps; jump++) {
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
        if (this.synergies.frostBurst && P.freeze > 0) this.applyFreeze(target);
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
        const base = enemy.isBoss ? 0xa855f7 : 0xf87171;
        enemy.ring.material.color.setHex(status === 2 ? 0xfde047 : status === 1 ? 0x38bdf8 : base);
      }

      const pos = enemy.root.position;
      let dx = heroPos.x - pos.x;
      let dz = heroPos.z - pos.z;
      let distance = Math.max(0.001, Math.hypot(dx, dz));
      // Soft separation + velocity lerp — tránh giật khi đám đông chen nhau.
      let sepX = 0;
      let sepZ = 0;

      for (let gx = enemy.gridX - 1; gx <= enemy.gridX + 1; gx++) {
        for (let gz = enemy.gridZ - 1; gz <= enemy.gridZ + 1; gz++) {
          const bucket = this.enemyGrid.get((gx + 64) * 256 + gz + 64);
          if (!bucket) continue;
          for (const other of bucket) {
            if (other === enemy || other.dead) continue;
            const ox = pos.x - other.root.position.x;
            const oz = pos.z - other.root.position.z;
            const odSq = ox * ox + oz * oz;
            const minimum = (enemy.radius + other.radius) * 0.62;
            if (odSq > 1e-6 && odSq < minimum * minimum) {
              const od = Math.sqrt(odSq);
              const push = (minimum - od) / od;
              sepX += ox * push;
              sepZ += oz * push;
            }
          }
        }
      }

      const sepLen = Math.hypot(sepX, sepZ);
      const sepCap = enemy.speed * 1.15;
      if (sepLen > sepCap) {
        const s = sepCap / sepLen;
        sepX *= s;
        sepZ *= s;
      }

      const moveScale = enemy.paralyzeT > 0 ? 0 : enemy.slowT > 0 ? enemy.slowFactor : 1;
      if (enemy.isBoss) {
        enemy.bossCd = Math.max(0, (enemy.bossCd || 0) - dt);
        if (enemy.telegraphT > 0) {
          enemy.telegraphT -= dt;
          enemy.vx = 0;
          enemy.vz = 0;
          enemy.anim.play('idle');
          enemy.ring.material.color.setHex(0xfde047);
          if (enemy.telegraphT <= 0) {
            enemy.chargeT = 0.75;
            enemy.chargeDir.set(dx / distance, 0, dz / distance);
            enemy.bossCd = 4.2;
          }
        } else if (enemy.chargeT > 0) {
          enemy.chargeT -= dt;
          enemy.vx = enemy.chargeDir.x * enemy.speed * 2.8;
          enemy.vz = enemy.chargeDir.z * enemy.speed * 2.8;
          pos.x += enemy.vx * dt;
          pos.z += enemy.vz * dt;
          this.faceTo(enemy, pos.x + enemy.chargeDir.x, pos.z + enemy.chargeDir.z, dt, 12);
          enemy.anim.play('run');
          enemy.ring.material.color.setHex(0xef4444);
        } else if (enemy.bossCd <= 0 && moveScale > 0) {
          enemy.telegraphT = 0.95;
        }
      }
      if (!(enemy.isBoss && (enemy.telegraphT > 0 || enemy.chargeT > 0))) {
        const seekX = dx / distance * enemy.speed * moveScale;
        const seekZ = dz / distance * enemy.speed * moveScale;
        const wantX = seekX + sepX * (enemy.isBoss ? 0.85 : 1.8);
        const wantZ = seekZ + sepZ * (enemy.isBoss ? 0.85 : 1.8);
        const blend = 1 - Math.exp(-10 * dt);
        enemy.vx = (enemy.vx || 0) + (wantX - (enemy.vx || 0)) * blend;
        enemy.vz = (enemy.vz || 0) + (wantZ - (enemy.vz || 0)) * blend;
        pos.x += enemy.vx * dt;
        pos.z += enemy.vz * dt;
        const speedSq = enemy.vx * enemy.vx + enemy.vz * enemy.vz;
        if (speedSq > 0.04) this.faceTo(enemy, pos.x + enemy.vx, pos.z + enemy.vz, dt, 7);
        else this.faceTo(enemy, heroPos.x, heroPos.z, dt, 6);
        enemy.anim.play(moveScale > 0 ? 'run' : 'idle');
      }
      if (pos.length() > this.arenaRadius - 0.6) pos.setLength(this.arenaRadius - 0.6);

      dx = heroPos.x - pos.x;
      dz = heroPos.z - pos.z;
      distance = Math.max(0.001, Math.hypot(dx, dz));
      if (distance < this.hero.radius + enemy.radius + 0.12 && this.hero.invulnerable <= 0) {
        const bump = enemy.isBoss && enemy.chargeT > 0 ? 1.55 : 1;
        this.damageHero(enemy.dmg * bump, dx / distance, dz / distance);
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

  hitEnemy(enemy, amount, { canCrit = false } = {}) {
    if (enemy.dead) return;
    let raw = amount;
    if (canCrit && (this.power.critChance || 0) > 0 && Math.random() < this.power.critChance) {
      raw *= this.power.critMult || 1.55;
    }
    if ((enemy.isBoss || enemy.isElite) && this.power.eliteMult) raw *= this.power.eliteMult;
    const dealt = Math.max(1, raw - enemy.defense);
    enemy.hp -= dealt;
    if ((this.power.vampRate || 0) > 0 && this.hero && !this.hero.dead) {
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + dealt * this.power.vampRate);
    }
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
      this.maybeSpawnPotion(enemy);
      if (enemy.isBoss) {
        this.spawnGem(enemy.root.position, Math.max(12, Math.round(enemy.gem * 0.5)));
        this.attrPoints++;
        this.updateAttrBadge();
        this.renderAttrRows();
        this.toast(`${enemy.bossIcon || '★'} Hạ ${enemy.bossName || 'Boss'}! +1 điểm`);
        this.flashEvent(`${enemy.bossIcon || '★'} Boss bị đánh bại!`, 3.5);
        this.grantXp(18);
      }
    }
  }

  maybeSpawnPotion(enemy) {
    const luck = this.attrs.luck || 0;
    const base = enemy.isBoss ? 0.9 : enemy.isElite ? 0.3 : 0.15;
    const chance = Math.min(0.95, base * (1 + luck * 0.05));
    if (Math.random() > chance) return;
    const healPct = enemy.isBoss ? 0.35 : enemy.isElite ? 0.24 : 0.16 + Math.random() * 0.06;
    const pos = enemy.root.position;
    const offset = 0.45 + Math.random() * 0.35;
    const a = Math.random() * Math.PI * 2;
    this.spawnPotion(
      tmp2.set(pos.x + Math.cos(a) * offset, 0, pos.z + Math.sin(a) * offset),
      healPct
    );
  }

  updateRegen(dt) {
    this.regenGate = Math.max(0, this.regenGate - dt);
    const rate = this.power.regenPerSec || 0;
    if (rate <= 0 || this.regenGate > 0 || !this.hero || this.hero.dead) return;
    if (this.hero.hp >= this.hero.maxHp) return;
    this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + rate * dt);
  }

  damageHero(amount, dx, dz) {
    const damage = Math.max(1, Math.round(amount * this.power.armor * (this.power.takenDamageMult || 1)));
    this.hero.hp -= damage;
    this.hero.invulnerable = 0.62;
    this.regenGate = 1.6;
    const knock = 0.85 * Math.max(0.2, 1 - (this.power.massResist || 0));
    this.hero.root.position.x += dx * knock;
    this.hero.root.position.z += dz * knock;
    if (this.hero.root.position.length() > this.arenaRadius - 0.8) this.hero.root.position.setLength(this.arenaRadius - 0.8);
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
    if (!mesh) mesh = createGemMesh(tier);
    mesh.visible = true;
    mesh.position.copy(position);
    mesh.position.y = 0.28;
    // Sprite scale = kích thước pixel trên thế giới (shared material, không clone).
    mesh.scale.set(tier.size * 1.85, tier.size * 2.25, 1);
    this.scene.add(mesh);
    this.pickups.push({ kind:'gem', mesh, value, tier, poolKey:key, age:0, collected:false });
  }

  spawnPotion(position, healPct = 0.18) {
    const key = 'potion';
    let pool = this.gemPool.get(key);
    if (!pool) {
      pool = [];
      this.gemPool.set(key, pool);
    }
    let mesh = pool.pop();
    if (!mesh) mesh = createPotionMesh();
    mesh.visible = true;
    mesh.position.copy(position);
    mesh.position.y = 0.12;
    mesh.scale.set(0.85, 0.95, 1);
    this.scene.add(mesh);
    this.pickups.push({ kind:'potion', mesh, healPct, poolKey:key, age:0, collected:false });
  }

  updatePickups(dt) {
    const heroPos = this.hero.root.position;
    for (const pickup of this.pickups) {
      pickup.age += dt;
      // Sprite billboard — chỉ hút nam châm, không xoay mesh.
      const dx = pickup.mesh.position.x - heroPos.x;
      const dz = pickup.mesh.position.z - heroPos.z;
      const distanceSq = dx * dx + dz * dz;
      const magnet = 2.2 * this.power.magnet * (this.power.attrMagnet || 1);
      if (distanceSq < magnet * magnet) {
        const distance = Math.sqrt(distanceSq) || 0.001;
        const y = pickup.kind === 'potion' ? 0.12 : 0.28;
        pickup.mesh.position.lerp(tmp2.set(heroPos.x, y, heroPos.z), Math.min(1, dt * (3 + magnet / distance)));
      }
      if (distanceSq < (this.hero.radius + 0.45) ** 2 || pickup.age > 45) this.collectPickup(pickup);
    }
    this.pickups = this.pickups.filter(pickup => !pickup.collected);
  }

  releaseGem(pickup) {
    if (!pickup?.mesh) return;
    this.scene?.remove(pickup.mesh);
    pickup.mesh.visible = false;
    const pool = this.gemPool?.get(pickup.poolKey);
    if (pool) pool.push(pickup.mesh);
    // Shared SpriteMaterial/texture — không dispose theo từng instance.
  }

  collectPickup(pickup) {
    if (pickup.kind === 'potion') this.collectPotion(pickup);
    else this.collectGem(pickup);
  }

  collectGem(pickup) {
    if (pickup.collected) return;
    pickup.collected = true;
    this.releaseGem(pickup);
    this.gems += pickup.value;
    this.grantXp(pickup.value * (this.power.luckXp || 1));
  }

  collectPotion(pickup) {
    if (pickup.collected || !this.hero) return;
    pickup.collected = true;
    this.releaseGem(pickup);
    const heal = Math.max(12, Math.round(this.hero.maxHp * (pickup.healPct || 0.18)));
    const before = this.hero.hp;
    this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + heal);
    const gained = Math.round(this.hero.hp - before);
    if (gained > 0) this.toast(`♥ +${gained} máu`);
    this.updateHud();
  }

  xpNeeded() {
    return 6 + (this.level - 1) * 7;
  }

  showLevelUp() {
    this.closeAttrSheet();
    this.state = 'levelup';
    this.needsRender = true;
    this.clearMovement();
    this.hand = this.buildLevelUpHand();
    this.ui.modal.innerHTML = `
      <div class="box">
        <h2>✨ Lên cấp ${this.level}!</h2>
        <p>Chọn kỹ năng bổ trợ hoặc điểm thuộc tính</p>
        <div class="cards">${this.hand.map((card, i) => {
          const levelLabel = card.kind === 'attr'
            ? 'Điểm +1'
            : card.kind === 'risk'
              ? 'Rủi ro'
              : `Cấp ${(this.upgradeLevels[card.id] || 0) + 1}/${card.max}`;
          return `<button class="card ${card.kind === 'risk' ? 'risk' : ''}" data-card="${i}">
            <span class="icon">${card.icon}</span><b>${card.name}</b>
            <small>${card.desc}</small>
            <em>${levelLabel}</em>
          </button>`;
        }).join('')}</div>
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
    if (card.kind === 'attr') {
      this.attrPoints++;
      this.updateAttrBadge();
      this.renderAttrRows();
      this.toast('◎ +1 điểm thuộc tính');
    } else {
      this.upgradeLevels[card.id] = (this.upgradeLevels[card.id] || 0) + 1;
      card.apply(this);
      this.checkSynergies();
      this.toast(card.kind === 'risk'
        ? `${card.icon} ${card.name}`
        : `${card.icon} ${card.name} cấp ${this.upgradeLevels[card.id]}`);
    }
    this.pendingLevels--;
    this.ui.modal.classList.add('hidden');
    if (this.pendingLevels > 0) this.showLevelUp();
    else this.state = 'playing';
    this.updateHud();
  }

  togglePause() {
    if (this.attrSheetOpen) {
      this.closeAttrSheet();
      return;
    }
    if (this.state === 'playing') {
      this.state = 'paused';
      this.clearMovement();
      this.showPauseModal();
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
    const stageLabel = this.elapsed >= RING_START_AT
      ? `VÒNG ${Math.round(this.arenaRadius)}`
      : `MÀN ${this.stageIndex + 1}`;
    if (cache.stageLabel !== stageLabel) {
      cache.stageLabel = stageLabel;
      this.ui.stage.textContent = stageLabel;
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

  // Keep attr sheet closed across scene rebuilds.
  cleanupAttrUi() {
    this.attrSheetOpen = false;
    this.ui.attrSheet?.classList.add('hidden');
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
    if (unit.burnRings?.length) {
      for (const ring of unit.burnRings) {
        unit.root.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
      }
      unit.burnRings = [];
    }
    const skeletons = new Set();
    unit.model?.traverse(object => {
      if (object.isSkinnedMesh && object.skeleton) skeletons.add(object.skeleton);
    });
    for (const skeleton of skeletons) skeleton.dispose();
  }

  cleanupScene() {
    if (!this.scene) return;
    this.cleanupAttrUi();
    this.currentIntro = null;
    this.introRemaining = 0;
    this.ui.enemyIntro?.classList.add('hidden');
    for (const projectile of this.projectiles || []) this.removeProjectile(projectile);
    for (const pickup of this.pickups || []) this.releaseGem(pickup);
    for (const drop of this.fieldDrops || []) {
      this.scene?.remove(drop.mesh);
      drop.mesh?.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }
    this.fieldDrops = [];
    this.ui.eventBanner?.classList.add('hidden');
    this.gemPool?.clear?.();
    disposeSharedPickups();
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
