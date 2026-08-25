import hospitalCsv from './data/hospital_phrases.csv?raw';
import { extractChosung } from './chosung';
import { createChosungWord, HOSPITAL_SOURCE, type ChosungWord, type HospitalContext } from './models';

export const HOSPITAL_CSV_FIELDS = ['text', 'priority', 'category', 'context'] as const;

export class HospitalDictionaryError extends Error {
  constructor(detail: string) {
    super(`invalid hospital dictionary: ${detail}`);
    this.name = 'HospitalDictionaryError';
  }
}

export function loadHospitalPhrases(csvText: string = hospitalCsv): readonly ChosungWord[] {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (lines[0] !== HOSPITAL_CSV_FIELDS.join(',')) {
    throw new HospitalDictionaryError('CSV header must be text,priority,category,context');
  }

  const phrases: ChosungWord[] = [];
  const seenTexts = new Set<string>();

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const fields = line.split(',');
    if (fields.length !== 4) throw new HospitalDictionaryError(`row ${rowNumber} must have four fields`);
    const [rawText, rawPriority, category, context] = fields;
    if (!rawText || rawText !== rawText.trim() || rawText.includes('  ')) {
      throw new HospitalDictionaryError(`row ${rowNumber} text has invalid spacing`);
    }

    const text = rawText.normalize('NFC');
    if (seenTexts.has(text)) throw new HospitalDictionaryError(`row ${rowNumber} duplicates ${text}`);
    const priority = Number(rawPriority);
    if (!Number.isInteger(priority) || priority < 0 || String(priority) !== rawPriority) {
      throw new HospitalDictionaryError(`row ${rowNumber} priority must be a non-negative integer`);
    }

    try {
      phrases.push(createChosungWord({
        word: text,
        chosung: extractChosung(text),
        freq: 0,
        rank: phrases.length + 1,
        source: HOSPITAL_SOURCE,
        priority,
        category,
        context: context as HospitalContext,
      }));
    } catch (error) {
      throw new HospitalDictionaryError(`row ${rowNumber} ${error instanceof Error ? error.message : String(error)}`);
    }
    seenTexts.add(text);
  });

  return phrases;
}
