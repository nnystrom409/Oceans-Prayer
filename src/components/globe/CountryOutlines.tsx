"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import countriesGeoJson from "@/data/countries.geo.json";

interface CountryOutlinesProps {
  radius?: number;
}

// Convert lat/lng to 3D position on sphere
function latLngTo3D(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return [x, y, z];
}

// Convert a line of coordinates to 3D points
function coordinatesToPoints(
  coords: number[][],
  radius: number
): [number, number, number][] {
  return coords.map(([lng, lat]) => latLngTo3D(lat, lng, radius));
}

export function CountryOutlines({ radius = 1 }: CountryOutlinesProps) {
  // Process GeoJSON into line segments
  const lines = useMemo(() => {
    const allLines: [number, number, number][][] = [];

    countriesGeoJson.features.forEach((feature) => {
      const geometry = feature.geometry as { type: string; coordinates: number[][][] | number[][] };

      if (geometry.type === "MultiLineString") {
        (geometry.coordinates as number[][][]).forEach((lineCoords) => {
          const points = coordinatesToPoints(lineCoords, radius * 1.002);
          if (points.length > 1) {
            allLines.push(points);
          }
        });
      } else if (geometry.type === "LineString") {
        const points = coordinatesToPoints(
          geometry.coordinates as number[][],
          radius * 1.002
        );
        if (points.length > 1) {
          allLines.push(points);
        }
      }
    });

    return allLines;
  }, [radius]);

  return (
    <group>
      {lines.map((points, index) => (
        <Line
          key={index}
          points={points}
          color="#1a6090"
          lineWidth={1.8}
          transparent
          opacity={0.85}
        />
      ))}
    </group>
  );
}
