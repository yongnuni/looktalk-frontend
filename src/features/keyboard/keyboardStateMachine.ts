import { DOUBLE_CONSONANTS, HangulComposer } from './composition/HangulComposer';
import {
  FUNCTION_KEY_CONFIRM,
  FUNCTION_KEY_DEL,
  FUNCTION_KEY_LANGUAGE,
  FUNCTION_KEY_SHIFT,
  FUNCTION_KEY_SPACE,
  KEYS_ENG_NORMAL,
  KEYS_ENG_SHIFT,
  KEYS_KOR_NORMAL,
  KEYS_KOR_SHIFT,
} from './layouts/qwertyLayouts';

/**
 * Look-Talk 원본: src/keyboard.py process_key()(519-779행)를 그대로 포팅한다.
 * Python은 buttonList(Button 객체 배열)를 매번 재생성하지만, 웹에서는 isKorean/isShift만
 * 상태로 들고 렌더링 시 getLayoutRows()로 파생시킨다 — "어떤 레이아웃이 언제 보이는가"라는
 * 관찰 가능한 동작은 동일하고, Python의 buttonList 재생성이라는 구현 디테일만 React 렌더링
 * 모델에 맞게 없앤 것이다. 천지인 분기(is_cheonjiin)는 QWERTY만 지원하는 Web 범위(Integration
 * Plan §0.5)라 포팅하지 않는다 — INTENTIONAL_WEB_DIFFERENCE.
 */

export interface KeyboardState {
  isKorean: boolean;
  isShift: boolean;
}

export const INITIAL_KEYBOARD_STATE: KeyboardState = { isKorean: true, isShift: false };

export interface ProcessKeyResult {
  state: KeyboardState;
  /** '확인' 키가 눌렸는지 — Python은 no-op placeholder였지만 Web은 onConfirm 콜백 트리거다(§15.4). */
  confirmed: boolean;
}

export function processKey(key: string, state: KeyboardState, composer: HangulComposer): ProcessKeyResult {
  if (key === FUNCTION_KEY_CONFIRM) {
    return { state, confirmed: true };
  }

  let { isKorean, isShift } = state;

  if (isKorean) {
    if (key === FUNCTION_KEY_DEL) {
      composer.backspaceJamo();
    } else if (key === FUNCTION_KEY_LANGUAGE) {
      composer.flushBuffer();
      isKorean = false;
      isShift = false;
    } else if (key === FUNCTION_KEY_SPACE) {
      composer.flushBuffer();
      composer.setFinalText(`${composer.getFinalText()} `);
    } else if (key === FUNCTION_KEY_SHIFT) {
      isShift = !isShift;
    } else {
      if (isShift && DOUBLE_CONSONANTS[key]) {
        composer.addJamo(DOUBLE_CONSONANTS[key]);
      } else {
        composer.addJamo(key);
      }
      isShift = false;
    }
  } else if (key === FUNCTION_KEY_DEL) {
    composer.setFinalText(composer.getFinalText().slice(0, -1));
  } else if (key === FUNCTION_KEY_LANGUAGE) {
    isKorean = true;
    isShift = false;
  } else if (key === FUNCTION_KEY_SPACE) {
    composer.setFinalText(`${composer.getFinalText()} `);
  } else if (key === FUNCTION_KEY_SHIFT) {
    isShift = !isShift;
  } else {
    composer.setFinalText(composer.getFinalText() + key);
    isShift = false;
  }

  return { state: { isKorean, isShift }, confirmed: false };
}

export function getLayoutRows(state: KeyboardState): readonly string[][] {
  if (state.isKorean) {
    return state.isShift ? KEYS_KOR_SHIFT : KEYS_KOR_NORMAL;
  }

  return state.isShift ? KEYS_ENG_SHIFT : KEYS_ENG_NORMAL;
}
