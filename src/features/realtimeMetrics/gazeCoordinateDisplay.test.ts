import { describe, expect, it } from 'vitest';
import { resolveGazeCoordinateDisplay } from './gazeCoordinateDisplay';
import type { RealtimeMetricsPayload } from './types';

function calibrationLikePayload(overrides: Partial<RealtimeMetricsPayload['gaze']> = {}): Pick<RealtimeMetricsPayload, 'gaze' | 'interaction'> {
  return {
    gaze: { x: null, y: null, irisX: 0.482, irisY: 0.376, confidence: 0.9, ...overrides },
    interaction: undefined,
  };
}

function patientLikePayload(overrides: Partial<RealtimeMetricsPayload['gaze']> = {}): Pick<RealtimeMetricsPayload, 'gaze' | 'interaction'> {
  return {
    gaze: { x: 642, y: 318, irisX: 0.5, irisY: 0.4, confidence: 0.9, ...overrides },
    interaction: { hoveredTargetId: null, progress: 0, fixationCount: 0 },
  };
}

describe('resolveGazeCoordinateDisplay', () => {
  it('1. gaze.x/y===null이고 irisX/irisY가 있으면(calibration, homography 미확정) NORMALIZED로 iris 값을 그대로 쓴다', () => {
    const result = resolveGazeCoordinateDisplay(calibrationLikePayload());
    expect(result).toEqual({ kind: 'NORMALIZED', x: 0.482, y: 0.376 });
  });

  it('2. gaze.x/y가 있으면 irisX/irisY보다 항상 우선해서 PX로 쓴다', () => {
    const result = resolveGazeCoordinateDisplay(patientLikePayload());
    expect(result).toEqual({ kind: 'PX', x: 642, y: 318 });
  });

  it('3. gaze.x/y와 irisX/irisY가 모두 없으면(얼굴 미검출) NONE이다', () => {
    const result = resolveGazeCoordinateDisplay(calibrationLikePayload({ irisX: null, irisY: null }));
    expect(result).toEqual({ kind: 'NONE' });
  });

  it('4. Patient 일반 payload는 gaze.x/y가 있는 한 기존 그대로 PX를 쓴다(회귀 없음)', () => {
    const result = resolveGazeCoordinateDisplay(patientLikePayload({ x: 100, y: 200 }));
    expect(result).toEqual({ kind: 'PX', x: 100, y: 200 });
  });

  it('5. Patient에서 눈 감음/저신뢰도로 gaze.x/y가 일시적으로 null이 되어도(interaction은 여전히 존재) NORMALIZED로 바뀌지 않고 NONE을 유지한다', () => {
    const result = resolveGazeCoordinateDisplay(patientLikePayload({ x: null, y: null }));
    expect(result).toEqual({ kind: 'NONE' });
  });

  it('payload 자체가 없으면(팝업이 아직 아무 프레임도 못 받음) NONE이다', () => {
    expect(resolveGazeCoordinateDisplay(null)).toEqual({ kind: 'NONE' });
    expect(resolveGazeCoordinateDisplay(undefined)).toEqual({ kind: 'NONE' });
  });
});
