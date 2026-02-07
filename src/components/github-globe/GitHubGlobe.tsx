"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { AtmosphereHalo } from "./AtmosphereHalo";
import { PullRequestArcs, DEFAULT_ARCS } from "./PullRequestArcs";
import { useQualityTier } from "./hooks/useQualityTier";
import { GlobeSurface } from "./GlobeSurface";
import { vector3ToLatLng } from "@/lib/geo-utils";
import { getCountryById, getCountryIdAtLatLng, loadCountryIdMap } from "@/lib/country-id-map";

interface GitHubGlobeProps {
  autoRotate?: boolean;
  rotationSpeed?: number;
  showArcs?: boolean;
  onQualityChange?: (tier: number, fps: number) => void;
  onCountrySelect?: (code: string, name: string) => void;
}

/**
 * Main GitHub-style globe component.
 * Orchestrates all sub-components with 4-light setup and auto-rotation.
 */
export function GitHubGlobe({
  autoRotate = true,
  rotationSpeed = 0.03,
  showArcs: showArcsProp = true,
  onQualityChange,
  onCountrySelect,
}: GitHubGlobeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const radius = 1;
  const hasInteractedRef = useRef(false);
  const dragStateRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    pointerId: null as number | null,
  });

  const DRAG_THRESHOLD_PX = 6;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [idMap, setIdMap] = useState<Awaited<ReturnType<typeof loadCountryIdMap>> | null>(null);
  const [idMapError, setIdMapError] = useState<Error | null>(null);

  // Quality tier monitoring
  const { tier, settings, currentFps } = useQualityTier();

  // Auto-rotation
  useFrame((_, delta) => {
    if (groupRef.current && autoRotate && !hasInteractedRef.current) {
      groupRef.current.rotation.y += delta * rotationSpeed;
    }

    // Report quality changes
    if (onQualityChange) {
      onQualityChange(tier, currentFps);
    }
  });

  // Determine if we should show arcs
  const showArcs = showArcsProp && settings.showArcs;

  useEffect(() => {
    let cancelled = false;

    loadCountryIdMap("/globe/country-id.png")
      .then((data) => {
        if (!cancelled) {
          setIdMap(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setIdMapError(error instanceof Error ? error : new Error("Failed to load ID map"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    hasInteractedRef.current = true;
    dragStateRef.current.active = true;
    dragStateRef.current.moved = false;
    dragStateRef.current.startX = event.nativeEvent.clientX;
    dragStateRef.current.startY = event.nativeEvent.clientY;
    dragStateRef.current.pointerId = event.pointerId;
    (event.nativeEvent.target as HTMLCanvasElement).setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!dragStateRef.current.active || dragStateRef.current.moved) return;
    const dx = event.nativeEvent.clientX - dragStateRef.current.startX;
    const dy = event.nativeEvent.clientY - dragStateRef.current.startY;
    if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      dragStateRef.current.moved = true;
    }
  }, []);

  const handlePointerCancel = useCallback((event: ThreeEvent<PointerEvent>) => {
    const pointerId = dragStateRef.current.pointerId;
    if (pointerId !== null) {
      (event.nativeEvent.target as HTMLCanvasElement).releasePointerCapture(pointerId);
    }
    dragStateRef.current.active = false;
    dragStateRef.current.moved = false;
    dragStateRef.current.pointerId = null;
  }, []);

  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const pointerId = dragStateRef.current.pointerId;
      if (pointerId === null) return;
      (event.nativeEvent.target as HTMLCanvasElement).releasePointerCapture(pointerId);

      const wasDrag = dragStateRef.current.moved;
      dragStateRef.current.active = false;
      dragStateRef.current.moved = false;
      dragStateRef.current.pointerId = null;

      if (wasDrag) return;

      const { lat, lng } = vector3ToLatLng(event.point, radius);

      if (idMap && !idMapError) {
        const id = getCountryIdAtLatLng(lat, lng, idMap);
        const country = getCountryById(id);

        if (id && country) {
          setSelectedId(id);
          if (onCountrySelect) {
            onCountrySelect(country.code, country.name);
          }
        } else {
          setSelectedId(null);
          if (onCountrySelect) {
            onCountrySelect("", "");
          }
        }
        return;
      }

      void (async () => {
        const { findCountryAtPoint } = await import("@/lib/country-lookup");
        const result = findCountryAtPoint(lat, lng);
        if (result) {
          setSelectedId(null);
          if (onCountrySelect) {
            onCountrySelect(result.code, result.name);
          }
        }
      })();
    },
    [idMap, idMapError, onCountrySelect, radius]
  );

  const stopAutoRotate = useCallback(() => {
    hasInteractedRef.current = true;
  }, []);

  return (
    <>
      {/* 4-light setup following GitHub's approach */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 3, 5]}
        intensity={0.6}
        color="#ffffff"
      />
      <directionalLight
        position={[-5, -3, -5]}
        intensity={0.4}
        color="#58a6ff"
      />
      <pointLight
        position={[0, 5, 0]}
        intensity={0.3}
        color="#ffffff"
      />
      <pointLight
        position={[0, -5, 0]}
        intensity={0.2}
        color="#1f6feb"
      />

      {/* Globe group with auto-rotation */}
      <group ref={groupRef}>
        {/* Texture-based globe surface */}
        <GlobeSurface radius={radius} selectedId={selectedId} />

        {/* Invisible hit target for pointer events (matches globe size) */}
        <mesh
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          renderOrder={1000}
        >
          <sphereGeometry args={[radius * 1.03, 64, 64]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.FrontSide} depthTest={false} />
        </mesh>

        {/* Animated PR arcs */}
        {showArcs && <PullRequestArcs arcs={DEFAULT_ARCS} radius={radius} />}
      </group>

      {/* Atmosphere halo (outside rotation group for stability) */}
      {settings.showAtmosphere && <AtmosphereHalo radius={radius} />}

      {/* Orbit controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.5}
        maxDistance={4}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        onStart={stopAutoRotate}
        autoRotate={false}
      />
    </>
  );
}
