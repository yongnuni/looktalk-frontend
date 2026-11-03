import { describe, expect, it } from 'vitest';
import { recommend, type MeasurementRow } from './recommend';

// 회귀 테스트: 캘리브레이션 직후 규칙 기반 추천(A)은 LightGBM 연동 후에도 그대로 동작해야 한다.
// (이 파일은 기존 recommend.ts의 동작을 고정할 뿐 구현을 바꾸지 않는다.)

const row = (inputMethod: MeasurementRow['inputMethod'], inputSpeed: number, typoRate: number): MeasurementRow => ({
  calibrationId: 'current-calibration',
  inputMethod,
  inputSpeed,
  typoRate,
  sessionAt: '2026-11-04T00:00:00.000Z',
});

describe('캘리브레이션 직후 규칙 기반 추천(A)', () => {
  it('오타율이 가장 낮은 방식을 추천하고, 같으면 입력 속도가 빠른 방식을 추천한다', () => {
    expect(recommend([], [row('EYE_TRACKING', 2, 0.5), row('BLINK', 1, 0), row('MOUTH', 3, 0)]).recommendedMethod).toBe('mouth');
  });

  it('추천 확률은 만들지 않고 engine은 rule-fallback이다', () => {
    const data = recommend([], [row('EYE_TRACKING', 4, 0), row('BLINK', 2, 0), row('MOUTH', 1, 0)]);
    expect(data.engine).toBe('rule-fallback');
    expect(data.recommendedMethod).toBe('gaze');
    expect(data.methods.every((method) => method.score === null)).toBe(true);
    expect(data.methods.map((method) => method.inputSpeed)).toEqual([4, 2, 1]);
  });

  it('측정이 없으면 추천하지 않는다', () => {
    const data = recommend([], []);
    expect(data.recommendedMethod).toBeNull();
    expect(data.methods.every((method) => !method.present)).toBe(true);
  });
});
