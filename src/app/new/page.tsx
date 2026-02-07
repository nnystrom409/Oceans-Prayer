"use client";

import { useState, useCallback, useEffect, useRef, useMemo, MutableRefObject } from "react";
import dynamic from "next/dynamic";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";

// Dynamic import to avoid SSR issues with react-globe.gl
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface CountryFeature {
  properties: {
    ADMIN?: string;
    name?: string;
  };
}

export default function NewGlobePage() {
  const [countries, setCountries] = useState<{ features: CountryFeature[] }>({
    features: [],
  });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoverCountry, setHoverCountry] = useState<string | null>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined) as MutableRefObject<GlobeMethods | undefined>;

  // Custom globe material - ocean blue
  const globeMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color("#60a5fa"), // blue-400
      transparent: true,
      opacity: 0.85,
      shininess: 20,
    });
  }, []);

  // Load country data and remove polygon holes (lakes)
  useEffect(() => {
    fetch(
      "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
    )
      .then((res) => res.json())
      .then((data) => {
        // Strip holes from polygons - keep only outer ring
        const featuresWithoutHoles = data.features.map((feature: { geometry: { type: string; coordinates: number[][][] | number[][][][] }; properties: object }) => {
          const geom = feature.geometry;
          if (geom.type === "Polygon") {
            // Polygon: coordinates[0] is outer ring, rest are holes
            return {
              ...feature,
              geometry: {
                ...geom,
                coordinates: [geom.coordinates[0]], // Keep only outer ring
              },
            };
          } else if (geom.type === "MultiPolygon") {
            // MultiPolygon: each polygon's [0] is outer ring
            return {
              ...feature,
              geometry: {
                ...geom,
                coordinates: (geom.coordinates as number[][][][]).map((polygon) => [polygon[0]]),
              },
            };
          }
          return feature;
        });
        setCountries({ features: featuresWithoutHoles });
      });
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;

      const stopAutoRotate = () => {
        controls.autoRotate = false;
        controls.update();
      };

      controls.addEventListener("start", stopAutoRotate);
      return () => {
        controls.removeEventListener("start", stopAutoRotate);
      };
    }
  }, []);

  const handlePolygonClick = useCallback((polygon: object | null) => {
    const feature = polygon as CountryFeature | null;
    const countryName = feature?.properties?.ADMIN || feature?.properties?.name || null;
    setSelectedCountry(countryName);
  }, []);

  const handlePolygonHover = useCallback((polygon: object | null) => {
    const feature = polygon as CountryFeature | null;
    const countryName = feature?.properties?.ADMIN || feature?.properties?.name || null;
    setHoverCountry(countryName);
  }, []);

  const getPolygonCapColor = useCallback(
    (polygon: object) => {
      const feature = polygon as CountryFeature;
      const name = feature?.properties?.ADMIN || feature?.properties?.name;
      if (name === selectedCountry) return "rgba(186, 230, 253, 0.95)"; // sky-200
      if (name === hoverCountry) return "rgba(224, 242, 254, 0.9)"; // sky-100
      return "rgba(241, 245, 249, 0.8)"; // slate-100 - light pastel
    },
    [selectedCountry, hoverCountry]
  );

  const getPolygonSideColor = useCallback(() => {
    return "rgba(241, 245, 249, 0.5)";
  }, []);

  const getPolygonStrokeColor = useCallback(() => {
    return "rgba(96, 165, 250, 0.4)"; // blue-400 - soft outline
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Background gradient - light theme matching mockup */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-50" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-300 to-cyan-400 opacity-80" />
          <h1 className="text-2xl font-light text-gray-700 tracking-wide">
            oceans <span className="text-sky-500">/ new</span>
          </h1>
        </div>
      </header>

      {/* Globe container */}
      <div className="absolute inset-0">
        <Globe
          ref={globeRef}
          globeMaterial={globeMaterial}
          backgroundColor="rgba(0,0,0,0)"
          polygonsData={countries.features}
          polygonCapColor={getPolygonCapColor}
          polygonSideColor={getPolygonSideColor}
          polygonStrokeColor={getPolygonStrokeColor}
          polygonAltitude={(d) => {
            const feature = d as CountryFeature;
            const name = feature?.properties?.ADMIN || feature?.properties?.name;
            return name === selectedCountry ? 0.01 : name === hoverCountry ? 0.005 : 0;
          }}
          onPolygonClick={handlePolygonClick}
          onPolygonHover={handlePolygonHover}
          polygonsTransitionDuration={300}
          atmosphereColor="rgb(125, 211, 252)"
          atmosphereAltitude={0.2}
        />
      </div>

      {/* Selected country display */}
      {selectedCountry && (
        <div className="absolute top-6 right-6 z-10">
          <div className="px-4 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-white/50 shadow-lg animate-in fade-in slide-in-from-right-2 duration-300">
            <span className="text-sky-600 font-medium">{selectedCountry}</span>
          </div>
        </div>
      )}

      {/* Hover country display */}
      {hoverCountry && hoverCountry !== selectedCountry && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
          <div className="px-3 py-1.5 rounded-lg bg-white/70 backdrop-blur-sm border border-white/50 shadow">
            <span className="text-gray-700 text-sm">{hoverCountry}</span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-6 right-6 text-sm text-gray-500">
        <p>Click on a country to select it</p>
        <p className="text-xs mt-1">Drag to rotate • Scroll to zoom</p>
      </div>

      {/* Back link */}
      <a
        href="/"
        className="absolute bottom-6 left-6 text-sm text-sky-600 hover:text-sky-500 transition-colors"
      >
        ← Back to custom globe
      </a>
    </main>
  );
}
