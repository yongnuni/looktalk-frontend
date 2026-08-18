import { describe, expect, it } from 'vitest';
import { HangulComposer } from './HangulComposer';

describe('HangulComposer (Look-Talk hangul.py add_jamo 포팅)', () => {
  it('초성+중성만으로 완성 음절을 만든다', () => {
    const composer = new HangulComposer();
    composer.addJamo('ㄱ');
    composer.addJamo('ㅏ');
    expect(composer.getComposedText()).toBe('가');
  });

  it('초성+중성+종성으로 완성 음절을 만든다', () => {
    const composer = new HangulComposer();
    ['ㅇ', 'ㅏ', 'ㄴ'].forEach((j) => composer.addJamo(j));
    expect(composer.getComposedText()).toBe('안');
  });

  it('겹받침(ㅂ+ㅅ→ㅄ)을 조합한다', () => {
    const composer = new HangulComposer();
    ['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ'].forEach((j) => composer.addJamo(j));
    expect(composer.getComposedText()).toBe('값');
  });

  it('복모음(ㅗ+ㅏ→ㅘ)을 조합한다', () => {
    const composer = new HangulComposer();
    ['ㅇ', 'ㅗ', 'ㅏ'].forEach((j) => composer.addJamo(j));
    expect(composer.getComposedText()).toBe('와');
  });

  it('받침이 있는 상태에서 모음이 들어오면 받침이 다음 글자 초성으로 재분배된다("아"+"니"="아니")', () => {
    const composer = new HangulComposer();
    ['ㅇ', 'ㅏ', 'ㄴ', 'ㅣ'].forEach((j) => composer.addJamo(j));
    expect(composer.getComposedText()).toBe('아니');
  });

  it('겹받침 상태에서 모음이 들어오면 겹받침이 분리되어 뒷자모가 다음 글자로 넘어간다("갔"+"어"흐름 확인용 "값"+모음)', () => {
    const composer = new HangulComposer();
    ['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ', 'ㅓ'].forEach((j) => composer.addJamo(j));
    // 종성 ㅄ(ㅂ+ㅅ) 상태에서 모음이 들어오면 ㅂ은 남고 ㅅ이 다음 글자 초성으로 넘어간다.
    expect(composer.getComposedText()).toBe('갑서');
  });

  it('Del은 완성 음절이 아니라 자모 단위로 지운다(종성→중성→초성)', () => {
    const composer = new HangulComposer();
    ['ㅇ', 'ㅏ', 'ㄴ'].forEach((j) => composer.addJamo(j));
    expect(composer.getComposedText()).toBe('안');

    composer.backspaceJamo();
    expect(composer.getComposedText()).toBe('아');

    composer.backspaceJamo();
    expect(composer.getComposedText()).toBe('ㅇ');

    composer.backspaceJamo();
    expect(composer.getComposedText()).toBe('');
  });

  it('flushBuffer 이후 finalText에 완성 음절이 커밋되고 버퍼가 비워진다', () => {
    const composer = new HangulComposer();
    ['ㅇ', 'ㅏ', 'ㄴ'].forEach((j) => composer.addJamo(j));
    composer.flushBuffer();
    expect(composer.getFinalText()).toBe('안');
    expect(composer.getComposedText()).toBe('안');

    composer.setFinalText(`${composer.getFinalText()} `);
    expect(composer.getComposedText()).toBe('안 ');
  });

  it('여러 글자를 이어서 입력해도 정확히 조합된다("안녕")', () => {
    const composer = new HangulComposer();
    ['ㅇ', 'ㅏ', 'ㄴ', 'ㄴ', 'ㅕ', 'ㅇ'].forEach((j) => composer.addJamo(j));
    expect(composer.getComposedText()).toBe('안녕');
  });
});
