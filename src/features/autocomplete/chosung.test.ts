import { describe, expect, it } from 'vitest';
import { decomposeHangulSyllable, extractChosung } from './chosung';

describe('Python recommendation/chosung.py 포팅', () => {
  it('완성형 한글을 초성·중성·종성으로 분해한다', () => {
    expect(decomposeHangulSyllable('가')).toEqual(['ㄱ', 'ㅏ', null]);
    expect(decomposeHangulSyllable('각')).toEqual(['ㄱ', 'ㅏ', 'ㄱ']);
    expect(decomposeHangulSyllable('힣')).toEqual(['ㅎ', 'ㅣ', 'ㅎ']);
  });

  it('독립 초성과 완성형 한글이 섞인 문자열에서 초성만 추출한다', () => {
    expect(extractChosung('ㄱ나ㄷ라마바사')).toBe('ㄱㄴㄷㄹㅁㅂㅅ');
    expect(extractChosung('너무 아파요')).toBe('ㄴㅁㅇㅍㅇ');
  });

  it('영문·숫자·공백·독립 모음과 잘못된 입력은 안전하게 건너뛴다', () => {
    expect(extractChosung('abc 123 ㅏ!')).toBe('');
    expect(extractChosung('A1 간 B2')).toBe('ㄱ');
    expect(extractChosung(null)).toBe('');
    expect(decomposeHangulSyllable('ab')).toBeNull();
  });
});
