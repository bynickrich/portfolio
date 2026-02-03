"use client";

/**
 * DiskFrame — The glowing circular ring that frames the particle head.
 *
 * Supports two modes:
 * 1. GLTF Model: Load a real disk model (e.g. from Sketchfab) placed in /public/models/
 * 2. Procedural Fallback: Simple torus rings + flat disk body when no model is provided
 *
 * KEY CONCEPTS:
 * - useGLTF: Drei hook that loads and caches GLTF/GLB files. Returns the scene graph.
 * - scene.traverse: Walks every node in a loaded model to inspect/modify materials.
 * - Emissive materials: Materials can emit light via `emissive` + `emissiveIntensity`.
 *   Combined with bloom post-processing, this creates the Tron glow effect.
 * - clone(): GLTF scenes are shared by default. We clone so multiple instances
 *   don't share the same transform/material state.
 */

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface DiskFrameProps {
  /**
   * Path to a GLTF/GLB disk model in /public/models/ (e.g. "tron-disk.glb").
   * If omitted, a simple procedural disk is rendered instead.
   */
  modelPath?: string;
  /** Outer radius of the procedural fallback disk */
  radius?: number;
  /** Rotation speed of the entire disk (radians/frame multiplier) */
  rotationSpeed?: number;
  /** Glow color for emissive edges */
  glowColor?: string;
}

/**
 * Loads a GLTF disk model, applies Tron-style materials, and auto-scales
 * it to fit consistently in the scene regardless of the model's native size.
 */
function GltfDisk({
  modelPath,
  glowColor,
}: {
  modelPath: string;
  glowColor: string;
}) {
  const { scene } = useGLTF(`/models/${modelPath}`);
  const [processedScene, setProcessedScene] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    // Clone the scene so we don't mutate the cached original.
    // Without this, loading the same model elsewhere would share our material changes.
    const cloned = scene.clone(true);

    // Compute bounding box to normalize scale.
    // Models from different sources come in wildly different sizes.
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Scale so the disk fits within ~4 units diameter (matching our scene proportions)
    const targetSize = 4.0;
    const scale = targetSize / maxDim;
    cloned.scale.setScalar(scale);

    // Center the model at the origin
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    const glowColorObj = new THREE.Color(glowColor);

    // Walk every mesh in the model and apply Tron-style materials.
    // The strategy:
    // - Dark/black parts → keep dark with metallic finish
    // - Bright/emissive parts → make them glow with our accent color
    // - Detect which is which by checking the original material's color brightness
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const materials = Array.isArray(child.material) ? child.material : [child.material];

      child.material = materials.map((mat) => {
        const oldMat = mat as THREE.MeshStandardMaterial;

        // Check if the original material is "bright" (likely a glow edge)
        // by looking at its color luminance or emissive intensity
        const color = oldMat.color ?? new THREE.Color(0x000000);
        const luminance = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
        const hasEmissive = oldMat.emissive && (oldMat.emissive.r + oldMat.emissive.g + oldMat.emissive.b) > 0.1;

        if (luminance > 0.5 || hasEmissive) {
          // Bright part → glowing edge material
          return new THREE.MeshBasicMaterial({
            color: glowColorObj,
            transparent: oldMat.transparent || oldMat.opacity < 1,
            opacity: oldMat.opacity,
            side: oldMat.side,
          });
        } else {
          // Dark part → metallic disk body
          return new THREE.MeshStandardMaterial({
            color: "#0a0a12",
            metalness: 0.9,
            roughness: 0.2,
            emissive: glowColorObj,
            emissiveIntensity: 0.02,
            transparent: oldMat.transparent || oldMat.opacity < 1,
            opacity: Math.min(oldMat.opacity, 0.95),
            side: oldMat.side ?? THREE.FrontSide,
          });
        }
      });

      // Unwrap single-material array (Three.js expects a single material, not a 1-element array)
      if (Array.isArray(child.material) && child.material.length === 1) {
        child.material = child.material[0];
      }
    });

    setProcessedScene(cloned);
  }, [scene, glowColor]);

  if (!processedScene) return null;

  return <primitive object={processedScene} />;
}

/**
 * Procedural fallback disk — simple torus rings when no GLTF model is available.
 */
function ProceduralDisk({
  radius,
  glowColor,
}: {
  radius: number;
  glowColor: string;
}) {
  return (
    <>
      {/* Outer glow ring */}
      <mesh>
        <torusGeometry args={[radius, 0.04, 16, 100]} />
        <meshBasicMaterial color={glowColor} />
      </mesh>

      {/* Inner edge ring */}
      <mesh>
        <torusGeometry args={[radius * 0.85, 0.02, 16, 100]} />
        <meshBasicMaterial color={glowColor} opacity={0.4} transparent />
      </mesh>

      {/* Disk body — front */}
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

      {/* Disk body — back */}
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

      {/* Accent ring */}
      <mesh>
        <torusGeometry args={[radius * 0.92, 0.008, 8, 100]} />
        <meshBasicMaterial color={glowColor} opacity={0.25} transparent />
      </mesh>
    </>
  );
}

export default function DiskFrame({
  modelPath,
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
      {modelPath ? (
        <GltfDisk modelPath={modelPath} glowColor={glowColor} />
      ) : (
        <ProceduralDisk radius={radius} glowColor={glowColor} />
      )}
    </group>
  );
}
