import { describe, expect, it } from 'vitest';
import { HangulComposer } from './composition/HangulComposer';
import { INITIAL_KEYBOARD_STATE, processKey } from './keyboardStateMachine';

describe('keyboardStateMachine (Look-Talk keyboard.py process_key 포팅)', () => {
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

    const result = processKey('확인', INITIAL_KEYBOARD_STATE, composer);

    expect(result.confirmed).toBe(true);
    expect(result.state).toBe(INITIAL_KEYBOARD_STATE);
    expect(composer.getComposedText()).toBe(before);
  });
});
