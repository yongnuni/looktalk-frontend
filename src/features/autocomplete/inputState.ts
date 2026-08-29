import { extractChosung } from './chosung';
import { getSuggestions } from './recommender';

export const FAVORITES_MODE = 'favorites';
export const AUTOCOMPLETE_MODE = 'autocomplete';
export const SUGGESTION_SLOT_COUNT = 3;
export const SUGGESTION_KEY_PREFIX = 'suggestion_';

export type SuggestionMode = typeof FAVORITES_MODE | typeof AUTOCOMPLETE_MODE;
export type SuggestionSlots = readonly [string, string, string];
export type SuggestionProvider = (chosungInput: string, limit: number) => string[];

export interface SuggestionUpdate {
  readonly mode: SuggestionMode;
  readonly chosungInput: string;
  readonly items: readonly string[];
  readonly slots: SuggestionSlots;
  readonly elapsedMs: number;
}

export function normalizeFavorites(sentences: readonly unknown[]): string[] {
  return sentences
    .filter((sentence): sentence is string => typeof sentence === 'string' && sentence.length > 0)
    .slice(0, SUGGESTION_SLOT_COUNT);
}

export function fillSuggestionSlots(items: readonly string[]): SuggestionSlots {
  return [items[0] ?? '', items[1] ?? '', items[2] ?? ''];
}

export function suggestionKeyId(index: number): string {
  return `${SUGGESTION_KEY_PREFIX}${index + 1}`;
}

export function suggestionIndexFromKey(keyValue: string): number | null {
  const match = /^suggestion_([1-3])$/.exec(keyValue);
  return match ? Number(match[1]) - 1 : null;
}

export function resolveSuggestionTarget(keyValue: string, slots: SuggestionSlots): string | null {
  const index = suggestionIndexFromKey(keyValue);
  if (index === null) return null;
  return slots[index] || null;
}

export function currentWord(currentText: unknown): string {
  if (typeof currentText !== 'string' || !currentText || currentText.endsWith(' ')) return '';
  return currentText.slice(currentText.lastIndexOf(' ') + 1);
}

export function resolveSuggestionSlots(
  currentText: string,
  favoriteSentences: readonly unknown[] = [],
  pendingWordBoundary = false,
  suggestionProvider: SuggestionProvider = getSuggestions,
): SuggestionSlots {
  if (pendingWordBoundary) return fillSuggestionSlots([]);
  if (!currentText) return fillSuggestionSlots(normalizeFavorites(favoriteSentences));

  const chosungInput = extractChosung(currentWord(currentText));
  if (!chosungInput) return fillSuggestionSlots([]);
  return fillSuggestionSlots(suggestionProvider(chosungInput, SUGGESTION_SLOT_COUNT));
}

/** Python SuggestionStateController의 갱신/선택 후 억제 계약을 그대로 보존한 상태 객체. */
export class SuggestionStateController {
  readonly favoriteSentences: readonly string[];
  autocompleteSuggestions: readonly string[] = [];
  mode: SuggestionMode = FAVORITES_MODE;
  slots: SuggestionSlots;
  lastCurrentText: string | null = null;
  currentChosung = '';
  lastLookupMs = 0;
  private readonly suggestionProvider: SuggestionProvider;

  constructor(
    favoriteSentences: readonly unknown[] = [],
    suggestionProvider: SuggestionProvider = getSuggestions,
  ) {
    this.favoriteSentences = normalizeFavorites(favoriteSentences);
    this.suggestionProvider = suggestionProvider;
    this.slots = fillSuggestionSlots(this.favoriteSentences);
  }

  get visibleItems(): readonly string[] {
    return this.mode === FAVORITES_MODE ? this.favoriteSentences : this.autocompleteSuggestions;
  }

  clearAfterSelection(currentText: unknown): void {
    const normalizedText = typeof currentText === 'string' ? currentText : '';
    this.lastCurrentText = normalizedText;
    this.mode = normalizedText ? AUTOCOMPLETE_MODE : FAVORITES_MODE;
    this.currentChosung = normalizedText ? extractChosung(currentWord(normalizedText)) : '';
    this.autocompleteSuggestions = [];
    this.lastLookupMs = 0;
    this.slots = fillSuggestionSlots([]);
  }

  update(currentText: unknown): SuggestionUpdate | null {
    const normalizedText = typeof currentText === 'string' ? currentText : '';
    if (this.lastCurrentText === normalizedText) return null;

    const firstUpdate = this.lastCurrentText === null;
    const previousMode = this.mode;
    const previousSlots = this.slots;
    this.lastCurrentText = normalizedText;

    if (!normalizedText) {
      this.mode = FAVORITES_MODE;
      this.currentChosung = '';
      this.autocompleteSuggestions = [];
      this.lastLookupMs = 0;
      this.slots = fillSuggestionSlots(this.favoriteSentences);
    } else {
      this.mode = AUTOCOMPLETE_MODE;
      this.currentChosung = extractChosung(currentWord(normalizedText));
      this.autocompleteSuggestions = [];
      this.lastLookupMs = 0;
      if (this.currentChosung) {
        const startedAt = performance.now();
        this.autocompleteSuggestions = this.suggestionProvider(
          this.currentChosung,
          SUGGESTION_SLOT_COUNT,
        ).filter((item) => typeof item === 'string' && item.length > 0).slice(0, SUGGESTION_SLOT_COUNT);
        this.lastLookupMs = performance.now() - startedAt;
      }
      this.slots = fillSuggestionSlots(this.autocompleteSuggestions);
    }

    if (!firstUpdate && this.mode === previousMode && this.slots.every((slot, index) => slot === previousSlots[index])) {
      return null;
    }

    return {
      mode: this.mode,
      chosungInput: this.currentChosung,
      items: this.visibleItems,
      slots: this.slots,
      elapsedMs: this.lastLookupMs,
    };
  }
}
