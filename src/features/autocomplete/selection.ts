import { HangulComposer } from '../keyboard/composition/HangulComposer';
import { processKey, type KeyboardState, type ProcessKeyResult } from '../keyboard/keyboardStateMachine';
import {
  FUNCTION_KEY_CONFIRM,
  FUNCTION_KEY_DEL,
  FUNCTION_KEY_LANGUAGE,
  FUNCTION_KEY_SHIFT,
  FUNCTION_KEY_SPACE,
} from '../keyboard/layouts/qwertyLayouts';

export interface SuggestionApplication {
  readonly text: string;
  readonly deletedCount: number;
  readonly insertedText: string;
}

export function diffTail(before: string, after: string): Omit<SuggestionApplication, 'text'> {
  let commonLength = 0;
  const maxCommon = Math.min(before.length, after.length);
  while (commonLength < maxCommon && before[commonLength] === after[commonLength]) commonLength += 1;
  return {
    deletedCount: before.length - commonLength,
    insertedText: after.slice(commonLength),
  };
}

/** Python src.keyboard.apply_suggestion(): 화면의 마지막 입력 단위만 후보로 치환한다. */
export function applySuggestion(composer: HangulComposer, suggestion: unknown): SuggestionApplication | null {
  if (typeof suggestion !== 'string' || !suggestion) return null;

  const compositeBefore = composer.getComposedText();
  const lastSpaceIndex = compositeBefore.lastIndexOf(' ');
  const compositeAfter = compositeBefore.slice(0, lastSpaceIndex + 1) + suggestion;

  composer.reset();
  composer.setFinalText(compositeAfter);

  return { text: compositeAfter, ...diffTail(compositeBefore, compositeAfter) };
}

function isWordFormingKey(key: string): boolean {
  return [...key].length === 1 && /^[\p{L}\p{N}]$/u.test(key);
}

/** Python PendingWordBoundaryState의 QWERTY 경로 포팅. */
export class PendingWordBoundaryState {
  private value = false;

  get pendingWordBoundary(): boolean {
    return this.value;
  }

  markPending(): void {
    this.value = true;
  }

  clear(): void {
    this.value = false;
  }

  handleKey(key: string, state: KeyboardState, composer: HangulComposer): ProcessKeyResult {
    if (!this.value) return processKey(key, state, composer);

    if (key === FUNCTION_KEY_SPACE) {
      composer.flushBuffer();
      if (!composer.getFinalText().endsWith(' ')) composer.setFinalText(`${composer.getFinalText()} `);
      this.clear();
      return { state, confirmed: false };
    }

    if (key === FUNCTION_KEY_DEL || key === FUNCTION_KEY_CONFIRM || key === 'Enter') {
      this.clear();
      return processKey(key, state, composer);
    }

    if (key === FUNCTION_KEY_SHIFT || key === FUNCTION_KEY_LANGUAGE) {
      return processKey(key, state, composer);
    }

    if (isWordFormingKey(key)) {
      composer.flushBuffer();
      if (!composer.getFinalText().endsWith(' ')) composer.setFinalText(`${composer.getFinalText()} `);
      this.clear();
    }

    return processKey(key, state, composer);
  }
}
