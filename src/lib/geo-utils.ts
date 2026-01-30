import * as THREE from "three";

// Convert latitude/longitude to 3D position on a sphere
export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

// Convert 3D position back to lat/lng
export function vector3ToLatLng(
  position: THREE.Vector3,
  radius: number
): { lat: number; lng: number } {
  const normalized = position.clone().normalize();
  const lat = 90 - Math.acos(normalized.y) * (180 / Math.PI);
  const lng = Math.atan2(normalized.z, -normalized.x) * (180 / Math.PI) - 180;

  return { lat, lng: lng < -180 ? lng + 360 : lng };
}

// Create a curved arc between two points on the globe
export function createArcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  altitude: number,
  segments: number = 64
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  const startNorm = start.clone().normalize();
  const endNorm = end.clone().normalize();

  // Calculate the great circle distance
  const angle = startNorm.angleTo(endNorm);

  // Create control points for the bezier curve
  const mid = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5)
    .normalize()
    .multiplyScalar(start.length() + altitude * (1 + angle));

  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

  for (let i = 0; i <= segments; i++) {
    points.push(curve.getPoint(i / segments));
  }

  return points;
}

// Irvine, CA coordinates
export const IRVINE_COORDS = {
  lat: 33.6846,
  lng: -117.8265,
  name: "Irvine, CA",
};

// Get country center coordinates (simplified - you'd want more accurate data)
export const COUNTRY_CENTERS: Record<string, { lat: number; lng: number; name: string }> = {
  USA: { lat: 39.8283, lng: -98.5795, name: "United States" },
  CAN: { lat: 56.1304, lng: -106.3468, name: "Canada" },
  MEX: { lat: 23.6345, lng: -102.5528, name: "Mexico" },
  BRA: { lat: -14.235, lng: -51.9253, name: "Brazil" },
  ARG: { lat: -38.4161, lng: -63.6167, name: "Argentina" },
  GBR: { lat: 55.3781, lng: -3.436, name: "United Kingdom" },
  FRA: { lat: 46.2276, lng: 2.2137, name: "France" },
  DEU: { lat: 51.1657, lng: 10.4515, name: "Germany" },
  ITA: { lat: 41.8719, lng: 12.5674, name: "Italy" },
  ESP: { lat: 40.4637, lng: -3.7492, name: "Spain" },
  PRT: { lat: 39.3999, lng: -8.2245, name: "Portugal" },
  NLD: { lat: 52.1326, lng: 5.2913, name: "Netherlands" },
  BEL: { lat: 50.5039, lng: 4.4699, name: "Belgium" },
  CHE: { lat: 46.8182, lng: 8.2275, name: "Switzerland" },
  AUT: { lat: 47.5162, lng: 14.5501, name: "Austria" },
  POL: { lat: 51.9194, lng: 19.1451, name: "Poland" },
  CZE: { lat: 49.8175, lng: 15.473, name: "Czech Republic" },
  SWE: { lat: 60.1282, lng: 18.6435, name: "Sweden" },
  NOR: { lat: 60.472, lng: 8.4689, name: "Norway" },
  FIN: { lat: 61.9241, lng: 25.7482, name: "Finland" },
  DNK: { lat: 56.2639, lng: 9.5018, name: "Denmark" },
  IRL: { lat: 53.1424, lng: -7.6921, name: "Ireland" },
  RUS: { lat: 61.524, lng: 105.3188, name: "Russia" },
  CHN: { lat: 35.8617, lng: 104.1954, name: "China" },
  JPN: { lat: 36.2048, lng: 138.2529, name: "Japan" },
  KOR: { lat: 35.9078, lng: 127.7669, name: "South Korea" },
  IND: { lat: 20.5937, lng: 78.9629, name: "India" },
  AUS: { lat: -25.2744, lng: 133.7751, name: "Australia" },
  NZL: { lat: -40.9006, lng: 174.886, name: "New Zealand" },
  ZAF: { lat: -30.5595, lng: 22.9375, name: "South Africa" },
  EGY: { lat: 26.8206, lng: 30.8025, name: "Egypt" },
  NGA: { lat: 9.082, lng: 8.6753, name: "Nigeria" },
  KEN: { lat: -0.0236, lng: 37.9062, name: "Kenya" },
  MAR: { lat: 31.7917, lng: -7.0926, name: "Morocco" },
  ISR: { lat: 31.0461, lng: 34.8516, name: "Israel" },
  SAU: { lat: 23.8859, lng: 45.0792, name: "Saudi Arabia" },
  UAE: { lat: 23.4241, lng: 53.8478, name: "United Arab Emirates" },
  TUR: { lat: 38.9637, lng: 35.2433, name: "Turkey" },
  GRC: { lat: 39.0742, lng: 21.8243, name: "Greece" },
  PHL: { lat: 12.8797, lng: 121.774, name: "Philippines" },
  IDN: { lat: -0.7893, lng: 113.9213, name: "Indonesia" },
  THA: { lat: 15.87, lng: 100.9925, name: "Thailand" },
  VNM: { lat: 14.0583, lng: 108.2772, name: "Vietnam" },
  MYS: { lat: 4.2105, lng: 101.9758, name: "Malaysia" },
  SGP: { lat: 1.3521, lng: 103.8198, name: "Singapore" },
  COL: { lat: 4.5709, lng: -74.2973, name: "Colombia" },
  PER: { lat: -9.19, lng: -75.0152, name: "Peru" },
  CHL: { lat: -35.6751, lng: -71.543, name: "Chile" },
  UKR: { lat: 48.3794, lng: 31.1656, name: "Ukraine" },
  HUN: { lat: 47.1625, lng: 19.5033, name: "Hungary" },
  ROU: { lat: 45.9432, lng: 24.9668, name: "Romania" },
};

export type Connection = {
  id: string;
  countryCode: string;
  timestamp?: Date;
};
