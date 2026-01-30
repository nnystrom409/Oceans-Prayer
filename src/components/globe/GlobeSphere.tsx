"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Custom shader for translucent glass globe
const globeVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const globeFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  uniform vec3 baseColor;
  uniform vec3 edgeColor;
  uniform float opacity;
  uniform float time;

  void main() {
    // Fresnel effect for glass-like edges - stronger effect for more transparency in center
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);

    // Color only on edges, transparent center
    vec3 color = edgeColor;

    // Very subtle shimmer on edges only
    float shimmer = sin(vUv.x * 30.0 + time * 0.5) * sin(vUv.y * 30.0 + time * 0.3) * 0.03 * fresnel;
    color += shimmer;

    // Only show color at edges (fresnel), center is mostly transparent
    float alpha = fresnel * 0.7 + opacity * 0.1;

    gl_FragColor = vec4(color, alpha);
  }
`;

interface GlobeSphereProps {
  radius?: number;
}

export function GlobeSphere({ radius = 1 }: GlobeSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      baseColor: { value: new THREE.Color("#b9e5fe") },
      edgeColor: { value: new THREE.Color("#7cd4fd") },
      opacity: { value: 0.15 },
      time: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    uniforms.time.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 128, 128]} />
      <shaderMaterial
        vertexShader={globeVertexShader}
        fragmentShader={globeFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
}
