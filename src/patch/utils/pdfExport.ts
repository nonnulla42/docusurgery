import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type {
  PatchFontFamily,
  PatchObject,
  PatchSignatureObject,
  PatchTextObject,
} from "../types/patch";
import { hexToRgb } from "./colorSampling";

function dataUrlToUint8Array(dataUrl: string) {
  const [, base64Payload = ""] = dataUrl.split(",", 2);
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function mapFontFamily(fontFamily: PatchFontFamily) {
  if (fontFamily === "Times New Roman" || fontFamily === "Georgia") {
    return StandardFonts.TimesRoman;
  }

  return StandardFonts.Helvetica;
}

export async function exportPatchedPdf(
  file: File,
  patches: PatchObject[],
  textObjects: PatchTextObject[],
  signatureObjects: PatchSignatureObject[],
) {
  const source = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(source);
  const fontCache = new Map<StandardFonts, Awaited<ReturnType<typeof pdfDoc.embedFont>>>();
  const signatureCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();

  const getFont = async (fontFamily: PatchFontFamily) => {
    const standardFont = mapFontFamily(fontFamily);
    const cached = fontCache.get(standardFont);
    if (cached) {
      return cached;
    }

    const embeddedFont = await pdfDoc.embedFont(standardFont);
    fontCache.set(standardFont, embeddedFont);
    return embeddedFont;
  };

  const getSignatureImage = async (signature: PatchSignatureObject) => {
    const cached = signatureCache.get(signature.imageDataUrl);
    if (cached) {
      return cached;
    }

    const bytes = dataUrlToUint8Array(signature.imageDataUrl);
    const embeddedImage = await pdfDoc.embedPng(bytes);
    signatureCache.set(signature.imageDataUrl, embeddedImage);
    return embeddedImage;
  };

  for (const patch of patches) {
    const page = pdfDoc.getPage(patch.pageNumber - 1);
    if (!page) {
      continue;
    }

    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const x = patch.x * pageWidth;
    const width = patch.width * pageWidth;
    const height = patch.height * pageHeight;
    const y = pageHeight - (patch.y + patch.height) * pageHeight;
    const fill = patch.fill.rgb;

    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(fill.r / 255, fill.g / 255, fill.b / 255),
    });
  }

  for (const signature of signatureObjects) {
    const page = pdfDoc.getPage(signature.pageNumber - 1);
    if (!page) {
      continue;
    }

    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const x = signature.x * pageWidth;
    const width = signature.width * pageWidth;
    const height = signature.height * pageHeight;
    const y = pageHeight - (signature.y + signature.height) * pageHeight;
    const image = await getSignatureImage(signature);

    page.drawImage(image, {
      x,
      y,
      width,
      height,
      opacity: signature.opacity,
    });
  }

  for (const textObject of textObjects) {
    const page = pdfDoc.getPage(textObject.pageNumber - 1);
    if (!page || !textObject.text.trim()) {
      continue;
    }

    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const textColor = hexToRgb(textObject.textColor);
    const font = await getFont(textObject.fontFamily);
    const lines = textObject.text.replace(/\r/g, "").split("\n");
    const lineHeight = textObject.fontSize * 1.2;
    const anchorX = textObject.x * pageWidth;
    const topY = pageHeight - textObject.y * pageHeight;

    lines.forEach((line, index) => {
      const lineWidth = font.widthOfTextAtSize(line, textObject.fontSize);
      let textX = anchorX;

      if (textObject.alignment === "center") {
        textX = anchorX - lineWidth / 2;
      } else if (textObject.alignment === "right") {
        textX = anchorX - lineWidth;
      }

      const textY = topY - textObject.fontSize - index * lineHeight;
      if (textY < 0) {
        return;
      }

      page.drawText(line, {
        x: textX,
        y: textY,
        size: textObject.fontSize,
        font,
        color: rgb(textColor.r / 255, textColor.g / 255, textColor.b / 255),
      });
    });
  }

  return pdfDoc.save();
}
