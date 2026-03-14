import { pdfjsLib } from '../utils/pdfWorker';
import { createWorker } from 'tesseract.js';
import type { ExtractionResult, TimelineEntry } from '../types/timeline';
import { extractDatesFromText, deduplicateEntries } from '../utils/dateParser';
import type { DocLanguage } from '../utils/dateContextClassifier';

export async function extractTimelineLocally(
  file: File,
  startPage?: number,
  endPage?: number,
  language: DocLanguage = 'auto'
): Promise<ExtractionResult> {
  const allEntries: TimelineEntry[] = [];

  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const start = startPage || 1;
    const end = endPage || pdf.numPages;

    for (let i = start; i <= end; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = (textContent.items || []).map((item: any) => item.str).join(' ');
      
      let pageEntries = extractDatesFromText(text, i, language);
      
      // If no text found, try OCR on this page
      if (pageEntries.length === 0) {
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport, canvas: canvas }).promise;
          const imageData = canvas.toDataURL('image/png');
          const ocrText = await performOCR(imageData);
          pageEntries = extractDatesFromText(ocrText, i, language);
        }
      }
      
      allEntries.push(...pageEntries);
    }
  } else if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    const dataUrlPromise = new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
    });
    reader.readAsDataURL(file);
    const dataUrl = await dataUrlPromise;
    
    const ocrText = await performOCR(dataUrl);
    allEntries.push(...extractDatesFromText(ocrText, 1, language));
  }

  const finalEntries = deduplicateEntries(allEntries);
  return {
    entries: finalEntries,
    totalFound: finalEntries.length
  };
}

async function performOCR(imageSource: string): Promise<string> {
  const worker = await createWorker('eng+ita+fra+deu+spa');
  const { data: { text } } = await worker.recognize(imageSource);
  await worker.terminate();
  return text;
}
