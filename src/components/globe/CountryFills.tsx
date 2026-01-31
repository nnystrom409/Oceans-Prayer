"use client";

import { useMemo } from "react";
import * as THREE from "three";
import earcut from "earcut";
import countriesGeoJson from "@/data/countries.geo.json";
import { latLngToVector3 } from "@/lib/geo-utils";

interface CountryFillsProps {
  radius?: number;
}

// Triangulate a polygon with holes using earcut
function triangulatePolygon(
  coords: number[][][],
  radius: number
): { positions: number[]; indices: number[] } {
  const positions: number[] = [];
  const flatCoords: number[] = [];
  const holeIndices: number[] = [];

  let vertexIndex = 0;

  // Process each ring (first is exterior, rest are holes)
  coords.forEach((ring, ringIndex) => {
    if (ringIndex > 0) {
      holeIndices.push(vertexIndex);
    }

    // Skip last point if it's the same as first (closed polygon)
    const ringCoords =
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring.slice(0, -1)
        : ring;

    ringCoords.forEach(([lng, lat]) => {
      flatCoords.push(lng, lat);

      const pos = latLngToVector3(lat, lng, radius);
      positions.push(pos.x, pos.y, pos.z);

      vertexIndex++;
    });
  });

  // Triangulate using earcut
  const indices = earcut(flatCoords, holeIndices, 2);

  return { positions, indices };
}

// Frosted glass shader for land masses
const frostedVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frostedFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  uniform vec3 baseColor;
  uniform vec3 frostedColor;
  uniform float opacity;

  void main() {
    // Fresnel for edge highlight
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 2.0);

    // Diffuse lighting for frosted look
    vec3 lightDir = normalize(vec3(5.0, 3.0, 5.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.4 + 0.6;

    // Mix base and frosted colors
    vec3 color = mix(baseColor, frostedColor, fresnel * 0.5 + 0.3);
    color *= diffuse;

    // Slight edge glow
    color += frostedColor * fresnel * 0.3;

    gl_FragColor = vec4(color, opacity);
  }
`;

export function CountryFills({ radius = 1 }: CountryFillsProps) {
  const geometry = useMemo(() => {
    const elevatedRadius = radius * 1.001; // Slightly above base sphere
    const allPositions: number[] = [];
    const allIndices: number[] = [];
    let indexOffset = 0;

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
        try {
          const { positions, indices } = triangulatePolygon(
            polygonCoords,
            elevatedRadius
          );

          if (indices.length > 0) {
            allPositions.push(...positions);
            indices.forEach((idx) => allIndices.push(idx + indexOffset));
            indexOffset += positions.length / 3;
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.warn("Failed to triangulate polygon:", error);
          }
        }
      });
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(allPositions, 3)
    );
    geo.setIndex(allIndices);
    geo.computeVertexNormals();

    return geo;
  }, [radius]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: frostedVertexShader,
        fragmentShader: frostedFragmentShader,
        uniforms: {
          baseColor: { value: new THREE.Color("#4a7c9b") },
          frostedColor: { value: new THREE.Color("#8ec5e2") },
          opacity: { value: 0.65 },
        },
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false,
      }),
    []
  );

  return <mesh geometry={geometry} material={material} />;
}
