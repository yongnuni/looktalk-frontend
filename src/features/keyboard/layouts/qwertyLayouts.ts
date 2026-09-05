/**
 * Look-Talk 원본: src/keyboard.py의 keys_kor_normal/keys_kor_shift/keys_eng_normal/
 * keys_eng_shift 리터럴을 그대로 옮긴다(16-49행). 문자 배열만 옮기고, 픽셀 단위
 * Button 배치(calculate_keyboard_layout)는 웹 DOM/CSS Grid로 대체한다 — 행 구조
 * (숫자행+자모/문자 3행+기능행)와 "space가 가장 넓다"는 비율 의미만 보존한다.
 */

export const KEYS_KOR_NORMAL: readonly string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
  ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', ',', '.', '?'],
];

export const KEYS_KOR_SHIFT: readonly string[][] = [
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['ㅃ', 'ㅉ', 'ㄸ', 'ㄲ', 'ㅆ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅒ', 'ㅖ'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
  ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', '<', '>', '?'],
];

export const KEYS_ENG_NORMAL: readonly string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?'],
];

export const KEYS_ENG_SHIFT: readonly string[][] = [
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?'],
];

// Look-Talk keyboard.py FUNCTION_ROW_LEFT/CENTER/RIGHT(66-68행) — Enter는 없다.
export const FUNCTION_KEY_SHIFT = 'Shift';
export const FUNCTION_KEY_LANGUAGE = '한/영';
export const FUNCTION_KEY_SPACE = ' ';
export const FUNCTION_KEY_DEL = 'Del';
export const FUNCTION_KEY_CONFIRM = '확인';

// Look-Talk keyboard.py DISPLAY_LABELS(72-76행)와 동일한 표시 이름.
export const DISPLAY_LABELS: Record<string, string> = {
  [FUNCTION_KEY_SHIFT]: 'shift',
  [FUNCTION_KEY_DEL]: '되돌리기',
  [FUNCTION_KEY_SPACE]: '스페이스',
  [FUNCTION_KEY_CONFIRM]: '보내기',
};

export function getKeyLabel(value: string): string {
  return DISPLAY_LABELS[value] ?? value;
}
