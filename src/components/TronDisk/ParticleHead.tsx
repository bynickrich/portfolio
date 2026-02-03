"use client";

/**
 * ParticleHead — Converts a 3D mesh into a particle cloud that forms
 * the head/face shape inside the Tron identity disk.
 *
 * KEY CONCEPTS:
 * - useLoader: R3F hook that loads assets (meshes, textures) and caches them.
 * - BufferGeometry: The modern Three.js geometry format. Stores vertex data in
 *   typed arrays (Float32Arrays) called "attributes" — position, normal, uv, etc.
 * - ShaderMaterial: Lets you write custom vertex/fragment shaders instead of
 *   using Three.js's built-in materials. Full GPU control.
 * - useFrame: Runs every frame (~60fps). This is where animation happens.
 *
 * MESH LOADING:
 * Place your 3D scan file in /public/models/ and pass the filename as a prop.
 * Supported formats: .obj, .ply, .glb/.gltf
 * If no file is provided (or loading fails), a sphere of particles is used.
 */

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { headParticleVertex, headParticleFragment } from "./shaders";

interface ParticleHeadProps {
  /** Path to a 3D model file in /public/models/ (e.g. "head.obj") */
  modelPath?: string;
  /** Maximum number of particles to sample from the mesh */
  particleCount?: number;
  /** How much particles drift from their home position */
  noiseScale?: number;
  /** Base color of the particles (CSS color string) */
  color?: string;
  /** Rotation speed multiplier (radians per frame) */
  rotationSpeed?: number;
}

/**
 * Extracts vertex positions from various Three.js object types.
 * Different loaders return different structures, so we need to
 * handle each case and pull out the raw position data.
 */
function extractPositions(object: THREE.Object3D | THREE.BufferGeometry): Float32Array | null {
  // If it's already a BufferGeometry (PLYLoader returns this)
  if (object instanceof THREE.BufferGeometry) {
    return object.attributes.position?.array as Float32Array ?? null;
  }

  // GLTF/OBJ loaders return a scene graph — we need to find meshes inside it
  const positions: number[] = [];

  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const posAttr = child.geometry.attributes.position;
      if (posAttr) {
        // Apply the mesh's world transform so positions are in world space
        child.updateWorldMatrix(true, false);
        const vec = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
          vec.fromBufferAttribute(posAttr, i);
          vec.applyMatrix4(child.matrixWorld);
          positions.push(vec.x, vec.y, vec.z);
        }
      }
    }
  });

  return positions.length > 0 ? new Float32Array(positions) : null;
}

/**
 * Generates a fallback sphere of particles for testing
 * when no 3D scan file is provided.
 */
function generateFallbackSphere(count: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Fibonacci sphere algorithm — distributes points evenly on a sphere surface.
    // Much better than random distribution which clumps at poles.
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;

    // Vary the radius slightly so it's not a perfect shell
    const r = 1.2 + (Math.random() - 0.5) * 0.3;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }

  return positions;
}

/**
 * Sub-samples positions if there are too many vertices.
 * LiDAR scans can have millions of points — we pick a random subset.
 */
function samplePositions(allPositions: Float32Array, maxCount: number): Float32Array {
  const totalVertices = allPositions.length / 3;
  if (totalVertices <= maxCount) return allPositions;

  const sampled = new Float32Array(maxCount * 3);
  const step = totalVertices / maxCount;

  for (let i = 0; i < maxCount; i++) {
    // Stratified sampling: pick one random point from each "bucket"
    // to maintain even coverage across the mesh surface
    const idx = Math.min(
      Math.floor(i * step + Math.random() * step),
      totalVertices - 1
    );
    sampled[i * 3] = allPositions[idx * 3];
    sampled[i * 3 + 1] = allPositions[idx * 3 + 1];
    sampled[i * 3 + 2] = allPositions[idx * 3 + 2];
  }

  return sampled;
}

/**
 * Centers and normalizes positions to fit within a unit sphere.
 * Scan files come in all scales/positions — this makes them consistent.
 */
function normalizePositions(positions: Float32Array, targetRadius: number = 1.3): Float32Array {
  const count = positions.length / 3;
  const result = new Float32Array(positions.length);

  // Find bounding box center
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const maxExtent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const scale = (targetRadius * 2) / maxExtent;

  for (let i = 0; i < count; i++) {
    result[i * 3] = (positions[i * 3] - cx) * scale;
    result[i * 3 + 1] = (positions[i * 3 + 1] - cy) * scale;
    result[i * 3 + 2] = (positions[i * 3 + 2] - cz) * scale;
  }

  return result;
}

/**
 * Custom hook to load a 3D model and extract particle positions.
 * Returns null while loading, and a Float32Array of positions when ready.
 */
function useModelPositions(
  modelPath: string | undefined,
  particleCount: number,
): Float32Array | null {
  const [positions, setPositions] = useState<Float32Array | null>(null);

  useEffect(() => {
    if (!modelPath) {
      setPositions(generateFallbackSphere(particleCount));
      return;
    }

    const ext = modelPath.split(".").pop()?.toLowerCase();
    let loader: THREE.Loader;

    switch (ext) {
      case "obj":
        loader = new OBJLoader();
        break;
      case "ply":
        loader = new PLYLoader();
        break;
      case "glb":
      case "gltf":
        loader = new GLTFLoader();
        break;
      default:
        console.warn(`Unsupported format: .${ext}, using fallback sphere`);
        setPositions(generateFallbackSphere(particleCount));
        return;
    }

    const fullPath = `/models/${modelPath}`;

    (loader as THREE.Loader & { load: (url: string, onLoad: (result: unknown) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void) => void }).load(
      fullPath,
      (result: unknown) => {
        let raw: Float32Array | null = null;

        if (ext === "ply") {
          // PLYLoader returns a BufferGeometry directly
          raw = extractPositions(result as THREE.BufferGeometry);
        } else if (ext === "glb" || ext === "gltf") {
          // GLTFLoader returns { scene, ... }
          const gltf = result as { scene: THREE.Object3D };
          raw = extractPositions(gltf.scene);
        } else {
          // OBJLoader returns a Group
          raw = extractPositions(result as THREE.Object3D);
        }

        if (raw && raw.length > 0) {
          const sampled = samplePositions(raw, particleCount);
          setPositions(normalizePositions(sampled));
        } else {
          console.warn("No vertex data found in model, using fallback");
          setPositions(generateFallbackSphere(particleCount));
        }
      },
      undefined,
      (error) => {
        console.warn("Failed to load model:", error, "— using fallback");
        setPositions(generateFallbackSphere(particleCount));
      },
    );
  }, [modelPath, particleCount]);

  return positions;
}

export default function ParticleHead({
  modelPath,
  particleCount = 15000,
  noiseScale = 0.015,
  color = "#6fdbff",
  rotationSpeed = 0.08,
}: ParticleHeadProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const positions = useModelPositions(modelPath, particleCount);

  // Create per-particle random seeds.
  // These are stored as a custom "attribute" on the geometry so each
  // particle gets its own value in the vertex shader.
  const randoms = useMemo(() => {
    const arr = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      arr[i] = Math.random();
    }
    return arr;
  }, [particleCount]);

  // Shader uniforms — values we can update every frame from JS.
  // useMemo ensures we create the uniform objects once (not every render).
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNoiseScale: { value: noiseScale },
      uNoiseSpeed: { value: 0.8 },
      uPointSize: { value: 2.5 },
      uColor: { value: new THREE.Color(color) },
    }),
    // We intentionally don't re-create on color/noise changes;
    // instead we update the existing uniform values below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Update uniform values when props change (without recreating the material)
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uNoiseScale.value = noiseScale;
      materialRef.current.uniforms.uColor.value.set(color);
    }
  }, [noiseScale, color]);

  // Animation loop — runs every frame.
  // `clock.getElapsedTime()` gives us total seconds since start.
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }

    // Slow independent rotation of the head particle cloud
    if (pointsRef.current) {
      pointsRef.current.rotation.y += rotationSpeed * 0.005;
    }
  });

  // Don't render until positions are loaded
  if (!positions) return null;

  return (
    <points ref={pointsRef}>
      {/*
        BufferGeometry stores all vertex data as typed arrays (Float32Arrays).
        Each "attribute" maps to a variable in the vertex shader:
        - "position" → built-in `position` variable
        - "aRandom"  → our custom `attribute float aRandom`
      */}
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          args={[randoms, 1]}
        />
      </bufferGeometry>

      {/*
        ShaderMaterial = full custom shaders.
        - vertexShader: positions each particle
        - fragmentShader: colors each pixel of each particle
        - transparent: enables alpha blending
        - depthWrite: false prevents particles from occluding each other
        - blending: AdditiveBlending makes overlapping particles brighter (glow effect)
      */}
      <shaderMaterial
        ref={materialRef}
        vertexShader={headParticleVertex}
        fragmentShader={headParticleFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
