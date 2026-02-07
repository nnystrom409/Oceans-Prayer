const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");
const topojson = require("topojson-client");

const topoData = require("world-atlas/countries-50m.json");

const topology = topoData;
const geo = topojson.feature(topology, topology.objects.countries);

const width = 1024;
const height = 512;

const landCanvas = createCanvas(width, height);
const borderCanvas = createCanvas(width, height);
const idCanvas = createCanvas(width, height);

const landCtx = landCanvas.getContext("2d");
const borderCtx = borderCanvas.getContext("2d");
const idCtx = idCanvas.getContext("2d");

if (!landCtx || !borderCtx || !idCtx) {
  throw new Error("Failed to get 2D canvas context");
}

landCtx.clearRect(0, 0, width, height);
borderCtx.clearRect(0, 0, width, height);
idCtx.clearRect(0, 0, width, height);

landCtx.fillStyle = "rgba(255, 255, 255, 1)";

borderCtx.lineWidth = 1;
borderCtx.strokeStyle = "rgba(110, 163, 209, 0.9)";
borderCtx.lineJoin = "round";
borderCtx.lineCap = "round";

const countryIndex = [];

const toPixel = (lng, lat) => {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
};

const drawRing = (ctx, ring) => {
  if (!ring || ring.length < 3) return;
  ctx.beginPath();
  ring.forEach(([lng, lat], i) => {
    const { x, y } = toPixel(lng, lat);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
};

const encodeIdColor = (id) => {
  const r = id % 256;
  const g = Math.floor(id / 256);
  return `rgb(${r}, ${g}, 0)`;
};

geo.features.forEach((feature, index) => {
  const geom = feature.geometry;
  if (!geom) return;

  const id = index + 1;
  const geometryMeta = topology.objects.countries.geometries[index];
  const code = geometryMeta && geometryMeta.id != null ? String(geometryMeta.id) : String(index);
  const name = (feature.properties && feature.properties.name) || "Unknown";

  countryIndex.push({ id, code, name });

  const polygons =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];

  idCtx.fillStyle = encodeIdColor(id);

  polygons.forEach((polygon) => {
    const exteriorRing = polygon[0];
    if (!exteriorRing) return;

    drawRing(landCtx, exteriorRing);
    landCtx.fill();

    drawRing(idCtx, exteriorRing);
    idCtx.fill();

    drawRing(borderCtx, exteriorRing);
    borderCtx.stroke();
  });
});

const outDir = path.join(process.cwd(), "public", "globe");
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, "earth-land.png"), landCanvas.toBuffer("image/png"));
fs.writeFileSync(
  path.join(outDir, "earth-borders.png"),
  borderCanvas.toBuffer("image/png")
);
fs.writeFileSync(path.join(outDir, "country-id.png"), idCanvas.toBuffer("image/png"));

const dataDir = path.join(process.cwd(), "src", "data");
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  path.join(dataDir, "country-index.json"),
  JSON.stringify(countryIndex, null, 2)
);

console.log(
  `Generated textures and country index at ${outDir} and ${path.join(dataDir, "country-index.json")}`
);
