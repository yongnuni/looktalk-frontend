import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { recommendationDemo } from '../mock/recommendationDemo';
import RecommendationResults from './RecommendationResults';

const render = (data = recommendationDemo) =>
  renderToStaticMarkup(
    createElement(RecommendationResults, {
      data,
      onRetest: () => {},
      retestRef: null,
      onChangeInput: () => {},
      changeInputRef: null,
    }),
  );

describe('RecommendationResults', () => {
  it('shows all input methods, recommendation scores and measurement metrics', () => {
    const html = render();

    for (const method of recommendationDemo.methods) {
      expect(html).toContain(`${method.label} 입력`);

      if (method.present && method.score !== null) {
        expect(html).toContain(`>${method.score}</strong>`);
      }

      if (method.present) {
        if (method.typoRatePercent !== null) {
          expect(html).toContain(`${method.typoRatePercent.toFixed(1)}%`);
        }

        if (method.inputSpeed !== null) {
          expect(html).toContain(`>${method.inputSpeed.toFixed(1)}</b>`);
        }
      } else {
        expect(html).toContain('결과 없음');
      }
    }

    expect(html).toContain('추천 확률');
    expect(html).toContain('다시 검사하기');
    expect(html).toContain('입력방식 변경');
    expect(html.match(/<button /g)).toHaveLength(2);
    expect(html).toContain('미제공');
    expect(html).not.toContain('학술제 시연용 임시 데이터입니다.');
    expect(html).not.toContain('donut');
  });

  it('accepts a different recommendation and measurement data', () => {
    const updatedData = {
      ...recommendationDemo,
      measuredAt: '2026-10-30',
      recommendedMethod: 'mouth' as const,
      methods: recommendationDemo.methods.map((method) => ({
        ...method,
        score: null,
        typoRatePercent: 37,
        inputSpeed: 14.123,
      })),
    };

    const html = render(updatedData);

    expect(html).toContain('<strong>입 움직임</strong>');
    expect(html).toContain('2026-10-30');
    expect(html).toContain('37.0%');
    expect(html).toContain('14.1');
    expect(html).not.toContain('63%');
    expect(html).not.toContain('임시 데이터');
  });

  it('does not invent a measurement date when measuredAt is null', () => {
    const html = render({
      ...recommendationDemo,
      measuredAt: null,
    });

    expect(html).toContain('미제공');
    expect(html).not.toContain('임시 데이터');
  });

  it('does not display a fake recommendation probability when score is null', () => {
    const html = render({
      ...recommendationDemo,
      methods: recommendationDemo.methods.map((method) => ({
        ...method,
        score: null,
      })),
    });

    expect(html).not.toContain('>100</strong>');
    expect(html).not.toContain('>98</strong>');
  });

  it('displays a dash when measurement metrics are unavailable', () => {
    const html = render({
      ...recommendationDemo,
      methods: recommendationDemo.methods.map((method) => ({
        ...method,
        present: true,
        score: null,
        typoRatePercent: null,
        inputSpeed: null,
      })),
    });

    expect(html).toContain('추천 확률');
    expect(html).not.toContain('NaN');
  });
});
