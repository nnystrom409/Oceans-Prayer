"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Custom shader for the translucent glass atmosphere effect
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform vec3 glowColor;
  uniform float intensity;

  void main() {
    float glow = pow(0.75 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
    vec3 color = glowColor * glow * intensity;
    float alpha = glow * 0.25;
    gl_FragColor = vec4(color, alpha);
  }
`;

interface AtmosphereProps {
  radius?: number;
}

export function Atmosphere({ radius = 1 }: AtmosphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color("#5eb8e4") },
      intensity: { value: 0.3 },
    }),
    []
  );

  useFrame(() => {
    if (meshRef.current) {
      // Subtle pulsing effect
      uniforms.intensity.value = 0.3 + Math.sin(Date.now() * 0.001) * 0.02;
    }
  });

  return (
    <mesh ref={meshRef} scale={[1.05, 1.05, 1.05]}>
      <sphereGeometry args={[radius, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
