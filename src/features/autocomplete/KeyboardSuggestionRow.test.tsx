import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import KeyboardSuggestionRow from './KeyboardSuggestionRow';

describe('KeyboardSuggestionRow', () => {
  it('실제 DOM에 한 행 3슬롯만 렌더링하고 빈 슬롯은 선택 대상에서 제외한다', () => {
    const markup = renderToStaticMarkup(
      <KeyboardSuggestionRow
        slots={['감사합니다', '', '간호사 불러주세요']}
        mode="autocomplete"
        onTargetSelect={vi.fn()}
      />,
    );

    expect(markup.match(/fv-keyboard-recommend-row/g)).toHaveLength(1);
    expect(markup.match(/<(?:button|span)[^>]*class="fv-keyboard-recommend-button/g)).toHaveLength(3);
    expect(markup.match(/<button/g)).toHaveLength(2);
    expect(markup.match(/data-key-id=/g)).toHaveLength(2);
    expect(markup).toContain('data-key-id="suggestion_1"');
    expect(markup).not.toContain('data-key-id="suggestion_2"');
    expect(markup).toContain('data-key-id="suggestion_3"');
  });

  it('긴 후보에 축소 폰트·2줄 말줄임용 클래스를 적용한다', () => {
    const markup = renderToStaticMarkup(
      <KeyboardSuggestionRow
        slots={['불편한 곳이 어디인지 알려주세요', '', '']}
        mode="favorites"
        onTargetSelect={vi.fn()}
      />,
    );
    expect(markup).toContain('fv-keyboard-recommend-button--long');
    expect(markup).toContain('aria-label="자주 쓰는 문장"');
  });
});
