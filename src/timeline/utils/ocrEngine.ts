import type { TimelineEntry } from '../types/timeline';

export interface OcrLine {
  text: string;
  bbox: {
    y0: number;
    y1: number;
    x0: number;
    x1: number;
  };
}

export interface OcrResult {
  lines: OcrLine[];
  width: number;
  height: number;
}

export interface HighlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const normalizeText = (text: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    // Normalize units
    .replace(/m[²2]|mq/g, "mq")
    // Normalize currency variants (Euro 40,49 -> 40.49)
    .replace(/euro\s*/g, "")
    .replace(/(\d+),(\d{2})/g, "$1.$2")
    // Standard normalization
    .replace(/[''""'"]/g, "'")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const getDateVariants = (originalDate: string, normalizedDate: string): string[] => {
  const variants = new Set<string>();
  if (originalDate) variants.add(normalizeText(originalDate));
  
  const dateParts = normalizedDate.split('-');
  if (dateParts.length === 3) {
    const y = dateParts[0];
    const m = parseInt(dateParts[1]);
    const d = parseInt(dateParts[2]);
    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    
    // Add variants with different separators
    ['/', '-', '.'].forEach(s => {
      variants.add(normalizeText(`${dd}${s}${mm}${s}${y}`));
      variants.add(normalizeText(`${d}${s}${m}${s}${y}`));
    });
  }
  return Array.from(variants);
};

export const findBestMatch = (
  ocrData: OcrResult,
  entry: TimelineEntry
): { lines: OcrLine[], score: number } | null => {
  const dateVariants = getDateVariants(entry.originalDate, entry.normalizedDate);
  const lines = ocrData.lines || [];
  
  // 1. Try Date-First Matching
  const dateMatches: OcrLine[] = [];
  lines.forEach(line => {
    const lineNorm = normalizeText(line.text);
    if (dateVariants.some(v => lineNorm.includes(v))) {
      dateMatches.push(line);
    }
  });

  if (dateMatches.length === 1) {
    return { lines: [dateMatches[0]], score: 1000 }; // High score for unique date match
  } else if (dateMatches.length > 1) {
    // Multiple dates - Disambiguate using secondary signals
    const snippetNorm = normalizeText(entry.snippet);
    const secondaryTokens = snippetNorm.split(' ').filter(t => t.length > 3);
    
    let topSecondaryScore = -1;
    let bestMatch: OcrLine | null = null;

    dateMatches.forEach(match => {
      const matchNorm = normalizeText(match.text);
      let score = 0;
      secondaryTokens.forEach(token => {
        if (matchNorm.includes(token)) score++;
      });
      
      if (score > topSecondaryScore) {
        topSecondaryScore = score;
        bestMatch = match;
      }
    });

    if (bestMatch) return { lines: [bestMatch], score: 500 + topSecondaryScore };
  }

  // 2. Fallback to Weighted Block Scoring
  const getSearchTokens = (e: TimelineEntry) => {
    const tokens: { text: string; weight: number; type: string }[] = [];
    dateVariants.forEach(v => tokens.push({ text: v, weight: 100, type: 'date' }));

    const codeRegex = /[A-Z]{1,4}\d{4,12}|\d{4}[\/\-]\d{4,8}/g;
    const codes = e.snippet.match(codeRegex) || [];
    codes.forEach(code => tokens.push({ text: normalizeText(code), weight: 150, type: 'code' }));

    const words = e.snippet.split(/\s+/);
    words.forEach(word => {
      const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      if (cleanWord.length > 4) {
        const isUppercase = cleanWord === cleanWord.toUpperCase() && /[A-Z]/.test(cleanWord);
        tokens.push({ text: normalizeText(cleanWord), weight: isUppercase ? 70 : 40, type: 'keyword' });
      }
    });

    return tokens;
  };

  const tokens = getSearchTokens(entry);
  let maxScore = 0;
  let bestBlock: OcrLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    for (let blockSize = 1; blockSize <= 3; blockSize++) {
      if (i + blockSize > lines.length) break;
      const blockLines = lines.slice(i, i + blockSize);
      const blockText = blockLines.map(l => normalizeText(l.text)).join(' ');
      let score = 0;
      tokens.forEach(t => { if (blockText.includes(t.text)) score += t.weight; });
      if (score > maxScore) {
        maxScore = score;
        bestBlock = blockLines;
      }
    }
  }

  if (maxScore >= 150) {
    return { lines: bestBlock, score: maxScore };
  }

  return null;
};

export const calculateHighlightRect = (
  matchLines: OcrLine[],
  containerWidth: number,
  scale: number
): HighlightRect => {
  const firstLine = matchLines[0];
  const lastLine = matchLines[matchLines.length - 1];
  
  const top = firstLine.bbox.y0 * scale;
  const bottom = lastLine.bbox.y1 * scale;
  
  return {
    x: containerWidth * 0.01,
    y: top - 4,
    w: containerWidth * 0.98,
    h: (bottom - top) + 8
  };
};
