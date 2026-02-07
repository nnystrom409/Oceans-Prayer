"use client";

import { useMemo } from "react";
import {
  generateFibonacciSpherePoints,
  positionToLatLng,
} from "@/lib/fibonacci-sphere";
import { isLandAtLatLng, type LandMapData } from "@/lib/land-detection";

interface UseDotPositionsResult {
  /** All positions as Float32Array [x1, y1, z1, x2, y2, z2, ...] */
  positions: Float32Array;
  /** Land flags for each position (1 = land, 0 = ocean) */
  landFlags: Float32Array;
  /** Count of land dots */
  landCount: number;
  /** Total dot count */
  totalCount: number;
}

/**
 * Generates Fibonacci sphere points and filters them through land detection.
 */
export function useDotPositions(
  dotCount: number,
  radius: number,
  landData: LandMapData | null
): UseDotPositionsResult {
  return useMemo(() => {
    // Generate all sphere points
    const positions = generateFibonacciSpherePoints(dotCount, radius);

    // Create land flags array
    const landFlags = new Float32Array(dotCount);
    let landCount = 0;

    if (landData) {
      // Check each point against land mask
      for (let i = 0; i < dotCount; i++) {
        const idx = i * 3;
        const x = positions[idx];
        const y = positions[idx + 1];
        const z = positions[idx + 2];

        const { lat, lng } = positionToLatLng(x, y, z);
        const isLand = isLandAtLatLng(lat, lng, landData);

        landFlags[i] = isLand ? 1.0 : 0.0;
        if (isLand) landCount++;
      }
    } else {
      // No land data yet - mark all as ocean (will be filtered out)
      landFlags.fill(0);
    }

    return {
      positions,
      landFlags,
      landCount,
      totalCount: dotCount,
    };
  }, [dotCount, radius, landData]);
}
