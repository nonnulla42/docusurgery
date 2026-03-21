import { PDFDocument } from "pdf-lib";
import type { SplitPageItem } from "../types/toolkit";

function normalizeRotation(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

async function loadEditablePdf(bytes: ArrayBuffer) {
  return await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });
}

export async function loadPdfSplitModel(file: File) {
  const bytes = await file.arrayBuffer();
  const pdf = await loadEditablePdf(bytes);

  const pages: SplitPageItem[] = pdf.getPages().map((page, index) => ({
    id: `split-page-${index + 1}`,
    pageNumber: index + 1,
    originalRotation: normalizeRotation(page.getRotation().angle),
    selected: true,
  }));

  return { pageCount: pdf.getPageCount(), pages };
}

export function parsePageRange(input: string, pageCount: number) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Enter at least one page number or range.");
  }

  const selectedPages = new Set<number>();
  const segments = trimmed.split(",");

  for (const rawSegment of segments) {
    const segment = rawSegment.trim();

    if (!segment) {
      throw new Error("Remove empty entries from the page range.");
    }

    const rangeMatch = segment.match(/^(\d+)\s*-\s*(\d+)$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
        throw new Error(`Page ranges must stay between 1 and ${pageCount}.`);
      }

      if (start > end) {
        throw new Error("Range starts must be lower than or equal to range ends.");
      }

      for (let page = start; page <= end; page += 1) {
        selectedPages.add(page);
      }

      continue;
    }

    if (!/^\d+$/.test(segment)) {
      throw new Error('Use formats like "1-3,5,8-10".');
    }

    const pageNumber = Number(segment);

    if (pageNumber < 1 || pageNumber > pageCount) {
      throw new Error(`Page numbers must stay between 1 and ${pageCount}.`);
    }

    selectedPages.add(pageNumber);
  }

  if (selectedPages.size === 0) {
    throw new Error("Select at least one page.");
  }

  return selectedPages;
}

export async function exportSelectedPagesPdf(file: File, pages: SplitPageItem[]) {
  const selectedIndices = pages.filter((page) => page.selected).map((page) => page.pageNumber - 1);

  if (selectedIndices.length === 0) {
    throw new Error("Select at least one page before exporting.");
  }

  const bytes = await file.arrayBuffer();
  const sourcePdf = await loadEditablePdf(bytes);
  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(sourcePdf, selectedIndices);

  copiedPages.forEach((page) => {
    outputPdf.addPage(page);
  });

  return await outputPdf.save();
}
