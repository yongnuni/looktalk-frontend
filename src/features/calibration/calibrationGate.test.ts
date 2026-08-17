import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../shared/constants/routes';
import { deriveCalibrationGateDecision, resolveCalibrationCompletionPath } from './calibrationGate';

describe('deriveCalibrationGateDecision', () => {
  it('1. active exists(loaded) → READY', () => {
    expect(deriveCalibrationGateDecision('loaded')).toBe('READY');
  });

  it('2. active not found → CALIBRATION_REQUIRED', () => {
    expect(deriveCalibrationGateDecision('not_found')).toBe('CALIBRATION_REQUIRED');
  });

  it('3. idle/loading → LOADING(READY로 오판하지 않는다)', () => {
    expect(deriveCalibrationGateDecision('idle')).toBe('LOADING');
    expect(deriveCalibrationGateDecision('loading')).toBe('LOADING');
    expect(deriveCalibrationGateDecision('idle')).not.toBe('READY');
  });

  it('4. server/network error → ERROR(CALIBRATION_REQUIRED로 오판하지 않는다)', () => {
    expect(deriveCalibrationGateDecision('error')).toBe('ERROR');
    expect(deriveCalibrationGateDecision('error')).not.toBe('CALIBRATION_REQUIRED');
  });
});

describe('resolveCalibrationCompletionPath', () => {
  it('6. Bootstrap(최초 진입, retest 아님) 완료 → ROUTES.MAIN(/main) — /patient는 실제 서비스 Main이 아닌 고아 route', () => {
    expect(resolveCalibrationCompletionPath(false)).toBe(ROUTES.MAIN);
    expect(resolveCalibrationCompletionPath(false)).toBe('/main');
  });

  it('7. Analysis 재측정 완료 → ROUTES.ANALYSIS(/analysis)', () => {
    expect(resolveCalibrationCompletionPath(true)).toBe(ROUTES.ANALYSIS);
    expect(resolveCalibrationCompletionPath(true)).toBe('/analysis');
  });
});
