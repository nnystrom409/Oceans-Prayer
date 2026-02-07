"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const CobeGlobe = dynamic(
  () => import("@/components/cobe-globe/CobeGlobe").then((mod) => mod.CobeGlobe),
  { ssr: false }
);

export default function CobePage() {
  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Dark ocean background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#030d18] via-[#0b1e36] to-[#0a2a40]" />

      {/* Radial glow behind globe */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(30,80,130,0.3)_0%,_transparent_60%)]" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 opacity-80" />
          <h1 className="text-2xl font-light text-gray-300 tracking-wide">
            ocean&apos;s prayer{" "}
            <span className="text-cyan-400">/ cobe</span>
          </h1>
        </div>
      </header>

      {/* Globe container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <CobeGlobe />
      </div>

      {/* Navigation links */}
      <nav className="absolute bottom-6 left-6 z-10 flex gap-3">
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
        >
          Original Globe
        </Link>
        <Link
          href="/new"
          className="px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
        >
          React Globe
        </Link>
        <Link
          href="/new-2"
          className="px-4 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
        >
          GitHub Globe
        </Link>
      </nav>

      {/* Instructions */}
      <div className="absolute bottom-6 right-6 z-10 text-sm text-gray-500">
        <p>Drag to rotate</p>
        <p className="text-xs mt-1">Auto-rotates when idle</p>
      </div>
    </main>
  );
}
