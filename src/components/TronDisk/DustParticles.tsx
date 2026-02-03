"use client";

/**
 * DustParticles — Sparse floating particles that add atmosphere to the scene.
 *
 * These are scattered randomly in a large volume around the disk.
 * They drift slowly to create a feeling of depth and environment,
 * like dust motes in a dark server room.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { dustVertex, dustFragment } from "./shaders";

interface DustParticlesProps {
  count?: number;
  spread?: number;
  color?: string;
}

export default function DustParticles({
  count = 300,
  spread = 8,
  color = "#6fdbff",
}: DustParticlesProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate random positions, per-particle random seeds, and speed multipliers
  const { positions, randoms, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    const spd = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread particles in a cube volume around the origin
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread;

      rnd[i] = Math.random();
      spd[i] = 0.5 + Math.random() * 1.5; // varied drift speeds
    }

    return { positions: pos, randoms: rnd, speeds: spd };
  }, [count, spread]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointSize: { value: 2.0 },
      uColor: { value: new THREE.Color(color) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          args={[randoms, 1]}
        />
        <bufferAttribute
          attach="attributes-aSpeed"
          args={[speeds, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={dustVertex}
        fragmentShader={dustFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
