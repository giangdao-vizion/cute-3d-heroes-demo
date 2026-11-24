import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { modelUrl, world } from '../game';
import type { Agent } from '../sim/types';

const ONE_SHOT = new Set(['pick-up']);

/**
 * Nhân vật 3D có skeleton. Đọc trạng thái từ agent trong mô phỏng mỗi frame.
 * Khi cầm thùng: chân chạy clip di chuyển (đã bỏ track tay), tay giữ tư thế `holding-both`.
 */
export function Character({ agentId, model, isPlayer }: { agentId: number; model: string; isPlayer: boolean }) {
  const gltf = useGLTF(modelUrl(model));
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const box = useRef<THREE.Group>(null);

  const rig = useMemo(() => {
    const root = cloneSkinned(gltf.scene) as THREE.Group;
    root.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const clip of gltf.animations) {
      actions.set(clip.name, mixer.clipAction(clip));
      const legs = new THREE.AnimationClip(clip.name + ':legs', clip.duration, clip.tracks.filter(t => !t.name.startsWith('arm-')));
      actions.set(clip.name + ':legs', mixer.clipAction(legs));
    }
    for (const name of ONE_SHOT) {
      const a = actions.get(name);
      if (a) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    }
    return { root, mixer, actions };
  }, [gltf]);

  const cur = useRef<{ base: string; upper: string | null }>({ base: '', upper: null });

  useEffect(() => {
    cur.current = { base: '', upper: null };
    return () => { rig.mixer.stopAllAction(); };
  }, [rig]);

  useFrame((state, dt) => {
    const a: Agent | undefined = world.agents.find(x => x.id === agentId);
    const g = group.current;
    if (!g || !a) return;
    g.position.set(a.x, 0, a.z);
    g.rotation.y = a.rot;
    const s = THREE.MathUtils.smoothstep(a.fade, 0, 1);
    g.scale.setScalar(Math.max(0.001, s));

    // chọn animation
    const base = a.carrying && (a.anim === 'walk' || a.anim === 'idle' || a.anim === 'sprint') ? a.anim + ':legs' : a.anim;
    const upper = a.carrying && base.endsWith(':legs') ? 'holding-both' : null;
    const c = cur.current;
    if (c.base !== base) {
      const next = rig.actions.get(base) ?? rig.actions.get('idle')!;
      const prev = rig.actions.get(c.base);
      next.reset().fadeIn(0.18).play();
      prev?.fadeOut(0.18);
      c.base = base;
    }
    if (c.upper !== upper) {
      if (upper) rig.actions.get(upper)?.reset().fadeIn(0.15).play();
      if (c.upper) rig.actions.get(c.upper)?.fadeOut(0.15);
      c.upper = upper;
    }
    const walkAct = rig.actions.get(c.base);
    if (walkAct && (a.anim === 'walk' || a.anim === 'sprint')) walkAct.timeScale = a.anim === 'walk' ? a.speed / 1.5 : 1;
    rig.mixer.update(dt);

    if (box.current) box.current.visible = a.carrying;
    if (ring.current) {
      const t = state.clock.elapsedTime;
      ring.current.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    }
  });

  return (
    <group ref={group}>
      <primitive object={rig.root} />
      {isPlayer && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[0.32, 0.42, 32]} />
          <meshBasicMaterial color="#ffd84a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}
      <group ref={box} position={[0, 0.36, 0.26]} visible={false}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.24, 0.24]} />
          <meshStandardMaterial color="#d9a066" roughness={0.9} />
        </mesh>
        <mesh position-y={0.121}>
          <boxGeometry args={[0.345, 0.004, 0.07]} />
          <meshStandardMaterial color="#b9814a" />
        </mesh>
      </group>
    </group>
  );
}
