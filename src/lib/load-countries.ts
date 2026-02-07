import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
// Use pre-processed world-atlas data (properly handles antimeridian splitting)
import topoData from "world-atlas/countries-50m.json";

interface CountryProperties {
  name: string;
  [key: string]: unknown;
}

interface CountryGeometry {
  id: string;
  properties: CountryProperties;
}

// Type the imported TopoJSON data
const topology = topoData as unknown as Topology<{
  countries: GeometryCollection<CountryProperties>;
}>;

// Convert TopoJSON to GeoJSON FeatureCollection
export const countriesGeoJson = topojson.feature(
  topology,
  topology.objects.countries
) as GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  CountryProperties
>;

// Add the id from geometry to properties for easier access
// world-atlas stores country ID at geometry level, not in properties
export const countryFeatures = countriesGeoJson.features.map((feature, index) => {
  const geom = (topology.objects.countries.geometries[index] as unknown as CountryGeometry);
  return {
    ...feature,
    properties: {
      ...feature.properties,
      // Map to uppercase for compatibility with existing code
      NAME: feature.properties.name || "Unknown",
      // Use the numeric ID as the country code (UN M49 code)
      ADM0_A3: geom?.id || String(index),
    },
  };
});

// Export a type for country features
export type CountryFeature = (typeof countryFeatures)[number];
