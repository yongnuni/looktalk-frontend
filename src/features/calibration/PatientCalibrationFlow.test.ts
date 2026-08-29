import { describe, expect, it } from 'vitest';
import type { InputMethodTestResult, InputTestMethod } from './inputMethodTest';
import type { GazeCalibrationResult } from './types';
import { PatientCalibrationFlow } from './PatientCalibrationFlow';

const GAZE_RESULT: GazeCalibrationResult = {
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
  calibratedViewport: {
    widthPx: 1920,
    heightPx: 1080,
    aspectRatio: 1920 / 1080,
    orientation: 'landscape',
  },
  reprojectionRmseNormalized: 0.01,
  createdAtLocal: '2026-08-29T00:00:00.000Z',
};

const BLINK_RESULT = {
  closeThreshold: 0.17,
  openThreshold: 0.21,
  openMedian: 0.3,
  closedMedian: 0.1,
  fallback: false,
};

const MOUTH_RESULT = {
  openThreshold: 0.265,
  closeThreshold: 0.19,
  baseline: 0.1,
  openMar: 0.4,
  activationThreshold: 0.18,
  fallback: false,
};

function inputResult(method: InputTestMethod, targetWord: string): InputMethodTestResult {
  return {
    method,
    targetWord,
    finalInput: targetWord,
    durationMs: 1_000,
    confirmationAttempts: 1,
    incorrectAttempts: 0,
  };
}

function completeThroughBlinkTest(flow: PatientCalibrationFlow): void {
  flow.completeGaze(GAZE_RESULT);
  flow.completeInputTest(inputResult('GAZE', flow.getSnapshot().inputTestTargets.gaze ?? ''));
  flow.completeBlink(BLINK_RESULT);
  flow.completeInputTest(inputResult('BLINK', flow.getSnapshot().inputTestTargets.blink ?? ''));
}

describe('PatientCalibrationFlow', () => {
  it('각 calibration 직후 같은 방식의 입력 테스트를 거쳐야 complete까지 진행한다', () => {
    const flow = new PatientCalibrationFlow(() => 0);
    expect(flow.getSnapshot().stage).toBe('GAZE_RUNNING');

    flow.completeGaze(GAZE_RESULT);
    expect(flow.getSnapshot()).toMatchObject({
      stage: 'GAZE_INPUT_TEST',
      inputTestTargets: { gaze: '물' },
    });

    flow.completeInputTest(inputResult('GAZE', '물'));
    expect(flow.getSnapshot().stage).toBe('BLINK_RUNNING');

    flow.completeBlink(BLINK_RESULT);
    expect(flow.getSnapshot()).toMatchObject({
      stage: 'BLINK_INPUT_TEST',
      inputTestTargets: { blink: '밥' },
    });

    flow.completeInputTest(inputResult('BLINK', '밥'));
    expect(flow.getSnapshot().stage).toBe('MOUTH_RUNNING');

    flow.completeMouth(MOUTH_RESULT);
    expect(flow.getSnapshot()).toMatchObject({
      stage: 'MOUTH_INPUT_TEST',
      inputTestTargets: { mouth: '집' },
    });

    flow.completeInputTest(inputResult('MOUTH', '집'));
    expect(flow.getSnapshot().stage).toBe('REVIEW');

    flow.startSaving();
    expect(flow.getSnapshot().stage).toBe('SAVING');
    flow.complete();
    expect(flow.getSnapshot().stage).toBe('COMPLETE');
  });

  it('목표와 다른 결과나 아직 완료하지 않은 테스트로는 REVIEW가 열리지 않는다', () => {
    const flow = new PatientCalibrationFlow(() => 0);
    flow.completeGaze(GAZE_RESULT);

    flow.completeInputTest(inputResult('GAZE', '집'));
    expect(flow.getSnapshot().stage).toBe('GAZE_INPUT_TEST');

    flow.completeInputTest(inputResult('GAZE', '물'));
    flow.completeBlink(BLINK_RESULT);
    flow.completeInputTest(inputResult('BLINK', '밥'));
    flow.completeMouth(MOUTH_RESULT);
    expect(flow.getSnapshot().stage).toBe('MOUTH_INPUT_TEST');
  });

  it('blink 재시도는 gaze 결과와 gaze 입력 테스트를 보존한다', () => {
    const flow = new PatientCalibrationFlow(() => 0);
    flow.completeGaze(GAZE_RESULT);
    flow.completeInputTest(inputResult('GAZE', '물'));
    flow.retryBlink();

    expect(flow.getSnapshot()).toMatchObject({
      stage: 'BLINK_RUNNING',
      gaze: GAZE_RESULT,
      blink: null,
      inputTestTargets: { gaze: '물', blink: null, mouth: null },
      inputTests: { gaze: inputResult('GAZE', '물'), blink: null, mouth: null },
    });
  });

  it('mouth 재시도는 이전 calibration과 두 입력 테스트를 보존한다', () => {
    const flow = new PatientCalibrationFlow(() => 0);
    completeThroughBlinkTest(flow);
    flow.retryMouth();

    expect(flow.getSnapshot()).toMatchObject({
      stage: 'MOUTH_RUNNING',
      gaze: GAZE_RESULT,
      blink: BLINK_RESULT,
      mouth: null,
      inputTests: {
        gaze: inputResult('GAZE', '물'),
        blink: inputResult('BLINK', '밥'),
        mouth: null,
      },
    });
  });

  it('저장 실패는 REVIEW로 돌아가고 전체 재측정만 모든 결과를 초기화한다', () => {
    const flow = new PatientCalibrationFlow(() => 0);
    completeThroughBlinkTest(flow);
    flow.completeMouth(MOUTH_RESULT);
    flow.completeInputTest(inputResult('MOUTH', '집'));
    flow.startSaving();
    flow.savingFailed();
    expect(flow.getSnapshot().stage).toBe('REVIEW');

    flow.restartGaze();
    expect(flow.getSnapshot()).toEqual({
      stage: 'GAZE_RUNNING',
      gaze: null,
      blink: null,
      mouth: null,
      inputTestTargets: { gaze: null, blink: null, mouth: null },
      inputTests: { gaze: null, blink: null, mouth: null },
    });
  });
});
