"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with Three.js
const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((mod) => mod.GlobeScene),
  { ssr: false }
);

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const handleCountrySelect = useCallback((countryName: string | null) => {
    setSelectedCountry(countryName);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-50" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-300 to-cyan-400 opacity-80" />
          <h1 className="text-2xl font-light text-gray-700 tracking-wide">
            oceans
          </h1>
        </div>
      </header>

      {/* Globe container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full max-w-[1200px] max-h-[900px]">
          <GlobeScene onCountrySelect={handleCountrySelect} />
        </div>
      </div>

      {/* Selected country display */}
      {selectedCountry && (
        <div className="absolute top-6 right-6 z-10">
          <div className="px-4 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-white/50 shadow-lg animate-in fade-in slide-in-from-right-2 duration-300">
            <span className="text-ocean-600 font-medium">{selectedCountry}</span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-6 right-6 text-sm text-gray-500">
        <p>Click on a country to select it</p>
        <p className="text-xs mt-1">Drag to rotate • Scroll to zoom</p>
      </div>
    </main>
  );
}
