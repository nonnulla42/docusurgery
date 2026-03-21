import { PDFDocument } from "pdf-lib";
import type { ImagePdfFitMode, ImagePdfItem, ImagePdfMargin, ImagePdfPageSize } from "../types/toolkit";

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];

function normalizeRotation(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function stepImageRotation(currentRotation: number, delta: number) {
  return normalizeRotation(currentRotation + delta);
}

export function isSupportedImageFile(file: File) {
  const fileName = file.name.toLowerCase();
  return (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp" ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".webp")
  );
}

export async function loadImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadHtmlImage(objectUrl);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be decoded."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: "image/jpeg" | "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Canvas export failed."));
      },
      type,
      quality,
    );
  });
}

async function normalizeImageForPdf(item: ImagePdfItem) {
  const sourceUrl = URL.createObjectURL(item.file);

  try {
    const image = await loadHtmlImage(sourceUrl);
    const quarterTurn = item.rotation === 90 || item.rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = quarterTurn ? image.naturalHeight : image.naturalWidth;
    canvas.height = quarterTurn ? image.naturalWidth : image.naturalHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Image canvas context is unavailable.");
    }

    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((item.rotation * Math.PI) / 180);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    context.restore();

    const outputType: "image/jpeg" | "image/png" = item.file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    const blob = await canvasToBlob(canvas, outputType, outputType === "image/jpeg" ? 0.92 : undefined);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    return {
      bytes,
      format: outputType,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function getMarginValue(margin: ImagePdfMargin) {
  return margin === "small" ? 24 : 0;
}

function getPageSize(pageSize: ImagePdfPageSize, width: number, height: number, margin: number): [number, number] {
  if (pageSize === "a4-portrait") {
    return A4_PORTRAIT;
  }

  if (pageSize === "a4-landscape") {
    return A4_LANDSCAPE;
  }

  return [width + margin * 2, height + margin * 2];
}

function getDrawBox(pageWidth: number, pageHeight: number, imageWidth: number, imageHeight: number, fitMode: ImagePdfFitMode, margin: number) {
  const availableWidth = Math.max(pageWidth - margin * 2, 1);
  const availableHeight = Math.max(pageHeight - margin * 2, 1);
  const widthRatio = availableWidth / Math.max(imageWidth, 1);
  const heightRatio = availableHeight / Math.max(imageHeight, 1);
  const scale = fitMode === "cover" ? Math.max(widthRatio, heightRatio) : Math.min(widthRatio, heightRatio);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;

  return {
    width: drawWidth,
    height: drawHeight,
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
  };
}

export async function exportImagesToPdf(
  items: ImagePdfItem[],
  options: {
    pageSize: ImagePdfPageSize;
    fitMode: ImagePdfFitMode;
    margin: ImagePdfMargin;
  },
) {
  if (items.length === 0) {
    throw new Error("Add at least one image before exporting.");
  }

  const pdf = await PDFDocument.create();
  const margin = getMarginValue(options.margin);

  for (const item of items) {
    const normalized = await normalizeImageForPdf(item);
    const embeddedImage =
      normalized.format === "image/jpeg" ? await pdf.embedJpg(normalized.bytes) : await pdf.embedPng(normalized.bytes);
    const [pageWidth, pageHeight] = getPageSize(options.pageSize, normalized.width, normalized.height, margin);
    const page = pdf.addPage([pageWidth, pageHeight]);
    const drawBox = getDrawBox(pageWidth, pageHeight, normalized.width, normalized.height, options.fitMode, margin);

    page.drawImage(embeddedImage, {
      x: drawBox.x,
      y: drawBox.y,
      width: drawBox.width,
      height: drawBox.height,
    });
  }

  return await pdf.save();
}
