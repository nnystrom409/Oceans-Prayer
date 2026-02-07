"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { countryFeatures } from "@/lib/load-countries";
import { latLngToVector3 } from "@/lib/geo-utils";

interface CountryOutlinesProps {
  radius?: number;
}

// Custom shader material that fades out back-facing lines
const vertexShader = `
  varying float vFacing;

  void main() {
    // Transform position to world space
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);

    // Normalized position is the surface normal for a sphere centered at origin
    vec3 worldNormal = normalize(worldPosition.xyz);

    // Camera direction (from vertex to camera)
    vec3 cameraDir = normalize(cameraPosition - worldPosition.xyz);

    // Dot product: positive = facing camera, negative = facing away
    vFacing = dot(worldNormal, cameraDir);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFacing;

  void main() {
    // Smooth fade from fully visible to invisible
    // Start fading at 0.15 (near edge), fully gone at -0.1 (back side)
    float alpha = smoothstep(-0.1, 0.15, vFacing) * uOpacity;

    // Discard fully transparent pixels
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

// Spherical linear interpolation (slerp) between two points on a sphere
// Returns intermediate lat/lng points along the great circle arc
function interpolateGreatCircle(
  start: [number, number], // [lng, lat]
  end: [number, number],
  segments: number = 3 // Number of subdivisions
): [number, number][] {
  const result: [number, number][] = [start];

  // Convert to radians
  const lat1 = (start[1] * Math.PI) / 180;
  const lng1 = (start[0] * Math.PI) / 180;
  const lat2 = (end[1] * Math.PI) / 180;
  const lng2 = (end[0] * Math.PI) / 180;

  // Convert to unit vectors
  const x1 = Math.cos(lat1) * Math.cos(lng1);
  const y1 = Math.cos(lat1) * Math.sin(lng1);
  const z1 = Math.sin(lat1);

  const x2 = Math.cos(lat2) * Math.cos(lng2);
  const y2 = Math.cos(lat2) * Math.sin(lng2);
  const z2 = Math.sin(lat2);

  // Angle between vectors (dot product)
  const dot = x1 * x2 + y1 * y2 + z1 * z2;
  const angle = Math.acos(Math.min(1, Math.max(-1, dot)));

  // If points are very close or identical, no interpolation needed
  if (angle < 0.0001) {
    result.push(end);
    return result;
  }

  const sinAngle = Math.sin(angle);

  // Generate intermediate points
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const a = Math.sin((1 - t) * angle) / sinAngle;
    const b = Math.sin(t * angle) / sinAngle;

    const x = a * x1 + b * x2;
    const y = a * y1 + b * y2;
    const z = a * z1 + b * z2;

    // Convert back to lat/lng
    const lat = Math.asin(z) * (180 / Math.PI);
    const lng = Math.atan2(y, x) * (180 / Math.PI);

    result.push([lng, lat]);
  }

  result.push(end);
  return result;
}

// Check if a segment crosses the antimeridian (longitude jump > threshold)
function isAntimeridianCrossing(lng1: number, lng2: number, threshold: number = 90): boolean {
  return Math.abs(lng2 - lng1) > threshold;
}

// Convert a ring of coordinates to line segment pairs with great-circle interpolation
// For a ring [A, B, C, D, A], we create interpolated segments along the great circle
function ringToLineSegments(
  coords: number[][],
  radius: number,
  positions: number[],
  interpolationSegments: number = 3
): void {
  if (coords.length < 2) return;

  for (let i = 0; i < coords.length - 1; i++) {
    const start: [number, number] = [coords[i][0], coords[i][1]];
    const end: [number, number] = [coords[i + 1][0], coords[i + 1][1]];

    // Skip segments that cross the antimeridian (would create long diagonal lines)
    if (isAntimeridianCrossing(start[0], end[0])) continue;

    // Get interpolated points along the great circle
    const interpolated = interpolateGreatCircle(start, end, interpolationSegments);

    // Create line segments between interpolated points
    for (let j = 0; j < interpolated.length - 1; j++) {
      const [lng1, lat1] = interpolated[j];
      const [lng2, lat2] = interpolated[j + 1];

      const p1 = latLngToVector3(lat1, lng1, radius);
      const p2 = latLngToVector3(lat2, lng2, radius);

      positions.push(p1.x, p1.y, p1.z);
      positions.push(p2.x, p2.y, p2.z);
    }
  }

  // Close the ring if not already closed
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    const start: [number, number] = [last[0], last[1]];
    const end: [number, number] = [first[0], first[1]];

    // Skip if closing segment crosses antimeridian
    if (isAntimeridianCrossing(start[0], end[0])) return;

    const interpolated = interpolateGreatCircle(start, end, interpolationSegments);

    for (let j = 0; j < interpolated.length - 1; j++) {
      const [lng1, lat1] = interpolated[j];
      const [lng2, lat2] = interpolated[j + 1];

      const p1 = latLngToVector3(lat1, lng1, radius);
      const p2 = latLngToVector3(lat2, lng2, radius);

      positions.push(p1.x, p1.y, p1.z);
      positions.push(p2.x, p2.y, p2.z);
    }
  }
}

export function CountryOutlines({ radius = 1 }: CountryOutlinesProps) {
  // Build a single batched LineSegments geometry from all country outlines
  const lineSegments = useMemo(() => {
    const allPositions: number[] = [];
    const elevatedRadius = radius * 1.004; // Raised a bit more for clarity over landmass

    countryFeatures.forEach((feature) => {
      const geom = feature.geometry;

      if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return;

      const polygons: number[][][][] =
        geom.type === "Polygon"
          ? [geom.coordinates as number[][][]]
          : (geom.coordinates as number[][][][]);

      polygons.forEach((polygonCoords) => {
        // Only process the exterior ring (index 0), skip interior rings (holes = lakes)
        const exteriorRing = polygonCoords[0];
        if (exteriorRing) {
          ringToLineSegments(exteriorRing, elevatedRadius, allPositions);
        }
      });
    });

    // Create single geometry with all line segments
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(allPositions, 3)
    );

    // Create material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color("#6ea3d1") },
        uOpacity: { value: 0.7 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    return new THREE.LineSegments(geometry, material);
  }, [radius]);

  return <primitive object={lineSegments} />;
}
