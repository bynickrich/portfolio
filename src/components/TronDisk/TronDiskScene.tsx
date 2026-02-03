"use client";

/**
 * TronDiskScene — The complete Tron identity disk experience.
 *
 * This is the top-level component that sets up:
 * - Canvas: The R3F rendering surface (wraps a WebGL context)
 * - Camera: Perspective camera positioned to frame the disk
 * - Lighting: Minimal ambient + point lights for the dark Tron aesthetic
 * - Post-processing: Bloom (glow) and vignette effects
 * - Fog: Depth fade for atmosphere
 * - OrbitControls: Click-and-drag rotation for exploration
 *
 * KEY CONCEPTS:
 * - <Canvas>: R3F's root component. Creates a WebGL renderer, scene, and
 *   camera. Everything inside it is Three.js, not regular HTML.
 * - EffectComposer: Post-processing pipeline from @react-three/postprocessing.
 *   Applies screen-space effects after the scene is rendered.
 * - Bloom: Makes bright objects glow by blurring their luminance and adding
 *   it back. This is what makes the cyan ring pop.
 * - Suspense: React's built-in loading boundary. Wraps async loaders
 *   (model files) so the scene doesn't break while loading.
 */

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

import ParticleHead from "./ParticleHead";
import DiskFrame from "./DiskFrame";
import DustParticles from "./DustParticles";

interface TronDiskSceneProps {
  /**
   * Filename of a 3D model in /public/models/ (e.g. "head.obj").
   * Supports .obj, .ply, .glb, .gltf formats.
   * If omitted, a sphere of particles is shown as a placeholder.
   */
  modelPath?: string;
  /** Number of particles for the head cloud */
  particleCount?: number;
  /** CSS class name for the container div */
  className?: string;
  /** CSS style object for the container div */
  style?: React.CSSProperties;
}

/**
 * Inner scene content — separated so it can be wrapped in Suspense.
 * Everything in here runs inside the R3F Canvas context.
 */
function SceneContent({
  modelPath,
  particleCount,
}: Pick<TronDiskSceneProps, "modelPath" | "particleCount">) {
  return (
    <>
      {/*
        Lighting Setup:
        - Ambient light: very dim, so the scene stays dark
        - Point lights: subtle fill from different angles
        The Tron aesthetic relies on self-illuminated elements (emissive materials
        and bloom), not environmental lighting. Keep this minimal.
      */}
      <ambientLight intensity={0.05} />
      <pointLight position={[5, 5, 5]} intensity={0.3} color="#4488aa" />
      <pointLight position={[-5, -3, -5]} intensity={0.15} color="#2244aa" />

      {/*
        Fog: makes distant objects fade to black.
        FogExp2 uses exponential falloff (denser than linear fog),
        creating a natural depth fade. The dark color matches our background.
      */}
      <fogExp2 attach="fog" args={["#000008", 0.08]} />

      {/* The glowing disk frame — rotates independently */}
      <DiskFrame />

      {/*
        The particle head — loads asynchronously if a model is provided.
        Suspense catches the loading state so the rest of the scene renders
        immediately while the model downloads.
      */}
      <Suspense fallback={null}>
        <ParticleHead modelPath={modelPath} particleCount={particleCount} />
      </Suspense>

      {/* Atmospheric dust floating in the scene */}
      <DustParticles />

      {/*
        Post-Processing Effects:
        These are screen-space effects applied after the 3D scene is rendered
        to a texture. They operate on pixels, not geometry.
      */}
      <EffectComposer>
        {/*
          Bloom: The signature Tron glow effect.
          - luminanceThreshold: how bright a pixel must be before it blooms.
            Lower = more glow. 0.2 makes the bright cyan ring and particles glow
            while the dark disk body stays clean.
          - luminanceSmoothing: smooth transition into bloom zone
          - intensity: strength of the glow overlay
          - mipmapBlur: uses mipmap chain for the blur (faster & better quality)
        */}
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={1.5}
          mipmapBlur
        />

        {/*
          Vignette: Darkens the edges of the screen, drawing focus to center.
          Subtle but important for the cinematic Tron look.
        */}
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>

      {/*
        OrbitControls: Lets the user click-drag to orbit around the scene.
        - enableZoom: scroll to zoom
        - enablePan: right-click drag to pan
        - autoRotate: the whole camera slowly orbits (adds life even without interaction)
        - autoRotateSpeed: keep it slow for a contemplative feel
        - maxDistance/minDistance: prevent zooming too far in or out
      */}
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.3}
        maxDistance={8}
        minDistance={3}
      />
    </>
  );
}

export default function TronDiskScene({
  modelPath,
  particleCount = 15000,
  className,
  style,
}: TronDiskSceneProps) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        background: "#000008",
        ...style,
      }}
    >
      {/*
        Canvas is R3F's root component. Key props:
        - camera: initial camera position and field of view
        - gl: WebGL renderer settings
          - antialias: smooth edges
          - toneMapping: how HDR values map to screen colors.
            ACESFilmicToneMapping gives a cinematic look.
          - outputColorSpace: SRGBColorSpace for correct color display
        - dpr: device pixel ratio. [1, 2] means "use up to 2x for retina screens
          but don't go below 1x". Higher = sharper but more GPU work.
      */}
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, 2]}
      >
        <SceneContent modelPath={modelPath} particleCount={particleCount} />
      </Canvas>
    </div>
  );
}
