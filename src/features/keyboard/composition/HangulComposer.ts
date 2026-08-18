import Hangul from 'hangul-js';

/**
 * Look-Talk 원본: src/hangul.py의 add_jamo() 상태머신을 그대로 포팅한다.
 *
 * Python은 모듈 전역 변수(jamo_buffer, finalText)를 쓰지만, 웹에서는 인스턴스 상태로
 * 캡슐화한다(값/전이 로직은 동일, 저장 위치만 클래스 필드로 바꿈).
 *
 * hangul-js는 최종 합성(Python jamo.j2h(cho,jung,jong) 자리)에만 쓴다 — 실제로
 * `Hangul.assemble([cho,jung,jong])`이 j2h와 동일한 결과를 내는지 직접 실행해 검증했다
 * (예: assemble(['ㄱ','ㅏ','ㄴ'])==='간', assemble(['ㄱ','ㅏ',''])==='가'). 초성/중성/종성
 * 버퍼를 언제 어떻게 채우고 넘길지 결정하는 상태머신 자체(add_jamo 193줄)는 hangul-js가
 * 제공하지 않으므로 전부 직접 포팅한다.
 */

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ',
  'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ',
  'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const JUNGSUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ',
  'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ',
  'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

const JONGSUNG = [
  '',
  'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ',
  'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
  'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ',
  'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

export const DOUBLE_CONSONANTS: Record<string, string> = {
  ㄱ: 'ㄲ',
  ㄷ: 'ㄸ',
  ㅂ: 'ㅃ',
  ㅅ: 'ㅆ',
  ㅈ: 'ㅉ',
};

const COMPOUND_VOWELS: Record<string, string> = {
  'ㅗ,ㅏ': 'ㅘ',
  'ㅗ,ㅐ': 'ㅙ',
  'ㅗ,ㅣ': 'ㅚ',
  'ㅜ,ㅓ': 'ㅝ',
  'ㅜ,ㅔ': 'ㅞ',
  'ㅜ,ㅣ': 'ㅟ',
  'ㅡ,ㅣ': 'ㅢ',
};

const DOUBLE_JONGSUNG: Record<string, string> = {
  'ㄱ,ㅅ': 'ㄳ',
  'ㄴ,ㅈ': 'ㄵ',
  'ㄴ,ㅎ': 'ㄶ',
  'ㄹ,ㄱ': 'ㄺ',
  'ㄹ,ㅁ': 'ㄻ',
  'ㄹ,ㅂ': 'ㄼ',
  'ㄹ,ㅅ': 'ㄽ',
  'ㄹ,ㅌ': 'ㄾ',
  'ㄹ,ㅍ': 'ㄿ',
  'ㄹ,ㅎ': 'ㅀ',
  'ㅂ,ㅅ': 'ㅄ',
};

const DOUBLE_JONGSUNG_ENTRIES = Object.entries(DOUBLE_JONGSUNG);

function isChoseong(c: string): boolean {
  return CHOSUNG.includes(c);
}

function isJungseong(c: string): boolean {
  return JUNGSUNG.includes(c);
}

function isJongseong(c: string): boolean {
  return JONGSUNG.includes(c) && c !== '';
}

function assembleSyllable(cho: string, jung: string, jong: string): string {
  try {
    return Hangul.assemble([cho, jung, jong]);
  } catch {
    return `${cho}${jung}${jong}`;
  }
}

export class HangulComposer {
  private jamoBuffer: [string, string, string] = ['', '', ''];
  private finalText = '';

  getFinalText(): string {
    return this.finalText;
  }

  setFinalText(text: string): void {
    this.finalText = text;
  }

  /** Python compose_jamo_buffer() 포팅 — 미완성 조합 중인 음절을 미리보기용으로 합성한다. */
  composeJamoBuffer(): string {
    const [cho, jung, jong] = this.jamoBuffer;

    if (cho && jung) {
      try {
        return assembleSyllable(cho, jung, jong);
      } catch {
        return `${cho}${jung}${jong}`;
      }
    }

    if (jung) return jung;
    if (cho) return cho;

    return '';
  }

  getComposedText(): string {
    return this.finalText + this.composeJamoBuffer();
  }

  /** Python flush_buffer() 포팅. */
  flushBuffer(): void {
    if (this.jamoBuffer[0] !== '') {
      this.finalText += this.composeJamoBuffer();
    }

    this.jamoBuffer = ['', '', ''];
  }

  backspaceJamo(): void {
    if (this.jamoBuffer[2]) {
      this.jamoBuffer[2] = '';
    } else if (this.jamoBuffer[1]) {
      this.jamoBuffer[1] = '';
    } else if (this.jamoBuffer[0]) {
      this.jamoBuffer[0] = '';
    } else {
      this.finalText = this.finalText.slice(0, -1);
    }
  }

  reset(): void {
    this.jamoBuffer = ['', '', ''];
    this.finalText = '';
  }

  /** Python add_jamo(j) 상태머신을 그대로 포팅한다(hangul.py:92-194). */
  addJamo(j: string): void {
    const [cho, jung, jong] = this.jamoBuffer;

    if (jung && jong === '' && isJungseong(j)) {
      const combined = COMPOUND_VOWELS[`${jung},${j}`];
      if (combined) {
        this.jamoBuffer[1] = combined;
        return;
      }
    }

    if (cho === '' && jung === '' && jong === '') {
      if (isChoseong(j)) {
        this.jamoBuffer[0] = j;
      } else if (isJungseong(j)) {
        this.jamoBuffer[1] = j;
      } else {
        this.jamoBuffer[0] = j;
      }
      return;
    }

    if (jung === '') {
      if (isJungseong(j)) {
        this.jamoBuffer[1] = j;
      } else {
        this.flushBuffer();
        this.addJamo(j);
      }
      return;
    }

    if (jong === '') {
      if (isJongseong(j)) {
        this.jamoBuffer[2] = j;
      } else if (isJungseong(j)) {
        this.flushBuffer();
        this.finalText += j;
      } else if (isChoseong(j)) {
        this.flushBuffer();
        this.jamoBuffer[0] = j;
      } else {
        this.flushBuffer();
        this.jamoBuffer[0] = j;
      }
      return;
    }

    // jamo_buffer 3칸이 전부 채워진 상태(cho, jung, jong 모두 존재)
    if (isJongseong(j)) {
      const combo = DOUBLE_JONGSUNG[`${jong},${j}`];

      if (combo) {
        this.jamoBuffer[2] = combo;
      } else {
        this.flushBuffer();
        this.jamoBuffer[0] = j;
      }
      return;
    }

    if (isJungseong(j)) {
      const isDoubleJongsung = DOUBLE_JONGSUNG_ENTRIES.some(([, value]) => value === jong);

      if (isDoubleJongsung) {
        const entry = DOUBLE_JONGSUNG_ENTRIES.find(([, value]) => value === jong);
        const [firstPart, secondPart] = entry ? entry[0].split(',') : [jong, ''];

        this.finalText += assembleSyllable(this.jamoBuffer[0], this.jamoBuffer[1], firstPart);
        this.jamoBuffer = [secondPart, j, ''];
      } else {
        const prevJong = this.jamoBuffer[2];
        this.jamoBuffer[2] = '';
        this.finalText += this.composeJamoBuffer();
        this.jamoBuffer = [prevJong, j, ''];
      }
      return;
    }

    if (isChoseong(j)) {
      this.flushBuffer();
      this.jamoBuffer[0] = j;
      return;
    }

    this.flushBuffer();
    this.jamoBuffer[0] = j;
  }
}
