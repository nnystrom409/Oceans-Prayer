"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Vertex shader with instancing support
const vertexShader = `
  attribute float landFlag;
  attribute float instanceIndex;

  varying float vLandFlag;
  varying float vDistanceToCamera;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vLandFlag = landFlag;
    vNormal = normalize(normalMatrix * normal);

    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * worldPosition;

    vDistanceToCamera = -mvPosition.z;
    vViewDir = normalize(-mvPosition.xyz);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader with distance and view-angle based fading
const fragmentShader = `
  uniform vec3 dotColor;
  uniform float minDistance;
  uniform float maxDistance;

  varying float vLandFlag;
  varying float vDistanceToCamera;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    // Discard ocean dots
    if (vLandFlag < 0.5) {
      discard;
    }

    // Distance-based fade (reduces moiré at distance)
    float distanceFade = 1.0 - smoothstep(minDistance, maxDistance, vDistanceToCamera);

    // View-direction fade (edge dots fade out)
    float viewDot = dot(vNormal, vViewDir);
    float viewFade = smoothstep(-0.1, 0.4, viewDot);

    // Combine fades
    float alpha = distanceFade * viewFade;

    // Discard nearly transparent pixels
    if (alpha < 0.01) {
      discard;
    }

    gl_FragColor = vec4(dotColor, alpha);
  }
`;

interface DotSphereProps {
  positions: Float32Array;
  landFlags: Float32Array;
  dotRadius?: number;
  dotSegments?: number;
  color?: string;
  globeRadius?: number;
}

/**
 * Renders land dots using InstancedMesh with custom shaders.
 * Pentagon circles (5 segments) positioned via Fibonacci sphere.
 */
export function DotSphere({
  positions,
  landFlags,
  dotRadius = 0.008,
  dotSegments = 5,
  color = "#3fb950",
  globeRadius = 1,
}: DotSphereProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  const instanceCount = positions.length / 3;

  // Create geometry and material
  const geometry = useMemo(() => {
    return new THREE.CircleGeometry(dotRadius, dotSegments);
  }, [dotRadius, dotSegments]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        dotColor: { value: new THREE.Color(color) },
        minDistance: { value: 1.5 }, // Start fading
        maxDistance: { value: 4.5 }, // Fully faded
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [color]);

  // Set up instances
  useEffect(() => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();
    const tempVec = new THREE.Vector3();

    // Add land flag as instance attribute
    const landFlagAttr = new THREE.InstancedBufferAttribute(landFlags, 1);
    mesh.geometry.setAttribute("landFlag", landFlagAttr);

    // Set up each instance transform
    for (let i = 0; i < instanceCount; i++) {
      const idx = i * 3;
      const x = positions[idx];
      const y = positions[idx + 1];
      const z = positions[idx + 2];

      // Position the dot
      dummy.position.set(x, y, z);

      // Orient the dot to face outward from globe center
      tempVec.set(x, y, z).normalize();
      dummy.lookAt(tempVec.multiplyScalar(2));

      // Lift slightly off the surface
      dummy.position.normalize().multiplyScalar(globeRadius * 1.002);

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, [positions, landFlags, instanceCount, globeRadius]);

  // Update uniform when color changes
  useEffect(() => {
    if (material.uniforms.dotColor) {
      material.uniforms.dotColor.value.set(color);
    }
  }, [color, material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, instanceCount]}
      frustumCulled={false}
    />
  );
}
