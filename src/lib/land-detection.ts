/**
 * Land Detection via PNG Land Mask
 * Uses a grayscale/alpha PNG where land pixels have alpha >= 90
 */

export interface LandMapData {
  imageData: ImageData;
  width: number;
  height: number;
}

/**
 * Load a land mask PNG and return its ImageData for sampling.
 * The PNG should be a world map where:
 * - Land areas have alpha >= 90 (or are white/opaque)
 * - Ocean areas have alpha < 90 (or are black/transparent)
 */
export async function loadLandMap(url: string): Promise<LandMapData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas 2D context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      resolve({
        imageData,
        width: img.width,
        height: img.height,
      });
    };

    img.onerror = () => {
      reject(new Error(`Failed to load land map from ${url}`));
    };

    img.src = url;
  });
}

/**
 * Check if a given lat/lng coordinate is over land.
 * Uses equirectangular projection to map lat/lng to pixel coordinates.
 *
 * @param lat Latitude in degrees (-90 to 90)
 * @param lng Longitude in degrees (-180 to 180)
 * @param landData The loaded land map data
 * @param threshold Alpha value threshold (default 90)
 * @returns true if the point is over land
 */
export function isLandAtLatLng(
  lat: number,
  lng: number,
  landData: LandMapData,
  threshold: number = 90
): boolean {
  const { imageData, width, height } = landData;

  // Convert lat/lng to pixel coordinates
  // Longitude: -180 to 180 maps to 0 to width
  // Latitude: 90 to -90 maps to 0 to height (north is top)
  const x = Math.floor(((lng + 180) / 360) * width);
  const y = Math.floor(((90 - lat) / 180) * height);

  // Clamp to valid range
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));

  // Get pixel index (RGBA format, 4 bytes per pixel)
  const index = (clampedY * width + clampedX) * 4;

  // Check alpha channel (index + 3)
  // Some maps use RGB values instead of alpha, so also check if pixel is bright
  const r = imageData.data[index];
  const g = imageData.data[index + 1];
  const b = imageData.data[index + 2];
  const a = imageData.data[index + 3];

  // Land if alpha is high OR if the pixel is bright (white)
  // This handles both alpha-based and RGB-based land masks
  const brightness = (r + g + b) / 3;
  return a >= threshold || (a > 0 && brightness > 127);
}

/**
 * Batch check multiple lat/lng coordinates for land.
 * Returns a Uint8Array where 1 = land, 0 = ocean.
 */
export function batchCheckLand(
  coordinates: Array<{ lat: number; lng: number }>,
  landData: LandMapData,
  threshold: number = 90
): Uint8Array {
  const results = new Uint8Array(coordinates.length);

  for (let i = 0; i < coordinates.length; i++) {
    const { lat, lng } = coordinates[i];
    results[i] = isLandAtLatLng(lat, lng, landData, threshold) ? 1 : 0;
  }

  return results;
}
