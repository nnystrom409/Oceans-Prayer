/**
 * Fibonacci Sphere Algorithm
 * Generates evenly distributed points on a sphere surface
 */

const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = (2 * Math.PI) / (PHI * PHI);

export interface SpherePoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Generate evenly distributed points on a sphere using the Fibonacci spiral method.
 * Returns a Float32Array with [x1, y1, z1, x2, y2, z2, ...] format.
 */
export function generateFibonacciSpherePoints(
  count: number,
  radius: number = 1
): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // y goes from 1 to -1 (top to bottom of sphere)
    const y = 1 - (i / (count - 1)) * 2;
    // radius at this y level
    const radiusAtY = Math.sqrt(1 - y * y);
    // golden angle increment
    const theta = GOLDEN_ANGLE * i;

    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    const idx = i * 3;
    positions[idx] = x * radius;
    positions[idx + 1] = y * radius;
    positions[idx + 2] = z * radius;
  }

  return positions;
}

/**
 * Convert a 3D position on a unit sphere to latitude/longitude.
 */
export function positionToLatLng(
  x: number,
  y: number,
  z: number
): { lat: number; lng: number } {
  // Normalize the position (in case it's not exactly on unit sphere)
  const length = Math.sqrt(x * x + y * y + z * z);
  const nx = x / length;
  const ny = y / length;
  const nz = z / length;

  // Latitude: from y coordinate, -90 to +90
  const lat = Math.asin(ny) * (180 / Math.PI);

  // Longitude: from x and z coordinates, -180 to +180
  const lng = Math.atan2(nz, nx) * (180 / Math.PI);

  return { lat, lng };
}

/**
 * Convert latitude/longitude to 3D position on a sphere.
 */
export function latLngToPosition(
  lat: number,
  lng: number,
  radius: number = 1
): SpherePoint {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}
