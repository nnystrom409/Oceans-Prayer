"use client";

import { useCallback, useRef } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { vector3ToLatLng } from "@/lib/geo-utils";
import { findCountryAtPoint } from "@/lib/country-lookup";

interface CountriesProps {
  radius?: number;
  onCountryClick?: (countryCode: string, countryName: string) => void;
}

export function Countries({ radius = 1, onCountryClick }: CountriesProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Handle click on globe to detect country using point-in-polygon
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!onCountryClick || !meshRef.current) return;

      // Stop propagation to prevent multiple handlers
      event.stopPropagation();

      // Get the point on the globe that was clicked (in world space)
      // Transform to local space to account for globe rotation
      const localPoint = meshRef.current.worldToLocal(event.point.clone());
      const { lat, lng } = vector3ToLatLng(localPoint, radius);

      // Find country at this point using polygon boundaries
      const country = findCountryAtPoint(lat, lng);

      if (country) {
        onCountryClick(country.code, country.name);
      }
    },
    [onCountryClick, radius]
  );

  return (
    <group>
      {/* Invisible sphere for click detection - larger radius and proper settings for reliable hits */}
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
