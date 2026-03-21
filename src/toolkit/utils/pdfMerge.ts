import { PDFDocument } from "pdf-lib";

export async function readFileAsArrayBuffer(file: File) {
  return await file.arrayBuffer();
}

export async function getPdfPageCount(file: File) {
  const bytes = await readFileAsArrayBuffer(file);
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}

export async function mergePdfFiles(files: File[]) {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const bytes = await readFileAsArrayBuffer(file);
    const sourcePdf = await PDFDocument.load(bytes);
    const pageIndices = sourcePdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);

    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  return await mergedPdf.save();
}
