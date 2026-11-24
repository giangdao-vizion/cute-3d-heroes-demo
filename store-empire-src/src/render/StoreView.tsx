import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { modelUrl, onWorldEvent, world } from '../game';
import { buildWalls, DOOR, GRID_W, STORE } from '../sim/layout';
import type { FixtureState } from '../sim/types';
import { setBadge } from './overlay';

const ITEM_NAMES = new Set(['carton', 'box', 'bag', 'can']);

/** Một model tĩnh, clone từ cache GLB. */
function Piece({ model, x, z, rot, shadow = true }: { model: string; x: number; z: number; rot: number; shadow?: boolean }) {
  const { scene } = useGLTF(modelUrl(model));
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse(m => { if ((m as THREE.Mesh).isMesh) { m.castShadow = shadow; m.receiveShadow = true; } });
    return o;
  }, [scene, shadow]);
  return <primitive object={obj} position={[x, 0, z]} rotation-y={rot * Math.PI / 2} />;
}

/** Sàn lát bằng InstancedMesh: một draw call cho cả mặt sàn. */
function Tiles({ model, cells }: { model: string; cells: [number, number][] }) {
  const { scene } = useGLTF(modelUrl(model));
  const ref = useRef<THREE.InstancedMesh>(null);
  const src = useMemo(() => {
    let mesh: THREE.Mesh | null = null;
    scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
    return mesh as unknown as THREE.Mesh;
  }, [scene]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    cells.forEach(([x, z], i) => { m.makeTranslation(x, 0, z); ref.current!.setMatrixAt(i, m); });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [cells]);
  return <instancedMesh ref={ref} args={[src.geometry, src.material as THREE.Material, cells.length]} receiveShadow />;
}

/** Cổng tự động: mở khi có người lại gần. */
function Gate() {
  const gltf = useGLTF(modelUrl('shop/fence-door-rotate.glb'));
  const rig = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse(m => { if ((m as THREE.Mesh).isMesh) m.castShadow = true; });
    const mixer = new THREE.AnimationMixer(root);
    const open = mixer.clipAction(gltf.animations.find(a => a.name === 'open')!);
    const close = mixer.clipAction(gltf.animations.find(a => a.name === 'close')!);
    for (const a of [open, close]) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    return { root, mixer, open, close, isOpen: false };
  }, [gltf]);
  useFrame((_, dt) => {
    const gx = DOOR.x, gz = DOOR.z + 0.5;
    const near = world.agents.some(a => Math.abs(a.x - gx) < 0.9 && Math.abs(a.z - gz) < 1.3);
    if (near !== rig.isOpen) {
      rig.isOpen = near;
      const [on, off] = near ? [rig.open, rig.close] : [rig.close, rig.open];
      off.stop(); on.reset().play();
    }
    rig.mixer.update(dt);
  });
  return <primitive object={rig.root} position={[DOOR.x, 0, DOOR.z + 0.5]} />;
}

function Fixture({ f }: { f: FixtureState }) {
  const { scene } = useGLTF(modelUrl(f.model));
  const group = useRef<THREE.Group>(null);
  const pulse = useRef(0);
  const { obj, items } = useMemo(() => {
    const o = scene.clone(true);
    const items: THREE.Object3D[] = [];
    o.traverse(m => {
      if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; }
      if (ITEM_NAMES.has(m.name)) items.push(m);
    });
    return { obj: o, items };
  }, [scene]);

  useEffect(() => onWorldEvent(e => { if (e.type === 'pulse' && e.fixtureId === f.id) pulse.current = 1; }), [f.id]);
  useEffect(() => () => setBadge(f.id, 0, 0, 0, null), [f.id]);

  const [ox, oz] = f.offset ?? [0, 0];
  useFrame((_, dt) => {
    const live = world.fx(f.id);
    if (live.capacity) {
      const show = Math.ceil(items.length * (live.stock / live.capacity));
      items.forEach((m, i) => { m.visible = i < show; });
      const ratio = live.stock / live.capacity;
      setBadge(f.id, f.cell.x + ox, 1.25, f.cell.z + oz,
        live.stock === 0 ? '!' : ratio < 0.35 ? `${live.stock}` : null,
        live.stock === 0 ? 'empty' : 'low');
    }
    if (group.current) {
      pulse.current = Math.max(0, pulse.current - dt * 3);
      const p = pulse.current;
      group.current.scale.set(1 + Math.sin(p * Math.PI) * 0.12, 1 - Math.sin(p * Math.PI) * 0.08 + Math.sin(p * Math.PI * 2) * 0.05, 1 + Math.sin(p * Math.PI) * 0.12);
    }
  });

  return (
    <group position={[f.cell.x + ox, 0, f.cell.z + oz]} rotation-y={f.rot * Math.PI / 2} userData={{ fixtureId: f.id }}>
      <group ref={group}><primitive object={obj} /></group>
    </group>
  );
}

export function StoreView() {
  const interior = useMemo(() => {
    const c: [number, number][] = [];
    for (let z = STORE.z0; z <= STORE.z1; z++) for (let x = STORE.x0; x <= STORE.x1; x++) c.push([x, z]);
    return c;
  }, []);
  const sidewalk = useMemo(() => {
    const c: [number, number][] = [];
    for (let z = STORE.z1 + 1; z <= STORE.z1 + 2; z++) for (let x = -2; x < GRID_W + 2; x++) c.push([x, z]);
    return c;
  }, []);
  const walls = useMemo(buildWalls, []);
  return (
    <group>
      {/* bãi cỏ quanh cửa hàng */}
      <mesh rotation-x={-Math.PI / 2} position={[6.5, -0.01, 5]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#8fd19e" roughness={1} />
      </mesh>
      {/* đường phố */}
      <mesh rotation-x={-Math.PI / 2} position={[6.5, -0.005, STORE.z1 + 4.5]} receiveShadow>
        <planeGeometry args={[60, 3]} />
        <meshStandardMaterial color="#6f6a86" roughness={1} />
      </mesh>
      <Tiles model="shop/floor-wood.glb" cells={interior} />
      <Tiles model="shop/floor.glb" cells={sidewalk} />
      {walls.map((w, i) => <Piece key={i} {...w} />)}
      <Gate />
      {world.fixtures.map(f => <Fixture key={f.id} f={f} />)}
    </group>
  );
}

export const STORE_MODELS = [
  'shop/floor-wood.glb', 'shop/floor.glb', 'shop/wall.glb', 'shop/wall-window.glb', 'shop/wall-corner.glb', 'shop/fence.glb', 'shop/fence-door-rotate.glb',
  ...new Set(world.fixtures.map(f => f.model)),
];
