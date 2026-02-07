import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import bbox from "@turf/bbox";
import { point } from "@turf/helpers";
import { countryFeatures } from "@/lib/load-countries";

interface CountryWithBbox {
  properties: { NAME: string; ADM0_A3: string };
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  bbox: [number, number, number, number];
}

// Pre-compute bounding boxes at startup for fast rejection
const countriesWithBbox: CountryWithBbox[] = countryFeatures.map((f) => ({
  properties: { NAME: f.properties.NAME, ADM0_A3: f.properties.ADM0_A3 },
  geometry: f.geometry,
  bbox: bbox(f) as [number, number, number, number],
}));

/**
 * Find which country contains a given lat/lng point using point-in-polygon testing.
 * Uses bounding box pre-filtering for performance.
 *
 * @param lat - Latitude in degrees (-90 to 90)
 * @param lng - Longitude in degrees (-180 to 180)
 * @returns Country code and name, or null if point is in ocean/unmapped territory
 */
export function findCountryAtPoint(
  lat: number,
  lng: number
): { code: string; name: string } | null {
  const pt = point([lng, lat]); // GeoJSON uses [lng, lat] order

  for (const country of countriesWithBbox) {
    const [minLng, minLat, maxLng, maxLat] = country.bbox;

    // Quick bounding box rejection - skip if point is outside bbox
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) {
      continue;
    }

    // Full polygon test (handles MultiPolygon for archipelagos, holes for enclaves)
    if (booleanPointInPolygon(pt, country.geometry)) {
      return {
        code: country.properties.ADM0_A3,
        name: country.properties.NAME,
      };
    }
  }

  return null; // Ocean or unmapped territory
}
