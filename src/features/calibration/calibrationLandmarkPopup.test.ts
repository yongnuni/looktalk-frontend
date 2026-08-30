import { describe, expect, it } from 'vitest';
import {
  resolvePatientCalibrationPopup,
  resolvePreCalibrationPopup,
} from './calibrationLandmarkPopup';

describe('calibration Landmark PiP stage mapping', () => {
  it('calibration은 full, 각 입력 테스트는 looktalk을 연다', () => {
    expect(resolvePatientCalibrationPopup('GAZE_RUNNING', true)).toMatchObject({ variant: 'full' });
    expect(resolvePatientCalibrationPopup('GAZE_INPUT_TEST', true)).toMatchObject({ variant: 'looktalk' });
    expect(resolvePatientCalibrationPopup('BLINK_RUNNING', true)).toMatchObject({ variant: 'full' });
    expect(resolvePatientCalibrationPopup('BLINK_INPUT_TEST', true)).toMatchObject({ variant: 'looktalk' });
    expect(resolvePatientCalibrationPopup('MOUTH_RUNNING', true)).toMatchObject({ variant: 'full' });
    expect(resolvePatientCalibrationPopup('MOUTH_INPUT_TEST', true)).toMatchObject({ variant: 'looktalk' });
  });

  it('REVIEW/SAVING/COMPLETE와 준비 전에는 자동 PiP를 닫는다', () => {
    expect(resolvePatientCalibrationPopup('REVIEW', true)).toBeNull();
    expect(resolvePatientCalibrationPopup('SAVING', true)).toBeNull();
    expect(resolvePatientCalibrationPopup('COMPLETE', true)).toBeNull();
    expect(resolvePatientCalibrationPopup('GAZE_RUNNING', false)).toBeNull();
  });

  it('9점 측정 중에만 full PiP를 연다', () => {
    expect(resolvePreCalibrationPopup(true)).toEqual({ key: 'pre-gaze:default', variant: 'full' });
    expect(resolvePreCalibrationPopup(false)).toBeNull();
  });

  it('같은 stage도 새 calibration session이면 다른 자동 열기 key를 사용한다', () => {
    expect(resolvePatientCalibrationPopup('GAZE_RUNNING', true, 'session-1')?.key)
      .toBe('patient-gaze:session-1');
    expect(resolvePatientCalibrationPopup('GAZE_RUNNING', true, 'session-2')?.key)
      .toBe('patient-gaze:session-2');
    expect(resolvePreCalibrationPopup(true, 'session-2')?.key)
      .toBe('pre-gaze:session-2');
  });
});
