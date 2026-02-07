"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import {
  geoOrthographic,
  geoPath,
  geoGraticule,
  geoContains,
  geoInterpolate,
} from "d3-geo";
import type { GeoProjection } from "d3-geo";
import { countryFeatures, type CountryFeature } from "@/lib/load-countries";
import { IRVINE_COORDS, COUNTRY_CENTERS } from "@/lib/geo-utils";

interface D3GlobeProps {
  onCountrySelect: (name: string | null) => void;
  autoRotate?: boolean;
}

// Colors
const OCEAN_COLOR = "#e0f2fe";
const LAND_COLOR = "#ffffff";
const BORDER_COLOR = "#94a3b8";
const HOVER_COLOR = "#bae6fd";
const SELECTED_COLOR = "#7dd3fc";
const GRATICULE_COLOR = "#cbd5e1";

// Arc animation constants
const ARC_GROW_DURATION = 2500;
const ARC_ARRIVE_DURATION = 500;
const ARC_FADE_DURATION = 1500;
const ARC_SPAWN_INTERVAL = 1500;
const MAX_ACTIVE_ARCS = 5;
const ARC_STEPS = 30;

const COUNTRY_KEYS = Object.keys(COUNTRY_CENTERS);
const IRVINE_LNG_LAT: [number, number] = [IRVINE_COORDS.lng, IRVINE_COORDS.lat];

interface ArcState {
  destCode: string;
  destCoords: [number, number]; // [lng, lat]
  startTime: number;
  phase: "growing" | "arriving" | "fading";
  phaseStartTime: number;
}

export default function D3Globe({
  onCountrySelect,
  autoRotate = true,
}: D3GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const projectionRef = useRef<GeoProjection | null>(null);
  const animFrameRef = useRef<number>(0);
  const rotationRef = useRef<[number, number, number]>([
    -IRVINE_COORDS.lng,
    -IRVINE_COORDS.lat,
    0,
  ]);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const hoveredRef = useRef<CountryFeature | null>(null);
  const selectedRef = useRef<CountryFeature | null>(null);
  const autoRotateRef = useRef(autoRotate);
  const sizeRef = useRef<{ width: number; height: number }>({
    width: 800,
    height: 800,
  });
  const arcsRef = useRef<ArcState[]>([]);
  const lastSpawnRef = useRef(0);
  const [dpr, setDpr] = useState(1);

  autoRotateRef.current = autoRotate;

  const graticule = useMemo(() => geoGraticule().step([15, 15])(), []);

  // Find country under a canvas point
  const findCountry = useCallback(
    (x: number, y: number): CountryFeature | null => {
      const projection = projectionRef.current;
      if (!projection) return null;
      const coords = projection.invert?.([x, y]);
      if (!coords) return null;
      for (const feature of countryFeatures) {
        if (geoContains(feature, coords)) {
          return feature;
        }
      }
      return null;
    },
    []
  );

  // Draw the globe
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const projection = projectionRef.current;
    if (!canvas || !projection) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    const pixelRatio = dpr;

    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, width, height);

    const pathGenerator = geoPath(projection, ctx);

    // 1. Ocean fill (globe sphere)
    ctx.beginPath();
    pathGenerator({ type: "Sphere" });
    ctx.fillStyle = OCEAN_COLOR;
    ctx.fill();

    // 2. Graticule lines
    ctx.beginPath();
    pathGenerator(graticule);
    ctx.strokeStyle = GRATICULE_COLOR;
    ctx.lineWidth = 0.4;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 3. Country fills
    for (const feature of countryFeatures) {
      ctx.beginPath();
      pathGenerator(feature);
      if (feature === selectedRef.current) {
        ctx.fillStyle = SELECTED_COLOR;
      } else if (feature === hoveredRef.current) {
        ctx.fillStyle = HOVER_COLOR;
      } else {
        ctx.fillStyle = LAND_COLOR;
      }
      ctx.fill();
    }

    // 4. Country borders
    ctx.beginPath();
    for (const feature of countryFeatures) {
      pathGenerator(feature);
    }
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // 5. Animated arcs
    const now = performance.now();
    for (const arc of arcsRef.current) {
      let progress: number;
      let opacity: number;

      if (arc.phase === "growing") {
        progress = Math.min(1, (now - arc.phaseStartTime) / ARC_GROW_DURATION);
        opacity = 1;
      } else if (arc.phase === "arriving") {
        progress = 1;
        opacity = 1;
      } else {
        // fading
        progress = 1;
        opacity = 1 - Math.min(1, (now - arc.phaseStartTime) / ARC_FADE_DURATION);
      }

      if (opacity <= 0) continue;

      const interpolator = geoInterpolate(IRVINE_LNG_LAT, arc.destCoords);

      // Build partial LineString from Irvine to current progress
      const coords: [number, number][] = [];
      const steps = Math.max(2, Math.round(ARC_STEPS * progress));
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * progress;
        coords.push(interpolator(t));
      }

      const lineString: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      };

      // Draw arc line with gradient-like fade (thinner at origin, thicker at head)
      ctx.beginPath();
      pathGenerator(lineString);
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.5 * opacity})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw leading dot
      const leadingPoint = interpolator(progress);
      const projected = projection(leadingPoint);
      if (projected) {
        // Check if the point is on the visible side of the globe
        const clipAngle = 90;
        const rotation = projection.rotate();
        const pointLng = leadingPoint[0];
        const pointLat = leadingPoint[1];
        // Simple visibility check: angular distance from center of projection
        const centerLng = -rotation[0];
        const centerLat = -rotation[1];
        const dLng = (pointLng - centerLng) * Math.PI / 180;
        const lat1 = centerLat * Math.PI / 180;
        const lat2 = pointLat * Math.PI / 180;
        const angularDist = Math.acos(
          Math.sin(lat1) * Math.sin(lat2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLng)
        ) * 180 / Math.PI;

        if (angularDist < clipAngle) {
          // Glow halo
          const gradient = ctx.createRadialGradient(
            projected[0], projected[1], 0,
            projected[0], projected[1], 8
          );
          gradient.addColorStop(0, `rgba(56, 189, 248, ${0.4 * opacity})`);
          gradient.addColorStop(1, `rgba(56, 189, 248, 0)`);
          ctx.beginPath();
          ctx.arc(projected[0], projected[1], 8, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          // Solid dot
          ctx.beginPath();
          ctx.arc(projected[0], projected[1], 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${opacity})`;
          ctx.fill();
        }
      }

      // Landing pulse when arriving
      if (arc.phase === "arriving") {
        const arriveProgress = Math.min(1, (now - arc.phaseStartTime) / ARC_ARRIVE_DURATION);
        const destProjected = projection(arc.destCoords);
        if (destProjected) {
          const rotation = projection.rotate();
          const centerLng = -rotation[0];
          const centerLat = -rotation[1];
          const dLng = (arc.destCoords[0] - centerLng) * Math.PI / 180;
          const lat1 = centerLat * Math.PI / 180;
          const lat2 = arc.destCoords[1] * Math.PI / 180;
          const angularDist = Math.acos(
            Math.sin(lat1) * Math.sin(lat2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLng)
          ) * 180 / Math.PI;

          if (angularDist < 90) {
            const ringRadius = 4 + arriveProgress * 12;
            const ringAlpha = 0.6 * (1 - arriveProgress);
            ctx.beginPath();
            ctx.arc(destProjected[0], destProjected[1], ringRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${ringAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }
    }

    // Irvine origin dot (persistent, gently pulsing)
    const irvineProjected = projection(IRVINE_LNG_LAT);
    if (irvineProjected) {
      const rotation = projection.rotate();
      const centerLng = -rotation[0];
      const centerLat = -rotation[1];
      const dLng = (IRVINE_LNG_LAT[0] - centerLng) * Math.PI / 180;
      const lat1 = centerLat * Math.PI / 180;
      const lat2 = IRVINE_LNG_LAT[1] * Math.PI / 180;
      const angularDist = Math.acos(
        Math.sin(lat1) * Math.sin(lat2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLng)
      ) * 180 / Math.PI;

      if (angularDist < 90) {
        const pulse = 0.7 + 0.3 * Math.sin(now / 600);
        // Glow
        const glowGradient = ctx.createRadialGradient(
          irvineProjected[0], irvineProjected[1], 0,
          irvineProjected[0], irvineProjected[1], 10
        );
        glowGradient.addColorStop(0, `rgba(14, 165, 233, ${0.3 * pulse})`);
        glowGradient.addColorStop(1, `rgba(14, 165, 233, 0)`);
        ctx.beginPath();
        ctx.arc(irvineProjected[0], irvineProjected[1], 10, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(irvineProjected[0], irvineProjected[1], 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(14, 165, 233, ${pulse})`;
        ctx.fill();
      }
    }

    // 6. Globe outline
    ctx.beginPath();
    pathGenerator({ type: "Sphere" });
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }, [dpr, graticule]);

  // Animation loop
  const animate = useCallback(() => {
    const projection = projectionRef.current;
    if (!projection) return;

    if (!isDraggingRef.current) {
      const vel = velocityRef.current;
      // Apply momentum decay
      if (Math.abs(vel.vx) > 0.01 || Math.abs(vel.vy) > 0.01) {
        rotationRef.current = [
          rotationRef.current[0] + vel.vx,
          Math.max(-90, Math.min(90, rotationRef.current[1] - vel.vy)),
          0,
        ];
        vel.vx *= 0.95;
        vel.vy *= 0.95;
      } else if (autoRotateRef.current) {
        // Auto-rotate
        rotationRef.current = [
          rotationRef.current[0] + 0.15,
          rotationRef.current[1],
          0,
        ];
        vel.vx = 0;
        vel.vy = 0;
      }
    }

    // Arc lifecycle management
    const now = performance.now();
    const arcs = arcsRef.current;

    // Spawn new arcs
    if (arcs.length < MAX_ACTIVE_ARCS && now - lastSpawnRef.current > ARC_SPAWN_INTERVAL) {
      const code = COUNTRY_KEYS[Math.floor(Math.random() * COUNTRY_KEYS.length)];
      const dest = COUNTRY_CENTERS[code];
      arcs.push({
        destCode: code,
        destCoords: [dest.lng, dest.lat],
        startTime: now,
        phase: "growing",
        phaseStartTime: now,
      });
      lastSpawnRef.current = now;
    }

    // Update arc phases
    for (const arc of arcs) {
      if (arc.phase === "growing" && now - arc.phaseStartTime >= ARC_GROW_DURATION) {
        arc.phase = "arriving";
        arc.phaseStartTime = now;
      } else if (arc.phase === "arriving" && now - arc.phaseStartTime >= ARC_ARRIVE_DURATION) {
        arc.phase = "fading";
        arc.phaseStartTime = now;
      }
    }

    // Remove completed arcs
    arcsRef.current = arcs.filter(
      (arc) => !(arc.phase === "fading" && now - arc.phaseStartTime >= ARC_FADE_DURATION)
    );

    projection.rotate(rotationRef.current);
    draw();
    animFrameRef.current = requestAnimationFrame(animate);
  }, [draw]);

  // Setup projection and resize observer
  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      const pixelRatio = window.devicePixelRatio || 1;

      sizeRef.current = { width: size, height: size };
      canvas.width = size * pixelRatio;
      canvas.height = size * pixelRatio;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      const projection = geoOrthographic()
        .fitSize([size, size], { type: "Sphere" })
        .clipAngle(90)
        .rotate(rotationRef.current);

      projectionRef.current = projection;
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [animate]);

  // Pointer event handlers
  const getCanvasPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = true;
      const pt = getCanvasPoint(e);
      lastPointerRef.current = pt;
      velocityRef.current = { vx: 0, vy: 0 };
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    },
    [getCanvasPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = getCanvasPoint(e);

      if (isDraggingRef.current && lastPointerRef.current) {
        const dx = pt.x - lastPointerRef.current.x;
        const dy = pt.y - lastPointerRef.current.y;

        // Sensitivity scales with globe size
        const scale = 0.4;
        const vx = dx * scale;
        const vy = dy * scale;

        rotationRef.current = [
          rotationRef.current[0] + vx,
          Math.max(-90, Math.min(90, rotationRef.current[1] - vy)),
          0,
        ];
        velocityRef.current = { vx, vy };
        lastPointerRef.current = pt;
      } else {
        // Hover detection
        const country = findCountry(pt.x, pt.y);
        if (country !== hoveredRef.current) {
          hoveredRef.current = country;
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.style.cursor = country ? "pointer" : "grab";
          }
        }
      }
    },
    [getCanvasPoint, findCountry]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = false;
      lastPointerRef.current = null;
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Only register click if not dragging (check velocity)
      const vel = velocityRef.current;
      if (Math.abs(vel.vx) > 1 || Math.abs(vel.vy) > 1) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const country = findCountry(x, y);
      if (country) {
        selectedRef.current = country;
        onCountrySelect(country.properties.NAME);
      } else {
        selectedRef.current = null;
        onCountrySelect(null);
      }
    },
    [findCountry, onCountrySelect]
  );

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="touch-none"
        style={{ cursor: "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      />
    </div>
  );
}
