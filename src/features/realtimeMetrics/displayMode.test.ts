import { describe, expect, it } from 'vitest';
import { resolveRealtimeMetricsDisplayMode } from './displayMode';

describe('resolveRealtimeMetricsDisplayMode', () => {
  it('BLINK는 resolveGazeInputMode와 달리 DWELL로 fallback되지 않고 그대로 BLINK 모드를 반환한다', () => {
    expect(resolveRealtimeMetricsDisplayMode('BLINK')).toBe('BLINK');
  });

  it('MOUTH는 MOUTH 모드를 반환한다', () => {
    expect(resolveRealtimeMetricsDisplayMode('MOUTH')).toBe('MOUTH');
  });

  it('EYE_TRACKING/undefined/null은 기본 GAZE 모드를 반환한다', () => {
    expect(resolveRealtimeMetricsDisplayMode('EYE_TRACKING')).toBe('GAZE');
    expect(resolveRealtimeMetricsDisplayMode(undefined)).toBe('GAZE');
    expect(resolveRealtimeMetricsDisplayMode(null)).toBe('GAZE');
  });
});
