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
const FIELD_DROP_MAX = 3;
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
  cardMats: new Map(),
  cardPlane: null,
};

/** Tia sét lan — dùng BoxGeometry dày (Line WebGL gần như vô hình trên mobile). */
const CHAIN_SEGMENTS = 12;
const SHARED_FX = {
  chainBox: null,
  chainCoreMat: null,
  chainGlowMat: null,
  chainFlashMat: null,
};

function getChainSharedFx() {
  if (!SHARED_FX.chainBox) {
    SHARED_FX.chainBox = new THREE.BoxGeometry(1, 1, 1);
    SHARED_FX.chainCoreMat = new THREE.MeshBasicMaterial({
      color:0xf8feff, transparent:true, opacity:1, depthWrite:false, toneMapped:false,
    });
    SHARED_FX.chainGlowMat = new THREE.MeshBasicMaterial({
      color:0x22d3ee, transparent:true, opacity:0.55, depthWrite:false, toneMapped:false,
      blending:THREE.AdditiveBlending,
    });
    const flash = document.createElement('canvas');
    flash.width = flash.height = 64;
    const ctx = flash.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(125,249,255,0.95)');
    grad.addColorStop(0.7, 'rgba(34,211,238,0.35)');
    grad.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(flash);
    tex.colorSpace = THREE.SRGBColorSpace;
    SHARED_FX.chainFlashMat = new THREE.SpriteMaterial({
      map:tex, transparent:true, depthWrite:false, toneMapped:false,
      blending:THREE.AdditiveBlending,
    });
  }
  return SHARED_FX;
}

function disposeSharedFx() {
  SHARED_FX.chainBox?.dispose();
  SHARED_FX.chainCoreMat?.dispose();
  SHARED_FX.chainGlowMat?.dispose();
  if (SHARED_FX.chainFlashMat) {
    SHARED_FX.chainFlashMat.map?.dispose();
    SHARED_FX.chainFlashMat.dispose();
  }
  SHARED_FX.chainBox = null;
  SHARED_FX.chainCoreMat = null;
  SHARED_FX.chainGlowMat = null;
  SHARED_FX.chainFlashMat = null;
}

function createChainBoltGroup() {
  const shared = getChainSharedFx();
  const group = new THREE.Group();
  group.userData.sharedFx = true;
  // Clone material theo group — mỗi tia tự fade/flicker, không đụng tia khác.
  const coreMat = shared.chainCoreMat.clone();
  const glowMat = shared.chainGlowMat.clone();
  const flashMat = shared.chainFlashMat.clone();
  group.userData.coreMat = coreMat;
  group.userData.glowMat = glowMat;
  group.userData.flashMat = flashMat;
  group.userData.segments = [];
  for (let i = 0; i < CHAIN_SEGMENTS; i++) {
    const glow = new THREE.Mesh(shared.chainBox, glowMat);
    const core = new THREE.Mesh(shared.chainBox, coreMat);
    glow.visible = false;
    core.visible = false;
    group.add(glow);
    group.add(core);
    group.userData.segments.push({ glow, core });
  }
  const flashA = new THREE.Sprite(flashMat);
  const flashB = new THREE.Sprite(flashMat);
  flashA.scale.set(0.01, 0.01, 0.01);
  flashB.scale.set(0.01, 0.01, 0.01);
  group.add(flashA);
  group.add(flashB);
  group.userData.flashA = flashA;
  group.userData.flashB = flashB;
  return group;
}

const _chainDir = new THREE.Vector3();
const _chainMid = new THREE.Vector3();
const _chainZ = new THREE.Vector3(0, 0, 1);

function placeChainSegment(mesh, ax, ay, az, bx, by, bz, thickness) {
  _chainDir.set(bx - ax, by - ay, bz - az);
  const len = Math.max(0.08, _chainDir.length());
  _chainMid.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  _chainDir.multiplyScalar(1 / len);
  mesh.position.copy(_chainMid);
  mesh.scale.set(thickness, thickness, len);
  mesh.quaternion.setFromUnitVectors(_chainZ, _chainDir);
  mesh.visible = true;
}

function buildLightningPath(from, to, count) {
  const points = new Float32Array((count + 1) * 3);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz) || 0.01;
  const nx = -dz / dist;
  const nz = dx / dist;
  const yBase = 0.72;
  points[0] = from.x;
  points[1] = yBase + 0.15;
  points[2] = from.z;
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const fade = 1 - Math.abs(t - 0.5) * 1.6;
    const amp = (0.28 + dist * 0.1) * Math.max(0.15, fade);
    const off = (Math.random() - 0.5) * 2 * amp;
    const yOff = (Math.random() - 0.35) * 0.55;
    points[i * 3] = from.x + dx * t + nx * off;
    points[i * 3 + 1] = yBase + 0.2 + yOff;
    points[i * 3 + 2] = from.z + dz * t + nz * off;
  }
  points[count * 3] = to.x;
  points[count * 3 + 1] = yBase + 0.15;
  points[count * 3 + 2] = to.z;
  return points;
}

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

/** Bình máu kiểu RPG — silhouette chai rõ (nút bần to + cổ dày + bầu đỏ + ♥). */
function makePotionTexture() {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const cx = 128;

  // Hào quang đỏ dưới chân.
  const glow = ctx.createRadialGradient(cx, 228, 6, cx, 228, 72);
  glow.addColorStop(0, 'rgba(239,68,68,0.6)');
  glow.addColorStop(0.5, 'rgba(239,68,68,0.2)');
  glow.addColorStop(1, 'rgba(239,68,68,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx, 230, 64, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bầu bình (pear / round-flask) — phần lớn nhất, đỏ đậm.
  const bulbGrad = ctx.createLinearGradient(60, 100, 200, 220);
  bulbGrad.addColorStop(0, '#ffe4ea');
  bulbGrad.addColorStop(0.3, '#ff6b81');
  bulbGrad.addColorStop(0.65, '#e11d48');
  bulbGrad.addColorStop(1, '#9f1239');
  ctx.beginPath();
  // Vai chai → bầu tròn dưới.
  ctx.moveTo(98, 108);
  ctx.bezierCurveTo(62, 118, 48, 160, 58, 190);
  ctx.bezierCurveTo(68, 220, 188, 220, 198, 190);
  ctx.bezierCurveTo(208, 160, 194, 118, 158, 108);
  ctx.closePath();
  ctx.fillStyle = bulbGrad;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Mặt nước.
  ctx.beginPath();
  ctx.ellipse(cx, 118, 42, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,200,210,0.5)';
  ctx.fill();

  // Cổ chai DÀY — nhìn rõ từ xa, không lẫn quả bóng.
  const neckGrad = ctx.createLinearGradient(108, 40, 148, 120);
  neckGrad.addColorStop(0, '#fecdd3');
  neckGrad.addColorStop(0.45, '#fb7185');
  neckGrad.addColorStop(1, '#be123c');
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(110, 112);
  ctx.lineTo(110, 52);
  ctx.quadraticCurveTo(110, 42, 128, 42);
  ctx.quadraticCurveTo(146, 42, 146, 52);
  ctx.lineTo(146, 112);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Vai (shoulder) nối cổ–bầu.
  ctx.beginPath();
  ctx.moveTo(98, 108);
  ctx.quadraticCurveTo(128, 100, 158, 108);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Nút bần TO, nâu vàng — điểm nhận diện chai thuốc.
  const corkGrad = ctx.createLinearGradient(100, 18, 156, 48);
  corkGrad.addColorStop(0, '#fcd34d');
  corkGrad.addColorStop(0.4, '#d97706');
  corkGrad.addColorStop(1, '#78350f');
  ctx.fillStyle = corkGrad;
  ctx.beginPath();
  ctx.roundRect(102, 16, 52, 30, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, 28); ctx.lineTo(146, 28);
  ctx.moveTo(110, 36); ctx.lineTo(146, 36);
  ctx.stroke();

  // Highlight thủy tinh.
  ctx.beginPath();
  ctx.ellipse(84, 155, 11, 28, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(92, 130, 5, 10, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();

  // Trái tim trắng lớn.
  ctx.save();
  ctx.translate(cx, 160);
  ctx.scale(1.45, 1.35);
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.bezierCurveTo(-20, -2, -20, -20, -9, -20);
  ctx.bezierCurveTo(-3, -20, 0, -13, 0, -13);
  ctx.bezierCurveTo(0, -13, 3, -20, 9, -20);
  ctx.bezierCurveTo(20, -20, 20, -2, 0, 12);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(127,29,29,0.5)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(cx - 7, 148, 4, 3, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
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

function createPotionMesh(scale = 0.72) {
  const sprite = new THREE.Sprite(getPotionMaterial());
  // Cao hơn rộng — giữ tỉ lệ chai đứng; mặc định ~50% kích thước cũ.
  sprite.scale.set(scale * 0.9, scale * 1.35, 1);
  sprite.center.set(0.5, 0.05);
  sprite.userData.sharedPickup = true;
  sprite.userData.potionScale = scale;
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
  for (const mat of SHARED_PICKUPS.cardMats.values()) {
    mat.map?.dispose();
    mat.dispose();
  }
  SHARED_PICKUPS.cardMats.clear();
  SHARED_PICKUPS.cardPlane?.dispose();
  SHARED_PICKUPS.cardPlane = null;
}

/** Texture thẻ kỹ năng — icon lớn, viền vàng, xoay trên map. */
function makeSkillCardTexture(icon, title, accentHex = 0xfbbf24) {
  const W = 160;
  const H = 220;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const accent = `#${(accentHex >>> 0).toString(16).padStart(6, '0')}`;

  // Bóng
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(W / 2, H - 14, 48, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thân thẻ
  const grad = ctx.createLinearGradient(20, 16, 140, 200);
  grad.addColorStop(0, '#fff7ed');
  grad.addColorStop(0.55, '#ffedd5');
  grad.addColorStop(1, '#fdba74');
  roundRectPath(ctx, 18, 12, 124, 186, 16);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, 28, 22, 104, 166, 12);
  ctx.stroke();

  // Icon
  ctx.font = '64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon || '✦', W / 2, 88);

  // Nhãn
  ctx.fillStyle = '#7c2d12';
  ctx.font = 'bold 18px sans-serif';
  const label = (title || 'Thẻ kỹ năng').slice(0, 12);
  ctx.fillText(label, W / 2, 150);
  ctx.fillStyle = accent;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('KỸ NĂNG', W / 2, 174);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function getSkillCardMaterial(skill) {
  const key = skill?.id || 'generic';
  let mat = SHARED_PICKUPS.cardMats.get(key);
  if (mat) return mat;
  mat = new THREE.MeshBasicMaterial({
    map: makeSkillCardTexture(skill?.icon || '✦', skill?.name || 'Thẻ kỹ năng', skill?.color || 0xf59e0b),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  SHARED_PICKUPS.cardMats.set(key, mat);
  return mat;
}

function getSkillCardPlane() {
  if (!SHARED_PICKUPS.cardPlane) {
    SHARED_PICKUPS.cardPlane = new THREE.PlaneGeometry(1.05, 1.45);
  }
  return SHARED_PICKUPS.cardPlane;
}

function createSkillCardMesh(skill) {
  const mesh = new THREE.Mesh(getSkillCardPlane(), getSkillCardMaterial(skill));
  mesh.position.y = 0.72;
  mesh.userData.sharedPickup = true;
  return mesh;
}

/** Field-drop cleanup — bỏ qua SpriteMaterial/texture dùng chung. */
function disposeFieldDropVisual(mesh) {
  mesh?.traverse(obj => {
    if (obj.isSprite || obj.userData?.sharedPickup) return;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
}

function fmtPct(ratio) {
  return `${Math.round(ratio * 100)}%`;
}

function fmtMult(ratio) {
  const text = ratio.toFixed(2).replace(/\.?0+$/, '');
  return `×${text}`;
}

/** Chỉ số cơ bản — cộng bằng điểm thuộc tính trong bảng nhân vật. */
const ATTR_DEFS = [
  {
    id:'str', icon:'⚔', name:'Sức mạnh', max:12,
    desc:'Mỗi điểm +12% sát thương gây ra',
    value:g => `Hiện tại ${fmtMult(1 + (g.attrs.str || 0) * 0.12)} sát thương`,
  },
  {
    id:'agi', icon:'👟', name:'Tốc độ', max:12,
    desc:'Mỗi điểm +8% tốc độ chạy',
    value:g => {
      const mult = 1 + (g.attrs.agi || 0) * 0.08;
      const speed = (g.hero?.baseSpeed || 0) * mult;
      return `Hiện tại ${speed.toFixed(1)} tốc chạy (${fmtMult(mult)})`;
    },
  },
  {
    id:'vit', icon:'♥', name:'Sinh lực', max:12,
    desc:'Mỗi điểm +22 máu tối đa',
    value:g => `Hiện tại ${Math.round(g.hero?.maxHp || 0)} máu tối đa`,
  },
  {
    // Giáp lũy tiến: mỗi điểm nhận thêm ×0.94 sát thương — không bao giờ về 0.
    id:'def', icon:'⬟', name:'Phòng thủ', max:10,
    desc:'Mỗi điểm nhận thêm ×0.94 sát thương (giảm dần, không miễn nhiễm)',
    value:g => {
      const keep = Math.pow(0.94, g.attrs.def || 0);
      return `Hiện tại nhận ${fmtPct(keep)} sát thương (−${fmtPct(1 - keep)})`;
    },
  },
  {
    id:'cri', icon:'✴', name:'Chí mạng', max:10,
    desc:'Mỗi điểm +4% tỉ lệ chí mạng (tối đa 55%)',
    value:g => {
      const chance = Math.min(0.55, (g.attrs.cri || 0) * 0.04);
      const mult = 1.55 + (g.attrs.cri || 0) * 0.03;
      return `Hiện tại ${fmtPct(chance)} chí mạng · ${fmtMult(mult)}`;
    },
  },
  {
    id:'pull', icon:'🧲', name:'Hút ngọc', max:8,
    desc:'Mỗi điểm +10% tầm hút ngọc',
    value:g => `Hiện tại tầm hút ${fmtMult(1 + (g.attrs.pull || 0) * 0.1)}`,
  },
  {
    id:'regen', icon:'🌿', name:'Hồi phục', max:8,
    desc:'Mỗi điểm +0.45 máu/giây khi không vừa bị đánh',
    value:g => `Hiện tại +${((g.attrs.regen || 0) * 0.45).toFixed(2)} máu/giây`,
  },
  {
    id:'mass', icon:'🪨', name:'Khối lượng', max:8,
    desc:'Mỗi điểm giảm 8% đẩy lùi (tối đa 75%)',
    value:g => `Hiện tại giảm đẩy lùi ${fmtPct(Math.min(0.75, (g.attrs.mass || 0) * 0.08))}`,
  },
];

/** Phần thưởng lên cấp: kỹ năng bổ trợ (không gồm chỉ số cơ bản).
 *  stats: 1–2 dòng viết tắt tiếng Anh, hiện dưới icon trên thẻ. */
const SPECIAL_UPGRADES = [
  { id:'rate', icon:'✦', name:'Liên hoàn', stats:['+18% ATK SPD'], max:5, apply:g => { g.power.interval /= 1.18; } },
  { id:'multi', icon:'➹', name:'Đa mục tiêu', stats:['+1 MULTI'], max:3, apply:g => { g.power.multi++; } },
  { id:'pierce', icon:'➤', name:'Xuyên phá', stats:['+1 PIERCE'], max:3, apply:g => { g.power.pierce++; } },
  { id:'size', icon:'◉', name:'Đạn khổng lồ', stats:['+25% SIZE'], max:4, apply:g => { g.power.size *= 1.25; } },
  { id:'magnet', icon:'◆', name:'Nam châm', stats:['+35% MAGNET'], max:4, apply:g => { g.power.magnet *= 1.35; g.updateMagnetRing(); } },
  { id:'range', icon:'◎', name:'Tầm bắn', stats:['+15% RANGE'], max:5, apply:g => { g.power.range *= 1.15; g.updateRangeRing(); } },
  { id:'chain', icon:'ϟ', name:'Sét lan', stats:['+1 CHAIN'], max:4, apply:g => { g.power.chain++; } },
  { id:'blast', icon:'✹', name:'Nổ lan', stats:['+1 BLAST'], max:4, apply:g => { g.power.blast++; } },
  { id:'freeze', icon:'❄', name:'Băng giá', stats:['+SLOW', '+FREEZE%'], max:4, apply:g => { g.power.freeze++; } },
  { id:'burnAura', icon:'🔥', name:'Vòng lửa', stats:['BURN AURA'], max:5, apply:g => { g.power.burnAura++; g.updateBurnAura(); } },
  {
    id:'orbit', icon:'🌀', name:'Vòng xoáy',
    stats:['+ORBIT', '+DMG'],
    max:5, apply:g => { g.power.orbit++; g.updateOrbit(); },
  },
  // Trước đây nằm trong bảng thuộc tính — chuyển sang thẻ kỹ năng bổ trợ.
  {
    id:'vamp', icon:'🩸', name:'Hút máu',
    stats:['+2.5% VAMP'],
    max:5, apply:g => { g.power.vamp++; g.syncSupportPassives(); },
  },
  {
    id:'luck', icon:'🍀', name:'May mắn',
    stats:['+10% XP', '+LOOT'],
    max:5, apply:g => { g.power.luck++; g.syncSupportPassives(); },
  },
  {
    id:'elite', icon:'👑', name:'Săn boss',
    stats:['+12% BOSS DMG'],
    max:5, apply:g => { g.power.elite++; g.syncSupportPassives(); },
  },
];

/** Thẻ rủi ro: mạnh hơn nhưng có đánh đổi. */
const RISK_UPGRADES = [
  {
    id:'riskPower', icon:'⚖', name:'Giao kèo máu', kind:'risk', max:1,
    stats:['+45% ATK', '-20% MAX HP'],
    apply:g => {
      g.power.damageBonus *= 1.45;
      g.hero.baseMaxHp = Math.max(80, Math.round(g.hero.baseMaxHp * 0.8));
      g.recalcAttributes();
      g.hero.hp = Math.min(g.hero.hp, g.hero.maxHp);
    },
  },
  {
    id:'riskGlass', icon:'🪞', name:'Thủy tinh sắc', kind:'risk', max:1,
    stats:['+1 PIERCE', '+25% DMG TAKEN'],
    apply:g => {
      g.power.pierce++;
      g.power.takenDamageMult *= 1.25;
    },
  },
  {
    id:'riskSwift', icon:'💨', name:'Gió đổi mạng', kind:'risk', max:1,
    stats:['+22% SPEED', '-12% RANGE'],
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
  name:'Thuộc tính',
  stats:['+1 ATTR'],
  kind:'attr',
  max:999,
};

/** Mỗi phút một boss; archetype quyết định hướng mạnh (máu / tốc / sát thương). */
const BOSS_ARCHETYPES = [
  { entryId:'Trex', name:'T-Rex Hung Hãn', icon:'🦖', focus:'tank', focusLabel:'Giáp dày' },
  { entryId:'Triceratops', name:'Tri Sừng Gió', icon:'🦕', focus:'swift', focusLabel:'Tốc độ' },
  { entryId:'Trex', name:'T-Rex Huyết Chiến', icon:'🦖', focus:'bruiser', focusLabel:'Sát thương' },
  { entryId:'Triceratops', name:'Tri Sừng Thép', icon:'🦕', focus:'tank', focusLabel:'Giáp dày' },
  { entryId:'Trex', name:'T-Rex Bão Táp', icon:'🦖', focus:'swift', focusLabel:'Tốc độ' },
  { entryId:'Triceratops', name:'Tri Sừng Cuồng Nộ', icon:'🦕', focus:'bruiser', focusLabel:'Sát thương' },
];

const FIELD_DROPS = [
  { id:'fieldAttr', icon:'◎', color:0xa78bfa, name:'Điểm thuộc tính', apply:g => { g.attrPoints++; g.updateAttrBadge(); g.renderAttrRows(); } },
  { id:'fieldHeal', icon:'🧪', color:0xef4444, name:'Bình máu', apply:g => { g.grantHealthPotion(Math.round(g.hero.maxHp * 0.28)); } },
  { id:'fieldXp', icon:'✦', color:0xfbbf24, name:'Bùng nổ XP', apply:g => { g.grantXp(14); } },
  { id:'fieldShield', icon:'⛨', color:0x60a5fa, name:'Khiên tạm', apply:g => { g.hero.invulnerable = Math.max(g.hero.invulnerable, 2.4); } },
  { id:'fieldRage', icon:'⚔', color:0xef4444, name:'Nộ chiến', apply:g => { g.tempBuffs.damage = { t:9, mult:1.4 }; } },
  { id:'fieldSkill', icon:'🃏', color:0xf59e0b, name:'Thẻ kỹ năng', kind:'skillCard' },
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
      if (this.isLevelUpOpen() && ['1','2','3'].includes(key)) this.chooseUpgrade(Number(key) - 1);
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
    this.attrs = { str:0, agi:0, vit:0, def:0, cri:0, pull:0, regen:0, mass:0 };
    this.regenGate = 0;
    this.synergies = { frostBurst:false, stormVolley:false, shrapnel:false, frostburn:false };
    this.burnTick = 0;
    this.bossSpawned = {};
    this.bossWave = 0;
    this.arenaRadius = ARENA;
    this.ringDamageClock = 0;
    this.fieldDropClock = 12 + Math.random() * 6;
    this.tempBuffs = {};
    this.eventBannerText = '';
    this.eventBannerT = 0;
    this.power = {
      damage:1, damageBonus:1, interval:0.72, multi:1, pierce:0, size:1,
      magnet:1, range:BASE_ATTACK_RANGE, attackClock:0.4, armor:1,
      chain:0, blast:0, freeze:0, burnAura:0, orbit:0, takenDamageMult:1,
      vamp:0, luck:0, elite:0,
      vampRate:0, luckXp:1, eliteMult:1,
    };
    this.orbitAngle = 0;
    this.orbitTick = 0;

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
    this.updateOrbit();
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

    this.updateCameraFit();
    this.camera.position.set(0, this.camFit.height, this.camFit.offset);
    this.camera.lookAt(0, 0.55, 0);
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
    // Chỉ fit lại camera khi tầm bắn đổi.
    this.updateCameraFit();
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

  orbitRadius() {
    const level = this.power.orbit || 0;
    if (level <= 0) return 0;
    // Cấp cao → bay xa hơn quanh hero.
    return 1.35 + level * 0.48;
  }

  orbitOrbHitRadius() {
    const level = this.power.orbit || 0;
    if (level <= 0) return 0;
    return 0.42 + level * 0.05;
  }

  orbitDps() {
    const level = this.power.orbit || 0;
    if (level <= 0) return 0;
    return (7.2 + level * 3.4) * this.power.damage * (this.tempBuffs.damage?.mult || 1);
  }

  clearOrbit() {
    if (!this.hero?.orbitGroup) return;
    this.hero.root.remove(this.hero.orbitGroup);
    if (this.hero.orbitPath) {
      this.hero.orbitPath.geometry.dispose();
      this.hero.orbitPath.material.dispose();
    }
    const shared = this.hero.orbitShared;
    if (shared) {
      shared.ringGeo?.dispose();
      shared.ringMat?.dispose();
      shared.glowGeo?.dispose();
      shared.glowMat?.dispose();
      shared.coreGeo?.dispose();
      shared.coreMat?.dispose();
      // Legacy keys from older torus/sphere version.
      shared.orbGeo?.dispose();
      shared.orbMat?.dispose();
    }
    this.hero.orbitGroup = null;
    this.hero.orbitOrbs = null;
    this.hero.orbitPath = null;
    this.hero.orbitShared = null;
  }

  updateOrbit() {
    if (!this.hero) return;
    this.clearOrbit();
    const level = this.power.orbit || 0;
    if (level <= 0) return;

    const radius = this.orbitRadius();
    const group = new THREE.Group();
    group.name = 'orbitSwirl';

    // Vệt quỹ đạo mỏng trên sàn.
    const path = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.1, radius - 0.045), radius + 0.045, 64),
      new THREE.MeshBasicMaterial({
        color:0x67e8f9, transparent:true, opacity:0.28, depthWrite:false,
        blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.035;
    group.add(path);

    // Ba vòng đứng (chakram) — đọc rõ là “vòng tròn” từ camera nghiêng.
    const ringGeo = new THREE.RingGeometry(0.2, 0.34, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color:0x22d3ee, transparent:true, opacity:0.95, depthWrite:false,
      blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    });
    const glowGeo = new THREE.RingGeometry(0.14, 0.4, 36);
    const glowMat = new THREE.MeshBasicMaterial({
      color:0xa5f3fc, transparent:true, opacity:0.28, depthWrite:false,
      blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    });
    const coreGeo = new THREE.CircleGeometry(0.11, 20);
    const coreMat = new THREE.MeshBasicMaterial({
      color:0xffffff, transparent:true, opacity:0.85, depthWrite:false,
      blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    });

    const orbs = [];
    for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group();
      const glow = new THREE.Mesh(glowGeo, glowMat);
      const rim = new THREE.Mesh(ringGeo, ringMat);
      const core = new THREE.Mesh(coreGeo, coreMat);
      // Đứng thẳng (mặt vòng nhìn ngang) rồi xoay theo quỹ đạo.
      glow.rotation.y = Math.PI / 2;
      rim.rotation.y = Math.PI / 2;
      core.rotation.y = Math.PI / 2;
      pivot.add(glow, rim, core);
      group.add(pivot);
      orbs.push(pivot);
    }

    this.hero.root.add(group);
    this.hero.orbitGroup = group;
    this.hero.orbitOrbs = orbs;
    this.hero.orbitPath = path;
    this.hero.orbitShared = { ringGeo, ringMat, glowGeo, glowMat, coreGeo, coreMat };
    this.syncOrbitPositions(this.orbitAngle || 0);
  }

  syncOrbitPositions(angle) {
    const orbs = this.hero?.orbitOrbs;
    if (!orbs?.length) return;
    const radius = this.orbitRadius();
    const spin = this.elapsed * 7.5;
    for (let i = 0; i < orbs.length; i++) {
      const a = angle + (i * Math.PI * 2) / 3;
      const orb = orbs[i];
      orb.position.x = Math.cos(a) * radius;
      orb.position.z = Math.sin(a) * radius;
      orb.position.y = 0.78 + Math.sin(spin * 0.55 + i * 2.1) * 0.1;
      // Mặt vòng hướng theo tiếp tuyến quỹ đạo + tự xoay tạo cảm giác xoáy.
      orb.rotation.y = a + Math.PI / 2;
      orb.rotation.z = Math.sin(spin + i) * 0.35;
      const rim = orb.children[1];
      if (rim) rim.rotation.z = spin * 1.8 + i * 2.1;
      const glow = orb.children[0];
      if (glow) {
        const pulse = 0.92 + Math.sin(spin * 1.3 + i) * 0.1;
        glow.scale.setScalar(pulse);
      }
    }
    if (this.hero.orbitPath) {
      const pulse = 0.96 + Math.sin(this.elapsed * 3.8) * 0.04;
      this.hero.orbitPath.scale.set(pulse, pulse, pulse);
      this.hero.orbitPath.material.opacity = 0.2 + Math.sin(this.elapsed * 3.2) * 0.08;
    }
  }

  updateOrbitCombat(dt) {
    const level = this.power.orbit || 0;
    if (level <= 0 || !this.hero?.orbitOrbs?.length) return;

    // Bay nhanh hơn mỗi cấp.
    const speed = 2.4 + level * 0.35;
    this.orbitAngle = (this.orbitAngle || 0) + speed * dt;
    this.syncOrbitPositions(this.orbitAngle);

    this.orbitTick -= dt;
    if (this.orbitTick > 0) return;
    this.orbitTick = 0.14;

    const hitR = this.orbitOrbHitRadius();
    const hitRSq = hitR * hitR;
    const damage = this.orbitDps() * 0.14;
    const heroPos = this.hero.root.position;
    const orbs = this.hero.orbitOrbs;

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const ex = enemy.root.position.x;
      const ez = enemy.root.position.z;
      for (const orb of orbs) {
        const ox = heroPos.x + orb.position.x;
        const oz = heroPos.z + orb.position.z;
        const dx = ex - ox;
        const dz = ez - oz;
        if (dx * dx + dz * dz <= hitRSq) {
          this.hitEnemy(enemy, damage);
          break;
        }
      }
    }
  }

  /**
   * Fit camera để đường kính vòng tầm bắn ≈ 90% chiều ngang màn hình.
   * FOV giữ ổn định (chỉ đổi portrait/landscape); khoảng cách camera đổi theo range.
   */
  updateCameraFit() {
    if (!this.camera || !this.power) return;
    const portrait = innerHeight > innerWidth;
    const aspect = Math.max(0.35, innerWidth / Math.max(1, innerHeight));
    const fov = portrait ? 50 : 45;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    } else {
      this.camera.updateProjectionMatrix();
    }

    const range = Math.max(1, this.power.range || BASE_ATTACK_RANGE);
    const vFovRad = THREE.MathUtils.degToRad(fov);
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
    // 2R = 0.9 * visibleWidth → halfVisible = R / 0.9 = dist * tan(hFov/2)
    const RANGE_SCREEN_FRACTION = 0.9;
    const dist = (range / RANGE_SCREEN_FRACTION) / Math.max(1e-4, Math.tan(hFovRad / 2));

    // Giữ góc nhìn cũ (cao / lùi) — chỉ scale khoảng cách.
    const k = portrait ? 17 / 12.5 : 13 / 10;
    const offset = Math.sqrt((dist * dist) / (k * k + 1));
    const height = k * offset;
    this.camFit = { height, offset, fov, range };
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
      this.updateOrbitCombat(dt);
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
    this.power.regenPerSec = (a.regen || 0) * 0.45;
    this.power.massResist = Math.min(0.75, (a.mass || 0) * 0.08);
    this.syncSupportPassives();
    this.updateMagnetRing();
  }

  /** Passiveives từ thẻ kỹ năng: hút máu / may mắn / sát thương boss. */
  syncSupportPassives() {
    const P = this.power;
    P.vampRate = (P.vamp || 0) * 0.025;
    P.luckXp = 1 + (P.luck || 0) * 0.1;
    P.eliteMult = 1 + (P.elite || 0) * 0.12;
  }

  luckLevel() {
    return this.power.luck || 0;
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
      const current = typeof def.value === 'function' ? def.value(this) : '';
      return `<div class="attr-row">
        <div class="attr-icon">${def.icon}</div>
        <div class="attr-copy">
          <b>${def.name} <span class="attr-lv">Cấp ${level}/${def.max}</span></b>
          <strong class="attr-now">${current}</strong>
          <small>${def.desc}</small>
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
    if (!this.ui.attrSheet || this.state === 'over' || this.state === 'loading') return;
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
    let riskPicked = 0;
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

    const tryAdd = (card) => {
      if (hand.length >= 3 || seen.has(card.id)) return;
      // Trong 3 lựa chọn chỉ được tối đa 1 thẻ rủi ro.
      if (card.kind === 'risk') {
        if (riskPicked >= 1) return;
        riskPicked++;
      }
      seen.add(card.id);
      hand.push(card);
    };

    for (const card of pool) tryAdd(card);
    if (hand.length < 3 && this.canSpendAnyAttr() && !seen.has(ATTR_POINT_CARD.id)) {
      tryAdd(ATTR_POINT_CARD);
    }
    // Bù thiếu bằng skill thường / điểm thuộc tính — không thêm rủi ro thứ hai.
    for (const card of specials) tryAdd(card);
    if (hand.length < 3 && this.canSpendAnyAttr()) tryAdd(ATTR_POINT_CARD);
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
    if (this.pendingLevels <= 0 || this.state !== 'playing') return;
    if (this.isLevelUpOpen()) {
      if (this.ui.levelupQueue) this.ui.levelupQueue.textContent = String(this.pendingLevels);
    } else {
      this.showLevelUp();
    }
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
    // Boss đầu tiên ở phút 1, rồi mỗi phút một con mạnh hơn.
    const dueWave = Math.floor(this.elapsed / 60);
    while (this.bossWave < dueWave) {
      this.bossWave++;
      await this.spawnEscalatingBoss(this.bossWave);
    }
  }

  buildBossEvent(wave) {
    const arch = BOSS_ARCHETYPES[(wave - 1) % BOSS_ARCHETYPES.length];
    let hp = Math.round(320 + wave * 200 + wave * wave * 28);
    let speed = 1.95 + wave * 0.09;
    let dmg = Math.round(11 + wave * 3.8);
    let scale = 1.02 + wave * 0.09;
    let defense = Math.floor(1 + wave * 0.85);
    let gem = 20 + wave * 12;

    if (arch.focus === 'tank') {
      hp = Math.round(hp * 1.4);
      scale += 0.14;
      defense += 2 + Math.floor(wave / 2);
    } else if (arch.focus === 'swift') {
      speed += 0.5 + wave * 0.06;
      scale = Math.max(0.95, scale - 0.04);
      hp = Math.round(hp * 0.9);
    } else if (arch.focus === 'bruiser') {
      dmg = Math.round(dmg * 1.45);
      speed += 0.18;
      scale += 0.06;
    }

    return {
      variantId:`bossWave${wave}`,
      entryId:arch.entryId,
      name:`${arch.name} · đợt ${wave}`,
      icon:arch.icon,
      focus:arch.focus,
      focusLabel:arch.focusLabel,
      hp,
      defense,
      speed:Math.min(4.35, speed),
      dmg,
      scale:Math.min(1.9, scale),
      gem,
      wave,
    };
  }

  async spawnEscalatingBoss(wave) {
    const event = this.buildBossEvent(wave);
    this.flashEvent(`${event.icon} Boss đợt ${wave}: ${event.name} (${event.focusLabel})`, 4.4);
    this.toast(`${event.icon} ${event.name}`);
    await this.spawnBoss(event);
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
    enemy.bossWave = event.wave || 1;
    enemy.bossName = event.name;
    enemy.bossIcon = event.icon;
    enemy.bossFocus = event.focus;
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
      const luck = this.luckLevel();
      this.fieldDropClock = (16 + Math.random() * 12) / (1 + luck * 0.07);
      this.spawnFieldDrop();
    }
    for (const drop of this.fieldDrops) {
      drop.life -= dt;
      drop.phase += dt * 3.2;
      // Sprite bình máu tự billboard — chỉ nhún, không xoay group.
      // Thẻ kỹ năng xoay nhanh để nổi bật trên map.
      if (drop.isSkillCard) {
        drop.mesh.rotation.y += dt * 4.6;
        if (drop.card) drop.card.rotation.y += dt * 1.8;
      } else if (!drop.isPotion) {
        drop.mesh.rotation.y += dt * 2.4;
      }
      drop.mesh.position.y = 0.55 + Math.sin(drop.phase) * 0.12;
      if (drop.halo?.material) {
        drop.halo.material.opacity = 0.35 + Math.sin(drop.phase * 1.4) * 0.2;
      }
      if (drop.life < 4) drop.mesh.scale.setScalar(0.75 + Math.sin(drop.phase * 8) * 0.12);
      const dx = drop.mesh.position.x - this.hero.root.position.x;
      const dz = drop.mesh.position.z - this.hero.root.position.z;
      if (dx * dx + dz * dz < (this.hero.radius + 0.75) ** 2) {
        this.collectFieldDrop(drop);
        drop.dead = true;
        this.updateHud();
      } else if (drop.life <= 0) {
        drop.dead = true;
      }
    }
    for (const drop of this.fieldDrops) {
      if (!drop.dead) continue;
      this.scene.remove(drop.mesh);
      disposeFieldDropVisual(drop.mesh);
    }
    this.fieldDrops = this.fieldDrops.filter(drop => !drop.dead);
  }

  collectFieldDrop(drop) {
    if (drop.isSkillCard && drop.skill) {
      this.grantSkillUpgrade(drop.skill);
      return;
    }
    if (drop.def?.apply) drop.def.apply(this);
    // fieldHeal đã toast qua grantHealthPotion — tránh báo trùng.
    if (drop.def?.id !== 'fieldHeal') {
      this.toast(`${drop.def.icon} ${drop.def.name}`);
    }
    this.flashEvent(`${drop.def.icon} Nhặt được: ${drop.def.name}`, 2.4);
  }

  /** Chọn thẻ kỹ năng còn nâng cấp được (ưu tiên chưa có). */
  pickRandomSkillUpgrade() {
    const available = SPECIAL_UPGRADES.filter(card => (this.upgradeLevels[card.id] || 0) < card.max);
    if (!available.length) return null;
    const fresh = available.filter(card => !(this.upgradeLevels[card.id]));
    const pool = fresh.length ? fresh : available;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  grantSkillUpgrade(skill) {
    if (!skill) {
      this.attrPoints++;
      this.updateAttrBadge();
      this.renderAttrRows();
      this.toast('◎ +1 điểm thuộc tính (thẻ đã max)');
      this.flashEvent('◎ Đổi thẻ thành điểm thuộc tính', 2.4);
      return;
    }
    const level = this.upgradeLevels[skill.id] || 0;
    if (level >= skill.max) {
      this.attrPoints++;
      this.updateAttrBadge();
      this.renderAttrRows();
      this.toast(`◎ ${skill.name} đã max · +1 điểm`);
      this.flashEvent('◎ Đổi thẻ thành điểm thuộc tính', 2.4);
      return;
    }
    this.upgradeLevels[skill.id] = level + 1;
    skill.apply(this);
    this.checkSynergies();
    this.toast(`${skill.icon} ${skill.name} cấp ${this.upgradeLevels[skill.id]}`);
    this.flashEvent(`${skill.icon} Nhặt thẻ: ${skill.name}`, 2.8);
  }

  placeFieldDropGroup(group) {
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
  }

  spawnSkillCardDrop(worldPos, skillOverride = null) {
    if (!this.scene) return;
    const skill = skillOverride || this.pickRandomSkillUpgrade();
    const def = FIELD_DROPS.find(item => item.id === 'fieldSkill') || {
      id:'fieldSkill', icon:'🃏', color:0xf59e0b, name:'Thẻ kỹ năng',
    };
    const life = 22 + Math.random() * 10;
    const group = new THREE.Group();
    const card = createSkillCardMesh(skill || { id:'generic', icon:'🃏', name:'Thẻ kỹ năng', color:0xf59e0b });
    card.position.y = 0.18;
    group.add(card);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.62, 28),
      new THREE.MeshBasicMaterial({
        color:skill?.color || 0xf59e0b, transparent:true, opacity:0.55, depthWrite:false, side:THREE.DoubleSide,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    group.add(halo);
    if (worldPos) {
      const ox = (Math.random() - 0.5) * 1.4;
      const oz = (Math.random() - 0.5) * 1.4;
      group.position.set(worldPos.x + ox, 0.55, worldPos.z + oz);
      if (group.position.length() > this.arenaRadius - 1.2) {
        group.position.setLength(this.arenaRadius - 1.2);
        group.position.y = 0.55;
      }
    } else {
      this.placeFieldDropGroup(group);
    }
    this.scene.add(group);
    this.fieldDrops.push({
      mesh:group, halo, card, def, skill, life,
      phase:Math.random() * 6, dead:false,
      isPotion:false, isSkillCard:true,
    });
    return skill;
  }

  spawnFieldDrop() {
    if (!this.scene || !this.hero) return;
    let def = FIELD_DROPS[Math.floor(Math.random() * FIELD_DROPS.length)];
    // May mắn lệch nhẹ về phần thưởng điểm thuộc tính.
    if (this.luckLevel() > 0 && Math.random() < this.luckLevel() * 0.03) {
      def = FIELD_DROPS.find(item => item.id === 'fieldAttr') || def;
    }

    if (def.kind === 'skillCard') {
      const skill = this.spawnSkillCardDrop(null);
      const label = skill ? `${skill.icon} ${skill.name}` : def.name;
      this.flashEvent(`🃏 Thẻ kỹ năng xuất hiện: ${label}`, 2.8);
      return;
    }

    const life = 15 + Math.random() * 15;
    const group = new THREE.Group();
    let halo = null;
    if (def.id === 'fieldHeal') {
      // Dùng chung sprite bình máu — nhận diện ngay, không còn khối lục diện xanh.
      const potion = createPotionMesh(0.82);
      potion.position.y = 0.1;
      group.add(potion);
      halo = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.44, 28),
        new THREE.MeshBasicMaterial({
          color:0xef4444, transparent:true, opacity:0.5, depthWrite:false, side:THREE.DoubleSide,
        })
      );
    } else {
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.38, 0),
        new THREE.MeshBasicMaterial({ color:def.color, toneMapped:false })
      );
      group.add(core);
      halo = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.68, 28),
        new THREE.MeshBasicMaterial({
          color:def.color, transparent:true, opacity:0.5, depthWrite:false, side:THREE.DoubleSide,
        })
      );
    }
    halo.rotation.x = -Math.PI / 2;
    group.add(halo);
    this.placeFieldDropGroup(group);
    this.scene.add(group);
    this.fieldDrops.push({
      mesh:group, halo, def, life,
      phase:Math.random() * 6, dead:false,
      isPotion: def.id === 'fieldHeal',
      isSkillCard:false,
    });
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
      // Set riêng — không bị blast “nuốt” mục tiêu khiến tia sét không bao giờ nhảy.
      const used = new Set([primary]);
      const chainRange = 4.6 + P.chain * 0.45;
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
        projectile.secondaryHits.add(target);
        this.hitEnemy(target, chainDamage);
        if (P.freeze > 0) this.applyFreeze(target);
        from = target;
      }
    }
  }

  disposeCombatEffectMesh(mesh, kind) {
    if (!mesh) return;
    if (kind === 'chain' || mesh.userData?.sharedFx) {
      mesh.userData.coreMat?.dispose();
      mesh.userData.glowMat?.dispose();
      mesh.userData.flashMat?.dispose();
      // Geometry dùng chung qua SHARED_FX — không dispose ở đây.
      return;
    }
    mesh.geometry?.dispose();
    mesh.material?.dispose();
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
    let group = this.effectPool.chain.pop();
    if (!group) group = createChainBoltGroup();

    const segCount = 7 + Math.floor(Math.random() * 4); // 7–10 gãy
    const points = buildLightningPath(from, to, segCount);
    const segments = group.userData.segments;
    for (let i = 0; i < segments.length; i++) {
      const { glow, core } = segments[i];
      if (i >= segCount) {
        glow.visible = false;
        core.visible = false;
        continue;
      }
      const ai = i * 3;
      const bi = (i + 1) * 3;
      placeChainSegment(
        glow,
        points[ai], points[ai + 1], points[ai + 2],
        points[bi], points[bi + 1], points[bi + 2],
        0.16
      );
      placeChainSegment(
        core,
        points[ai], points[ai + 1], points[ai + 2],
        points[bi], points[bi + 1], points[bi + 2],
        0.055
      );
    }

    const flashA = group.userData.flashA;
    const flashB = group.userData.flashB;
    flashA.position.set(from.x, 0.9, from.z);
    flashB.position.set(to.x, 0.9, to.z);
    flashA.scale.set(1.15, 1.15, 1.15);
    flashB.scale.set(1.35, 1.35, 1.35);
    group.userData.coreMat.opacity = 1;
    group.userData.glowMat.opacity = 0.6;
    group.userData.flashMat.opacity = 1;

    group.visible = true;
    this.scene.add(group);
    this.combatEffects.push({ mesh:group, t:0, life:0.42, kind:'chain', flicker:0, rebranched:false });
  }

  updateCombatEffects(dt) {
    for (const effect of this.combatEffects) {
      effect.t += dt;
      const progress = Math.min(1, effect.t / effect.life);
      if (effect.kind === 'blast') {
        effect.mesh.material.opacity = 1 - progress;
        effect.mesh.scale.setScalar(effect.radius * (0.35 + progress * 0.8));
      } else if (effect.kind === 'chain') {
        // Nhấp nháy nhanh — giống tia sét thật.
        effect.flicker = (effect.flicker || 0) + dt * 28;
        const pulse = 0.55 + Math.abs(Math.sin(effect.flicker)) * 0.45;
        const fade = 1 - progress * progress;
        const alpha = pulse * fade;
        const ud = effect.mesh.userData;
        if (ud.glowMat) ud.glowMat.opacity = 0.3 + alpha * 0.5;
        if (ud.coreMat) ud.coreMat.opacity = 0.7 + alpha * 0.3;
        if (ud.flashMat) ud.flashMat.opacity = alpha;
        const flashA = ud.flashA;
        const flashB = ud.flashB;
        if (flashA) flashA.scale.setScalar((1.1 + pulse * 0.55) * fade);
        if (flashB) flashB.scale.setScalar((1.35 + pulse * 0.7) * fade);
        // Đổi đường gãy giữa chừng để trông sống động hơn.
        if (effect.t > 0.12 && !effect.rebranched && progress < 0.7) {
          effect.rebranched = true;
          const segs = effect.mesh.userData.segments;
          if (segs?.length) {
            const visible = segs.filter(s => s.core.visible);
            if (visible.length >= 3) {
              const mid = visible[Math.floor(visible.length / 2)];
              mid.core.position.y += (Math.random() - 0.5) * 0.35;
              mid.glow.position.y = mid.core.position.y;
            }
          }
        }
      }
      if (progress < 1) continue;
      this.scene.remove(effect.mesh);
      effect.mesh.visible = false;
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
        const wave = enemy.bossWave || 1;
        const attrReward = 1 + Math.floor((wave - 1) / 3);
        this.spawnGem(enemy.root.position, Math.max(12, Math.round(enemy.gem * 0.5)));
        this.attrPoints += attrReward;
        this.updateAttrBadge();
        this.renderAttrRows();
        const skill = this.spawnSkillCardDrop(enemy.root.position);
        const skillHint = skill ? ` · thẻ ${skill.name}` : '';
        this.toast(`${enemy.bossIcon || '★'} Hạ ${enemy.bossName || 'Boss'}! +${attrReward} điểm${skillHint}`);
        this.flashEvent(`${enemy.bossIcon || '★'} Boss đợt ${wave} bị đánh bại! +${attrReward} điểm`, 3.8);
        this.grantXp(14 + wave * 6);
      }
    }
  }

  maybeSpawnPotion(enemy) {
    const luck = this.luckLevel();
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
    if (!mesh) mesh = createPotionMesh(0.72);
    mesh.visible = true;
    mesh.position.copy(position);
    mesh.position.y = 0.1;
    const s = mesh.userData.potionScale || 0.72;
    mesh.scale.set(s * 0.9, s * 1.35, 1);
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
        const y = pickup.kind === 'potion' ? 0.1 : 0.28;
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
    this.grantHealthPotion(heal);
  }

  /** Hồi máu; nếu đã đầy thì +1 giới hạn máu (baseMaxHp) thay vì bỏ phí. */
  grantHealthPotion(healAmount) {
    const hero = this.hero;
    if (!hero) return;
    if (hero.hp >= hero.maxHp - 0.001) {
      hero.baseMaxHp += 1;
      hero.maxHp += 1;
      hero.hp = hero.maxHp;
      this.toast('♥ +1 giới hạn máu');
    } else {
      const before = hero.hp;
      hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(1, healAmount));
      const gained = Math.round(hero.hp - before);
      if (gained > 0) this.toast(`♥ +${gained} máu`);
    }
    this.updateHud();
  }

  xpNeeded() {
    return 6 + (this.level - 1) * 7;
  }

  isLevelUpOpen() {
    return !!(this.hand?.length && this.ui.levelupDock && !this.ui.levelupDock.classList.contains('hidden'));
  }

  showLevelUp() {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    // Không đổi state / không modal — trận tiếp tục, thẻ hiện góc phải.
    this.hand = this.buildLevelUpHand();
    this.renderLevelUpDock();
    this.flashEvent(`Lv ${this.level} · chọn thẻ`, 1.8);
    this.needsRender = true;
  }

  renderLevelUpDock() {
    const dock = this.ui.levelupDock;
    const cardsEl = this.ui.levelupCards;
    if (!dock || !cardsEl) return;
    if (this.ui.levelupQueue) {
      this.ui.levelupQueue.textContent = String(Math.max(1, this.pendingLevels || 1));
    }
    cardsEl.innerHTML = (this.hand || []).map((card, i) => this.renderUpgradeCard(card, i)).join('');
    cardsEl.querySelectorAll('[data-card]').forEach(button => {
      button.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this.chooseUpgrade(Number(button.dataset.card));
      };
    });
    dock.classList.remove('hidden');
  }

  hideLevelUpDock() {
    this.hand = [];
    this.ui.levelupDock?.classList.add('hidden');
    if (this.ui.levelupCards) this.ui.levelupCards.innerHTML = '';
  }

  /** Thẻ góc màn hình: icon + tên + 1–2 dòng stat EN. */
  renderUpgradeCard(card, index) {
    const kind = card.kind === 'risk' ? 'risk' : card.kind === 'attr' ? 'attr' : '';
    const levelLabel = card.kind === 'attr'
      ? 'ATTR'
      : card.kind === 'risk'
        ? 'RISK'
        : `Lv ${(this.upgradeLevels[card.id] || 0) + 1}/${card.max}`;
    const stats = (card.stats || []).slice(0, 2);
    const statsHtml = stats.map(line => `<span class="stat">${line}</span>`).join('');
    return `<button class="dock-card ${kind}" data-card="${index}" type="button">
      <span class="dock-icon" aria-hidden="true">${card.icon}</span>
      <span class="dock-body">
        <span class="card-name">${card.name}</span>
        <span class="stats">${statsHtml}</span>
      </span>
      <em class="card-lv">${levelLabel}</em>
      <span class="dock-key">${index + 1}</span>
    </button>`;
  }

  chooseUpgrade(index) {
    if (!this.isLevelUpOpen()) return;
    if (this.state !== 'playing' && this.state !== 'paused') return;
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
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    if (this.pendingLevels > 0) this.showLevelUp();
    else this.hideLevelUpDock();
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
    this.hideLevelUpDock();
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
    if (!this.camFit) this.updateCameraFit();
    const { height, offset } = this.camFit;
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
    this.camera.aspect = width / Math.max(1, height);
    this.updateCameraFit();
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
    if (unit.orbitGroup) {
      unit.root.remove(unit.orbitGroup);
      if (unit.orbitPath) {
        unit.orbitPath.geometry.dispose();
        unit.orbitPath.material.dispose();
      }
      const shared = unit.orbitShared;
      if (shared) {
        shared.ringGeo?.dispose();
        shared.ringMat?.dispose();
        shared.glowGeo?.dispose();
        shared.glowMat?.dispose();
        shared.coreGeo?.dispose();
        shared.coreMat?.dispose();
        shared.orbGeo?.dispose();
        shared.orbMat?.dispose();
      }
      unit.orbitGroup = null;
      unit.orbitOrbs = null;
      unit.orbitPath = null;
      unit.orbitShared = null;
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
    this.hideLevelUpDock();
    this.currentIntro = null;
    this.introRemaining = 0;
    this.ui.enemyIntro?.classList.add('hidden');
    for (const projectile of this.projectiles || []) this.removeProjectile(projectile);
    for (const pickup of this.pickups || []) this.releaseGem(pickup);
    for (const drop of this.fieldDrops || []) {
      this.scene?.remove(drop.mesh);
      disposeFieldDropVisual(drop.mesh);
    }
    this.fieldDrops = [];
    this.ui.eventBanner?.classList.add('hidden');
    this.gemPool?.clear?.();
    disposeSharedPickups();
    for (const effect of this.combatEffects || []) {
      this.scene.remove(effect.mesh);
      this.disposeCombatEffectMesh(effect.mesh, effect.kind);
    }
    for (const [kind, pool] of Object.entries(this.effectPool || {})) {
      for (const mesh of pool) this.disposeCombatEffectMesh(mesh, kind);
    }
    this.effectPool = { blast:[], chain:[] };
    disposeSharedFx();
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
