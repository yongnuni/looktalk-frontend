import { describe, expect, it, vi } from 'vitest';
import {
  INPUT_TEST_ENTRY_LOCK_MS,
  INPUT_TEST_WORDS,
  InputMethodTestSession,
  isInputTestEntryUnlocked,
  selectInputTestWord,
} from './inputMethodTest';

describe('inputMethodTest', () => {
  it('fallback 후보에서 랜덤 목표를 고르고 이미 사용한 단어는 제외한다', () => {
    expect(selectInputTestWord(new Set(), () => 0)).toBe(INPUT_TEST_WORDS[0]);
    expect(selectInputTestWord(new Set(['물']), () => 0)).toBe('밥');
    expect(selectInputTestWord(new Set(['물', '밥']), () => 0.99)).toBe('집');
  });

  it('세 테스트의 목표를 중복 없이 선택하고 소진 뒤에는 실패를 명시한다', () => {
    const used = new Set<string>();
    const random = vi.fn(() => 0);

    for (let index = 0; index < INPUT_TEST_WORDS.length; index += 1) {
      used.add(selectInputTestWord(used, random));
    }

    expect(used).toEqual(new Set(INPUT_TEST_WORDS));
    expect(() => selectInputTestWord(used, random)).toThrow(/남아 있지 않습니다/);
  });

  it('정확한 조합 뒤 확인해야 완료하며 오답 횟수와 완료 시간을 기록한다', () => {
    const session = new InputMethodTestSession('BLINK', '밥', 1_000);

    expect(session.confirm('밤', 1_500)).toEqual({ status: 'incorrect' });
    expect(session.confirm('밥', 2_250)).toEqual({
      status: 'completed',
      result: {
        method: 'BLINK',
        targetWord: '밥',
        finalInput: '밥',
        durationMs: 1_250,
        confirmationAttempts: 2,
        incorrectAttempts: 1,
      },
    });
  });

  it('완료 후 들어온 중복 확인 이벤트를 무시한다', () => {
    const session = new InputMethodTestSession('MOUTH', '집', 0);

    expect(session.confirm('집', 500).status).toBe('completed');
    expect(session.confirm('집', 600)).toEqual({ status: 'ignored' });
  });

  it('stage 진입 직후에는 직전 gesture 입력을 잠근다', () => {
    expect(isInputTestEntryUnlocked(1_000, 1_000 + INPUT_TEST_ENTRY_LOCK_MS - 1)).toBe(false);
    expect(isInputTestEntryUnlocked(1_000, 1_000 + INPUT_TEST_ENTRY_LOCK_MS)).toBe(true);
  });
});
