"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const D3Globe = dynamic(
  () => import("@/components/d3-globe/D3Globe"),
  { ssr: false }
);

export default function D3Page() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const handleCountrySelect = useCallback((name: string | null) => {
    setSelectedCountry(name);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Light gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-50" />

      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,213,247,0.3)_0%,_transparent_70%)]" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-300 to-sky-500 opacity-90" />
          <h1 className="text-2xl font-light text-gray-700 tracking-wide">
            ocean&apos;s prayer{" "}
            <span className="text-sky-500">/ d3</span>
          </h1>
        </div>
      </header>

      {/* Globe container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full max-w-[900px] max-h-[900px]">
          <D3Globe onCountrySelect={handleCountrySelect} />
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
      <nav className="absolute bottom-6 left-6 z-10 flex gap-3">
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
        <Link
          href="/new-2"
          className="px-4 py-2 rounded-lg bg-black/5 backdrop-blur-sm border border-black/10 text-gray-600 hover:bg-black/10 hover:text-gray-800 transition-colors"
        >
          GitHub Globe
        </Link>
      </nav>

      {/* Instructions */}
      <div className="absolute bottom-6 right-6 z-10 text-sm text-gray-500 text-right">
        <p>Click a country to select</p>
        <p className="text-xs mt-1">Drag to rotate</p>
      </div>
    </main>
  );
}
