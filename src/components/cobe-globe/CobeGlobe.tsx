"use client";

import { useEffect, useRef, useCallback } from "react";
import createGlobe from "cobe";
import { markers } from "./markers";

interface CobeGlobeProps {
  autoRotate?: boolean;
  rotationSpeed?: number;
  showMarkers?: boolean;
  theta?: number;
  onReady?: () => void;
}

// Ocean color palette (RGB 0-1)
const OCEAN_BASE: [number, number, number] = [0.04, 0.12, 0.24]; // ocean-900ish
const OCEAN_MARKER: [number, number, number] = [0.4, 0.78, 0.9]; // ocean-300ish
const OCEAN_GLOW: [number, number, number] = [0.06, 0.2, 0.36]; // ocean-700ish

export function CobeGlobe({
  autoRotate = true,
  rotationSpeed = 0.003,
  showMarkers = true,
  theta = 0.15,
  onReady,
}: CobeGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phiRef = useRef(0);
  const velocityRef = useRef(0);
  const widthRef = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
  }, []);

  const onPointerUp = useCallback(() => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  }, []);

  const onPointerOut = useCallback(() => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerInteracting.current !== null) {
      const delta = e.clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      velocityRef.current = delta / 200;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number | undefined;

    const onResize = () => {
      if (canvas) widthRef.current = canvas.offsetWidth;
    };
    window.addEventListener("resize", onResize);
    onResize();

    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      phi: 0,
      theta,
      dark: 1,
      diffuse: 2.5,
      mapSamples: 20000,
      mapBrightness: 4,
      baseColor: OCEAN_BASE,
      markerColor: OCEAN_MARKER,
      glowColor: OCEAN_GLOW,
      markers: showMarkers
        ? markers.map((m) => ({ location: m.location, size: m.size }))
        : [],
      onRender: (state) => {
        // Auto-rotate when not dragging
        if (pointerInteracting.current === null && autoRotate) {
          phiRef.current += rotationSpeed;
        }

        // Apply velocity from drag with exponential decay
        phiRef.current += velocityRef.current;
        velocityRef.current *= 0.93;

        // Clamp tiny velocities to zero
        if (Math.abs(velocityRef.current) < 0.0001) {
          velocityRef.current = 0;
        }

        state.phi = phiRef.current;
        state.width = widthRef.current * 2;
        state.height = widthRef.current * 2;
      },
    });

    // Fade in after init
    requestAnimationFrame(() => {
      if (canvas) canvas.style.opacity = "1";
      onReady?.();
    });

    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [autoRotate, rotationSpeed, showMarkers, theta, onReady]);

  return (
    <div className="relative w-full aspect-square max-w-[680px] mx-auto">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOut={onPointerOut}
        onPointerMove={onPointerMove}
        style={{
          width: "100%",
          height: "100%",
          contain: "layout paint size",
          opacity: 0,
          transition: "opacity 1s ease",
          cursor: "grab",
        }}
      />
    </div>
  );
}
