import { degrees, PDFDocument } from "pdf-lib";
import type { RotatePageItem } from "../types/toolkit";

function normalizeRotation(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function stepRotation(currentRotation: number, delta: number) {
  return normalizeRotation(currentRotation + delta);
}

async function loadEditablePdf(bytes: ArrayBuffer) {
  return await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });
}

export async function loadPdfRotationModel(file: File) {
  const bytes = await file.arrayBuffer();
  const pdf = await loadEditablePdf(bytes);

  const pages: RotatePageItem[] = pdf.getPages().map((page, index) => {
    const originalRotation = normalizeRotation(page.getRotation().angle);

    return {
      id: `rotate-page-${index + 1}`,
      pageNumber: index + 1,
      originalRotation,
      rotation: originalRotation,
    };
  });

  return { pageCount: pdf.getPageCount(), pages };
}

export async function exportRotatedPdf(file: File, pages: RotatePageItem[]) {
  const bytes = await file.arrayBuffer();
  const pdf = await loadEditablePdf(bytes);
  const sourcePages = pdf.getPages();

  pages.forEach((page, index) => {
    sourcePages[index].setRotation(degrees(page.rotation));
  });

  return await pdf.save();
}
