"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { ThreeEvent, useThree, useFrame } from "@react-three/fiber";
import { countryFeatures } from "@/lib/load-countries";
import { CountryFills, LodLevel, generateCountryGeometry } from "./CountryFills";
import { useGpuPicker } from "./useGpuPicker";

interface CountriesProps {
  radius?: number;
  onCountryClick?: (countryCode: string, countryName: string) => void;
  globeGroupRef?: React.RefObject<THREE.Group | null>;
}

// LOD distance thresholds
const LOD_THRESHOLDS = {
  high: 2.0,    // Use high detail when camera < 2 units
  medium: 3.5,  // Use medium detail when camera < 3.5 units
  // low: > 3.5 units
};

export function Countries({ radius = 1, onCountryClick, globeGroupRef }: CountriesProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [lodLevel, setLodLevel] = useState<LodLevel>("medium");
  const lodRef = useRef<LodLevel>("medium"); // Ref to avoid stale closure in useFrame
  const { camera } = useThree();

  // Generate picking geometry (always uses medium LOD for consistent picking)
  const pickingGeometry = useMemo(
    () => generateCountryGeometry(radius, "medium"),
    [radius]
  );

  // GPU picker hook - pass globe group ref for rotation sync
  const { pick } = useGpuPicker({ pickingGeometry, globeGroupRef });

  // Update LOD based on camera distance
  useFrame(() => {
    const distance = camera.position.length();
    let newLod: LodLevel;

    if (distance < LOD_THRESHOLDS.high) {
      newLod = "high";
    } else if (distance < LOD_THRESHOLDS.medium) {
      newLod = "medium";
    } else {
      newLod = "low";
    }

    // Only update state when LOD actually changes (ref avoids stale closure)
    if (newLod !== lodRef.current) {
      lodRef.current = newLod;
      setLodLevel(newLod);
    }
  });

  // Handle click on globe using GPU picking
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!onCountryClick) return;

      event.stopPropagation();

      // Get screen coordinates from the event
      const { clientX, clientY } = event.nativeEvent;

      // Get canvas bounding rect for proper coordinate calculation
      const canvas = event.target as HTMLElement;
      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      // Use GPU picker to find country
      const result = pick(screenX, screenY);

      if (result.countryIndex !== null && result.countryIndex < countryFeatures.length) {
        const feature = countryFeatures[result.countryIndex];
        const code = feature.properties.ADM0_A3;
        const name = feature.properties.NAME;
        onCountryClick(code, name);
      }
    },
    [onCountryClick, pick]
  );

  return (
    <group>
      {/* Country fills with LOD */}
      <CountryFills radius={radius} lodLevel={lodLevel} />

      {/* Invisible sphere for click detection */}
      <mesh ref={meshRef} onClick={handleClick} renderOrder={1000}>
        <sphereGeometry args={[radius * 1.03, 64, 64]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          side={THREE.FrontSide}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
