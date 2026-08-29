import { describe, expect, it } from 'vitest';
import type { GazeSignal } from '../faceTracking/types';
import {
  EMPTY_LANDMARK_SIGNAL_HUD,
  formatLandmarkSignalHud,
} from './landmarkSignalHud';

function signal(ear: number, mar: number): GazeSignal {
  return {
    irisX: 0.5,
    irisY: 0.5,
    ear,
    mar,
    irisConfidence: 1,
    eyeClosed: false,
    timestamp: 1,
  };
}

describe('formatLandmarkSignalHud', () => {
  it('EAR와 MAR를 소수점 셋째 자리까지 표시한다', () => {
    expect(formatLandmarkSignalHud(signal(0.314_159, 0.278_91))).toBe(
      'EAR 0.314 · MAR 0.279',
    );
  });

  it('얼굴 신호가 없거나 값이 유효하지 않으면 0으로 위장하지 않는다', () => {
    expect(formatLandmarkSignalHud(null)).toBe(EMPTY_LANDMARK_SIGNAL_HUD);
    expect(formatLandmarkSignalHud(signal(Number.NaN, 0.2))).toBe(
      EMPTY_LANDMARK_SIGNAL_HUD,
    );
  });
});
