import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { recommendationDemo } from '../mock/recommendationDemo';
import RecommendationResults from './RecommendationResults';

const render = (data = recommendationDemo) => renderToStaticMarkup(createElement(RecommendationResults, { data, onRetest: () => {}, retestRef: null, onChangeInput: () => {}, changeInputRef: null }));

describe('RecommendationResults', () => {
  it('shows all methods, scores and percentage meters without the removed footer notice', () => {
    const html = render();
    for (const method of recommendationDemo.methods) {
      expect(html).toContain(`${method.label} 입력`);
      expect(html).toContain(`>${method.score}</strong>`);
      for (const metric of method.metrics) {
        expect(html).toContain(`aria-label="${method.label} ${metric.label}"`);
      }
    }
    expect(html.match(/role="meter"/g)).toHaveLength(12);
    expect(html).not.toContain('학술제 시연용 임시 데이터입니다.');
    expect(html).toContain('다시 검사하기');
    expect(html).toContain('입력방식 변경');
    expect(html.match(/<button /g)).toHaveLength(2);
    expect(recommendationDemo.source).toBe('demo');
    expect(html).toContain('미제공 (임시 데이터)');
    expect(html).not.toContain('donut');
  });

  it('accepts a different recommendation and metric structure without using demo labels', () => {
    const html = render({ ...recommendationDemo, source: 'api', measuredAt: '2026-10-30', recommendedMethod: 'mouth', methods: recommendationDemo.methods.map(method => ({ ...method, metrics: [{ id: 'custom', label: '새 지표', percent: 37 }] })) });
    expect(html).toContain('<strong>입 움직임</strong>');
    expect(html).toContain('2026-10-30');
    expect(html.match(/role="meter"/g)).toHaveLength(3);
    expect(html).toContain('width:37%');
    expect(html).not.toContain('임시 데이터');
  });

  it('does not invent a measurement date for API data either', () => {
    const html = render({ ...recommendationDemo, source: 'api', measuredAt: null });
    expect(html).toContain('검사 날짜: 미제공');
    expect(html).not.toContain('(임시 데이터)');
  });
});
