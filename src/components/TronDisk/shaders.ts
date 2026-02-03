/**
 * Custom GLSL shaders for the Tron Disk particle system.
 *
 * KEY CONCEPTS:
 * - Vertex shader: runs once per particle, controls position and size
 * - Fragment shader: runs once per pixel of each particle, controls color/opacity
 * - Uniforms: values passed from JavaScript to the GPU (same for all particles)
 * - Attributes: per-particle data (position, randomness seed, etc.)
 */

// ---------------------------------------------------------------------------
// Particle Head Shaders
// These render the head-shaped point cloud with animated drift/noise.
// ---------------------------------------------------------------------------

export const headParticleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uNoiseScale;   // how far particles drift from their home position
  uniform float uNoiseSpeed;   // how fast the drift animates
  uniform float uPointSize;    // base size of each particle

  attribute float aRandom;     // unique random seed per particle (0-1)

  varying float vAlpha;        // pass opacity to the fragment shader

  //
  // Simple 3D noise approximation using sine waves.
  // A full Simplex/Perlin implementation is heavier; this is good enough
  // for subtle organic drift and keeps the shader small.
  //
  vec3 snoiseVec3(vec3 p) {
    // Three independent sine-based pseudo-noise channels
    return vec3(
      sin(p.x * 1.3 + p.y * 1.7 + p.z * 2.1 + uTime * uNoiseSpeed * 0.7),
      sin(p.y * 1.5 + p.z * 1.9 + p.x * 2.3 + uTime * uNoiseSpeed * 0.8),
      sin(p.z * 1.1 + p.x * 1.4 + p.y * 2.5 + uTime * uNoiseSpeed * 0.6)
    );
  }

  void main() {
    // Start from the original mesh vertex position
    vec3 pos = position;

    // Add noise-based drift so particles feel alive, not frozen.
    // Each particle uses its own random seed to offset the noise lookup,
    // preventing them from all moving in unison.
    vec3 noise = snoiseVec3(pos * 2.0 + aRandom * 100.0);
    pos += noise * uNoiseScale;

    // Transform from local (model) space → world → camera → clip space.
    // modelViewMatrix = modelMatrix * viewMatrix (provided by Three.js).
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Size attenuation: particles farther from the camera appear smaller,
    // mimicking perspective. The divisor (-mvPosition.z) is the depth.
    gl_PointSize = uPointSize * (300.0 / -mvPosition.z);

    gl_Position = projectionMatrix * mvPosition;

    // Vary opacity per particle for visual richness.
    // Mix between 0.4 and 1.0 based on each particle's random seed.
    vAlpha = mix(0.4, 1.0, aRandom);
  }
`;

export const headParticleFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;

  varying float vAlpha;

  void main() {
    // gl_PointCoord gives us UV coordinates within each point sprite (0-1).
    // We compute distance from center to create a soft circular particle
    // instead of a hard square (which is the default for GL_POINTS).
    float dist = length(gl_PointCoord - vec2(0.5));

    // Discard pixels outside the circle radius
    if (dist > 0.5) discard;

    // Soft falloff from center to edge (quadratic curve for a gentle glow)
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

    // Subtle pulsing per-particle based on time and random seed
    alpha *= vAlpha;

    // Slight color variation: core is brighter/whiter, edges are more cyan
    vec3 color = mix(uColor, vec3(1.0), alpha * 0.3);

    gl_FragColor = vec4(color, alpha * 0.85);
  }
`;

// ---------------------------------------------------------------------------
// Dust Particle Shaders
// Floating ambient particles for atmosphere.
// ---------------------------------------------------------------------------

export const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPointSize;

  attribute float aRandom;
  attribute float aSpeed;

  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // Gentle upward drift + sine-wave wandering
    pos.y += mod(uTime * aSpeed * 0.1, 10.0) - 5.0;
    pos.x += sin(uTime * aSpeed * 0.3 + aRandom * 6.28) * 0.3;
    pos.z += cos(uTime * aSpeed * 0.2 + aRandom * 3.14) * 0.3;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uPointSize * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // Dust fades based on random seed for variety
    vAlpha = mix(0.1, 0.4, aRandom);
  }
`;

export const dustFragment = /* glsl */ `
  uniform vec3 uColor;

  varying float vAlpha;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    gl_FragColor = vec4(uColor, alpha * vAlpha);
  }
`;
