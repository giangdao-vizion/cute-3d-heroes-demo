import { PerformanceMonitor, useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { modelUrl, onWorldEvent, tick, world } from '../game';
import { CASHIER_MODEL, PLAYER_MODEL } from '../sim/world';
import { useHud } from '../ui/hudStore';
import { CameraRig, tapMarker } from './CameraRig';
import { Character } from './Character';
import { addFloat } from './overlay';
import { STORE_MODELS, StoreView } from './StoreView';

/** Chạy mô phỏng mỗi frame và đẩy số liệu sang HUD (4 lần/giây). */
function SimDriver() {
  const acc = useRef(0);
  useEffect(() => onWorldEvent(e => {
    if (e.type === 'float') addFloat(e.x, e.z, e.text, e.color, performance.now() / 1000);
  }), []);
  useFrame((_, dt) => {
    tick(dt);
    acc.current += dt;
    if (acc.current > 0.25) { acc.current = 0; useHud.getState().sync(); }
  });
  return null;
}

/** Danh sách nhân vật: chỉ render lại khi có người vào / ra. */
function Agents() {
  const [list, setList] = useState(() => world.agents.map(a => ({ id: a.id, model: a.model, kind: a.kind })));
  const key = useRef('');
  useFrame(() => {
    const k = world.agents.map(a => a.id).join(',');
    if (k !== key.current) {
      key.current = k;
      setList(world.agents.map(a => ({ id: a.id, model: a.model, kind: a.kind })));
    }
  });
  return <>{list.map(a => <Character key={a.id} agentId={a.id} model={a.model} isPlayer={a.kind === 'player'} />)}</>;
}

function TapMarkerView() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current; const t = tapMarker.current;
    if (!m) return;
    if (!t) { m.visible = false; return; }
    const age = (performance.now() - t.t) / 600;
    m.visible = age < 1;
    m.position.set(t.x, 0.03, t.z);
    m.scale.setScalar(0.6 + age * 0.6);
    (m.material as THREE.MeshBasicMaterial).opacity = 1 - age;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[0.3, 0.4, 28]} />
      <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
    </mesh>
  );
}

function Lights({ shadows }: { shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(6.5, 0, 5);
    l.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <hemisphereLight args={['#fff6e8', '#7aa7c7', 1.25]} />
      <directionalLight
        ref={light}
        position={[12, 16, 10]}
        intensity={1.9}
        color="#fff1d6"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
    </>
  );
}

export function Scene() {
  const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
  const [dpr, setDpr] = useState(Math.min(maxDpr, 1.5));
  const [shadows, setShadows] = useState(true);
  const setFps = useHud(s => s.setFps);

  return (
    <Canvas
      orthographic
      shadows={shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={dpr}
      camera={{ position: [30, 30, 30], zoom: 40, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
    >
      <color attach="background" args={['#8fd19e']} />
      <PerformanceMonitor
        onChange={({ fps }) => setFps(Math.round(fps))}
        onDecline={() => { setDpr(d => Math.max(1, d - 0.25)); setShadows(false); }}
        onIncline={() => setDpr(d => Math.min(maxDpr, d + 0.25))}
        flipflops={3}
      >
        <Lights shadows={shadows} />
        <Suspense fallback={null}>
          <StoreView />
          <Agents />
          <SimDriver />
        </Suspense>
        <TapMarkerView />
        <CameraRig />
      </PerformanceMonitor>
    </Canvas>
  );
}

// Tải trước toàn bộ model để vào game không bị giật.
[...STORE_MODELS, PLAYER_MODEL, CASHIER_MODEL,
  'chars/character-female-b.glb', 'chars/character-female-c.glb', 'chars/character-female-d.glb', 'chars/character-female-e.glb',
  'chars/character-male-a.glb', 'chars/character-male-b.glb', 'chars/character-male-e.glb', 'chars/character-male-g.glb',
].forEach(m => useGLTF.preload(modelUrl(m)));
