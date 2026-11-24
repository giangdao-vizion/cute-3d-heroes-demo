import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { world } from '../game';
import { STORE } from '../sim/layout';
import { updateOverlay } from './overlay';

const ELEV = THREE.MathUtils.degToRad(40);   // góc nhìn xuống
const AZIM = THREE.MathUtils.degToRad(45);   // góc isometric
const DIST = 40;
const OFFSET = new THREE.Vector3(Math.sin(AZIM) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(AZIM) * Math.cos(ELEV)).multiplyScalar(DIST);
const BOUNDS = { x0: STORE.x0 - 1, x1: STORE.x1 + 1, z0: STORE.z0 - 1, z1: STORE.z1 + 2 };

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ray = new THREE.Raycaster();

export type TapMarker = { x: number; z: number; t: number } | null;
export const tapMarker: { current: TapMarker } = { current: null };

/**
 * Camera orthographic isometric cố định góc.
 * 1 ngón: kéo để pan, chạm để đi / tương tác. 2 ngón: pinch zoom. Chuột: lăn để zoom.
 */
export function CameraRig() {
  const { camera, gl, size, scene } = useThree();
  const target = useRef(new THREE.Vector3((STORE.x0 + STORE.x1) / 2 + 0.3, 0, (STORE.z0 + STORE.z1) / 2 + 0.6));
  const zoomFit = useRef(1);

  // zoom mặc định: nhìn ~9 ô theo bề ngang (portrait) hoặc ~12 ô (ngang)
  useEffect(() => {
    const units = size.width < size.height ? 7.6 : 13;
    zoomFit.current = size.width / units;
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = zoomFit.current;
    cam.updateProjectionMatrix();
  }, [size.width, size.height, camera]);

  useEffect(() => {
    const el = gl.domElement;
    const cam = camera as THREE.OrthographicCamera;
    const pts = new Map<number, { x: number; y: number }>();
    let start: { x: number; y: number; t: number } | null = null;
    let moved = 0;
    let pinchDist = 0;
    let lastGround: THREE.Vector3 | null = null;

    const ndc = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    };
    const groundAt = (x: number, y: number) => {
      ray.setFromCamera(ndc(x, y), cam);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(ground, p) ? p : null;
    };
    const clampZoom = (z: number) => THREE.MathUtils.clamp(z, zoomFit.current * 0.55, zoomFit.current * 2);

    const tap = (x: number, y: number) => {
      ray.setFromCamera(ndc(x, y), cam);
      const hits = ray.intersectObjects(scene.children, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          const id = o.userData?.fixtureId as string | undefined;
          if (id) { world.tapFixture(id); return; }
          o = o.parent;
        }
      }
      const p = groundAt(x, y);
      if (p) {
        const c = { x: Math.round(p.x), z: Math.round(p.z) };
        world.tapCell(c);
        tapMarker.current = { x: c.x, z: c.z, t: performance.now() };
      }
    };

    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; lastGround = groundAt(e.clientX, e.clientY); }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        start = null;
      }
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      moved += Math.hypot(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1 && lastGround) {
        const now = groundAt(e.clientX, e.clientY);
        if (now) {
          target.current.add(lastGround.clone().sub(now));
          clampTarget();
          syncCamera();
          lastGround = groundAt(e.clientX, e.clientY);
        }
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) { cam.zoom = clampZoom(cam.zoom * (d / pinchDist)); cam.updateProjectionMatrix(); }
        pinchDist = d;
      }
    };
    const up = (e: PointerEvent) => {
      if (pts.size === 1 && start && moved < 10 && performance.now() - start.t < 450) tap(e.clientX, e.clientY);
      pts.delete(e.pointerId);
      if (pts.size === 1) { const [q] = [...pts.values()]; lastGround = groundAt(q.x, q.y); start = null; }
      if (pts.size === 0) { lastGround = null; pinchDist = 0; }
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); cam.zoom = clampZoom(cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9)); cam.updateProjectionMatrix(); };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [camera, gl, scene]);

  const clampTarget = () => {
    const t = target.current;
    t.x = THREE.MathUtils.clamp(t.x, BOUNDS.x0, BOUNDS.x1);
    t.z = THREE.MathUtils.clamp(t.z, BOUNDS.z0, BOUNDS.z1);
  };
  const syncCamera = () => {
    camera.position.copy(target.current).add(OFFSET);
    camera.lookAt(target.current);
  };

  useFrame(() => {
    syncCamera();
    updateOverlay(camera, size.width, size.height, performance.now() / 1000);
  });

  return null;
}
