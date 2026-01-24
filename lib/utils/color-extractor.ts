/**
 * Extract dominant color from an image URL
 * Uses canvas to sample pixels and find the most vibrant/representative color
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Calculate color vibrancy (saturation * luminance balance)
 */
function getVibrancy(hsl: HSL): number {
  // Prefer colors that are saturated and not too dark or too light
  const luminanceScore = 1 - Math.abs(hsl.l - 50) / 50;
  return hsl.s * luminanceScore;
}

/**
 * Extract the dominant/most vibrant color from an image
 */
export async function extractDominantColor(imageUrl: string): Promise<HSL | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        // Use a small size for performance
        const size = 50;
        canvas.width = size;
        canvas.height = size;

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        // Sample colors and find the most vibrant
        const colorCounts: Map<string, { count: number; hsl: HSL }> = new Map();

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          const hsl = rgbToHsl(r, g, b);

          // Skip very dark or very light colors (likely background)
          if (hsl.l < 15 || hsl.l > 85) continue;
          // Skip very desaturated colors
          if (hsl.s < 20) continue;

          // Quantize to reduce unique colors
          const key = `${Math.round(hsl.h / 10) * 10}-${Math.round(hsl.s / 10) * 10}-${Math.round(hsl.l / 10) * 10}`;

          const existing = colorCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            colorCounts.set(key, { count: 1, hsl });
          }
        }

        // Find the most vibrant color that appears frequently
        let bestColor: HSL | null = null;
        let bestScore = 0;

        colorCounts.forEach(({ count, hsl }) => {
          const vibrancy = getVibrancy(hsl);
          const score = vibrancy * Math.log(count + 1);

          if (score > bestScore) {
            bestScore = score;
            bestColor = hsl;
          }
        });

        resolve(bestColor);
      } catch (e) {
        console.error("Failed to extract color:", e);
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = imageUrl;
  });
}

/**
 * Convert HSL to CSS string
 */
export function hslToString(hsl: HSL): string {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}
