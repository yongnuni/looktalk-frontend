import { describe, expect, it } from 'vitest';
import { HangulComposer } from './composition/HangulComposer';
import { INITIAL_KEYBOARD_STATE, processKey } from './keyboardStateMachine';
import {
  FUNCTION_KEY_CONFIRM,
  FUNCTION_KEY_DEL,
  getKeyLabel,
  KEYS_ENG_NORMAL,
  KEYS_ENG_SHIFT,
  KEYS_KOR_NORMAL,
  KEYS_KOR_SHIFT,
} from './layouts/qwertyLayouts';

describe('keyboardStateMachine (Look-Talk keyboard.py process_key 포팅)', () => {
  it('Del 내부 ID는 유지하면서 화면·접근성용 라벨은 되돌리기로 표시한다', () => {
    expect(FUNCTION_KEY_DEL).toBe('Del');
    expect(getKeyLabel(FUNCTION_KEY_DEL)).toBe('되돌리기');
    expect(getKeyLabel(FUNCTION_KEY_DEL)).not.toContain('뒤돌리기');
  });

  it('한글 모드: 문자 입력 후 Shift는 항상 false로 리셋된다', () => {
    const composer = new HangulComposer();
    let state = INITIAL_KEYBOARD_STATE;

    state = processKey('Shift', state, composer).state;
    expect(state.isShift).toBe(true);

    state = processKey('ㄱ', state, composer).state;
    expect(state.isShift).toBe(false);
  });

  it('Shift + 쌍자음 대응 키는 쌍자음으로 입력된다(ㄱ→ㄲ)', () => {
    const composer = new HangulComposer();
    let state = INITIAL_KEYBOARD_STATE;
    state = processKey('Shift', state, composer).state;
    processKey('ㄱ', state, composer);
    expect(composer.getComposedText()).toBe('ㄲ');
  });

  it('한/영 전환 시 버퍼가 flush되고 언어가 바뀌며 Shift가 꺼진다', () => {
    const composer = new HangulComposer();
    let state = INITIAL_KEYBOARD_STATE;
    processKey('ㅇ', state, composer);
    processKey('ㅏ', state, composer);
    expect(composer.getComposedText()).toBe('아');

    const result = processKey('한/영', state, composer);
    state = result.state;
    expect(state.isKorean).toBe(false);
    expect(state.isShift).toBe(false);
    expect(composer.getFinalText()).toBe('아'); // flush되어 finalText로 커밋됨
  });

  it('영문 모드에서 문자 입력 시 그대로 finalText에 붙는다', () => {
    const composer = new HangulComposer();
    const englishState = { isKorean: false, isShift: false };
    processKey('a', englishState, composer);
    processKey('b', englishState, composer);
    expect(composer.getFinalText()).toBe('ab');
  });

  it('영문 키보드의 물음표 키는 표시값과 실제 입력값이 모두 물음표다', () => {
    const composer = new HangulComposer();
    const englishState = { isKorean: false, isShift: false };
    const normalLetterRow = KEYS_ENG_NORMAL.at(-2) ?? [];
    const normalPunctuationRow = KEYS_ENG_NORMAL.at(-1) ?? [];
    const shiftPunctuationRow = KEYS_ENG_SHIFT.at(-1) ?? [];

    expect(normalLetterRow).not.toContain('?');
    expect(normalPunctuationRow).toEqual(expect.arrayContaining([',', '.', '?']));
    expect(normalPunctuationRow.at(-1)).toBe('?');
    expect(shiftPunctuationRow.at(-1)).toBe('?');
    expect(KEYS_ENG_NORMAL.flat()).not.toContain(';');
    processKey('?', englishState, composer);

    expect(composer.getFinalText()).toBe('?');
  });

  it('한글 일반/Shift 키보드에서도 기존 문장부호와 물음표를 함께 제공하고 실제 입력한다', () => {
    const normalPunctuationRow = KEYS_KOR_NORMAL.at(-1) ?? [];
    const shiftPunctuationRow = KEYS_KOR_SHIFT.at(-1) ?? [];

    expect(normalPunctuationRow).toEqual(expect.arrayContaining([',', '.', '?']));
    expect(shiftPunctuationRow).toContain('?');

    const normalComposer = new HangulComposer();
    processKey('?', INITIAL_KEYBOARD_STATE, normalComposer);
    expect(normalComposer.getComposedText()).toBe('?');

    const shiftComposer = new HangulComposer();
    processKey('?', { isKorean: true, isShift: true }, shiftComposer);
    expect(shiftComposer.getComposedText()).toBe('?');
  });

  it('Del은 한글 모드에서 자모 단위, 영문 모드에서 문자 단위로 지운다', () => {
    const composer = new HangulComposer();
    processKey('ㅇ', INITIAL_KEYBOARD_STATE, composer);
    processKey('ㅏ', INITIAL_KEYBOARD_STATE, composer);
    processKey('Del', INITIAL_KEYBOARD_STATE, composer);
    expect(composer.getComposedText()).toBe('ㅇ');

    const composer2 = new HangulComposer();
    composer2.setFinalText('ab');
    processKey('Del', { isKorean: false, isShift: false }, composer2);
    expect(composer2.getFinalText()).toBe('a');
  });

  it('Space(실제 키 값은 " " 한 칸)는 버퍼를 flush하고 공백을 추가한다', () => {
    const composer = new HangulComposer();
    processKey('ㅇ', INITIAL_KEYBOARD_STATE, composer);
    processKey('ㅏ', INITIAL_KEYBOARD_STATE, composer);
    processKey(' ', INITIAL_KEYBOARD_STATE, composer);
    expect(composer.getFinalText()).toBe('아 ');
  });

  it('확인 키는 state/composer를 건드리지 않고 confirmed=true만 반환한다', () => {
    const composer = new HangulComposer();
    processKey('ㅇ', INITIAL_KEYBOARD_STATE, composer);
    const before = composer.getComposedText();

    const result = processKey(FUNCTION_KEY_CONFIRM, INITIAL_KEYBOARD_STATE, composer);

    expect(getKeyLabel(FUNCTION_KEY_CONFIRM)).toBe('보내기');
    expect(result.confirmed).toBe(true);
    expect(result.state).toBe(INITIAL_KEYBOARD_STATE);
    expect(composer.getComposedText()).toBe(before);
  });
});
