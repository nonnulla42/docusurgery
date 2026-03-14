import type { DateCategory } from "../types/timeline";

export type DocLanguage = 'auto' | 'en' | 'it' | 'fr' | 'de' | 'es';

const birthKeywords: Record<string, string[]> = {
  it: ["nato", "nata", "nascita", "data di nascita"],
  en: ["born", "date of birth", "birth date"],
  fr: ["né", "née", "date de naissance", "naissance"],
  de: ["geboren", "geburtsdatum", "geburt"],
  es: ["nacido", "nacida", "fecha de nacimiento", "nacimiento"]
};

const legalKeywords: Record<string, string[]> = {
  it: ["legge", "dpr", "d.lgs", "decreto", "art.", "comma", "ai sensi", "sentenza", "tribunale"],
  en: ["law", "act", "decree", "article", "section", "pursuant", "court", "judgment"],
  fr: ["loi", "décret", "article", "section", "tribunal", "jugement"],
  de: ["gesetz", "verordnung", "artikel", "absatz", "gericht", "urteil"],
  es: ["ley", "decreto", "artículo", "sección", "tribunal", "sentencia"]
};

export function classifyDateContext(snippet: string, language: DocLanguage = 'auto'): DateCategory {
  const text = snippet.toLowerCase();
  // The date is roughly in the middle of the provided snippet
  const center = Math.floor(text.length / 2);
  
  const languagesToCheck: string[] = language === 'auto' 
    ? ['en', 'it', 'fr', 'de', 'es'] 
    : [language];

  let bestCategory: DateCategory = 'generic';
  let minDistance = Infinity;

  // Check for birth keywords
  for (const lang of languagesToCheck) {
    const keywords = birthKeywords[lang];
    if (keywords) {
      for (const keyword of keywords) {
        let index = text.indexOf(keyword);
        while (index !== -1) {
          // Calculate distance from the middle of the keyword to the center of the snippet
          const distance = Math.abs(index + Math.floor(keyword.length / 2) - center);
          if (distance < minDistance) {
            minDistance = distance;
            bestCategory = 'birth';
          }
          index = text.indexOf(keyword, index + 1);
        }
      }
    }
  }

  // Check for legal keywords
  for (const lang of languagesToCheck) {
    const keywords = legalKeywords[lang];
    if (keywords) {
      for (const keyword of keywords) {
        let index = text.indexOf(keyword);
        while (index !== -1) {
          const distance = Math.abs(index + Math.floor(keyword.length / 2) - center);
          if (distance < minDistance) {
            minDistance = distance;
            bestCategory = 'legal_reference';
          }
          index = text.indexOf(keyword, index + 1);
        }
      }
    }
  }

  return bestCategory;
}
