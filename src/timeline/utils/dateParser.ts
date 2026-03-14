import type { TimelineEntry } from "../types/timeline";
import { classifyDateContext, type DocLanguage } from "./dateContextClassifier";

const MONTHS: Record<string, number> = {
  // English
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // Italian
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  // French
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, octobre: 10, décembre: 12, decembre: 12,
  // German
  januar: 1, februar: 2, märz: 3, maerz: 3, juni: 6, juli: 7, dezember: 12,
  // Spanish
  enero: 1, febrero: 2, mayo: 5, junio: 6, julio: 7, septiembre: 9, setiembre: 9, diciembre: 12,
};

const monthNamesRegex = Object.keys(MONTHS).join('|');

// Regex patterns
const patterns = [
  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  {
    regex: new RegExp(`(\\b\\d{1,2})[\\/\\-\\.](\\d{1,2})[\\/\\-\\.](\\d{4})\\b`, 'g'),
    parse: (match: string[]) => {
      const d = parseInt(match[1]);
      const m = parseInt(match[2]);
      const y = parseInt(match[3]);
      // European preference: DD/MM/YYYY
      if (m > 12 && d <= 12) return `${y}-${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}`;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  },
  // YYYY-MM-DD
  {
    regex: /(\b\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g,
    parse: (match: string[]) => `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`
  },
  // 16 aprile 2010, 16 April 2010
  {
    regex: new RegExp(`(\\b\\d{1,2})\\s+(${monthNamesRegex})\\s+(\\d{4})\\b`, 'gi'),
    parse: (match: string[]) => {
      const d = parseInt(match[1]);
      const m = MONTHS[match[2].toLowerCase()];
      const y = parseInt(match[3]);
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  },
  // April 16, 2010
  {
    regex: new RegExp(`(${monthNamesRegex})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi'),
    parse: (match: string[]) => {
      const m = MONTHS[match[1].toLowerCase()];
      const d = parseInt(match[2]);
      const y = parseInt(match[3]);
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
];

export function extractDatesFromText(text: string, pageNumber: number, language: DocLanguage = 'auto'): TimelineEntry[] {
  if (!text) return [];
  const entries: TimelineEntry[] = [];
  const lines = text.split('\n');

  if (lines) {
    lines.forEach((line, lineIdx) => {
      if (patterns) {
        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.regex.exec(line)) !== null) {
            const normalized = pattern.parse(match);
            const snippetStart = Math.max(0, match.index - 80);
            const snippetEnd = Math.min(line.length, match.index + match[0].length + 80);
            const snippet = line.substring(snippetStart, snippetEnd).trim();

            // Narrow context for classification (approx 40 chars around the date)
            const contextStart = Math.max(0, match.index - 40);
            const contextEnd = Math.min(line.length, match.index + match[0].length + 40);
            const classificationContext = line.substring(contextStart, contextEnd);

            entries.push({
              id: `local-${pageNumber}-${lineIdx}-${match.index}`,
              normalizedDate: normalized,
              originalDate: match[0],
              snippet: snippet,
              pageNumber: pageNumber,
              confidence: 1.0,
              category: classifyDateContext(classificationContext, language)
            });
          }
          // Reset regex index
          pattern.regex.lastIndex = 0;
        });
      }
    });
  }

  return entries;
}

export function deduplicateEntries(entries: TimelineEntry[]): TimelineEntry[] {
  if (!entries) return [];
  const groups: Record<string, TimelineEntry> = {};

  entries.forEach(entry => {
    // Create a key based on date, page, and a normalized snippet
    // We want to be more conservative: only merge if date, page AND snippet are very similar
    const snippetKey = entry.snippet.toLowerCase().replace(/\s+/g, '').substring(0, 100);
    const key = `${entry.normalizedDate}-${entry.pageNumber}-${snippetKey}`;

    if (groups[key]) {
      groups[key].occurrences = (groups[key].occurrences || 1) + 1;
    } else {
      groups[key] = { ...entry, occurrences: 1 };
    }
  });

  return Object.values(groups);
}

export interface DateGroup {
  date: string;
  entries: TimelineEntry[];
}

export function groupEntriesByDate(entries: TimelineEntry[]): DateGroup[] {
  if (!entries) return [];
  const groups: Record<string, TimelineEntry[]> = {};
  
  entries.forEach(entry => {
    if (!groups[entry.normalizedDate]) {
      groups[entry.normalizedDate] = [];
    }
    groups[entry.normalizedDate].push(entry);
  });

  return Object.entries(groups).map(([date, entries]) => ({
    date,
    entries: entries.sort((a, b) => a.pageNumber - b.pageNumber)
  }));
}
