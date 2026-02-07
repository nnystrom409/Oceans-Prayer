"use client";

import { useState, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";

export interface QualitySettings {
  dotCount: number;
  showAtmosphere: boolean;
  showArcs: boolean;
}

// Quality tiers from highest to lowest
const QUALITY_TIERS: QualitySettings[] = [
  { dotCount: 12000, showAtmosphere: true, showArcs: true }, // Tier 0: Full
  { dotCount: 8000, showAtmosphere: true, showArcs: true }, // Tier 1: Reduced dots
  { dotCount: 5000, showAtmosphere: false, showArcs: true }, // Tier 2: No atmosphere
  { dotCount: 3000, showAtmosphere: false, showArcs: false }, // Tier 3: Minimal
];

const FPS_SAMPLE_COUNT = 60;
const FPS_THRESHOLD = 55.5;
const UPGRADE_THRESHOLD = 58; // FPS needed to upgrade tier
const COOLDOWN_FRAMES = 120; // Frames to wait after tier change

interface UseQualityTierResult {
  tier: number;
  settings: QualitySettings;
  currentFps: number;
}

/**
 * Hook that monitors FPS and automatically adjusts quality tier.
 * Degrades when FPS drops below 55.5, upgrades when stable above 58.
 */
export function useQualityTier(initialTier: number = 0): UseQualityTierResult {
  const [tier, setTier] = useState(
    Math.max(0, Math.min(QUALITY_TIERS.length - 1, initialTier))
  );
  const [currentFps, setCurrentFps] = useState(60);

  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  const cooldownRef = useRef(0);
  const stableFramesRef = useRef(0);

  useFrame(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;

    // Track frame times
    frameTimesRef.current.push(delta);
    if (frameTimesRef.current.length > FPS_SAMPLE_COUNT) {
      frameTimesRef.current.shift();
    }

    // Calculate average FPS
    if (frameTimesRef.current.length >= FPS_SAMPLE_COUNT / 2) {
      const avgDelta =
        frameTimesRef.current.reduce((a, b) => a + b, 0) /
        frameTimesRef.current.length;
      const fps = 1000 / avgDelta;
      setCurrentFps(Math.round(fps));

      // Handle cooldown
      if (cooldownRef.current > 0) {
        cooldownRef.current--;
        return;
      }

      // Check if we should degrade
      if (fps < FPS_THRESHOLD && tier < QUALITY_TIERS.length - 1) {
        setTier((prev) => Math.min(QUALITY_TIERS.length - 1, prev + 1));
        cooldownRef.current = COOLDOWN_FRAMES;
        stableFramesRef.current = 0;
        frameTimesRef.current = []; // Reset samples
      }
      // Check if we should upgrade
      else if (fps > UPGRADE_THRESHOLD && tier > 0) {
        stableFramesRef.current++;
        // Need sustained good performance before upgrading
        if (stableFramesRef.current > COOLDOWN_FRAMES * 2) {
          setTier((prev) => Math.max(0, prev - 1));
          cooldownRef.current = COOLDOWN_FRAMES;
          stableFramesRef.current = 0;
          frameTimesRef.current = []; // Reset samples
        }
      } else {
        stableFramesRef.current = 0;
      }
    }
  });

  return {
    tier,
    settings: QUALITY_TIERS[tier],
    currentFps,
  };
}

/**
 * Get quality settings for a specific tier without FPS monitoring.
 */
export function getQualitySettings(tier: number): QualitySettings {
  return QUALITY_TIERS[Math.max(0, Math.min(QUALITY_TIERS.length - 1, tier))];
}
