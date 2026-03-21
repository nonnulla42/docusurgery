import type { PatchFillColor } from "../types/patch";

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) => clampChannel(value).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const safeHex = normalized.length === 3
    ? normalized.split("").map((value) => `${value}${value}`).join("")
    : normalized;

  const intValue = Number.parseInt(safeHex, 16);
  if (Number.isNaN(intValue)) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

export function createFillColor(r: number, g: number, b: number): PatchFillColor {
  const rgb = {
    r: clampChannel(r),
    g: clampChannel(g),
    b: clampChannel(b),
  };

  return {
    rgb,
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
  };
}

export function samplePatchFillColor(
  canvas: HTMLCanvasElement,
  rect: { x: number; y: number; width: number; height: number },
): PatchFillColor {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return createFillColor(255, 255, 255);
  }

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const margin = Math.max(6, Math.round(Math.min(rect.width, rect.height) * 0.12));

  const left = Math.max(0, Math.floor(rect.x));
  const top = Math.max(0, Math.floor(rect.y));
  const right = Math.min(canvasWidth, Math.ceil(rect.x + rect.width));
  const bottom = Math.min(canvasHeight, Math.ceil(rect.y + rect.height));

  const outerLeft = Math.max(0, left - margin);
  const outerTop = Math.max(0, top - margin);
  const outerRight = Math.min(canvasWidth, right + margin);
  const outerBottom = Math.min(canvasHeight, bottom + margin);

  const sampleWidth = Math.max(1, outerRight - outerLeft);
  const sampleHeight = Math.max(1, outerBottom - outerTop);
  const imageData = context.getImageData(outerLeft, outerTop, sampleWidth, sampleHeight).data;

  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let row = 0; row < sampleHeight; row += 1) {
    for (let col = 0; col < sampleWidth; col += 1) {
      const sampleX = outerLeft + col;
      const sampleY = outerTop + row;
      const insidePatch = sampleX >= left && sampleX <= right && sampleY >= top && sampleY <= bottom;
      if (insidePatch) {
        continue;
      }

      const offset = (row * sampleWidth + col) * 4;
      const alpha = imageData[offset + 3];
      if (alpha < 20) {
        continue;
      }

      red += imageData[offset];
      green += imageData[offset + 1];
      blue += imageData[offset + 2];
      count += 1;
    }
  }

  if (count === 0) {
    return createFillColor(255, 255, 255);
  }

  return createFillColor(red / count, green / count, blue / count);
}
