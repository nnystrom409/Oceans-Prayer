import countryIndex from "@/data/country-index.json";

export interface CountryIndexEntry {
  id: number;
  code: string;
  name: string;
}

export interface CountryIdMapData {
  imageData: ImageData;
  width: number;
  height: number;
}

const countryById = new Map<number, CountryIndexEntry>(
  (countryIndex as CountryIndexEntry[]).map((entry) => [entry.id, entry])
);

export async function loadCountryIdMap(url: string): Promise<CountryIdMapData> {
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
      reject(new Error(`Failed to load country ID map from ${url}`));
    };

    img.src = url;
  });
}

export function getCountryIdAtLatLng(
  lat: number,
  lng: number,
  idMap: CountryIdMapData
): number | null {
  const { imageData, width, height } = idMap;

  const x = Math.floor(((lng + 180) / 360) * width);
  const y = Math.floor(((90 - lat) / 180) * height);

  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));

  const index = (clampedY * width + clampedX) * 4;
  const r = imageData.data[index];
  const g = imageData.data[index + 1];

  const id = r + g * 256;
  return id === 0 ? null : id;
}

export function getCountryById(id: number | null): CountryIndexEntry | null {
  if (!id) return null;
  return countryById.get(id) ?? null;
}
