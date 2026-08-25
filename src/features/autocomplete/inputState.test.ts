import { describe, expect, it } from 'vitest';
import {
  AUTOCOMPLETE_MODE,
  FAVORITES_MODE,
  resolveSuggestionSlots,
  resolveSuggestionTarget,
  SuggestionStateController,
} from './inputState';

describe('Python recommendation/input_state.py 포팅', () => {
  it('빈 입력은 사용자 자주 쓰는 문장을 3칸에 채우고 부족한 칸은 비운다', () => {
    expect(resolveSuggestionSlots('', ['물 주세요', '', '감사합니다'])).toEqual([
      '물 주세요',
      '감사합니다',
      '',
    ]);
  });

  it('입력이 시작되면 마지막 입력 단위의 초성만 조회한다', () => {
    const calls: string[] = [];
    const slots = resolveSuggestionSlots('오늘 ㄱㅅ', ['자주 쓰는 문장'], false, (prefix) => {
      calls.push(prefix);
      return ['감사합니다'];
    });

    expect(calls).toEqual(['ㄱㅅ']);
    expect(slots).toEqual(['감사합니다', '', '']);
  });

  it('선택 뒤 단어 경계가 pending인 동안 세 슬롯 모두 비운다', () => {
    expect(resolveSuggestionSlots('감사합니다', ['자주 쓰는 문장'], true)).toEqual(['', '', '']);
  });

  it('선택한 동일 문자열은 재조회하지 않고 다음 입력/되돌리기 때만 갱신한다', () => {
    const calls: string[] = [];
    const controller = new SuggestionStateController([], (prefix) => {
      calls.push(prefix);
      return ['새 추천'];
    });

    expect(controller.update('ㄱㅅ')?.mode).toBe(AUTOCOMPLETE_MODE);
    controller.clearAfterSelection('감사합니다');
    expect(controller.update('감사합니다')).toBeNull();
    expect(controller.slots).toEqual(['', '', '']);
    expect(controller.update('감사합니')?.slots).toEqual(['새 추천', '', '']);
    expect(calls).toEqual(['ㄱㅅ', 'ㄱㅅㅎㄴ']);

    expect(controller.update('')?.mode).toBe(FAVORITES_MODE);
  });

  it('내용이 있는 suggestion_1~3만 단일 선택 대상으로 해석한다', () => {
    const slots = ['감사합니다', '', '도와주세요'] as const;
    expect(resolveSuggestionTarget('suggestion_1', slots)).toBe('감사합니다');
    expect(resolveSuggestionTarget('suggestion_2', slots)).toBeNull();
    expect(resolveSuggestionTarget('suggestion_3', slots)).toBe('도와주세요');
    expect(resolveSuggestionTarget('suggestion_4', slots)).toBeNull();
  });
});
