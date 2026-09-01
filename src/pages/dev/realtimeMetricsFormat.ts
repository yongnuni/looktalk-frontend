import type { GazeCoordinateDisplay } from '../../features/realtimeMetrics/gazeCoordinateDisplay';

/** RealtimeMetricsWindowPage의 숫자 행과 RealtimeGazePosition의 dot 라벨이 공유하는
 * 포맷팅 규칙 — 두 곳이 서로 다른 반올림/자릿수를 쓰지 않도록 한 곳에 모은다. */

export function formatPx(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${Math.round(value)} px`;
}

export function formatRatio(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

/** kind별로 단위를 절대 섞지 않는다 — PX는 항상 "N px", NORMALIZED는 항상 소수점 3자리뿐. */
export function formatGazeAxis(display: GazeCoordinateDisplay, axis: 'x' | 'y'): string {
  if (display.kind === 'PX') return formatPx(display[axis]);
  if (display.kind === 'NORMALIZED') return formatRatio(display[axis], 3);
  return '—';
}

/** dot 옆 "(X, Y)" 라벨 전용 — formatPx/formatGazeAxis와 동일한 반올림 규칙(PX는
 * Math.round, NORMALIZED는 toFixed(3))을 쓰되, 단위(" px")를 두 번 반복하지 않고 한 쌍의
 * 좌표로 합쳐서 보여준다. 좌표가 없으면(NONE, 또는 NaN/Infinity) null — 호출부가 라벨
 * 자체를 렌더링하지 않는다. */
export function formatGazeCoordinatePair(display: GazeCoordinateDisplay): string | null {
  if (display.kind === 'PX') {
    if (!Number.isFinite(display.x) || !Number.isFinite(display.y)) {
      return null;
    }
    return `${Math.round(display.x)}, ${Math.round(display.y)}`;
  }

  if (display.kind === 'NORMALIZED') {
    if (!Number.isFinite(display.x) || !Number.isFinite(display.y)) {
      return null;
    }
    return `${display.x.toFixed(3)}, ${display.y.toFixed(3)}`;
  }

  return null;
}
