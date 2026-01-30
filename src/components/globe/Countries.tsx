"use client";

import { useCallback } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { COUNTRY_CENTERS, vector3ToLatLng } from "@/lib/geo-utils";

interface CountriesProps {
  radius?: number;
  onCountryClick?: (countryCode: string, countryName: string) => void;
}

export function Countries({ radius = 1, onCountryClick }: CountriesProps) {
  // Handle click on globe to detect country
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!onCountryClick) return;

      // Stop propagation to prevent multiple handlers
      event.stopPropagation();

      // Get the point on the globe that was clicked
      const point = event.point;
      const { lat, lng } = vector3ToLatLng(point, radius);

      // Find the nearest country
      let nearestCountry = "";
      let nearestDistance = Infinity;

      Object.entries(COUNTRY_CENTERS).forEach(([code, { lat: cLat, lng: cLng }]) => {
        const distance = Math.sqrt(
          Math.pow(lat - cLat, 2) + Math.pow(lng - cLng, 2)
        );
        if (distance < nearestDistance && distance < 20) {
          nearestDistance = distance;
          nearestCountry = code;
        }
      });

      if (nearestCountry) {
        onCountryClick(nearestCountry, COUNTRY_CENTERS[nearestCountry].name);
      }
    },
    [onCountryClick, radius]
  );

  return (
    <group>
      {/* Invisible sphere for click detection - larger radius and proper settings for reliable hits */}
      <mesh onClick={handleClick} renderOrder={1000}>
        <sphereGeometry args={[radius * 1.03, 64, 64]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
