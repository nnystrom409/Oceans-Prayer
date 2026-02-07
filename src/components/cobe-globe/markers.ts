import { IRVINE_COORDS } from "@/lib/geo-utils";

export interface GlobeMarker {
  location: [number, number];
  size: number;
  label: string;
}

export const markers: GlobeMarker[] = [
  // Home base
  { location: [IRVINE_COORDS.lat, IRVINE_COORDS.lng], size: 0.1, label: "Irvine, CA" },
  // Prayer locations
  { location: [31.7683, 35.2137], size: 0.08, label: "Jerusalem" },
  { location: [35.6762, 139.6503], size: 0.07, label: "Tokyo" },
  { location: [-33.9249, 18.4241], size: 0.07, label: "Cape Town" },
  { location: [-33.8688, 151.2093], size: 0.07, label: "Sydney" },
  // Ocean-themed locations
  { location: [21.3069, -157.8583], size: 0.06, label: "Honolulu" },
  { location: [64.1466, -21.9426], size: 0.06, label: "Reykjavik" },
  { location: [-8.3405, 115.092], size: 0.06, label: "Bali" },
  { location: [1.3521, 103.8198], size: 0.06, label: "Singapore" },
  { location: [-22.9068, -43.1729], size: 0.06, label: "Rio de Janeiro" },
  { location: [51.5074, -0.1278], size: 0.06, label: "London" },
  { location: [25.2048, 55.2708], size: 0.06, label: "Dubai" },
];
