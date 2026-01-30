"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { Preload } from "@react-three/drei";
import { Globe } from "./Globe";
import { CountryPopup } from "./CountryPopup";
import { Connection, COUNTRY_CENTERS } from "@/lib/geo-utils";

interface GlobeSceneProps {
  initialConnections?: Connection[];
}

export function GlobeScene({ initialConnections = [] }: GlobeSceneProps) {
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [selectedCountry, setSelectedCountry] = useState<{
    code: string;
    name: string;
    position: { x: number; y: number };
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleCountryClick = useCallback(
    (countryCode: string, countryName: string) => {
      // Get mouse position from the last click event
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Use the center of the canvas as a fallback
      const mouseX = rect.left + rect.width / 2;
      const mouseY = rect.top + rect.height / 2;

      setSelectedCountry({
        code: countryCode,
        name: countryName,
        position: { x: mouseX, y: mouseY },
      });

      // Add to connections if not already connected
      if (!connections.find((c) => c.countryCode === countryCode)) {
        setConnections((prev) => [
          ...prev,
          { id: `${countryCode}-${Date.now()}`, countryCode },
        ]);
      }
    },
    [connections]
  );

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Store mouse position for popup placement
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      // We'll use this position when a country is clicked
      (window as unknown as { __lastClickPos: { x: number; y: number } }).__lastClickPos = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  }, []);

  const handleCountryClickWithPosition = useCallback(
    (countryCode: string, countryName: string) => {
      const lastClickPos = (window as unknown as { __lastClickPos?: { x: number; y: number } }).__lastClickPos;
      const position = lastClickPos || { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      setSelectedCountry({
        code: countryCode,
        name: countryName,
        position,
      });

      // Add to connections if not already connected
      if (!connections.find((c) => c.countryCode === countryCode)) {
        setConnections((prev) => [
          ...prev,
          { id: `${countryCode}-${Date.now()}`, countryCode },
        ]);
      }
    },
    [connections]
  );

  const handleClosePopup = useCallback(() => {
    setSelectedCountry(null);
  }, []);

  return (
    <div
      ref={canvasRef}
      className="w-full h-full relative"
      onMouseDown={handleCanvasClick}
    >
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
          <Globe
            connections={connections}
            onCountryClick={handleCountryClickWithPosition}
          />
          <Preload all />
        </Suspense>
      </Canvas>

      {/* Country popup overlay */}
      {selectedCountry && (
        <CountryPopup
          countryName={selectedCountry.name}
          position={selectedCountry.position}
          onClose={handleClosePopup}
        />
      )}

      {/* Connection counter */}
      {connections.length > 0 && (
        <div className="absolute bottom-6 left-6 px-4 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-white/50 shadow-lg">
          <span className="text-gray-600 text-sm">Prayers sent: </span>
          <span className="text-ocean-600 font-semibold">{connections.length}</span>
        </div>
      )}
    </div>
  );
}
