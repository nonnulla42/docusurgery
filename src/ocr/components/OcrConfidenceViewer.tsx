// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';

const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const JSPDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

const DICTIONARY = {
  eng: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it', 'for', 'not', 'on', 'with', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'],
  ita: ['il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'e', 'o', 'ma', 'se', 'che', 'chi', 'cui', 'dove', 'quando', 'come', 'quale', 'quanto', 'questo', 'quello', 'mio', 'tuo', 'suo', 'nostro', 'vostro', 'loro', 'essere', 'avere', 'fare', 'dire', 'potere', 'volere', 'sapere', 'stare', 'dovere', 'prendere', 'vedere', 'andare', 'venire', 'dare', 'parlare', 'trovare', 'sentire', 'lasciare', 'guardare', 'mettere', 'pensare', 'passare', 'credere', 'portare', 'parola', 'cosa', 'anno', 'uomo', 'giorno', 'volta', 'casa', 'parte', 'vita', 'tempo', 'donna', 'mano', 'occhio', 'ora', 'signore', 'paese', 'momento', 'modo', 'mondo', 'stato', 'caso', 'strada', 'figlio', 'notte', 'voce', 'nome', 'sera', 'acqua', 'amico', 'fatto', 'padre', 'madre', 'amore', 'storia', 'aria', 'forza', 'testa', 'mare'],
};

const LANGUAGES = [
  ['eng', 'English'],
  ['ita', 'Italian'],
  ['fra', 'French'],
  ['deu', 'German'],
  ['spa', 'Spanish'],
];

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') return resolve();
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      matrix[i][j] = b[i - 1] === a[j - 1] ? matrix[i - 1][j - 1] : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function getSuggestions(word: string, languages: string[]) {
  const dict = languages.flatMap((language) => DICTIONARY[language] ?? []);
  const source = dict.length ? dict : DICTIONARY.eng;
  const target = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!target) return [];
  return source
    .map((candidate) => ({ candidate, dist: levenshtein(target, candidate) }))
    .filter((entry) => entry.dist <= 2)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((entry) => entry.candidate);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function imageFromUrl(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function buildWordId(pageIndex: number, wordIndex: number) {
  return `p${pageIndex}-w${wordIndex}`;
}

export default function OcrConfidenceViewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const docRef = useRef<HTMLDivElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const pdfDocRef = useRef<any>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const [librariesReady, setLibrariesReady] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState(['eng', 'ita']);
  const [pageMode, setPageMode] = useState<'all' | 'range'>('all');
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('Drop a PDF or image here');
  const [uploadSubtextVisible, setUploadSubtextVisible] = useState(true);
  const [pageInfo, setPageInfo] = useState('No document loaded');
  const [fileType, setFileType] = useState<'pdf' | 'image' | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [results, setResults] = useState<Record<number, any>>({});
  const [pageUndoState, setPageUndoState] = useState<Record<number, number[]>>({});
  const [zoomLevel, setZoomLevel] = useState(1);
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');
  const [activeWordId, setActiveWordId] = useState('');
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tooltip, setTooltip] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadScript(TESSERACT_SRC), loadScript(PDFJS_SRC), loadScript(JSPDF_SRC)])
      .then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        if (mounted) setLibrariesReady(true);
      })
      .catch((error) => {
        if (mounted) setLibraryError(error instanceof Error ? error.message : 'Failed to load OCR libraries');
      });
    return () => {
      mounted = false;
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (docRef.current) docRef.current.style.transform = `scale(${zoomLevel})`;
  }, [zoomLevel]);

  useEffect(() => {
    const updateSize = () => {
      const source = fileType === 'pdf' ? canvasRef.current : imageRef.current;
      if (!source) return;
      setDisplaySize({
        width: source.clientWidth || source.width || source.naturalWidth || 0,
        height: source.clientHeight || source.height || source.naturalHeight || 0,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [fileType, currentPage, imageDataUrl, results]);

  const diagnostics = useMemo(() => {
    const pageStats: { idx: number; density: number }[] = [];
    let totalWords = 0;
    let lowConfCount = 0;
    let midConfCount = 0;
    let totalConfidence = 0;

    Object.entries(results).forEach(([pageKey, result]) => {
      let pageLow = 0;
      let pageTotal = 0;
      result.data.words.forEach((word: any, wordIndex: number) => {
        if (result.removedWords.has(wordIndex)) return;
        const locked = result.lockedWords.has(wordIndex);
        totalWords += 1;
        pageTotal += 1;
        totalConfidence += locked ? 100 : word.confidence;
        if (!locked) {
          if (word.confidence < 60) {
            lowConfCount += 1;
            pageLow += 1;
          } else if (word.confidence < 85) {
            midConfCount += 1;
          }
        }
      });
      pageStats.push({ idx: Number(pageKey), density: pageTotal ? pageLow / pageTotal : 0 });
    });

    return {
      totalWords,
      lowConfCount,
      midConfCount,
      overallAccuracy: totalWords ? Math.round(totalConfidence / totalWords) : 0,
      errorDensity: totalWords ? Math.round((lowConfCount / totalWords) * 100) : 0,
      pageStats,
    };
  }, [results]);

  const currentResult = results[currentPage];

  function getArtifactScore(word: any) {
    let score = 0;
    const text = String(word.text || '').trim();
    if (!text) return 0;
    const box = word.bbox;
    const height = box.y1 - box.y0;
    const width = box.x1 - box.x0;
    const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
    const alphaRatio = alphaCount / text.length;
    if (word.confidence < 20) score += 2;
    if (word.confidence < 10) score += 1;
    if (text.length > 2) score += 1;
    if (/^-+$/.test(text)) score += 4;
    if (/^_+$/.test(text)) score += 4;
    if (/^[|lI]{3,}$/.test(text)) score += 3;
    if (/^[~\-=]{3,}$/.test(text)) score += 3;
    if (/^[^a-zA-Z0-9]{2,}$/.test(text)) score += 2;
    if (text.length > 3 && !/[aeiouAEIOU]/.test(text) && alphaRatio < 0.5) score += 3;
    if (alphaRatio < 0.2 && text.length > 1) score += 2;
    if (width / Math.max(height, 1) > 12) score += 4;
    if (height < 5) score += 2;
    if (word.confidence < 30 && !selectedLanguages.some((language) => DICTIONARY[language]?.includes(text.toLowerCase()))) score += 2;
    return score;
  }

  function isArtifact(word: any) {
    return word.confidence < 20 && getArtifactScore(word) >= 5;
  }

  function isAutoCleanCandidate(word: any) {
    return isArtifact(word);
  }

  const visibleWords = useMemo(() => {
    if (!currentResult) return [];
    return currentResult.data.words.map((word: any, wordIndex: number) => {
      const wordId = buildWordId(currentPage, wordIndex);
      return {
        word,
        wordIndex,
        wordId,
        removed: currentResult.removedWords.has(wordIndex),
        locked: currentResult.lockedWords.has(wordIndex),
        correctedText: currentResult.corrections[wordIndex],
        artifact: isArtifact(word),
      };
    });
  }, [currentResult, currentPage, selectedLanguages]);

  function showFeedback(message: string) {
    setFeedbackMessage(message);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedbackMessage(''), 3000);
  }

  function updateResult(pageIndex: number, updater: (pageResult: any) => any) {
    setResults((currentResults) => {
      const currentPageResult = currentResults[pageIndex];
      if (!currentPageResult) return currentResults;
      return { ...currentResults, [pageIndex]: updater(currentPageResult) };
    });
  }

  async function renderPdfPage(pageIndex: number) {
    if (!pdfDocRef.current || !canvasRef.current) return;
    const page = await pdfDocRef.current.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    setCurrentPage(pageIndex);
    setDisplaySize({ width: canvas.clientWidth || canvas.width, height: canvas.clientHeight || canvas.height });
  }

  async function handleFile(file: File) {
    selectedFileRef.current = file;
    setUploadStatus(file.name);
    setUploadSubtextVisible(false);
    setResults({});
    setPageUndoState({});
    setActiveWordId('');
    setTooltip(null);
    setZoomLevel(1);
    setProgressValue(0);
    setStatusText('Ready to analyze.');
    setPageFrom(1);
    if (file.type === 'application/pdf') {
      const pdfDoc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      pdfDocRef.current = pdfDoc;
      setFileType('pdf');
      setTotalPages(pdfDoc.numPages);
      setPageTo(pdfDoc.numPages);
      setPageInfo(`PDF: ${pdfDoc.numPages} pages`);
      setImageDataUrl('');
      await renderPdfPage(0);
      return;
    }
    pdfDocRef.current = null;
    setFileType('image');
    setTotalPages(1);
    setPageTo(1);
    setCurrentPage(0);
    setPageInfo('Image (1 page)');
    setImageDataUrl(await fileToDataUrl(file));
  }

  async function runOcr() {
    if (!librariesReady || !selectedFileRef.current) return;
    if (selectedLanguages.length === 0) return window.alert('Please select at least one language.');
    const start = pageMode === 'range' ? Math.max(0, pageFrom - 1) : 0;
    const end = pageMode === 'range' ? Math.min(totalPages - 1, pageTo - 1) : totalPages - 1;
    if (end < start) return window.alert('The page range is invalid.');

    setProcessing(true);
    setProgressVisible(true);
    setStatusText('Preparing OCR worker...');
    setResults({});
    const worker = await window.Tesseract.createWorker(selectedLanguages.join('+'), 1, {
      logger: (message: any) => {
        if (message.status === 'recognizing text') setProgressValue(Math.round(message.progress * 100));
        else setStatusText(message.status);
      },
    });

    const nextResults: Record<number, any> = {};
    try {
      for (let pageIndex = start; pageIndex <= end; pageIndex += 1) {
        setStatusText(`Processing page ${pageIndex - start + 1} of ${end - start + 1}...`);
        let source: HTMLCanvasElement | HTMLImageElement;
        if (pdfDocRef.current) {
          const page = await pdfDocRef.current.getPage(pageIndex + 1);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          source = canvas;
        } else {
          source = await imageFromUrl(imageDataUrl);
        }
        const { data } = await worker.recognize(source);
        nextResults[pageIndex] = { data, image: source instanceof HTMLCanvasElement ? source.toDataURL('image/jpeg', 0.8) : source.src, removedWords: new Set(), lockedWords: new Set(), corrections: {} };
      }
    } finally {
      await worker.terminate();
      setProcessing(false);
      setProgressVisible(false);
    }

    setResults(nextResults);
    setCurrentPage(start);
    if (pdfDocRef.current) await renderPdfPage(start);
    setStatusText('OCR analysis complete.');
    showFeedback('OCR analysis complete.');
  }

  function cleanArtifacts(pageIndex: number | null = null) {
    const targetPages = pageIndex === null ? Object.keys(results).map(Number) : [pageIndex];
    let removedCount = 0;
    const nextResults: Record<number, any> = {};
    const undoPages: Record<number, number[]> = {};

    targetPages.forEach((targetPage) => {
      const pageResult = results[targetPage];
      if (!pageResult) return;
      const removedIndices: number[] = [];
      pageResult.data.words.forEach((word: any, wordIndex: number) => {
        if (isAutoCleanCandidate(word) && !pageResult.removedWords.has(wordIndex) && !pageResult.lockedWords.has(wordIndex)) removedIndices.push(wordIndex);
      });
      if (!removedIndices.length) return;
      const removedWords = new Set(pageResult.removedWords);
      removedIndices.forEach((wordIndex) => removedWords.add(wordIndex));
      nextResults[targetPage] = { ...pageResult, removedWords };
      undoPages[targetPage] = removedIndices;
      removedCount += removedIndices.length;
    });

    if (!removedCount) return window.alert('No new artifacts detected.');
    setResults((currentResults) => ({ ...currentResults, ...nextResults }));
    setPageUndoState((currentUndo) => ({ ...currentUndo, ...undoPages }));
    showFeedback(pageIndex === null ? `${removedCount} artifacts removed from the document` : `${removedCount} artifacts removed from this page`);
  }

  function undoCleanForCurrentPage() {
    const removedIndices = pageUndoState[currentPage];
    if (!removedIndices?.length) return;
    updateResult(currentPage, (pageResult) => {
      const removedWords = new Set(pageResult.removedWords);
      removedIndices.forEach((wordIndex) => removedWords.delete(wordIndex));
      return { ...pageResult, removedWords };
    });
    setPageUndoState((currentUndo) => {
      const nextUndo = { ...currentUndo };
      delete nextUndo[currentPage];
      return nextUndo;
    });
    showFeedback('Artifact removal undone for this page');
  }

  function openTooltip(event: React.MouseEvent, wordData: any) {
    event.stopPropagation();
    setActiveWordId(wordData.wordId);
    setTooltip({
      ...wordData,
      text: wordData.correctedText || wordData.word.text,
      suggestions: wordData.artifact ? [] : getSuggestions(wordData.correctedText || wordData.word.text, selectedLanguages),
    });
  }

  function closeTooltip() {
    setActiveWordId('');
    setTooltip(null);
  }

  function removeWord(wordIndex: number) {
    updateResult(currentPage, (pageResult) => {
      const removedWords = new Set(pageResult.removedWords);
      removedWords.add(wordIndex);
      return { ...pageResult, removedWords };
    });
    closeTooltip();
  }

  function restoreWord(wordIndex: number) {
    updateResult(currentPage, (pageResult) => {
      const removedWords = new Set(pageResult.removedWords);
      removedWords.delete(wordIndex);
      return { ...pageResult, removedWords };
    });
    closeTooltip();
  }

  function lockWord(wordIndex: number) {
    updateResult(currentPage, (pageResult) => {
      const lockedWords = new Set(pageResult.lockedWords);
      lockedWords.add(wordIndex);
      return { ...pageResult, lockedWords };
    });
    closeTooltip();
  }

  function unlockWord(wordIndex: number) {
    updateResult(currentPage, (pageResult) => {
      const lockedWords = new Set(pageResult.lockedWords);
      lockedWords.delete(wordIndex);
      return { ...pageResult, lockedWords };
    });
    closeTooltip();
  }

  function applySuggestion(wordIndex: number, text: string) {
    updateResult(currentPage, (pageResult) => ({
      ...pageResult,
      corrections: { ...pageResult.corrections, [wordIndex]: text },
    }));
    closeTooltip();
  }

  function buildPageText(pageIndex: number) {
    const pageResult = results[pageIndex];
    if (!pageResult) return '';
    return pageResult.data.words
      .map((word: any, wordIndex: number) => {
        if (pageResult.removedWords.has(wordIndex)) return null;
        return pageResult.corrections[wordIndex] || word.text;
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  async function exportPdf(annotated: boolean) {
    const pageIndexes = Object.keys(results).map(Number).sort((a, b) => a - b);
    if (!pageIndexes.length) return;
    setExporting(true);
    setProgressVisible(true);
    setStatusText(annotated ? 'Generating annotated PDF...' : 'Generating searchable PDF...');

    const { jsPDF } = window.jspdf;
    let doc: any = null;
    try {
      for (let pointer = 0; pointer < pageIndexes.length; pointer += 1) {
        const pageIndex = pageIndexes[pointer];
        const pageResult = results[pageIndex];
        const image = await imageFromUrl(pageResult.image);
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (pointer === 0) doc = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'pt', format: [width, height] });
        else doc.addPage([width, height], width > height ? 'l' : 'p');
        doc.addImage(image, 'JPEG', 0, 0, width, height);

        if (annotated) {
          const faded = new doc.GState({ opacity: 0.35 });
          const normal = new doc.GState({ opacity: 1 });
          pageResult.data.words.forEach((word: any, wordIndex: number) => {
            if (pageResult.removedWords.has(wordIndex) || pageResult.lockedWords.has(wordIndex) || word.confidence >= 85) return;
            doc.setGState(faded);
            doc.setFillColor(word.confidence < 60 ? 239 : 245, word.confidence < 60 ? 68 : 158, word.confidence < 60 ? 68 : 11);
            doc.rect(word.bbox.x0, word.bbox.y0, word.bbox.x1 - word.bbox.x0, word.bbox.y1 - word.bbox.y0, 'F');
            doc.setGState(normal);
          });
        }

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        pageResult.data.words.forEach((word: any, wordIndex: number) => {
          if (pageResult.removedWords.has(wordIndex)) return;
          const text = pageResult.corrections[wordIndex] || word.text;
          const boxWidth = word.bbox.x1 - word.bbox.x0;
          const boxHeight = word.bbox.y1 - word.bbox.y0;
          doc.setFontSize(boxHeight * 0.82);
          const textWidth = doc.getTextWidth(text);
          const charSpace = text.length > 1 && boxWidth > 0 ? (boxWidth - textWidth) / (text.length - 1) : 0;
          doc.text(text, word.bbox.x0, word.bbox.y1 - boxHeight * 0.18, { charSpace, renderingMode: 'invisible' });
        });
        setProgressValue(Math.round(((pointer + 1) / pageIndexes.length) * 100));
      }
      doc.save(annotated ? 'ocr_annotated_pro.pdf' : 'ocr_searchable_pro.pdf');
      showFeedback(`Download complete: ${annotated ? 'ocr_annotated_pro.pdf' : 'ocr_searchable_pro.pdf'}`);
    } finally {
      setExporting(false);
      setProgressVisible(false);
    }
  }

  async function exportText() {
    const pageIndexes = Object.keys(results).map(Number).sort((a, b) => a - b);
    if (!pageIndexes.length) return;
    if (window.confirm('Download as plain TXT? Click Cancel for text-only PDF.')) {
      const fullText = pageIndexes.map((pageIndex) => `--- Page ${pageIndex + 1} ---\n\n${buildPageText(pageIndex)}\n`).join('\n');
      triggerDownload(new Blob([fullText], { type: 'text/plain;charset=utf-8' }), 'extracted_text.txt');
      return showFeedback('Text exported as TXT');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pageIndexes.forEach((pageIndex, pointer) => {
      if (pointer > 0) doc.addPage();
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`Page ${pageIndex + 1}`, 20, 15);
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.text(doc.splitTextToSize(buildPageText(pageIndex), 170), 20, 30);
    });
    doc.save('extracted_text_clean.pdf');
    showFeedback('Text exported as PDF');
  }

  async function goToPage(pageIndex: number) {
    closeTooltip();
    if (fileType === 'pdf') await renderPdfPage(pageIndex);
    else setCurrentPage(pageIndex);
  }

  const hasResults = Object.keys(results).length > 0;
  const canRun = Boolean(selectedFileRef.current) && librariesReady && !processing;
  const canUndoCurrentPage = Boolean(pageUndoState[currentPage]?.length);
  const previewWidth = (fileType === 'pdf' ? canvasRef.current?.width : imageRef.current?.naturalWidth) || 1;
  const previewHeight = (fileType === 'pdf' ? canvasRef.current?.height : imageRef.current?.naturalHeight) || 1;
  const scaleX = displaySize.width / previewWidth || 1;
  const scaleY = displaySize.height / previewHeight || 1;

  return (
    <div className="tool-container" onClick={closeTooltip}>
      <header className="tool-header">
        <h2>Docusurgery Workbench</h2>
        <p className="subtitle">Precision diagnostic analysis and professional OCR export.</p>
      </header>

      <div className="top-controls">
        <label
          className={`upload-zone ${isDragging ? 'dragover' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={async (event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) await handleFile(file);
          }}
        >
          <h3>{uploadStatus}</h3>
          {uploadSubtextVisible ? <p>or click to select from your computer</p> : null}
          <p className="page-info">{pageInfo}</p>
          <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={async (event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
        </label>

        <div className="settings-panel">
          <div className="settings-group">
            <h4>Languages</h4>
            <div className="lang-grid">
              {LANGUAGES.map(([code, label]) => (
                <label key={code} className="lang-item">
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(code)}
                    onChange={() =>
                      setSelectedLanguages((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="settings-group">
            <h4>Page Range</h4>
            <div className="page-options">
              <label>
                <input type="radio" checked={pageMode === 'all'} onChange={() => setPageMode('all')} />
                All pages
              </label>
              <label>
                <input type="radio" checked={pageMode === 'range'} onChange={() => setPageMode('range')} />
                Custom range
              </label>
              <div className="range-inputs">
                <input type="number" min="1" max={Math.max(totalPages, 1)} value={pageFrom} onFocus={() => setPageMode('range')} onChange={(event) => setPageFrom(Number(event.target.value))} />
                <span>to</span>
                <input type="number" min="1" max={Math.max(totalPages, 1)} value={pageTo} onFocus={() => setPageMode('range')} onChange={(event) => setPageTo(Number(event.target.value))} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="action-bar">
        <button className="btn btn-primary" disabled={!canRun} onClick={runOcr}>Run OCR Analysis</button>
        <button className="btn btn-secondary btn-artifact" disabled={!hasResults || processing} onClick={() => cleanArtifacts()}>Clean All Artifacts</button>
        <button className="btn btn-secondary" disabled={!hasResults || exporting} onClick={() => exportPdf(false)}>Download Searchable PDF</button>
        <button className="btn btn-secondary" disabled={!hasResults || exporting} onClick={() => exportPdf(true)}>Download Annotated PDF</button>
      </div>

      {(progressVisible || libraryError) && (
        <div className="progress-wrap">
          {progressVisible ? (
            <>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressValue}%` }} /></div>
              <div className="status-text">{statusText}</div>
            </>
          ) : null}
          {libraryError ? <div className="status-text error-text">{libraryError}</div> : null}
        </div>
      )}

      {hasResults ? (
        <div className="diagnostics-panel">
          <div className="diag-header">
            <span>Document Diagnostics</span>
            <span className="overall-accuracy">Accuracy: {diagnostics.overallAccuracy}%</span>
          </div>
          <div className="diag-stats">
            <div className="stat-card"><span className="stat-label">Total Words</span><div className="stat-value">{diagnostics.totalWords}</div></div>
            <div className="stat-card"><span className="stat-label">Low Confidence</span><div className="stat-value low-value">{diagnostics.lowConfCount}</div></div>
            <div className="stat-card"><span className="stat-label">Uncertain</span><div className="stat-value mid-value">{diagnostics.midConfCount}</div></div>
            <div className="stat-card"><span className="stat-label">Error Density</span><div className="stat-value">{diagnostics.errorDensity}%</div></div>
          </div>
          <div className="diag-subtitle">Error density per page (click to jump)</div>
          <div className="page-strip">
            {diagnostics.pageStats.map((page) => (
              <button key={page.idx} className="page-bar" onClick={() => goToPage(page.idx)}>
                <div className="page-bar-num">{page.idx + 1}</div>
                <div className="page-bar-fill" style={{ height: `${page.density * 100}%`, background: page.density > 0.3 ? 'var(--low-conf)' : 'var(--accent)' }} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="legend legend-surface">
        <div className="legend-item"><span className="dot dot-good" />Good (&gt;=85%)</div>
        <div className="legend-item"><span className="dot dot-mid" />Uncertain (60-85%)</div>
        <div className="legend-item"><span className="dot dot-low" />Low (20-60%)</div>
        <div className="legend-item"><span className="dot dot-artifact" />Possible artifact (&lt;20%)</div>
      </div>

      <div className="review-layout">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header-left">
              <span>Document Preview</span>
              <div className="zoom-controls">
                <button className="zoom-btn" onClick={() => setZoomLevel((value) => Math.max(value - 0.1, 0.5))}>-</button>
                <span className="zoom-val">{Math.round(zoomLevel * 100)}%</span>
                <button className="zoom-btn" onClick={() => setZoomLevel((value) => Math.min(value + 0.1, 3))}>+</button>
                <button className="zoom-btn" onClick={() => setZoomLevel(1)}>Reset</button>
              </div>
            </div>
            <div className="page-nav" style={{ display: totalPages > 1 ? 'flex' : 'none' }}>
              <button onClick={() => goToPage(Math.max(currentPage - 1, 0))} disabled={currentPage === 0}>&lt;</button>
              <span>Page {currentPage + 1}</span>
              <button onClick={() => goToPage(Math.min(currentPage + 1, totalPages - 1))} disabled={currentPage >= totalPages - 1}>&gt;</button>
            </div>
          </div>

          <div
            className="viewport"
            onWheel={(event) => {
              if (!event.ctrlKey) return;
              event.preventDefault();
              const delta = event.deltaY > 0 ? -0.1 : 0.1;
              setZoomLevel((value) => Math.min(Math.max(value + delta, 0.5), 3));
            }}
          >
            <div className="doc-container" ref={docRef}>
              <canvas ref={canvasRef} className="preview-canvas" style={{ display: fileType === 'pdf' ? 'block' : 'none' }} />
              <img
                ref={imageRef}
                className="preview-img"
                src={imageDataUrl}
                style={{ display: fileType === 'image' && imageDataUrl ? 'block' : 'none' }}
                onLoad={(event) => setDisplaySize({ width: event.currentTarget.clientWidth || event.currentTarget.naturalWidth, height: event.currentTarget.clientHeight || event.currentTarget.naturalHeight })}
              />
              <div className="overlay">
                {visibleWords.map((entry) => {
                  const classes = ['word-box'];
                  if (entry.removed) classes.push('removed');
                  else if (entry.locked) classes.push('locked');
                  else if (entry.artifact) classes.push('artifact');
                  else if (entry.word.confidence < 60) classes.push('low');
                  else if (entry.word.confidence < 85) classes.push('mid');
                  if (activeWordId === entry.wordId) classes.push('active');

                  return (
                    <button
                      key={entry.wordId}
                      className={classes.join(' ')}
                      style={{
                        left: `${entry.word.bbox.x0 * scaleX}px`,
                        top: `${entry.word.bbox.y0 * scaleY}px`,
                        width: `${(entry.word.bbox.x1 - entry.word.bbox.x0) * scaleX}px`,
                        height: `${(entry.word.bbox.y1 - entry.word.bbox.y0) * scaleY}px`,
                      }}
                      onClick={(event) => openTooltip(event, entry)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Extracted Text</span>
            <div className="text-actions">
              <button className="btn btn-secondary mini-btn" disabled={!hasResults} onClick={exportText}>Download text</button>
              <button className="btn btn-secondary mini-btn" disabled={!canUndoCurrentPage} onClick={undoCleanForCurrentPage}>Undo last clean</button>
              <button className="btn btn-secondary mini-btn btn-artifact" disabled={!hasResults} onClick={() => cleanArtifacts(currentPage)}>Clean artifacts (this page)</button>
            </div>
          </div>

          <div className="output-area">
            {!hasResults ? (
              <div className="placeholder-text">{selectedFileRef.current ? 'Ready to analyze.' : 'Results will appear here.'}</div>
            ) : (
              visibleWords.map((entry) => {
                if (entry.removed) return null;
                const classes = ['word-text'];
                if (entry.locked) classes.push('locked-text');
                else if (entry.artifact) classes.push('artifact-text');
                else if (entry.word.confidence < 60) classes.push('low');
                else if (entry.word.confidence < 85) classes.push('mid');
                if (entry.correctedText) classes.push('corrected');
                if (activeWordId === entry.wordId) classes.push('active');
                return (
                  <span key={entry.wordId} className={classes.join(' ')} onClick={(event) => openTooltip(event, entry)}>
                    {entry.correctedText || entry.word.text}{' '}
                  </span>
                );
              })
            )}
          </div>

          <div className="inspector-panel" onClick={(event) => event.stopPropagation()}>
            {tooltip ? (
              <>
                <div className="tooltip-info inspector-info">
                  <strong>{tooltip.text}</strong>
                  <br />
                  <span>Confidence: {Math.round(tooltip.word.confidence)}%</span>
                </div>
                <div className="tooltip-title">Suggestions</div>
                <ul className="suggestion-list inspector-list">
                  {tooltip.artifact && !tooltip.locked ? <li className="tooltip-flag">Possible artifact detected</li> : null}
                  {!tooltip.artifact &&
                    (tooltip.suggestions.length ? (
                      tooltip.suggestions.map((suggestion: string) => (
                        <li key={suggestion} className="suggestion-item" onClick={() => applySuggestion(tooltip.wordIndex, suggestion)}>
                          {suggestion}
                        </li>
                      ))
                    ) : (
                      <li className="tooltip-muted">Likely correct. Highlighted due to low OCR confidence.</li>
                    ))}
                  <li><button className="btn btn-secondary tooltip-btn tooltip-danger" onClick={() => removeWord(tooltip.wordIndex)}>Remove from text layer</button></li>
                  <li><button className="btn btn-secondary tooltip-btn tooltip-success" onClick={() => lockWord(tooltip.wordIndex)}>Keep this word</button></li>
                </ul>
              </>
            ) : (
              <div className="inspector-empty">
                <strong>Word Inspector</strong>
                <p>Select a highlighted word to review suggestions or keep/remove it from the text layer.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {feedbackMessage ? <div className="feedback-toast">{feedbackMessage}</div> : null}
    </div>
  );
}
