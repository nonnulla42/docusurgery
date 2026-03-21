function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode signature image."));
    image.src = dataUrl;
  });
}

export async function processSignatureImage(
  originalImageDataUrl: string,
  removeWhiteBackground: boolean,
  backgroundThreshold: number,
) {
  if (!removeWhiteBackground) {
    return originalImageDataUrl;
  }

  const image = await loadImage(originalImageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas 2D context unavailable for signature processing.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  const threshold = clamp(backgroundThreshold, 0, 255);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];

    if (alpha === 0) {
      continue;
    }

    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const distanceFromWhite = 255 - luminance;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);

    // Keep darker, more saturated strokes more intact even at higher cleanup levels.
    if (chroma > 72 && luminance < 244) {
      continue;
    }

    if (distanceFromWhite > threshold) {
      continue;
    }

    const softBand = Math.max(12, Math.min(48, threshold * 0.2 || 12));
    const normalized = clamp((threshold - distanceFromWhite) / softBand, 0, 1);
    const nextAlpha = Math.round(alpha * (1 - normalized));
    data[index + 3] = nextAlpha;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}
