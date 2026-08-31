export const INPUT_TEST_WORDS = ['물', '밥', '집'] as const;

export type InputTestMethod = 'GAZE' | 'BLINK' | 'MOUTH';

export interface InputMethodTestResult {
  method: InputTestMethod;
  targetWord: string;
  finalInput: string;
  durationMs: number;
  confirmationAttempts: number;
  incorrectAttempts: number;
}

export type InputMethodTestConfirmation =
  | { status: 'incorrect' }
  | { status: 'completed'; result: InputMethodTestResult }
  | { status: 'ignored' };

type RandomSource = () => number;

/** Python TestRunner의 random.choice와 같은 균등 index 선택을 사용하되 이미 쓴 단어는 제외한다. */
export function selectInputTestWord(
  usedWords: ReadonlySet<string>,
  random: RandomSource = Math.random,
): string {
  const available = INPUT_TEST_WORDS.filter((word) => !usedWords.has(word));

  if (available.length === 0) {
    throw new Error('입력 테스트에 사용할 중복 없는 목표 단어가 남아 있지 않습니다.');
  }

  const sample = random();
  const normalizedSample = Number.isFinite(sample)
    ? Math.min(Math.max(sample, 0), 1 - Number.EPSILON)
    : 0;
  return available[Math.floor(normalizedSample * available.length)];
}

/** 확인을 누른 순간에만 판정하며, 성공 뒤의 중복 이벤트는 무시한다. */
export class InputMethodTestSession {
  private confirmationAttempts = 0;
  private incorrectAttempts = 0;
  private completed = false;
  private readonly method: InputTestMethod;
  private readonly targetWord: string;
  private readonly startedAtMs: number;

  constructor(
    method: InputTestMethod,
    targetWord: string,
    startedAtMs: number,
  ) {
    this.method = method;
    this.targetWord = targetWord;
    this.startedAtMs = startedAtMs;
  }

  confirm(input: string, nowMs: number): InputMethodTestConfirmation {
    if (this.completed) {
      return { status: 'ignored' };
    }

    this.confirmationAttempts += 1;

    if (input !== this.targetWord) {
      this.incorrectAttempts += 1;
      return { status: 'incorrect' };
    }

    this.completed = true;
    return {
      status: 'completed',
      result: {
        method: this.method,
        targetWord: this.targetWord,
        finalInput: input,
        durationMs: Math.max(0, nowMs - this.startedAtMs),
        confirmationAttempts: this.confirmationAttempts,
        incorrectAttempts: this.incorrectAttempts,
      },
    };
  }
}

export const INPUT_TEST_ENTRY_LOCK_MS = 350;
export const INPUT_TEST_DUPLICATE_SELECTION_LOCK_MS = 400;

/** Pointer와 gesture가 거의 동시에 같은 key를 선택할 때 한 번만 통과시킨다. */
export class InputMethodTestSelectionGate {
  private lastKeyValue: string | null = null;
  private lockedUntilMs = Number.NEGATIVE_INFINITY;

  accept(keyValue: string, nowMs: number): boolean {
    if (keyValue === this.lastKeyValue && nowMs <= this.lockedUntilMs) {
      return false;
    }

    this.lastKeyValue = keyValue;
    this.lockedUntilMs = nowMs + INPUT_TEST_DUPLICATE_SELECTION_LOCK_MS;
    return true;
  }
}

export function isInputTestEntryUnlocked(
  enteredAtMs: number,
  frameNowMs: number,
  lockMs = INPUT_TEST_ENTRY_LOCK_MS,
): boolean {
  return frameNowMs - enteredAtMs >= lockMs;
}
