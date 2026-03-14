export type DateCategory = 'birth' | 'legal_reference' | 'generic';

export interface TimelineEntry {
  id: string;
  normalizedDate: string; // YYYY-MM-DD
  originalDate: string;
  snippet: string;
  pageNumber: number;
  confidence: number;
  category: DateCategory;
  occurrences?: number;
}

export interface ExtractionResult {
  entries: TimelineEntry[];
  totalFound: number;
}
