"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

// Dynamic import to avoid SSR issues with Three.js
const GitHubGlobeScene = dynamic(
  () =>
    import("@/components/github-globe/GitHubGlobeScene").then(
      (mod) => mod.GitHubGlobeScene
    ),
  { ssr: false }
);

export default function NewPage2() {
  const [qualityInfo, setQualityInfo] = useState({ tier: 0, fps: 60 });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const handleQualityChange = useCallback((tier: number, fps: number) => {
    setQualityInfo({ tier, fps });
  }, []);

  const handleCountrySelect = useCallback((code: string, name: string) => {
    setSelectedCountry(name || code || null);
  }, []);

  const tierLabels = ["Full", "Reduced", "Low", "Minimal"];

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Light gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f0f4f8] via-[#e8eef5] to-[#f0f4f8]" />

      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,213,247,0.3)_0%,_transparent_70%)]" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a8d5f7] to-[#7ca8d0] opacity-90" />
            <h1 className="text-2xl font-light text-gray-700 tracking-wide">
              GitHub Globe
            </h1>
          </div>

          {/* Quality indicator */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>
              Quality: <span className="text-gray-700">{tierLabels[qualityInfo.tier]}</span>
            </span>
            <span>
              FPS: <span className="text-gray-700">{qualityInfo.fps}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Globe container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full max-w-[1200px] max-h-[900px]">
          <GitHubGlobeScene
            onQualityChange={handleQualityChange}
            onCountrySelect={handleCountrySelect}
          />
        </div>
      </div>

      {/* Selected country pill */} 
      {selectedCountry && (
        <div className="absolute top-6 right-6 z-10">
          <div className="px-4 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-white/50 shadow-lg animate-in fade-in slide-in-from-right-2 duration-300">
            <span className="text-sky-600 font-medium">{selectedCountry}</span>
          </div>
        </div>
      )}

      {/* Navigation links */}
      <nav className="absolute bottom-6 left-6 z-10 flex gap-4">
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-black/5 backdrop-blur-sm border border-black/10 text-gray-600 hover:bg-black/10 hover:text-gray-800 transition-colors"
        >
          Original Globe
        </Link>
        <Link
          href="/new"
          className="px-4 py-2 rounded-lg bg-black/5 backdrop-blur-sm border border-black/10 text-gray-600 hover:bg-black/10 hover:text-gray-800 transition-colors"
        >
          New Globe
        </Link>
      </nav>

      {/* Instructions */}
      <div className="absolute bottom-6 right-6 z-10 text-sm text-gray-500">
        <p>Drag to rotate</p>
        <p className="text-xs mt-1">Scroll to zoom</p>
      </div>
    </main>
  );
}
