"use client";

import { useMemo } from "react";
import * as THREE from "three";
import countriesGeoJson from "@/data/countries.geo.json";
import { latLngToVector3 } from "@/lib/geo-utils";

interface CountryOutlinesProps {
  radius?: number;
}

function ringToPoints(
  coords: number[][],
  radius: number
): [number, number, number][] {
  return coords.map(([lng, lat]) => {
    const pos = latLngToVector3(lat, lng, radius);
    return [pos.x, pos.y, pos.z];
  });
}

// Extract all rings from a polygon (exterior + any holes)
function extractPolygonRings(
  polygonCoords: number[][][],
  radius: number
): [number, number, number][][] {
  const rings: [number, number, number][][] = [];

  // Each polygon has an exterior ring (index 0) and optional interior rings (holes)
  // We render all rings as outlines
  for (const ring of polygonCoords) {
    const points = ringToPoints(ring, radius);
    if (points.length > 1) {
      rings.push(points);
    }
  }

  return rings;
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

// Single line component with custom shader
function OutlineLine({ points }: { points: [number, number, number][] }) {
  const lineObject = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.flat());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color("#1a6090") },
        uOpacity: { value: 0.85 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    return new THREE.Line(geometry, material);
  }, [points]);

  return <primitive object={lineObject} />;
}

export function CountryOutlines({ radius = 1 }: CountryOutlinesProps) {
  // Process GeoJSON into line segments
  const lines = useMemo(() => {
    const allLines: [number, number, number][][] = [];
    const elevatedRadius = radius * 1.002; // Slightly above globe surface

    countriesGeoJson.features.forEach((feature) => {
      const geom = feature.geometry as {
        type: string;
        coordinates: number[][][] | number[][][][];
      };

      // Only process Polygon and MultiPolygon geometries
      if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return;

      const polygons: number[][][][] =
        geom.type === "Polygon"
          ? [geom.coordinates as number[][][]]
          : (geom.coordinates as number[][][][]);

      polygons.forEach((polygonCoords) => {
        const rings = extractPolygonRings(polygonCoords, elevatedRadius);
        allLines.push(...rings);
      });
    });

    return allLines;
  }, [radius]);

  return (
    <group>
      {lines.map((points, index) => (
        <OutlineLine key={index} points={points} />
      ))}
    </group>
  );
}
