import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CalibrationRecommendationResults from './CalibrationRecommendationResults';
import RecommendationResults from '../../analysis/components/RecommendationResults';
import { recommendationDemo } from '../../analysis/mock/recommendationDemo';
import { useCalibrationCompletionGaze } from '../completionGaze/useCalibrationCompletionGaze';

vi.mock('../completionGaze/useCalibrationCompletionGaze', () => ({
  useCalibrationCompletionGaze: vi.fn(),
}));

describe('calibration dashboard back button', () => {
  it('renders the back button below the shared comparison table only in calibration', () => {
    const html = renderToStaticMarkup(
      createElement(CalibrationRecommendationResults, {
        data: recommendationDemo,
        subscribeCompletionGaze: () => () => {},
        onRetest: vi.fn(),
        onChangeInput: vi.fn(),
      }),
    );

    expect(html).toContain('뒤로가기');
    expect(html.indexOf('뒤로가기')).toBeGreaterThan(html.indexOf('</table>'));

    const standalone = renderToStaticMarkup(
      createElement(RecommendationResults, {
        data: recommendationDemo,
        onRetest: vi.fn(),
        onChangeInput: vi.fn(),
        retestRef: null,
        changeInputRef: null,
      }),
    );

    expect(standalone).not.toContain('뒤로가기');
  });

  it('reuses the result-return action for gaze selection without invoking retest', () => {
    const onChangeInput = vi.fn();
    const onRetest = vi.fn();

    renderToStaticMarkup(
      createElement(CalibrationRecommendationResults, {
        data: recommendationDemo,
        subscribeCompletionGaze: () => () => {},
        onRetest,
        onChangeInput,
      }),
    );

    const options = vi
      .mocked(useCalibrationCompletionGaze)
      .mock.calls.at(-1)![0];
    const targets = options.getTargets();

    const back = targets.find(
      (target) => target.id === 'calibration-dashboard-back',
    )!;

    const change = targets.find(
      (target) => target.id === 'calibration-dashboard-change-input',
    )!;

    expect(back.onSelect).toBe(change.onSelect);

    back.onSelect();

    expect(onChangeInput).toHaveBeenCalledOnce();
    expect(onRetest).not.toHaveBeenCalled();
  });
});
