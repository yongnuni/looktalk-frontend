import { describe, expect, it } from 'vitest';
import { resolveRealtimeMetricsDisplayMode } from './displayMode';

describe('resolveRealtimeMetricsDisplayMode', () => {
  describe('Patient runtime(inputMethod 기반) — 기존 동작 회귀 없음', () => {
    it('BLINK는 resolveGazeInputMode와 달리 DWELL로 fallback되지 않고 그대로 BLINK 모드를 반환한다', () => {
      expect(resolveRealtimeMetricsDisplayMode({ inputMethod: 'BLINK' })).toBe('BLINK');
    });

    it('MOUTH는 MOUTH 모드를 반환한다', () => {
      expect(resolveRealtimeMetricsDisplayMode({ inputMethod: 'MOUTH' })).toBe('MOUTH');
    });

    it('EYE_TRACKING/undefined/null은 기본 GAZE 모드를 반환한다', () => {
      expect(resolveRealtimeMetricsDisplayMode({ inputMethod: 'EYE_TRACKING' })).toBe('GAZE');
      expect(resolveRealtimeMetricsDisplayMode({ inputMethod: undefined })).toBe('GAZE');
      expect(resolveRealtimeMetricsDisplayMode({ inputMethod: null })).toBe('GAZE');
      expect(resolveRealtimeMetricsDisplayMode(undefined)).toBe('GAZE');
      expect(resolveRealtimeMetricsDisplayMode(null)).toBe('GAZE');
    });
  });

  describe('Calibration runtime(calibrationMode 기반) — flowStage가 그대로 표시 모드가 된다', () => {
    it('GAZE_RUNNING(calibrationMode=GAZE)은 GAZE 모드를 반환한다', () => {
      expect(resolveRealtimeMetricsDisplayMode({ inputMethod: null, calibrationMode: 'GAZE' })).toBe('GAZE');
    });

    it('BLINK_RUNNING(calibrationMode=BLINK)은 BLINK 모드를 반환한다', () => {
      expect(resolveRealtimeMetricsDisplayMode({ inputMethod: null, calibrationMode: 'BLINK' })).toBe('BLINK');
    });

    it('MOUTH_RUNNING(calibrationMode=MOUTH)은 MOUTH 모드를 반환한다', () => {
      expect(resolveRealtimeMetricsDisplayMode({ inputMethod: null, calibrationMode: 'MOUTH' })).toBe('MOUTH');
    });
  });

  it('calibrationMode가 있으면 inputMethod보다 우선한다', () => {
    expect(resolveRealtimeMetricsDisplayMode({ inputMethod: 'BLINK', calibrationMode: 'GAZE' })).toBe('GAZE');
    expect(resolveRealtimeMetricsDisplayMode({ inputMethod: 'MOUTH', calibrationMode: 'BLINK' })).toBe('BLINK');
  });
});
