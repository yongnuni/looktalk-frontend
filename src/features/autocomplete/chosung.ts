/** Python src/recommendation/chosung.py의 완성형 한글 분해/초성 추출 포팅. */
export const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

export const JUNGSUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ',
  'ㅣ',
] as const;

export const JONGSUNG = [
  null,
  'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ',
  'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ',
  'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const HANGUL_SYLLABLE_BASE = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;
const JUNGSUNG_COUNT = 21;
const JONGSUNG_COUNT = 28;
const SYLLABLES_PER_CHOSUNG = JUNGSUNG_COUNT * JONGSUNG_COUNT;
const CHOSUNG_SET = new Set<string>(CHOSUNG);

export type DecomposedHangul = readonly [
  chosung: string,
  jungsung: string,
  jongsung: string | null,
];

export function decomposeHangulSyllable(char: unknown): DecomposedHangul | null {
  if (typeof char !== 'string' || [...char].length !== 1) return null;

  const codePoint = char.codePointAt(0);
  if (codePoint === undefined || codePoint < HANGUL_SYLLABLE_BASE || codePoint > HANGUL_SYLLABLE_END) {
    return null;
  }

  const syllableIndex = codePoint - HANGUL_SYLLABLE_BASE;
  const chosungIndex = Math.floor(syllableIndex / SYLLABLES_PER_CHOSUNG);
  const jungsungIndex = Math.floor((syllableIndex % SYLLABLES_PER_CHOSUNG) / JONGSUNG_COUNT);
  const jongsungIndex = syllableIndex % JONGSUNG_COUNT;

  return [CHOSUNG[chosungIndex], JUNGSUNG[jungsungIndex], JONGSUNG[jongsungIndex]];
}

export function extractChosung(text: unknown): string {
  if (typeof text !== 'string' || !text) return '';

  const extracted: string[] = [];

  for (const char of text) {
    if (CHOSUNG_SET.has(char)) {
      extracted.push(char);
      continue;
    }

    const decomposed = decomposeHangulSyllable(char);
    if (decomposed) extracted.push(decomposed[0]);
  }

  return extracted.join('');
}

export function isSupportedChosungSequence(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && [...value].every((char) => CHOSUNG_SET.has(char));
}
