"use client";

import { useCallback, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { GlobeSphere } from "./GlobeSphere";
import { Atmosphere } from "./Atmosphere";
import { CountryOutlines } from "./CountryOutlines";
import { Countries } from "./Countries";

interface GlobeProps {
  onCountryClick?: (countryCode: string, countryName: string) => void;
}

export function Globe({ onCountryClick }: GlobeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const hasInteractedRef = useRef(false);
  const focusTargetRef = useRef<THREE.Quaternion | null>(null);
  const radius = 1;
  const { camera } = useThree();

  const stopAutoRotate = useCallback(() => {
    hasInteractedRef.current = true;
  }, []);

  const focusOnPoint = useCallback(
    (point: THREE.Vector3) => {
      if (!groupRef.current) return;

      hasInteractedRef.current = true;

      const targetDir = camera.position.clone().normalize();
      const pointDir = point.clone().normalize();
      if (pointDir.lengthSq() === 0 || targetDir.lengthSq() === 0) return;

      const deltaQuat = new THREE.Quaternion().setFromUnitVectors(pointDir, targetDir);
      const targetQuat = groupRef.current.quaternion.clone();
      targetQuat.premultiply(deltaQuat);
      focusTargetRef.current = targetQuat;
    },
    [camera]
  );

  // Gentle auto-rotation when not interacting
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (focusTargetRef.current) {
      const smoothing = 1 - Math.exp(-delta * 6);
      groupRef.current.quaternion.slerp(focusTargetRef.current, smoothing);
      if (groupRef.current.quaternion.angleTo(focusTargetRef.current) < 0.001) {
        groupRef.current.quaternion.copy(focusTargetRef.current);
        focusTargetRef.current = null;
      }
      return;
    }

    if (!hasInteractedRef.current) {
      // Very slow rotation
      groupRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#b9e5fe" />
      <pointLight position={[0, 0, 3]} intensity={0.5} color="#7cd4fd" />

      {/* Globe group */}
      <group ref={groupRef} onPointerDown={stopAutoRotate}>
        {/* Main sphere */}
        <GlobeSphere radius={radius} />

        {/* Atmosphere glow */}
        <Atmosphere radius={radius} />

        {/* Country border outlines */}
        <CountryOutlines radius={radius} />

        {/* Countries with LOD fills and click detection */}
        <Countries
          radius={radius}
          onCountryClick={onCountryClick}
          onCountryFocus={focusOnPoint}
          globeGroupRef={groupRef}
        />
      </group>

      {/* Orbit controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.5}
        maxDistance={4}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        onStart={stopAutoRotate}
        // Disable auto-rotate from controls (we do it manually)
        autoRotate={false}
      />
    </>
  );
}
