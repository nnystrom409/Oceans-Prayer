"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { GlobeSphere } from "./GlobeSphere";
import { Atmosphere } from "./Atmosphere";
import { CountryOutlines } from "./CountryOutlines";
import { Countries } from "./Countries";
import { Arcs } from "./Arcs";
import { Connection } from "@/lib/geo-utils";

interface GlobeProps {
  connections: Connection[];
  onCountryClick?: (countryCode: string, countryName: string) => void;
}

export function Globe({ connections, onCountryClick }: GlobeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const radius = 1;

  // Gentle auto-rotation when not interacting
  useFrame((state, delta) => {
    if (groupRef.current) {
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
      <group ref={groupRef}>
        {/* Main sphere */}
        <GlobeSphere radius={radius} />

        {/* Atmosphere glow */}
        <Atmosphere radius={radius} />

        {/* Country border outlines */}
        <CountryOutlines radius={radius} />

        {/* Click detection */}
        <Countries radius={radius} onCountryClick={onCountryClick} />

        {/* Prayer connection arcs */}
        <Arcs connections={connections} radius={radius} />
      </group>

      {/* Orbit controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.5}
        maxDistance={4}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        // Disable auto-rotate from controls (we do it manually)
        autoRotate={false}
      />
    </>
  );
}
