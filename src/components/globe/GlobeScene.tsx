"use client";

import { Suspense, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Preload } from "@react-three/drei";
import { Globe } from "./Globe";

interface GlobeSceneProps {
  onCountrySelect?: (countryName: string | null) => void;
}

export function GlobeScene({ onCountrySelect }: GlobeSceneProps) {
  const handleCountryClick = useCallback(
    (countryCode: string, countryName: string) => {
      onCountrySelect?.(countryName);
    },
    [onCountrySelect]
  );

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Globe onCountryClick={handleCountryClick} />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}
