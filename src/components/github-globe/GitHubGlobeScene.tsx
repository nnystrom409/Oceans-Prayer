"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { GitHubGlobe } from "./GitHubGlobe";
import { Effects } from "./Effects";

interface GitHubGlobeSceneProps {
  onQualityChange?: (tier: number, fps: number) => void;
  onCountrySelect?: (code: string, name: string) => void;
}

type WebglStatus = "checking" | "supported" | "unsupported";

/**
 * R3F Canvas wrapper for the GitHub-style globe.
 * Handles camera setup and provides a loading fallback.
 */
export function GitHubGlobeScene({ onQualityChange, onCountrySelect }: GitHubGlobeSceneProps) {
  const [webglStatus, setWebglStatus] = useState<WebglStatus>("checking");

  const checkWebgl = useCallback(() => {
    setWebglStatus("checking");
    const isAvailable = (() => {
      if (typeof window === "undefined") return false;
      try {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl") ||
          canvas.getContext("webgl2");
        return !!gl;
      } catch {
        return false;
      }
    })();
    setWebglStatus(isAvailable ? "supported" : "unsupported");
  }, []);

  useEffect(() => {
    checkWebgl();
  }, [checkWebgl]);

  if (webglStatus === "unsupported") {
    return <WebGLFallback onRetry={checkWebgl} />;
  }

  if (webglStatus === "checking") {
    return <WebGLChecking />;
  }

  return (
    <Canvas
      camera={{
        position: [0, 0, 2.5],
        fov: 45,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      dpr={[1, 2]} // Limit pixel ratio for performance
      style={{ background: "transparent" }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <GitHubGlobe onQualityChange={onQualityChange} onCountrySelect={onCountrySelect} />
        <Effects />
      </Suspense>
    </Canvas>
  );
}

function WebGLChecking() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="px-5 py-3 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-lg text-sm text-gray-600">
        Checking WebGL support…
      </div>
    </div>
  );
}

function WebGLFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="w-full h-full flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl bg-white/85 backdrop-blur-md border border-white/70 shadow-xl p-6 text-gray-700">
        <h2 className="text-lg font-medium text-gray-800">WebGL is disabled</h2>
        <p className="mt-2 text-sm text-gray-600">
          Your browser couldn’t create a WebGL context. Enable hardware acceleration to
          view the globe.
        </p>
        <ul className="mt-3 text-sm text-gray-600 list-disc list-inside space-y-1">
          <li>Turn on hardware acceleration in your browser settings</li>
          <li>Restart the browser after changing the setting</li>
          <li>Update GPU drivers or try another browser</li>
        </ul>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-400 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/**
 * Simple loading indicator while assets load.
 */
function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshBasicMaterial color="#1f6feb" wireframe />
    </mesh>
  );
}
