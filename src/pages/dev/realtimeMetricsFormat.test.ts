import { describe, expect, it } from 'vitest';
import { formatGazeAxis, formatGazeCoordinatePair, formatPx, formatRatio } from './realtimeMetricsFormat';

describe('formatGazeCoordinatePair', () => {
  it('PX는 기존 formatPx와 동일한 반올림 규칙으로 정수 좌표쌍을 만든다', () => {
    expect(formatGazeCoordinatePair({ kind: 'PX', x: 833.6, y: 420.4 })).toBe('834, 420');
  });

  it('NORMALIZED는 기존 formatRatio와 동일하게 소수점 3자리를 유지한다', () => {
    expect(formatGazeCoordinatePair({ kind: 'NORMALIZED', x: 0.4234, y: 0.5876 })).toBe('0.423, 0.588');
  });

  it('NONE이거나 NaN/Infinity면 null이다(가짜 좌표를 만들지 않는다)', () => {
    expect(formatGazeCoordinatePair({ kind: 'NONE' })).toBeNull();
    expect(formatGazeCoordinatePair({ kind: 'PX', x: Number.NaN, y: 1 })).toBeNull();
    expect(formatGazeCoordinatePair({ kind: 'NORMALIZED', x: Number.POSITIVE_INFINITY, y: 1 })).toBeNull();
  });
});

describe('기존 포맷터 회귀 없음(RealtimeMetricsWindowPage에서 그대로 재사용)', () => {
  it('formatPx', () => {
    expect(formatPx(834.4)).toBe('834 px');
    expect(formatPx(null)).toBe('—');
  });

  it('formatRatio', () => {
    expect(formatRatio(0.4234, 3)).toBe('0.423');
    expect(formatRatio(undefined, 3)).toBe('—');
  });

  it('formatGazeAxis', () => {
    expect(formatGazeAxis({ kind: 'PX', x: 834, y: 421 }, 'x')).toBe('834 px');
    expect(formatGazeAxis({ kind: 'NORMALIZED', x: 0.423, y: 0.512 }, 'y')).toBe('0.512');
    expect(formatGazeAxis({ kind: 'NONE' }, 'x')).toBe('—');
  });
});
