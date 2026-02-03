"use client";

/**
 * DiskFrame — The glowing circular ring that frames the particle head.
 *
 * KEY CONCEPTS:
 * - TorusGeometry: A donut shape. We use it for the outer glowing ring.
 *   Parameters: (radius, tube thickness, radial segments, tubular segments)
 * - RingGeometry: A flat annulus (washer shape). Used for the disk body.
 *   Parameters: (inner radius, outer radius, segments)
 * - MeshStandardMaterial: PBR material with roughness/metalness for realistic looks.
 * - MeshBasicMaterial: Ignores lighting, shows flat color. With emissive-like
 *   appearance when combined with bloom post-processing.
 * - Group: A container that lets us transform multiple meshes together.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface DiskFrameProps {
  /** Outer radius of the disk */
  radius?: number;
  /** Rotation speed of the entire disk (radians/frame multiplier) */
  rotationSpeed?: number;
  /** Glow color for the ring edge */
  glowColor?: string;
}

export default function DiskFrame({
  radius = 2.0,
  rotationSpeed = 0.15,
  glowColor = "#6fdbff",
}: DiskFrameProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Rotate the entire disk group on the Y axis
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += rotationSpeed * 0.005;
    }
  });

  return (
    <group ref={groupRef}>
      {/*
        Outer Glow Ring — the bright cyan/white edge visible in the Tron reference.
        A torus (donut) provides a round tube cross-section which catches bloom nicely.
      */}
      <mesh>
        <torusGeometry args={[radius, 0.04, 16, 100]} />
        <meshBasicMaterial
          color={glowColor}
          toneMapped={false}
          // toneMapped=false lets the color exceed 0-1 range, making it
          // appear extra bright and bloom-friendly in post-processing.
        />
      </mesh>

      {/* Inner edge ring — slightly smaller, slightly dimmer */}
      <mesh>
        <torusGeometry args={[radius * 0.85, 0.02, 16, 100]} />
        <meshBasicMaterial
          color={glowColor}
          toneMapped={false}
          opacity={0.5}
          transparent
        />
      </mesh>

      {/*
        Disk Body — the dark metallic surface between the rings.
        RingGeometry creates a flat washer shape. We give it a dark,
        semi-transparent material so the particles inside are visible
        but the disk still has physical presence.
      */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.85, radius, 64]} />
        <meshStandardMaterial
          color="#111118"
          metalness={0.8}
          roughness={0.3}
          side={THREE.DoubleSide}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Back face of the disk body */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.85, radius, 64]} />
        <meshStandardMaterial
          color="#111118"
          metalness={0.8}
          roughness={0.3}
          side={THREE.DoubleSide}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/*
        Accent glow lines — thin rings that add detail.
        In the movie, the disk has multiple concentric light lines.
      */}
      <mesh>
        <torusGeometry args={[radius * 0.92, 0.008, 8, 100]} />
        <meshBasicMaterial
          color={glowColor}
          toneMapped={false}
          opacity={0.3}
          transparent
        />
      </mesh>
    </group>
  );
}
