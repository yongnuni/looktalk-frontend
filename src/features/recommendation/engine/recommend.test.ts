import { describe, expect, it } from 'vitest';
import rawModel from '../models/looktalk_lgbm.json';
import fixtures from './parity_fixtures.json';
import { buildFeatures, durationToInputSpeed, FEATURE_COLUMNS, METHODS } from './features';
import { predictModel } from './predict';
import { HISTORY_DECAY, recommend } from './recommend';
import type { MeasurementRow } from './types';

// looktalk-recommendation/tests/test_model.ts를 vitest로 옮긴 것. 모델 원본 동작 검증용.

const TRAINING_FEATURE_ORDER = [
  'eye_tracking_present', 'eye_tracking_input_speed', 'eye_tracking_typo_rate', 'eye_tracking_speed_ratio', 'eye_tracking_typo_gap',
  'blink_present', 'blink_input_speed', 'blink_typo_rate', 'blink_speed_ratio', 'blink_typo_gap',
  'mouth_present', 'mouth_input_speed', 'mouth_typo_rate', 'mouth_speed_ratio', 'mouth_typo_gap',
];

const mock = (id: string, g: number | null, b: number | null, m: number | null): MeasurementRow[] =>
  ([['EYE_TRACKING', g], ['BLINK', b], ['MOUTH', m]] as const)
    .filter(([, seconds]) => seconds !== null)
    .map(([inputMethod, seconds]) => ({
      calibrationId: id,
      inputMethod,
      inputSpeed: durationToInputSpeed((seconds as number) * 1000),
      typoRate: 0,
      sessionAt: '2026-11-03T00:00:00Z',
    }));

describe('LightGBM 모델 스키마', () => {
  it('피처 15개 순서와 클래스 순서가 학습 당시와 모델 JSON에 일치한다', () => {
    expect(FEATURE_COLUMNS).toEqual(TRAINING_FEATURE_ORDER);
    expect(rawModel.feature_names).toEqual(TRAINING_FEATURE_ORDER);
    expect(rawModel.num_class).toBe(3);
    expect(METHODS).toEqual(['EYE_TRACKING', 'BLINK', 'MOUTH']);
    expect(HISTORY_DECAY).toBe(0.5);
  });
});

describe('Python/TypeScript 예측값 동등성', () => {
  it(`parity fixture ${fixtures.length}개 사례가 Python 예측 확률과 일치한다`, () => {
    expect(fixtures).toHaveLength(14);
    for (const fixture of fixtures) {
      const predicted = predictModel(fixture.features.map((value) => (value === null ? Number.NaN : value)));
      fixture.probabilities.forEach((expected, index) => {
        expect(Math.abs(predicted[index] - expected)).toBeLessThanOrEqual(1e-9);
      });
    }
  });
});

describe('recommend() 원본 시나리오', () => {
  it('가장 빠르고 오타 없는 방식을 추천한다', () => {
    expect(recommend([], mock('a', 15, 40, 40)).recommendedMethod).toBe('EYE_TRACKING');
    expect(recommend([], mock('b', 40, 15, 40)).recommendedMethod).toBe('BLINK');
    expect(recommend([], mock('c', 40, 40, 15)).recommendedMethod).toBe('MOUTH');
  });

  it('빈 입력이면 추천하지 않는다', () => {
    expect(recommend([], []).recommendedMethod).toBeNull();
  });

  it('history와 current에 같은 calibrationId가 있어도 중복 집계하지 않는다', () => {
    const eye = mock('a', 15, 40, 40);
    expect(recommend(eye, eye).methods).toEqual(recommend([], eye).methods);
  });

  it('최신 측정에서 생략한 방식은 추천 후보에서 제외하고 present=false로 표시한다', () => {
    const skipped = recommend([], mock('d', 15, null, 40));
    expect(skipped.recommendedMethod).not.toBe('BLINK');
    expect(skipped.methods.find((item) => item.method === 'BLINK')).toMatchObject({
      present: false,
      typoRatePercent: null,
    });
  });

  it('피처 벡터 길이는 15다', () => {
    expect(buildFeatures(mock('a', 15, 40, 40))).toHaveLength(15);
  });
});
