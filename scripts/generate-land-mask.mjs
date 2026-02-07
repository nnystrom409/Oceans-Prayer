/**
 * Script to generate a land mask PNG from GeoJSON data
 * Run with: node scripts/generate-land-mask.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { createCanvas } from "canvas";

// Configuration
const WIDTH = 360;
const HEIGHT = 180;
const OUTPUT_PATH = "./public/world-map.png";
const GEOJSON_PATH = "./src/data/countries.geo.json";

// Load GeoJSON
const geojsonData = JSON.parse(readFileSync(GEOJSON_PATH, "utf-8"));

// Create canvas
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");

// Fill with transparent (ocean)
ctx.clearRect(0, 0, WIDTH, HEIGHT);

// Set land color (white with full alpha)
ctx.fillStyle = "rgba(255, 255, 255, 255)";

// Convert lat/lng to pixel coordinates
function latLngToPixel(lng, lat) {
  const x = ((lng + 180) / 360) * WIDTH;
  const y = ((90 - lat) / 180) * HEIGHT;
  return [x, y];
}

// Draw a polygon
function drawPolygon(coordinates) {
  ctx.beginPath();
  coordinates.forEach((ring, ringIndex) => {
    ring.forEach(([lng, lat], i) => {
      const [x, y] = latLngToPixel(lng, lat);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
  });
  // For the first ring (exterior), fill. Inner rings are holes.
  ctx.fill("evenodd");
}

// Process each feature
geojsonData.features.forEach((feature) => {
  const { geometry } = feature;

  if (geometry.type === "Polygon") {
    drawPolygon(geometry.coordinates);
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => {
      drawPolygon(polygon);
    });
  }
});

// Save PNG
const buffer = canvas.toBuffer("image/png");
writeFileSync(OUTPUT_PATH, buffer);

console.log(`Land mask generated: ${OUTPUT_PATH} (${WIDTH}x${HEIGHT})`);
