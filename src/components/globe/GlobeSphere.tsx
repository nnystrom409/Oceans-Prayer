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

  uniform vec3 edgeColor;
  uniform float opacity;
  uniform float time;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

    // Fresnel effect for glass-like edges
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);

    // Specular highlights for glass reflections
    vec3 lightDir1 = normalize(vec3(5.0, 3.0, 5.0));
    vec3 lightDir2 = normalize(vec3(-3.0, 5.0, 2.0));

    vec3 halfVector1 = normalize(lightDir1 + viewDirection);
    vec3 halfVector2 = normalize(lightDir2 + viewDirection);

    float specular1 = pow(max(dot(vNormal, halfVector1), 0.0), 64.0);
    float specular2 = pow(max(dot(vNormal, halfVector2), 0.0), 48.0);

    // White specular highlights
    vec3 specularColor = vec3(1.0) * (specular1 * 0.6 + specular2 * 0.3);

    // Base edge color with fresnel
    vec3 color = edgeColor * fresnel;

    // Add specular highlights
    color += specularColor;

    // Very subtle shimmer on edges only
    float shimmer = sin(vUv.x * 30.0 + time * 0.5) * sin(vUv.y * 30.0 + time * 0.3) * 0.02 * fresnel;
    color += shimmer;

    // Alpha: edges visible, center mostly transparent, specular always visible
    float alpha = fresnel * 0.6 + opacity * 0.1 + (specular1 + specular2) * 0.5;

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
