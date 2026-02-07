"use client";

import { useMemo, useEffect } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GluTesselator, windingRule, primitiveType, gluEnum } from "libtess";
import { countryFeatures } from "@/lib/load-countries";
import { latLngToVector3 } from "@/lib/geo-utils";

// LOD configuration
export type LodLevel = "high" | "medium" | "low";

interface LodConfig {
  maxEdgeLength: number;
  maxDepth: number;
}

const LOD_CONFIGS: Record<LodLevel, LodConfig> = {
  high: { maxEdgeLength: 0.08, maxDepth: 5 },   // Finer for close-up detail
  medium: { maxEdgeLength: 0.15, maxDepth: 4 }, // Balanced for typical view
  low: { maxEdgeLength: 0.3, maxDepth: 2 },     // Coarse for distant view
};

interface CountryFillsProps {
  radius?: number;
  lodLevel?: LodLevel;
  onGeometryReady?: (geometry: THREE.BufferGeometry) => void;
  /** Base opacity for non-highlighted land (0 to hide seams) */
  baseOpacity?: number;
  /** 1-based country id from geometry (featureIndex + 1) */
  hoveredId?: number | null;
  selectedId?: number | null;
  highlightColors?: {
    base?: string; // unchanged land base
    hover?: string;
    selected?: string;
  };
}

// Check if a polygon crosses the antimeridian (has large longitude jumps)
function crossesAntimeridian(coords: number[][], threshold: number = 90): boolean {
  for (let i = 0; i < coords.length - 1; i++) {
    if (Math.abs(coords[i + 1][0] - coords[i][0]) > threshold) {
      return true;
    }
  }
  return false;
}

// Triangulate a polygon using libtess (more robust than earcut for complex polygons)
function triangulatePolygon(
  coords: number[][][],
  radius: number
): { positions: number[]; indices: number[] } {
  const positions: number[] = [];
  const vertexMap = new Map<string, number>(); // Map coordinate key to vertex index
  const indices: number[] = [];

  // Only process the exterior ring (first ring), ignore holes (lakes)
  const exteriorRing = coords[0];

  // Skip last point if it's the same as first (closed polygon)
  const ringCoords =
    exteriorRing[0][0] === exteriorRing[exteriorRing.length - 1][0] &&
    exteriorRing[0][1] === exteriorRing[exteriorRing.length - 1][1]
      ? exteriorRing.slice(0, -1)
      : exteriorRing;

  // Create libtess tessellator
  const tesselator = new GluTesselator();

  // Collect vertices from tessellation
  const tessVertices: number[][] = [];
  let currentPrimitive: number[] = [];
  let currentPrimitiveType: number = 0;

  // Callback: receive vertex data
  tesselator.gluTessCallback(gluEnum.GLU_TESS_VERTEX_DATA, ((data: number[], polyVertArray: number[][]) => {
    polyVertArray.push(data);
  }) as (...args: unknown[]) => unknown);

  // Callback: begin primitive
  tesselator.gluTessCallback(gluEnum.GLU_TESS_BEGIN, ((type: number) => {
    currentPrimitiveType = type;
    currentPrimitive = [];
  }) as (...args: unknown[]) => unknown);

  // Callback: end primitive - convert to triangles
  tesselator.gluTessCallback(gluEnum.GLU_TESS_END, (() => {
    // Convert primitive to triangle indices
    if (currentPrimitiveType === primitiveType.GL_TRIANGLES) {
      for (let i = 0; i < tessVertices.length; i += 3) {
        if (i + 2 < tessVertices.length) {
          const v0 = tessVertices[i];
          const v1 = tessVertices[i + 1];
          const v2 = tessVertices[i + 2];

          const i0 = getOrCreateVertex(v0[0], v0[1]);
          const i1 = getOrCreateVertex(v1[0], v1[1]);
          const i2 = getOrCreateVertex(v2[0], v2[1]);

          indices.push(i0, i1, i2);
        }
      }
    } else if (currentPrimitiveType === primitiveType.GL_TRIANGLE_FAN) {
      if (tessVertices.length >= 3) {
        const center = tessVertices[0];
        const centerIdx = getOrCreateVertex(center[0], center[1]);

        for (let i = 1; i < tessVertices.length - 1; i++) {
          const v1 = tessVertices[i];
          const v2 = tessVertices[i + 1];

          const i1 = getOrCreateVertex(v1[0], v1[1]);
          const i2 = getOrCreateVertex(v2[0], v2[1]);

          indices.push(centerIdx, i1, i2);
        }
      }
    } else if (currentPrimitiveType === primitiveType.GL_TRIANGLE_STRIP) {
      for (let i = 0; i < tessVertices.length - 2; i++) {
        const v0 = tessVertices[i];
        const v1 = tessVertices[i + 1];
        const v2 = tessVertices[i + 2];

        const i0 = getOrCreateVertex(v0[0], v0[1]);
        const i1 = getOrCreateVertex(v1[0], v1[1]);
        const i2 = getOrCreateVertex(v2[0], v2[1]);

        // Alternate winding for strips
        if (i % 2 === 0) {
          indices.push(i0, i1, i2);
        } else {
          indices.push(i0, i2, i1);
        }
      }
    }
    tessVertices.length = 0;
  }) as (...args: unknown[]) => unknown);

  // Callback: combine vertices (for self-intersecting polygons)
  tesselator.gluTessCallback(gluEnum.GLU_TESS_COMBINE, ((coords: number[]) => {
    return [coords[0], coords[1], coords[2]];
  }) as (...args: unknown[]) => unknown);

  // Callback: error handling
  tesselator.gluTessCallback(gluEnum.GLU_TESS_ERROR, ((errno: number) => {
    console.warn('Tessellation error:', errno);
  }) as (...args: unknown[]) => unknown);

  // Helper to get or create vertex index
  function getOrCreateVertex(lng: number, lat: number): number {
    const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
    let idx = vertexMap.get(key);
    if (idx === undefined) {
      idx = positions.length / 3;
      const pos = latLngToVector3(lat, lng, radius);
      positions.push(pos.x, pos.y, pos.z);
      vertexMap.set(key, idx);
    }
    return idx;
  }

  // Set winding rule to handle all non-zero winding areas as filled
  tesselator.gluTessProperty(gluEnum.GLU_TESS_WINDING_RULE, windingRule.GLU_TESS_WINDING_NONZERO);

  // Begin tessellation
  tesselator.gluTessBeginPolygon(tessVertices);
  tesselator.gluTessBeginContour();

  // Add vertices to contour
  ringCoords.forEach(([lng, lat]) => {
    const coords = [lng, lat, 0];
    tesselator.gluTessVertex(coords, coords);
  });

  tesselator.gluTessEndContour();
  tesselator.gluTessEndPolygon();

  return { positions, indices };
}

// Subdivide triangles that have edges too long for proper spherical rendering
function subdivideSphericalTriangles(
  positions: number[],
  indices: number[],
  countryIds: number[],
  radius: number,
  config: LodConfig
): { positions: number[]; indices: number[]; countryIds: number[] } {
  const newPositions = [...positions];
  const newCountryIds = [...countryIds];
  let newIndices = [...indices];

  // Cache for edge midpoints to ensure shared edges use the same vertex
  const edgeMidpointCache = new Map<string, number>();

  // Track which country each original vertex belongs to
  const vertexCountryMap = new Map<number, number>();
  for (let i = 0; i < countryIds.length; i++) {
    vertexCountryMap.set(i, countryIds[i]);
  }

  const getVertex = (idx: number): [number, number, number] => [
    newPositions[idx * 3],
    newPositions[idx * 3 + 1],
    newPositions[idx * 3 + 2],
  ];

  const edgeLength = (
    v1: [number, number, number],
    v2: [number, number, number]
  ): number => {
    const dx = v2[0] - v1[0];
    const dy = v2[1] - v1[1];
    const dz = v2[2] - v1[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const getOrCreateMidpoint = (
    idx1: number,
    idx2: number,
    countryId: number
  ): number => {
    const edgeKey = idx1 < idx2 ? `${idx1}-${idx2}` : `${idx2}-${idx1}`;

    const cached = edgeMidpointCache.get(edgeKey);
    if (cached !== undefined) {
      return cached;
    }

    const v1 = getVertex(idx1);
    const v2 = getVertex(idx2);
    const mx = (v1[0] + v2[0]) / 2;
    const my = (v1[1] + v2[1]) / 2;
    const mz = (v1[2] + v2[2]) / 2;

    const len = Math.sqrt(mx * mx + my * my + mz * mz);
    const nx = (mx / len) * radius;
    const ny = (my / len) * radius;
    const nz = (mz / len) * radius;

    const newIdx = newPositions.length / 3;
    newPositions.push(nx, ny, nz);
    newCountryIds.push(countryId);
    vertexCountryMap.set(newIdx, countryId);

    edgeMidpointCache.set(edgeKey, newIdx);
    return newIdx;
  };

  const subdivide = (depth: number): void => {
    if (depth >= config.maxDepth) return;

    const triangleCount = newIndices.length / 3;
    const nextIndices: number[] = [];
    let didSubdivide = false;

    // NOTE: Do NOT clear edgeMidpointCache here!
    // Keeping the cache ensures shared edges use identical vertices across subdivision levels

    for (let t = 0; t < triangleCount; t++) {
      const i0 = newIndices[t * 3];
      const i1 = newIndices[t * 3 + 1];
      const i2 = newIndices[t * 3 + 2];

      // Get country ID from any vertex of this triangle
      const countryId = vertexCountryMap.get(i0) ?? 0;

      const v0 = getVertex(i0);
      const v1 = getVertex(i1);
      const v2 = getVertex(i2);

      const e01 = edgeLength(v0, v1);
      const e12 = edgeLength(v1, v2);
      const e20 = edgeLength(v2, v0);

      const maxEdge = Math.max(e01, e12, e20);

      if (maxEdge > config.maxEdgeLength) {
        didSubdivide = true;

        const m01 = getOrCreateMidpoint(i0, i1, countryId);
        const m12 = getOrCreateMidpoint(i1, i2, countryId);
        const m20 = getOrCreateMidpoint(i2, i0, countryId);

        nextIndices.push(i0, m01, m20);
        nextIndices.push(m01, i1, m12);
        nextIndices.push(m20, m12, i2);
        nextIndices.push(m01, m12, m20);
      } else {
        nextIndices.push(i0, i1, i2);
      }
    }

    newIndices = nextIndices;

    if (didSubdivide) {
      subdivide(depth + 1);
    }
  };

  subdivide(0);

  return { positions: newPositions, indices: newIndices, countryIds: newCountryIds };
}

// Generate country geometry with specified LOD level
export function generateCountryGeometry(
  radius: number,
  lodLevel: LodLevel = "medium"
): THREE.BufferGeometry {
  const elevatedRadius = radius * 1.004;
  const config = LOD_CONFIGS[lodLevel];

  const allPositions: number[] = [];
  const allIndices: number[] = [];
  const allCountryIds: number[] = [];
  let indexOffset = 0;

  countryFeatures.forEach((feature, featureIndex) => {
    const geom = feature.geometry;

    if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return;

    const polygons: number[][][][] =
      geom.type === "Polygon"
        ? [geom.coordinates as number[][][]]
        : (geom.coordinates as number[][][][]);

    polygons.forEach((polygonCoords) => {
      try {
        // Skip polygons that cross the antimeridian (would create incorrect triangulation)
        const exteriorRing = polygonCoords[0];
        if (exteriorRing && crossesAntimeridian(exteriorRing)) {
          return;
        }

        const triangulated = triangulatePolygon(polygonCoords, elevatedRadius);

        // Create country IDs for initial vertices (1-indexed, 0 = ocean)
        const initialCountryIds = new Array(triangulated.positions.length / 3).fill(
          featureIndex + 1
        );

        const { positions, indices, countryIds } = subdivideSphericalTriangles(
          triangulated.positions,
          triangulated.indices,
          initialCountryIds,
          elevatedRadius,
          config
        );

        if (indices.length > 0) {
          allPositions.push(...positions);
          allCountryIds.push(...countryIds);
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

  let geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(allPositions, 3)
  );
  geo.setIndex(allIndices);

  // Add country ID attribute for GPU picking
  geo.setAttribute(
    "countryId",
    new THREE.Float32BufferAttribute(allCountryIds, 1)
  );

  // Weld duplicate vertices to eliminate seams between triangles
  // Use a small tolerance to merge vertices that are nearly identical
  try {
    geo = BufferGeometryUtils.mergeVertices(geo, 1e-4);
  } catch {
    // If merge fails, continue with original geometry
    console.warn("Vertex merging failed, using original geometry");
  }

  // Compute normals analytically (for sphere, normal = normalized position)
  const positions = geo.getAttribute("position").array;
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const len = Math.sqrt(x * x + y * y + z * z);
    normals[i] = x / len;
    normals[i + 1] = y / len;
    normals[i + 2] = z / len;
  }
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));

  return geo;
}

// Frosted glass shader for land masses with highlight support
const frostedVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  attribute float countryId;
  varying float vCountryId;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vCountryId = countryId;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frostedFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vCountryId;

  uniform vec3 baseColor;
  uniform vec3 frostedColor;
  uniform float baseOpacity;
  uniform vec3 hoverColor;
  uniform vec3 selectedColor;
  uniform float hoveredId;
  uniform float selectedId;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float NdotV = max(dot(viewDirection, vNormal), 0.0);
    float fresnel = pow(1.0 - NdotV, 2.0);

    // Diffuse for subtle shading only
    vec3 lightDir = normalize(vec3(5.0, 3.0, 5.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.15 + 0.85;

    // Start with bright base - strengthen base color
    vec3 color = baseColor * 0.85 + baseColor * diffuse * 0.15;

    // Less edge fade for frosted glass rim
    color = mix(color, frostedColor, fresnel * 0.25);

    // Softer specular highlight
    vec3 landLightDir = normalize(vec3(4.0, 4.0, 5.0));
    vec3 landHalf = normalize(landLightDir + viewDirection);
    float landSpec = pow(max(dot(vNormal, landHalf), 0.0), 16.0);
    color += vec3(1.0) * landSpec * 0.15;

    float alpha = baseOpacity;

    // Highlight logic
    if (abs(vCountryId - selectedId) < 0.5) {
      color = mix(color, selectedColor, 0.75);
      alpha = max(alpha, 0.95);
    } else if (abs(vCountryId - hoveredId) < 0.5) {
      color = mix(color, hoverColor, 0.6);
      alpha = max(alpha, 0.4);
    }

    gl_FragColor = vec4(color, alpha);
  }
`;

export function CountryFills({
  radius = 1,
  lodLevel = "medium",
  onGeometryReady,
  baseOpacity = 1,
  hoveredId = null,
  selectedId = null,
  highlightColors,
}: CountryFillsProps) {
  const geometry = useMemo(
    () => generateCountryGeometry(radius, lodLevel),
    [radius, lodLevel]
  );

  // Notify parent when geometry is ready (for GPU picker)
  useEffect(() => {
    if (onGeometryReady) {
      onGeometryReady(geometry);
    }
  }, [geometry, onGeometryReady]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: frostedVertexShader,
        fragmentShader: frostedFragmentShader,
        uniforms: {
          baseColor: { value: new THREE.Color("#f5f9fc") },
          frostedColor: { value: new THREE.Color("#ffffff") },
          baseOpacity: { value: baseOpacity },
          hoverColor: { value: new THREE.Color(highlightColors?.hover || "#e0f2fe") },
          selectedColor: { value: new THREE.Color(highlightColors?.selected || "#bae6fd") },
          hoveredId: { value: hoveredId ?? -1 },
          selectedId: { value: selectedId ?? -1 },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    // Keep material instance stable; we update uniforms imperatively below
    [baseOpacity, highlightColors?.hover, highlightColors?.selected]
  );

  // Keep uniforms in sync when props change
  material.uniforms.baseOpacity.value = baseOpacity;
  material.uniforms.hoveredId.value = hoveredId ?? -1;
  material.uniforms.selectedId.value = selectedId ?? -1;
  material.uniforms.hoverColor.value.set(highlightColors?.hover || "#e0f2fe");
  material.uniforms.selectedColor.value.set(highlightColors?.selected || "#bae6fd");

  return <mesh geometry={geometry} material={material} />;
}
