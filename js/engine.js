// Phần dùng chung: tải model, chuẩn hoá kích thước, điều khiển animation.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();

export function loadModel(entry, onProgress) {
  if (!cache.has(entry.id)) {
    cache.set(entry.id, new Promise((res, rej) => loader.load(entry.file, res, onProgress, rej)));
  }
  return cache.get(entry.id);
}

// Tìm clip theo tên, bỏ qua tiền tố "Armature|".
export function findClip(clips, name) {
  if (!name) return null;
  return clips.find(c => c.name === name) || clips.find(c => c.name.split('|').pop() === name) || null;
}

export function shortName(clip) { return clip.name.split('|').pop(); }

// Tạo một bản sao của model: root (vị trí/hướng) > model (đã scale về chiều cao chuẩn).
export async function spawnModel(entry, heightOverride) {
  const gltf = await loadModel(entry);
  const model = SkeletonUtils.clone(gltf.scene);
  if (entry.keep) {
    // KayKit gắn sẵn nhiều vũ khí trong tay: chỉ giữ lại bộ được chọn.
    const weaponish = /Sword|Shield|Axe|Mug|Spellbook|Wand|Staff|Crossbow|Knife|Throwable|Hat|Helmet/;
    model.traverse(o => { if (o.isMesh && weaponish.test(o.name)) o.visible = entry.keep.includes(o.name); });
  }
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = true;
      // Quaternius để metalness 0.4 nên model bị tối: chuyển về chất liệu mờ kiểu toon.
      for (const m of [].concat(o.material)) { if (m.metalness !== undefined) { m.metalness = 0; m.roughness = Math.max(m.roughness, 0.75); } }
    }
  });
  // Đo kích thước ở bind pose.
  model.updateMatrixWorld(true);
  model.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
  let box = new THREE.Box3();
  model.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o, false); });
  if (![box.min.x, box.min.y, box.max.x, box.max.y].every(Number.isFinite)) {
    // Một số model bay (Bee, Wasp) cho NaN khi tính theo xương: đo theo hình học gốc.
    box = new THREE.Box3();
    model.traverse(o => {
      if (o.isMesh && o.visible) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
    });
  }
  // Bind-pose bounds so frustum culling stays correct without disabling it.
  model.traverse(o => {
    if (!o.isSkinnedMesh) return;
    o.geometry.computeBoundingSphere();
    o.geometry.computeBoundingBox();
  });
  const h = Math.max(box.max.y - box.min.y, 1e-4);
  const s = (heightOverride || entry.height) / h;
  model.scale.multiplyScalar(s);
  model.position.y -= box.min.y * s;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  model.position.x -= cx * s; model.position.z -= cz * s;
  const root = new THREE.Group();
  root.add(model);
  root.userData.radius = Math.min(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s * 0.5, (heightOverride || entry.height) * 0.45);
  root.userData.height = heightOverride || entry.height;
  return { root, model, clips: gltf.animations };
}

export class Animator {
  constructor(model, clips, map) {
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = clips; this.map = map || {};
    this.current = null; this.currentKey = null; this.onceCb = null;
    this.mixer.addEventListener('finished', e => {
      if (e.action === this.current && this.onceCb) { const cb = this.onceCb; this.onceCb = null; cb(); }
    });
  }
  has(key) { return !!findClip(this.clips, this.map[key] || key); }
  duration(key) { const c = findClip(this.clips, this.map[key] || key); return c ? c.duration : 0; }
  // key: khoá trong map (idle/run/attack...) hoặc tên clip trực tiếp.
  play(key, { once = false, fade = 0.18, speed = 1, clamp = false, onDone = null, restart = false } = {}) {
    const clip = findClip(this.clips, this.map[key] || key);
    if (!clip) { if (onDone) onDone(); return false; }
    const action = this.mixer.clipAction(clip);
    if (this.current === action && !restart && !once) return true;
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = clamp;
    action.timeScale = speed;
    action.enabled = true;
    action.play();
    if (this.current && this.current !== action) this.current.crossFadeTo(action, fade, false);
    this.current = action; this.currentKey = key; this.onceCb = onDone;
    return true;
  }
  update(dt) { this.mixer.update(dt); }
}

/** Mobile / coarse-pointer devices heat up fast with soft shadows + 2× DPR. */
export function isMobileGraphics() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  try {
    if (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 920) return true;
  } catch (_) { /* ignore */ }
  return false;
}

export function makeRenderer(canvas) {
  const mobile = isMobileGraphics();
  const r = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    powerPreference: mobile ? 'low-power' : 'high-performance',
    alpha: false,
  });
  // Cap DPR hard on phones — fill-rate is the main heat source.
  r.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 2));
  r.shadowMap.enabled = true;
  r.shadowMap.type = mobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  return r;
}

export function addLights(scene, size = 30) {
  const mobile = isMobileGraphics();
  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x6b8f4e, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.position.set(12, 22, 10);
  sun.castShadow = true;
  const map = mobile ? 1024 : 2048;
  sun.shadow.mapSize.set(map, map);
  Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  scene.add(sun); scene.add(sun.target);
  return sun;
}

// Cây, đá, hoa low-poly để trang trí (tự sinh, không cần file).
export function makeTree(scale = 1) {
  const mobile = isMobileGraphics();
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x8a5a3b, flatShading: true }));
  trunk.position.y = 0.4; g.add(trunk);
  const greens = [0x5fbf5a, 0x4caf50, 0x7ccf63];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.75 - i * 0.18, 0.9, 7), new THREE.MeshStandardMaterial({ color: greens[i], flatShading: true }));
    c.position.y = 1.0 + i * 0.45; g.add(c);
  }
  // Decor props casting soft shadows are expensive; keep characters as the casters.
  g.traverse(o => { if (o.isMesh) { o.castShadow = !mobile; o.frustumCulled = true; } });
  g.scale.setScalar(scale);
  return g;
}

export function makeRock(scale = 1) {
  const mobile = isMobileGraphics();
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, flatShading: true }));
  m.scale.set(scale, scale * 0.7, scale); m.position.y = 0.15 * scale;
  m.castShadow = !mobile; m.receiveShadow = true; m.frustumCulled = true;
  return m;
}

export function makeFlower() {
  const mobile = isMobileGraphics();
  const g = new THREE.Group();
  const colors = [0xff8fb1, 0xffd166, 0xffffff, 0xb28dff];
  const Mat = mobile ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, mobile ? 5 : 6, mobile ? 3 : 4), new Mat({ color: colors[Math.floor(Math.random() * 4)] }));
  head.position.y = 0.18; g.add(head);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 3), new Mat({ color: 0x3f8f3a }));
  stem.position.y = 0.09; g.add(stem);
  g.traverse(o => { if (o.isMesh) o.frustumCulled = true; });
  return g;
}
