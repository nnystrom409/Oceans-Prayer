"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latLngToPosition } from "@/lib/fibonacci-sphere";

interface ArcData {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color?: string;
}

interface PullRequestArcsProps {
  arcs: ArcData[];
  radius?: number;
  tubeRadius?: number;
  animationSpeed?: number;
}

/**
 * Animated PR arcs using CubicBezierCurve3 and TubeGeometry.
 * Animation via setDrawRange() for progressive reveal.
 */
export function PullRequestArcs({
  arcs,
  radius = 1,
  tubeRadius = 0.003,
  animationSpeed = 0.5,
}: PullRequestArcsProps) {
  return (
    <>
      {arcs.map((arc) => (
        <Arc
          key={arc.id}
          arc={arc}
          radius={radius}
          tubeRadius={tubeRadius}
          animationSpeed={animationSpeed}
        />
      ))}
    </>
  );
}

interface ArcProps {
  arc: ArcData;
  radius: number;
  tubeRadius: number;
  animationSpeed: number;
}

function Arc({ arc, radius, tubeRadius, animationSpeed }: ArcProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);
  const directionRef = useRef(1); // 1 = growing, -1 = shrinking

  // Create the bezier curve and tube geometry
  const { geometry, totalSegments } = useMemo(() => {
    // Get 3D positions
    const start = latLngToPosition(arc.startLat, arc.startLng, radius * 1.005);
    const end = latLngToPosition(arc.endLat, arc.endLng, radius * 1.005);

    const startVec = new THREE.Vector3(start.x, start.y, start.z);
    const endVec = new THREE.Vector3(end.x, end.y, end.z);

    // Calculate arc height based on distance
    const distance = startVec.distanceTo(endVec);
    const arcHeight = Math.max(0.1, distance * 0.5);

    // Create control points for cubic bezier
    const mid = new THREE.Vector3()
      .addVectors(startVec, endVec)
      .multiplyScalar(0.5);

    // Push control points outward from globe center
    const midNorm = mid.clone().normalize();
    const cp1 = startVec
      .clone()
      .lerp(mid, 0.25)
      .normalize()
      .multiplyScalar(radius + arcHeight * 0.7);
    const cp2 = endVec
      .clone()
      .lerp(mid, 0.25)
      .normalize()
      .multiplyScalar(radius + arcHeight * 0.7);

    // Actually, let's use a quadratic approach for simpler arc
    const peakPoint = midNorm.multiplyScalar(radius + arcHeight);

    // Create curve
    const curve = new THREE.QuadraticBezierCurve3(startVec, peakPoint, endVec);

    // Create tube geometry
    const segments = 64;
    const geo = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false);

    return { geometry: geo, totalSegments: segments };
  }, [arc, radius, tubeRadius]);

  // Material
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: arc.color || "#58a6ff",
      transparent: true,
      opacity: 0.8,
    });
  }, [arc.color]);

  // Animate the arc drawing
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const geo = meshRef.current.geometry as THREE.TubeGeometry;
    const indexCount = geo.index?.count || 0;

    // Update progress
    progressRef.current += delta * animationSpeed * directionRef.current;

    // Clamp and reverse direction
    if (progressRef.current >= 1) {
      progressRef.current = 1;
      directionRef.current = -1;
    } else if (progressRef.current <= 0) {
      progressRef.current = 0;
      directionRef.current = 1;
    }

    // Set draw range based on progress
    const count = Math.floor(progressRef.current * indexCount);
    geo.setDrawRange(0, count);
  });

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  );
}

// Default arcs for demo (connecting various cities)
export const DEFAULT_ARCS: ArcData[] = [
  {
    id: "sf-london",
    startLat: 37.7749,
    startLng: -122.4194,
    endLat: 51.5074,
    endLng: -0.1278,
    color: "#58a6ff",
  },
  {
    id: "tokyo-sydney",
    startLat: 35.6762,
    startLng: 139.6503,
    endLat: -33.8688,
    endLng: 151.2093,
    color: "#3fb950",
  },
  {
    id: "berlin-singapore",
    startLat: 52.52,
    startLng: 13.405,
    endLat: 1.3521,
    endLng: 103.8198,
    color: "#f778ba",
  },
  {
    id: "saopaulo-dubai",
    startLat: -23.5505,
    startLng: -46.6333,
    endLat: 25.2048,
    endLng: 55.2708,
    color: "#d29922",
  },
  {
    id: "nyc-paris",
    startLat: 40.7128,
    startLng: -74.006,
    endLat: 48.8566,
    endLng: 2.3522,
    color: "#58a6ff",
  },
];
