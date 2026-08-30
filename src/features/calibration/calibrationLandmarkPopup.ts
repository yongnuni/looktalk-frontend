import type { LandmarkAutoOpenRequest } from '../landmarkPopup/landmarkAutoOpen';
import type { PatientCalibrationStage } from './PatientCalibrationFlow';

const PATIENT_STAGE_POPUPS: Partial<
  Record<PatientCalibrationStage, LandmarkAutoOpenRequest>
> = {
  GAZE_RUNNING: { key: 'patient-gaze', variant: 'full' },
  GAZE_INPUT_TEST: { key: 'patient-gaze-test', variant: 'looktalk' },
  BLINK_RUNNING: { key: 'patient-blink', variant: 'full' },
  BLINK_INPUT_TEST: { key: 'patient-blink-test', variant: 'looktalk' },
  MOUTH_RUNNING: { key: 'patient-mouth', variant: 'full' },
  MOUTH_INPUT_TEST: { key: 'patient-mouth-test', variant: 'looktalk' },
};

export function resolvePatientCalibrationPopup(
  stage: PatientCalibrationStage,
  trackingReady: boolean,
  sessionKey = 'default',
): LandmarkAutoOpenRequest | null {
  const request = trackingReady ? (PATIENT_STAGE_POPUPS[stage] ?? null) : null;
  return request ? { ...request, key: `${request.key}:${sessionKey}` } : null;
}

export function resolvePreCalibrationPopup(
  calibrationRunning: boolean,
  sessionKey = 'default',
): LandmarkAutoOpenRequest | null {
  return calibrationRunning
    ? { key: `pre-gaze:${sessionKey}`, variant: 'full' }
    : null;
}
