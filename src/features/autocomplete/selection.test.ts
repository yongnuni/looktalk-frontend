import { describe, expect, it } from 'vitest';
import { HangulComposer } from '../keyboard/composition/HangulComposer';
import { INITIAL_KEYBOARD_STATE, processKey } from '../keyboard/keyboardStateMachine';
import { applySuggestion, PendingWordBoundaryState } from './selection';

function qwertyInput(prefix: string, keys: string[]): HangulComposer {
  const composer = new HangulComposer();
  composer.setFinalText(prefix);
  for (const key of keys) processKey(key, INITIAL_KEYBOARD_STATE, composer);
  return composer;
}

describe('Python apply_suggestion/PendingWordBoundaryState 포팅', () => {
  it.each([
    ['', ['ㄱ', 'ㅅ'], '감사합니다', '감사합니다', 2],
    ['오늘 ', ['ㄱ', 'ㅅ'], '감사합니다', '오늘 감사합니다', 2],
    ['', ['ㄱ'], '간호사 불러주세요', '간호사 불러주세요', 1],
  ] as const)('마지막 초성/단어만 후보로 치환한다', (prefix, keys, suggestion, expected, deletedCount) => {
    const composer = qwertyInput(prefix, [...keys]);
    const result = applySuggestion(composer, suggestion);

    expect(result).toEqual({ text: expected, deletedCount, insertedText: suggestion });
    expect(composer.getComposedText()).toBe(expected);
    expect(composer.getFinalText()).toBe(expected);
    expect(expected.endsWith(' ')).toBe(false);
  });

  it('후보 선택 뒤 일반 문자는 한 칸의 단어 경계를 만든다', () => {
    const composer = new HangulComposer();
    const boundary = new PendingWordBoundaryState();
    applySuggestion(composer, '너무 아파요');
    boundary.markPending();

    boundary.handleKey('ㅂ', INITIAL_KEYBOARD_STATE, composer);
    expect(composer.getComposedText()).toBe('너무 아파요 ㅂ');
    expect(boundary.pendingWordBoundary).toBe(false);
  });

  it('문장부호는 바로 결합하고 다음 일반 문자 앞에서 경계를 만든다', () => {
    const composer = new HangulComposer();
    const boundary = new PendingWordBoundaryState();
    applySuggestion(composer, '가래를 빼주세요');
    boundary.markPending();

    boundary.handleKey(',', INITIAL_KEYBOARD_STATE, composer);
    expect(composer.getComposedText()).toBe('가래를 빼주세요,');
    expect(boundary.pendingWordBoundary).toBe(true);

    boundary.handleKey('ㅁ', INITIAL_KEYBOARD_STATE, composer);
    expect(composer.getComposedText()).toBe('가래를 빼주세요, ㅁ');
    expect(boundary.pendingWordBoundary).toBe(false);
  });

  it('직접 스페이스는 정확히 하나만 넣고 되돌리기는 숨은 공백 없이 삭제한다', () => {
    const spaced = new HangulComposer();
    const spaceBoundary = new PendingWordBoundaryState();
    applySuggestion(spaced, '너무 아파요');
    spaceBoundary.markPending();
    spaceBoundary.handleKey(' ', INITIAL_KEYBOARD_STATE, spaced);
    expect(spaced.getComposedText()).toBe('너무 아파요 ');

    const deleted = new HangulComposer();
    const deleteBoundary = new PendingWordBoundaryState();
    applySuggestion(deleted, '너무 아파요');
    deleteBoundary.markPending();
    deleteBoundary.handleKey('Del', INITIAL_KEYBOARD_STATE, deleted);
    expect(deleted.getComposedText()).toBe('너무 아파');
  });

  it('같은 후보 선택 콜백이 반복돼도 문장을 중복 삽입하지 않는다', () => {
    const composer = qwertyInput('', ['ㄱ', 'ㅅ']);
    applySuggestion(composer, '감사합니다');
    applySuggestion(composer, '감사합니다');
    expect(composer.getComposedText()).toBe('감사합니다');
  });
});
