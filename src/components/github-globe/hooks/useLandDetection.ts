"use client";

import { useState, useEffect } from "react";
import { loadLandMap, type LandMapData } from "@/lib/land-detection";

interface UseLandDetectionResult {
  landData: LandMapData | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to load and manage land detection data from a PNG mask.
 */
export function useLandDetection(
  url: string = "/world-map.png"
): UseLandDetectionResult {
  const [landData, setLandData] = useState<LandMapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await loadLandMap(url);
        if (!cancelled) {
          setLandData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err : new Error("Failed to load land map")
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { landData, isLoading, error };
}
