import type { GazeCoordinateDisplay } from './gazeCoordinateDisplay';
import type { RealtimeMetricsPayload } from './types';

export interface GazePanelPosition {
  /** panel 안에서의 0..1 fractional 위치(clamp 완료). 점을 그릴 데이터가 없으면 둘 다 null —
   * 팝업은 이 경우 점을 아예 그리지 않는다(가짜 (0,0) 좌표를 만들지 않는다). */
  fractionX: number | null;
  fractionY: number | null;
}

const NO_POSITION: GazePanelPosition = { fractionX: null, fractionY: null };

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * RealtimeMetricsWindowPage의 gaze visualization panel(고정 크기가 아니라 CSS로 늘어나는
 * 컨테이너) 안에서 점을 그릴 0..1 fractional 위치를 계산하는 순수 함수.
 *
 * 원칙(핵심): "측정 좌표"와 "점의 화면 위치"를 분리한다. 이 함수는 점의 위치(fraction)만
 * 계산하고, 라벨에 표시하는 실제 측정값(§realtimeMetricsFormat.ts)은 절대 건드리지 않는다 —
 * GazeCoordinateDisplay의 x/y를 그대로 라벨에 쓰고, 이 함수의 결과는 오직 dot의
 * left/top(%) 계산에만 쓴다.
 *
 * - NORMALIZED(0..1, iris canonical): 이미 0..1이므로 그대로 fraction으로 쓴다(추가 변환 없음).
 * - PX(main window CSS px, gazeCoordinateDisplay.ts 주석 참고): payload.coordinateSpace
 *   (같은 main window의 window.innerWidth/innerHeight, §buildRealtimeMetricsPayload.ts
 *   currentCoordinateSpace())로 나눠 0..1로 정규화한다. 팝업 자신의 크기나
 *   window.innerWidth/innerHeight를 원본 viewport로 쓰지 않는다 — 그 값은 팝업 자신의
 *   창 크기일 뿐 gaze가 측정된 원본 화면과 무관하다.
 * - coordinateSpace가 없거나(옛 payload 등) width/height가 0 이하/비유한이면 안전하게
 *   "점 없음"으로 처리한다 — 잘못된 값으로 레이아웃이 깨지지 않게 한다.
 * - 모든 결과는 0..1로 clamp한다 — 시선이 화면 경계를 살짝 벗어나는 프레임에서도 점이
 *   panel 밖으로 나가지 않는다.
 * - NaN/Infinity/좌표 없음(NONE)은 전부 "점 없음"(null/null)으로 통일한다.
 */
export function mapGazeToPanel(
  display: GazeCoordinateDisplay,
  coordinateSpace: RealtimeMetricsPayload['coordinateSpace'] | null | undefined,
): GazePanelPosition {
  if (display.kind === 'NONE') {
    return NO_POSITION;
  }

  if (!isFiniteNumber(display.x) || !isFiniteNumber(display.y)) {
    return NO_POSITION;
  }

  if (display.kind === 'NORMALIZED') {
    return { fractionX: clamp01(display.x), fractionY: clamp01(display.y) };
  }

  // PX
  if (
    !coordinateSpace ||
    !isFiniteNumber(coordinateSpace.width) ||
    !isFiniteNumber(coordinateSpace.height) ||
    coordinateSpace.width <= 0 ||
    coordinateSpace.height <= 0
  ) {
    return NO_POSITION;
  }

  return {
    fractionX: clamp01(display.x / coordinateSpace.width),
    fractionY: clamp01(display.y / coordinateSpace.height),
  };
}
