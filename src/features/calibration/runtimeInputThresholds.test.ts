import { describe, expect, it } from 'vitest';
import {
  resolveBlinkThresholds,
  resolveMouthThresholds,
} from './runtimeInputThresholds';
import type { InputCalibrationResult } from './inputCalibration';

const CALIBRATED: InputCalibrationResult = {
  blink: {
    closeThreshold: 0.17,
    openThreshold: 0.21,
    openMedian: 0.3,
    closedMedian: 0.1,
    fallback: false,
  },
  mouth: {
    openThreshold: 0.265,
    closeThreshold: 0.19,
    baseline: 0.1,
    openMar: 0.4,
    activationThreshold: 0.18,
    fallback: false,
  },
};

describe('runtimeInputThresholds', () => {
  it('측정 결과가 있으면 두 controller가 같은 세션 threshold를 받는다', () => {
    expect(resolveBlinkThresholds(CALIBRATED)).toEqual({
      closeThreshold: 0.17,
      openThreshold: 0.21,
    });
    expect(resolveMouthThresholds(CALIBRATED)).toEqual({
      openThreshold: 0.265,
      closeThreshold: 0.19,
    });
  });

  it('세션 결과가 없거나 fallback이면 undefined로 기존 controller 기본값을 유지한다', () => {
    expect(resolveBlinkThresholds(null)).toBeUndefined();
    expect(resolveMouthThresholds(null)).toBeUndefined();

    expect(
      resolveBlinkThresholds({
        ...CALIBRATED,
        blink: { ...CALIBRATED.blink, fallback: true },
      }),
    ).toBeUndefined();
    expect(
      resolveMouthThresholds({
        ...CALIBRATED,
        mouth: { ...CALIBRATED.mouth, fallback: true },
      }),
    ).toBeUndefined();
  });
});
