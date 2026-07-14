import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/*
 * The hero's 3D canopy — the one React Three Fiber scene on the site.
 *
 * This module is the lazy chunk: three + @react-three/fiber are imported ONLY
 * here, so they are code-split out of the main bundle and never downloaded by
 * the people most at risk from them (phones, reduced-motion users). The gate
 * that decides whether to load it at all is components/HeroCanopy.jsx.
 *
 * Deliberate cost controls, since this is the page's only heavy dependency:
 *   - ONE InstancedMesh, not 64 meshes → a single draw call
 *   - MeshBasicMaterial → unlit, so no lights and no lighting math
 *   - ShapeGeometry built from curves → no texture to download or decode
 *   - dpr capped at 1.5, antialias off → fill rate stays sane on 4K displays
 *   - frameloop driven by the parent's visibility; scrolled away, it stops
 *
 * Depth is why this earns its weight over the 2D LeafField: leaves sit at real
 * z, so the canopy self-occludes and moves with true perspective as the camera
 * drifts — parallax that layered SVG can't fake.
 */

const COUNT = 64;
const SPREAD_X = 16;
const SPREAD_Y = 10;

// Brand greens (Impleo Design System v2) — the same three the 2D leaf field uses.
const PALETTE = ['#A6D91A', '#28C94E', '#00A050'];

// Deterministic PRNG. A fixed layout means the canopy composes identically on
// every load, so it can be art-directed against the headline rather than
// occasionally piling leaves onto the copy.
function mulberry32(a) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLeafGeometry() {
  // Same silhouette as the 2D canvas leaf: two mirrored quadratic curves.
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.5);
  shape.quadraticCurveTo(0.5, 0, 0, 0.5);
  shape.quadraticCurveTo(-0.5, 0, 0, -0.5);
  return new THREE.ShapeGeometry(shape, 10);
}

function Leaves() {
  const mesh = useRef(null);
  const geometry = useMemo(makeLeafGeometry, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const seeds = useMemo(() => {
    const rand = mulberry32(20260714);
    return Array.from({ length: COUNT }, () => ({
      x: (rand() - 0.5) * SPREAD_X,
      y: (rand() - 0.5) * SPREAD_Y,
      // Negative z pushes leaves away from camera; the range gives the canopy
      // its depth and lets near leaves cross in front of far ones.
      z: -1 - rand() * 7,
      scale: 0.35 + rand() * 0.85,
      fall: 0.12 + rand() * 0.4,
      spin: (rand() - 0.5) * 0.5,
      tilt: rand() * Math.PI,
      phase: rand() * Math.PI * 2,
      sway: 0.25 + rand() * 0.5,
      rot: rand() * Math.PI * 2,
    }));
  }, []);

  // Per-instance colour, set once. instanceColor is uploaded to the GPU, so the
  // whole canopy stays one draw call despite three colours.
  useEffect(() => {
    const node = mesh.current;
    if (!node) return;
    const color = new THREE.Color();
    seeds.forEach((_, i) => {
      node.setColorAt(i, color.set(PALETTE[i % PALETTE.length]));
    });
    if (node.instanceColor) node.instanceColor.needsUpdate = true;
  }, [seeds]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const node = mesh.current;
    if (!node) return;

    // delta is clamped: a backgrounded tab can hand back a huge delta on
    // return, which would teleport every leaf.
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    seeds.forEach((s, i) => {
      s.y -= s.fall * dt;
      s.rot += s.spin * dt;
      // Wrap to the top once a leaf falls out of frame — an endless canopy.
      if (s.y < -SPREAD_Y / 2) s.y = SPREAD_Y / 2;

      dummy.position.set(s.x + Math.sin(t * s.sway + s.phase) * 0.5, s.y, s.z);
      dummy.rotation.set(s.tilt + Math.sin(t * 0.3 + s.phase) * 0.3, s.rot, s.rot * 0.5);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      node.setMatrixAt(i, dummy.matrix);
    });
    node.instanceMatrix.needsUpdate = true;

    // Camera drifts toward the pointer — the depth cue that makes the layers
    // read as 3D. Lerped, so it eases rather than snapping to the cursor.
    state.camera.position.x += (state.pointer.x * 0.6 - state.camera.position.x) * 0.03;
    state.camera.position.y += (state.pointer.y * 0.35 - state.camera.position.y) * 0.03;
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        transparent
        opacity={0.42}
        side={THREE.DoubleSide}
        // Leaves overlap heavily; writing depth would make them punch holes in
        // each other's transparency.
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export default function CanopyScene({ active = true }) {
  return (
    <Canvas
      // 'never' fully halts the render loop when the hero is off-screen.
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 8], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      style={{ pointerEvents: 'none' }}
    >
      <Leaves />
    </Canvas>
  );
}
