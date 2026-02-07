"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";

interface GlobeSphereSimpleProps {
  radius?: number;
}

/**
 * Simple lit globe sphere without textures.
 * Following GitHub's approach: "we point four lights at a sphere"
 */
export function GlobeSphereSimple({ radius = 1 }: GlobeSphereSimpleProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Custom shader for subtle gradient effect
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#a8d5f7"), // Soft sky blue
      roughness: 0.9,
      metalness: 0.1,
    });
  }, []);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
