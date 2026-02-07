"use client";

import { useMemo } from "react";
import * as THREE from "three";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { GluTesselator, windingRule, primitiveType, gluEnum } from "libtess";

import landTopo from "world-atlas/land-50m.json";
import { latLngToVector3 } from "@/lib/geo-utils";

// LOD tuned to keep the landmass smooth without heavy geometry
const LAND_MAX_EDGE = 0.18;
const LAND_MAX_DEPTH = 4;

// Type definitions for the imported TopoJSON
type LandObjects = {
  land: GeometryCollection;
};

// Convert the land topology into a single GeoJSON feature (MultiPolygon)
const landFeature = topojson.feature(
  landTopo as unknown as Topology<LandObjects>,
  (landTopo as unknown as Topology<LandObjects>).objects.land
) as unknown as GeoJSON.Feature<GeoJSON.MultiPolygon | GeoJSON.Polygon>;

// Utility: detect if polygon crosses antimeridian to avoid giant triangles
function crossesAntimeridian(coords: number[][], threshold = 90): boolean {
  for (let i = 0; i < coords.length - 1; i++) {
    if (Math.abs(coords[i + 1][0] - coords[i][0]) > threshold) return true;
  }
  return false;
}

// Triangulate a single polygon ring set using libtess (outer ring only)
function triangulatePolygon(coords: number[][][], radius: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();

  const exteriorRing = coords[0];
  if (!exteriorRing) return { positions, indices };

  const ringCoords =
    exteriorRing[0][0] === exteriorRing[exteriorRing.length - 1][0] &&
    exteriorRing[0][1] === exteriorRing[exteriorRing.length - 1][1]
      ? exteriorRing.slice(0, -1)
      : exteriorRing;

  const tess = new GluTesselator();
  const tessVertices: number[][] = [];
  let currentPrimitiveType = 0;
  let currentPrimitive: number[] = [];

  const getOrCreateVertex = (lng: number, lat: number): number => {
    const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
    const found = vertexMap.get(key);
    if (found !== undefined) return found;
    const pos = latLngToVector3(lat, lng, radius);
    const idx = positions.length / 3;
    positions.push(pos.x, pos.y, pos.z);
    vertexMap.set(key, idx);
    return idx;
  };

  tess.gluTessCallback(
    gluEnum.GLU_TESS_VERTEX_DATA,
    ((data: number[], polyVertArray: number[][]) => {
      polyVertArray.push(data);
    }) as unknown as () => void
  );

  tess.gluTessCallback(
    gluEnum.GLU_TESS_BEGIN,
    ((type: number) => {
      currentPrimitiveType = type;
      currentPrimitive = [];
    }) as unknown as () => void
  );

  tess.gluTessCallback(
    gluEnum.GLU_TESS_END,
    (() => {
      if (currentPrimitiveType === primitiveType.GL_TRIANGLES) {
        for (let i = 0; i < tessVertices.length; i += 3) {
          if (i + 2 < tessVertices.length) {
            const v0 = tessVertices[i];
            const v1 = tessVertices[i + 1];
            const v2 = tessVertices[i + 2];
            indices.push(
              getOrCreateVertex(v0[0], v0[1]),
              getOrCreateVertex(v1[0], v1[1]),
              getOrCreateVertex(v2[0], v2[1])
            );
          }
        }
      } else if (currentPrimitiveType === primitiveType.GL_TRIANGLE_FAN) {
        if (tessVertices.length >= 3) {
          const center = getOrCreateVertex(tessVertices[0][0], tessVertices[0][1]);
          for (let i = 1; i < tessVertices.length - 1; i++) {
            const i1 = getOrCreateVertex(tessVertices[i][0], tessVertices[i][1]);
            const i2 = getOrCreateVertex(tessVertices[i + 1][0], tessVertices[i + 1][1]);
            indices.push(center, i1, i2);
          }
        }
      } else if (currentPrimitiveType === primitiveType.GL_TRIANGLE_STRIP) {
        for (let i = 0; i < tessVertices.length - 2; i++) {
          const i0 = getOrCreateVertex(tessVertices[i][0], tessVertices[i][1]);
          const i1 = getOrCreateVertex(tessVertices[i + 1][0], tessVertices[i + 1][1]);
          const i2 = getOrCreateVertex(tessVertices[i + 2][0], tessVertices[i + 2][1]);
          if (i % 2 === 0) {
            indices.push(i0, i1, i2);
          } else {
            indices.push(i0, i2, i1);
          }
        }
      }
      tessVertices.length = 0;
    }) as unknown as () => void
  );

  tess.gluTessCallback(
    gluEnum.GLU_TESS_COMBINE,
    ((coords: number[]) => [coords[0], coords[1], coords[2]]) as unknown as () => void
  );

  tess.gluTessCallback(
    gluEnum.GLU_TESS_ERROR,
    ((errno: number) => {
      console.warn("Land tessellation error", errno);
    }) as unknown as () => void
  );

  tess.gluTessProperty(gluEnum.GLU_TESS_WINDING_RULE, windingRule.GLU_TESS_WINDING_NONZERO);

  tess.gluTessBeginPolygon(tessVertices);
  tess.gluTessBeginContour();

  ringCoords.forEach(([lng, lat]) => {
    const coords = [lng, lat, 0];
    tess.gluTessVertex(coords, coords);
  });

  tess.gluTessEndContour();
  tess.gluTessEndPolygon();

  return { positions, indices };
}

// Subdivide long triangles on the sphere to avoid stretching
function subdivideSphericalTriangles(
  positions: number[],
  indices: number[],
  radius: number
) {
  let newPositions = [...positions];
  let newIndices = [...indices];
  const edgeMidpointCache = new Map<string, number>();

  const getVertex = (idx: number): [number, number, number] => [
    newPositions[idx * 3],
    newPositions[idx * 3 + 1],
    newPositions[idx * 3 + 2],
  ];

  const edgeLength = (v1: [number, number, number], v2: [number, number, number]) => {
    const dx = v2[0] - v1[0];
    const dy = v2[1] - v1[1];
    const dz = v2[2] - v1[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const getOrCreateMidpoint = (i1: number, i2: number): number => {
    const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
    const cached = edgeMidpointCache.get(key);
    if (cached !== undefined) return cached;

    const v1 = getVertex(i1);
    const v2 = getVertex(i2);
    const mx = (v1[0] + v2[0]) / 2;
    const my = (v1[1] + v2[1]) / 2;
    const mz = (v1[2] + v2[2]) / 2;

    const len = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
    const nx = (mx / len) * radius;
    const ny = (my / len) * radius;
    const nz = (mz / len) * radius;

    const idx = newPositions.length / 3;
    newPositions.push(nx, ny, nz);
    edgeMidpointCache.set(key, idx);
    return idx;
  };

  const subdivide = (depth: number) => {
    if (depth >= LAND_MAX_DEPTH) return;

    const next: number[] = [];
    let didSplit = false;

    for (let t = 0; t < newIndices.length; t += 3) {
      const i0 = newIndices[t];
      const i1 = newIndices[t + 1];
      const i2 = newIndices[t + 2];

      const v0 = getVertex(i0);
      const v1 = getVertex(i1);
      const v2 = getVertex(i2);

      const maxEdge = Math.max(
        edgeLength(v0, v1),
        edgeLength(v1, v2),
        edgeLength(v2, v0)
      );

      if (maxEdge > LAND_MAX_EDGE) {
        didSplit = true;
        const m01 = getOrCreateMidpoint(i0, i1);
        const m12 = getOrCreateMidpoint(i1, i2);
        const m20 = getOrCreateMidpoint(i2, i0);

        next.push(i0, m01, m20);
        next.push(m01, i1, m12);
        next.push(m20, m12, i2);
        next.push(m01, m12, m20);
      } else {
        next.push(i0, i1, i2);
      }
    }

    newIndices = next;
    if (didSplit) subdivide(depth + 1);
  };

  subdivide(0);
  return { positions: newPositions, indices: newIndices };
}

// Build a single landmass geometry
function generateLandGeometry(radius: number) {
  const elevatedRadius = radius * 1.002;

  const allPositions: number[] = [];
  const allIndices: number[] = [];
  let indexOffset = 0;

  const geom = landFeature.geometry;
  if (!geom) return new THREE.BufferGeometry();

  const polygons: number[][][][] =
    geom.type === "Polygon"
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);

  polygons.forEach((polygon) => {
    const exteriorRing = polygon[0];
    if (!exteriorRing) return;
    if (crossesAntimeridian(exteriorRing)) return;

    const { positions, indices } = triangulatePolygon(polygon, elevatedRadius);
    if (!indices.length) return;

    const subdivided = subdivideSphericalTriangles(positions, indices, elevatedRadius);

    allPositions.push(...subdivided.positions);
    subdivided.indices.forEach((idx) => allIndices.push(idx + indexOffset));
    indexOffset += subdivided.positions.length / 3;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(allPositions, 3));
  geo.setIndex(allIndices);

  // Normals = normalized position for a sphere
  const positionsArr = geo.getAttribute("position").array as ArrayLike<number>;
  const normals = new Float32Array(positionsArr.length);
  for (let i = 0; i < positionsArr.length; i += 3) {
    const x = positionsArr[i];
    const y = positionsArr[i + 1];
    const z = positionsArr[i + 2];
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    normals[i] = x / len;
    normals[i + 1] = y / len;
    normals[i + 2] = z / len;
  }
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));

  return geo;
}

interface LandMassProps {
  radius?: number;
}

/**
 * Single landmass mesh that sits atop the ocean sphere.
 * This removes the visual seams between per-country polygons.
 */
export function LandMass({ radius = 1 }: LandMassProps) {
  const geometry = useMemo(() => generateLandGeometry(radius), [radius]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#f4f7fb"),
        roughness: 0.55,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    []
  );

  return <mesh geometry={geometry} material={material} />;
}
