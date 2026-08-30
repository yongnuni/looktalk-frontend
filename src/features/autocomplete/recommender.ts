import { loadHospitalPhrases } from './hospital';
import type { ChosungWord } from './models';
import { ChosungTrie, loadChosungWords } from './trie';

export const PUBLIC_SUGGESTION_LIMIT = 3;

export class SuggestionEngine {
  readonly trie: ChosungTrie | null;
  readonly initializationMs: number;
  readonly wordfreqCount: number;
  readonly hospitalCount: number;
  readonly errorMessage: string | null;

  constructor(
    trie: ChosungTrie | null,
    initializationMs: number,
    wordfreqCount = 0,
    hospitalCount = 0,
    errorMessage: string | null = null,
  ) {
    this.trie = trie;
    this.initializationMs = initializationMs;
    this.wordfreqCount = wordfreqCount;
    this.hospitalCount = hospitalCount;
    this.errorMessage = errorMessage;
  }

  get available(): boolean {
    return this.trie !== null;
  }

  getSuggestions(chosungInput: unknown, limit = PUBLIC_SUGGESTION_LIMIT): string[] {
    if (!this.trie || !Number.isInteger(limit) || limit <= 0) return [];
    return this.trie
      .query(chosungInput, Math.min(limit, PUBLIC_SUGGESTION_LIMIT))
      .map((candidate) => candidate.word);
  }
}

export function buildRecommender(
  wordfreqWords: readonly ChosungWord[] = loadChosungWords(),
  hospitalPhrases: readonly ChosungWord[] = loadHospitalPhrases(),
): SuggestionEngine {
  const startedAt = performance.now();
  const trie = ChosungTrie.fromWords([...wordfreqWords, ...hospitalPhrases]);
  return new SuggestionEngine(
    trie,
    performance.now() - startedAt,
    wordfreqWords.length,
    hospitalPhrases.length,
  );
}

function createDefaultEngine(): SuggestionEngine {
  const startedAt = performance.now();
  try {
    const engine = buildRecommender();
    return new SuggestionEngine(
      engine.trie,
      performance.now() - startedAt,
      engine.wordfreqCount,
      engine.hospitalCount,
    );
  } catch (error) {
    return new SuggestionEngine(
      null,
      performance.now() - startedAt,
      0,
      0,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Python main.py의 initialize_recommender()처럼 모듈 수명 동안 정확히 한 번 구축해 재사용한다.
const DEFAULT_ENGINE = createDefaultEngine();

export function initializeRecommender(): SuggestionEngine {
  return DEFAULT_ENGINE;
}

export function getSuggestions(chosungInput: unknown, limit = PUBLIC_SUGGESTION_LIMIT): string[] {
  return DEFAULT_ENGINE.getSuggestions(chosungInput, limit);
}
