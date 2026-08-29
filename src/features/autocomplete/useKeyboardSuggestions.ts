import { useCallback, useMemo } from 'react';
import { usePhrases } from '../phrase/hooks/usePhrases';
import {
  fillSuggestionSlots,
  resolveSuggestionSlots,
  resolveSuggestionTarget,
  type SuggestionSlots,
} from './inputState';

interface UseKeyboardSuggestionsOptions {
  enabled: boolean;
  draftText: string;
  pendingWordBoundary: boolean;
  onKeySelect: (keyValue: string) => void;
  onSuggestionSelect?: (suggestion: string) => void;
}

interface UseKeyboardSuggestionsResult {
  slots: SuggestionSlots;
  handleTargetSelect: (keyValue: string) => void;
  suggestionSignature: string;
}

export function useKeyboardSuggestions({
  enabled,
  draftText,
  pendingWordBoundary,
  onKeySelect,
  onSuggestionSelect,
}: UseKeyboardSuggestionsOptions): UseKeyboardSuggestionsResult {
  const { phrases, isLoading, hasError } = usePhrases(enabled);
  const favoriteSentences = useMemo(
    () => isLoading || hasError ? [] : phrases.map((phrase) => phrase.text),
    [hasError, isLoading, phrases],
  );

  const slots = useMemo(
    () => enabled
      ? resolveSuggestionSlots(draftText, favoriteSentences, pendingWordBoundary)
      : fillSuggestionSlots([]),
    [draftText, enabled, favoriteSentences, pendingWordBoundary],
  );

  const handleTargetSelect = useCallback((keyValue: string) => {
    if (!keyValue.startsWith('suggestion_')) {
      onKeySelect(keyValue);
      return;
    }

    const suggestion = resolveSuggestionTarget(keyValue, slots);
    if (suggestion) onSuggestionSelect?.(suggestion);
  }, [onKeySelect, onSuggestionSelect, slots]);

  return {
    slots,
    handleTargetSelect,
    suggestionSignature: slots.join('\u001f'),
  };
}
