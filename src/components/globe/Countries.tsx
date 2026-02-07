"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { countryFeatures } from "@/lib/load-countries";
import { CountryFills, LodLevel, generateCountryGeometry } from "./CountryFills";
import { useGpuPicker } from "./useGpuPicker";

interface CountriesProps {
  radius?: number;
  onCountryClick?: (countryCode: string, countryName: string) => void;
  onCountryFocus?: (point: THREE.Vector3) => void;
  globeGroupRef?: React.RefObject<THREE.Group | null>;
}

// LOD distance thresholds
const LOD_THRESHOLDS = {
  high: 2.0,    // Use high detail when camera < 2 units
  medium: 3.5,  // Use medium detail when camera < 3.5 units
  // low: > 3.5 units
};

const DRAG_THRESHOLD_PX = 6;

export function Countries({ radius = 1, onCountryClick, onCountryFocus, globeGroupRef }: CountriesProps) {
  const [lodLevel, setLodLevel] = useState<LodLevel>("medium");
  const lodRef = useRef<LodLevel>("medium");
  const { camera, gl, size } = useThree();

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

    if (newLod !== lodRef.current) {
      lodRef.current = newLod;
      setLodLevel(newLod);
    }
  });

  // DOM-level click detection — bypasses R3F/OrbitControls event conflicts
  useEffect(() => {
    const canvas = gl.domElement;
    let startX = 0, startY = 0;
    let camX = 0, camY = 0, camZ = 0;

    const onPointerDown = (e: PointerEvent) => {
      startX = e.clientX;
      startY = e.clientY;
      camX = camera.position.x;
      camY = camera.position.y;
      camZ = camera.position.z;
    };

    const onPointerUp = (e: PointerEvent) => {
      // Check pointer displacement
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const pointerMoved = dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;

      // Check camera displacement (OrbitControls moves camera, not pointer)
      const cdx = camera.position.x - camX;
      const cdy = camera.position.y - camY;
      const cdz = camera.position.z - camZ;
      const cameraMoved = cdx * cdx + cdy * cdy + cdz * cdz > 0.0001;

      if (pointerMoved || cameraMoved) return;

      // Not a drag — do GPU picking
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const result = pick(screenX, screenY);

      if (result.countryIndex !== null && result.countryIndex < countryFeatures.length) {
        const feature = countryFeatures[result.countryIndex];
        const code = feature.properties.ADM0_A3;
        const name = feature.properties.NAME;
        onCountryClick?.(code, name);

        // Compute intersection point for focus animation
        if (onCountryFocus) {
          const ndc = new THREE.Vector2(
            (screenX / size.width) * 2 - 1,
            -(screenY / size.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(ndc, camera);
          const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), radius);
          const hitPoint = new THREE.Vector3();
          if (raycaster.ray.intersectSphere(sphere, hitPoint)) {
            onCountryFocus(hitPoint);
          }
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl, camera, size, radius, pick, onCountryClick, onCountryFocus]);

  return (
    <group>
      <CountryFills radius={radius} lodLevel={lodLevel} />
    </group>
  );
}
