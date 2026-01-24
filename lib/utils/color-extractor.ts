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
 * Falls back to most common color for grayscale images
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

        // Sample colors - separate vibrant from all colors
        const vibrantColors: Map<string, { count: number; hsl: HSL }> = new Map();
        const allColors: Map<string, { count: number; hsl: HSL }> = new Map();

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          const hsl = rgbToHsl(r, g, b);

          // Quantize to reduce unique colors
          const key = `${Math.round(hsl.h / 10) * 10}-${Math.round(hsl.s / 10) * 10}-${Math.round(hsl.l / 10) * 10}`;

          // Track all colors (for fallback)
          const existingAll = allColors.get(key);
          if (existingAll) {
            existingAll.count++;
          } else {
            allColors.set(key, { count: 1, hsl });
          }

          // Track vibrant colors (saturated, mid-luminance)
          if (hsl.l >= 15 && hsl.l <= 85 && hsl.s >= 20) {
            const existingVibrant = vibrantColors.get(key);
            if (existingVibrant) {
              existingVibrant.count++;
            } else {
              vibrantColors.set(key, { count: 1, hsl });
            }
          }
        }

        // Try to find the most vibrant color first
        let bestColor: HSL | null = null;
        let bestScore = 0;

        vibrantColors.forEach(({ count, hsl }) => {
          const vibrancy = getVibrancy(hsl);
          const score = vibrancy * Math.log(count + 1);

          if (score > bestScore) {
            bestScore = score;
            bestColor = hsl;
          }
        });

        // If no vibrant color found, use most common color with adjusted saturation
        if (!bestColor && allColors.size > 0) {
          let maxCount = 0;
          let fallbackHsl: HSL | null = null;

          allColors.forEach(({ count, hsl }) => {
            // Prefer colors that aren't pure black or white
            if (hsl.l > 5 && hsl.l < 95 && count > maxCount) {
              maxCount = count;
              fallbackHsl = hsl;
            }
          });

          if (fallbackHsl) {
            const fb = fallbackHsl as HSL;
            // Boost saturation for grayscale fallback to make ambient visible
            bestColor = {
              h: fb.h || 200, // Default to blue-ish if no hue
              s: Math.max(fb.s, 30), // Ensure minimum saturation
              l: Math.min(Math.max(fb.l, 25), 65), // Clamp luminance
            };
          }
        }

        // Ultimate fallback: teal/primary color
        if (!bestColor) {
          bestColor = { h: 183, s: 50, l: 50 }; // Teal fallback
        }

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
