import { describe, expect, it } from 'vitest';
import { useCalibrationStore } from './calibrationStore';
import type { GazeCalibrationResult } from '../types';

const FAKE_RESULT: GazeCalibrationResult = {
  schemaVersion: 1,
  mappingType: 'RAW_HOMOGRAPHY',
  coordinateSpace: 'NORMALIZED_VIEWPORT',
  homography: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  mirrorX: true,
  mirrorStrategy: 'PRE_INFERENCE_FRAME_FLIP',
  grid: { rows: 4, cols: 4, margin: 0.08 },
  calibratedViewport: { widthPx: 1920, heightPx: 1080, aspectRatio: 1920 / 1080, orientation: 'landscape' },
  reprojectionRmseNormalized: 0.01,
  createdAtLocal: '2026-01-01T00:00:00.000Z',
};

describe('calibrationStore.reset (Front Step 10 §17 account-boundary 계정 전환 격리)', () => {
  it('9. 사용자 A의 active+candidate 상태에서 reset()을 호출하면 candidate까지 포함해 idle로 완전히 되돌아간다(다음 사용자 B가 재사용하지 않음)', () => {
    useCalibrationStore.getState().setActive('calib-a', FAKE_RESULT);
    useCalibrationStore.getState().setCandidate(FAKE_RESULT);
    expect(useCalibrationStore.getState().activeStatus).toBe('loaded');
    expect(useCalibrationStore.getState().active).not.toBeNull();
    expect(useCalibrationStore.getState().candidate).not.toBeNull();

    useCalibrationStore.getState().reset();

    const state = useCalibrationStore.getState();
    expect(state.activeStatus).toBe('idle');
    expect(state.active).toBeNull();
    expect(state.activeCalibrationId).toBeNull();
    expect(state.activeError).toBeNull();
    expect(state.candidate).toBeNull();
  });

  it('일반 재측정 흐름의 resetActive와 달리, account-boundary reset()은 candidate도 함께 지운다는 것을 명시적으로 확인한다', () => {
    useCalibrationStore.getState().setCandidate(FAKE_RESULT);
    expect(useCalibrationStore.getState().candidate).not.toBeNull();

    useCalibrationStore.getState().reset();

    expect(useCalibrationStore.getState().candidate).toBeNull();
  });
});
