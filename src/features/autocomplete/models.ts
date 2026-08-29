import { extractChosung, isSupportedChosungSequence } from './chosung';

export const WORD_SOURCE = 'wordfreq';
export const HOSPITAL_SOURCE = 'hospital';

export type ChosungWordSource = typeof WORD_SOURCE | typeof HOSPITAL_SOURCE;
export type HospitalContext = 'patient_staff' | 'patient_patient' | 'both';

export interface ChosungWord {
  readonly word: string;
  readonly chosung: string;
  readonly freq: number;
  readonly rank: number;
  readonly source: ChosungWordSource;
  readonly priority: number;
  readonly category: string | null;
  readonly context: HospitalContext | null;
}

interface ChosungWordInput {
  word: unknown;
  chosung: unknown;
  freq: unknown;
  rank: unknown;
  source?: ChosungWordSource;
  priority?: unknown;
  category?: unknown;
  context?: unknown;
}

const HOSPITAL_CONTEXTS = new Set<HospitalContext>(['patient_staff', 'patient_patient', 'both']);

function isPrecomposedHangul(char: string): boolean {
  return char >= '가' && char <= '힣';
}

export function createChosungWord(input: ChosungWordInput): ChosungWord {
  const source = input.source ?? WORD_SOURCE;
  const priority = input.priority ?? 0;

  if (source !== WORD_SOURCE && source !== HOSPITAL_SOURCE) {
    throw new Error(`unsupported source: ${String(source)}`);
  }

  if (typeof input.word !== 'string' || !input.word) throw new Error('word must be a non-empty string');
  if (input.word.normalize('NFC') !== input.word) throw new Error('word must be NFC-normalized');

  if (source === WORD_SOURCE) {
    if (![...input.word].every(isPrecomposedHangul)) {
      throw new Error('wordfreq word must contain only precomposed Hangul syllables');
    }
  } else if (
    input.word !== input.word.trim()
    || input.word.includes('  ')
    || ![...input.word].every((char) => char === ' ' || isPrecomposedHangul(char))
  ) {
    throw new Error('hospital text must contain precomposed Hangul and single spaces');
  }

  if (!isSupportedChosungSequence(input.chosung)) throw new Error('chosung contains an unsupported character');
  if (extractChosung(input.word) !== input.chosung) throw new Error('chosung does not match word');
  if (typeof input.freq !== 'number' || !Number.isFinite(input.freq) || input.freq < 0) {
    throw new Error('freq must be a finite non-negative number');
  }
  if (!Number.isInteger(input.rank) || (input.rank as number) <= 0) {
    throw new Error('rank must be a positive integer');
  }
  if (!Number.isInteger(priority) || (priority as number) < 0) {
    throw new Error('priority must be a non-negative integer');
  }

  let category: string | null = null;
  let context: HospitalContext | null = null;

  if (source === WORD_SOURCE) {
    if (input.category != null || input.context != null) {
      throw new Error('wordfreq candidates cannot have category or context');
    }
  } else {
    if (typeof input.category !== 'string' || !input.category) {
      throw new Error('hospital category must be a non-empty string');
    }
    if (typeof input.context !== 'string' || !HOSPITAL_CONTEXTS.has(input.context as HospitalContext)) {
      throw new Error('hospital context is unsupported');
    }
    category = input.category;
    context = input.context as HospitalContext;
  }

  return {
    word: input.word,
    chosung: input.chosung,
    freq: input.freq,
    rank: input.rank as number,
    source,
    priority: priority as number,
    category,
    context,
  };
}
