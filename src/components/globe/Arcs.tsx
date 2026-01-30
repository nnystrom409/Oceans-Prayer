"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import {
  IRVINE_COORDS,
  COUNTRY_CENTERS,
  latLngToVector3,
  Connection,
} from "@/lib/geo-utils";

interface ArcsProps {
  connections: Connection[];
  radius?: number;
}

interface ArcData {
  curve: THREE.QuadraticBezierCurve3;
  countryCode: string;
}

export function Arcs({ connections, radius = 1 }: ArcsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef<number[]>([]);

  // Initialize progress array
  if (progressRef.current.length !== connections.length) {
    progressRef.current = connections.map((_, i) => Math.random() * 0.5);
  }

  // Create arc curves for each connection
  const arcs: ArcData[] = useMemo(() => {
    const origin = latLngToVector3(IRVINE_COORDS.lat, IRVINE_COORDS.lng, radius);

    return connections.map((connection) => {
      const country = COUNTRY_CENTERS[connection.countryCode];
      if (!country) {
        return null;
      }

      const destination = latLngToVector3(country.lat, country.lng, radius);

      // Calculate arc height based on distance
      const distance = origin.distanceTo(destination);
      const arcHeight = Math.min(distance * 0.5, radius * 0.8);

      // Create control point for the arc
      const midPoint = new THREE.Vector3()
        .addVectors(origin, destination)
        .multiplyScalar(0.5);
      const controlPoint = midPoint
        .clone()
        .normalize()
        .multiplyScalar(radius + arcHeight);

      const curve = new THREE.QuadraticBezierCurve3(
        origin,
        controlPoint,
        destination
      );

      return { curve, countryCode: connection.countryCode };
    }).filter((arc): arc is ArcData => arc !== null);
  }, [connections, radius]);

  // Animate the arcs
  useFrame((state) => {
    progressRef.current = progressRef.current.map((p) => {
      const newP = p + 0.003;
      return newP > 1.5 ? 0 : newP;
    });
  });

  return (
    <group ref={groupRef}>
      {arcs.map((arc, index) => (
        <Arc
          key={`${arc.countryCode}-${index}`}
          curve={arc.curve}
          progressOffset={index * 0.1}
        />
      ))}
    </group>
  );
}

interface ArcProps {
  curve: THREE.QuadraticBezierCurve3;
  progressOffset: number;
}

function Arc({ curve, progressOffset }: ArcProps) {
  const particleRef = useRef<THREE.Mesh>(null);

  // Get points along the curve for the Line component
  const points = useMemo(() => {
    return curve.getPoints(64).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [curve]);

  // Animate particle along the arc
  useFrame((state) => {
    if (particleRef.current) {
      const time = (state.clock.elapsedTime * 0.3 + progressOffset) % 1;
      const point = curve.getPoint(time);
      particleRef.current.position.copy(point);

      // Pulse the particle size
      const scale = 0.015 + Math.sin(state.clock.elapsedTime * 5) * 0.005;
      particleRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      {/* Arc line using Drei's Line component */}
      <Line
        points={points}
        color="#50c8ff"
        lineWidth={3}
        transparent
        opacity={0.85}
      />

      {/* Animated particle */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#70d8ff"
          transparent
          opacity={1}
        />
      </mesh>
    </group>
  );
}
