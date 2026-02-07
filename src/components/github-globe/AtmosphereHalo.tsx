"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Fresnel-based glow shader for backside rendering
const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 glowColor;
  uniform float intensity;
  uniform float power;

  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    // Fresnel effect - stronger glow at edges
    vec3 viewDir = normalize(-vPosition);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    float glow = pow(fresnel, power) * intensity;

    // Multi-layer glow for depth
    float innerGlow = pow(fresnel, power * 0.5) * 0.3;
    float outerGlow = pow(fresnel, power * 1.5) * 0.5;

    vec3 color = glowColor * (glow + innerGlow + outerGlow);
    float alpha = glow * 0.6 + innerGlow * 0.2 + outerGlow * 0.2;

    gl_FragColor = vec4(color, alpha);
  }
`;

interface AtmosphereHaloProps {
  radius?: number;
  color?: string;
  intensity?: number;
  power?: number;
  scale?: number;
}

/**
 * Atmospheric glow effect rendered on the backside of a larger sphere.
 * Uses Fresnel shading with additive blending.
 * Tilted slightly (0.15 rad) to hide pixelation artifacts.
 */
export function AtmosphereHalo({
  radius = 1,
  color = "#a8d5f7",
  intensity = 0.3,
  power = 3.0,
  scale = 1.15,
}: AtmosphereHaloProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(color) },
      intensity: { value: intensity },
      power: { value: power },
    }),
    [color, intensity, power]
  );

  // Subtle pulsing animation
  useFrame(({ clock }) => {
    if (uniforms.intensity) {
      uniforms.intensity.value =
        intensity + Math.sin(clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <mesh
      ref={meshRef}
      scale={[scale, scale, scale]}
      rotation={[0.15, 0, 0]} // Slight tilt to hide artifacts
    >
      <sphereGeometry args={[radius, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
