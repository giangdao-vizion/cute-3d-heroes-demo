import * as THREE from 'three';

/**
 * Lớp DOM nằm trên canvas cho chữ bay (+$, XP) và huy hiệu trên vật thể.
 * Vị trí cập nhật mỗi frame bằng cách chiếu toạ độ 3D lên màn hình – không qua React.
 */
type Floater = { el: HTMLElement; pos: THREE.Vector3; born: number; life: number };
type Badge = { el: HTMLElement; pos: THREE.Vector3 };

let root: HTMLElement | null = null;
const floaters: Floater[] = [];
const badges = new Map<string, Badge>();
const v = new THREE.Vector3();

export function setOverlayRoot(el: HTMLElement | null) { root = el; }

export function addFloat(x: number, z: number, text: string, color: string, now: number) {
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = text;
  el.style.color = color;
  root.appendChild(el);
  floaters.push({ el, pos: new THREE.Vector3(x, 1.1, z), born: now, life: 1.4 });
}

export function setBadge(id: string, x: number, y: number, z: number, text: string | null, cls = '') {
  let b = badges.get(id);
  if (!text) { if (b) { b.el.remove(); badges.delete(id); } return; }
  if (!root) return;
  if (!b) {
    const el = document.createElement('div');
    root.appendChild(el);
    b = { el, pos: new THREE.Vector3() };
    badges.set(id, b);
  }
  b.pos.set(x, y, z);
  if (b.el.textContent !== text) b.el.textContent = text;
  const c = 'badge ' + cls;
  if (b.el.className !== c) b.el.className = c;
}

function place(el: HTMLElement, p: THREE.Vector3, cam: THREE.Camera, w: number, h: number, dy = 0, extra = '') {
  v.copy(p).project(cam);
  const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h + dy;
  el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)${extra}`;
}

export function updateOverlay(cam: THREE.Camera, w: number, h: number, now: number) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    const t = (now - f.born) / f.life;
    if (t >= 1) { f.el.remove(); floaters.splice(i, 1); continue; }
    f.el.style.opacity = String(t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
    place(f.el, f.pos, cam, w, h, -t * 46, ` scale(${(t < 0.15 ? 0.6 + t * 2.7 : 1).toFixed(2)})`);
  }
  badges.forEach(b => place(b.el, b.pos, cam, w, h));
}
