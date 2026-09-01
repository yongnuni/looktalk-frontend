import type { RealtimeMetricsPayload } from './types';

export type GazeCoordinateDisplay =
  | { kind: 'PX'; x: number; y: number }
  | { kind: 'NORMALIZED'; x: number; y: number }
  | { kind: 'NONE' };

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * GAZE 표시 모드에서 X/Y를 어떤 좌표계로 보여줄지 결정하는 순수 함수(RealtimeMetricsWindowPage
 * 에서 분리 — displayMode.ts와 동일한 관례로 테스트 가능하게 만든다).
 *
 * 우선순위:
 * 1) payload.gaze.x/y(기존 그대로: Patient의 GazeFrame.cursorCssPx, 또는 Calibration의
 *    candidate homography + viewportNormalizedToCssPx() 결과 — 둘 다 CSS px)가 있으면
 *    그것을 최우선으로 쓴다. Patient의 기존 동작은 이 분기 그대로라 변경되지 않는다.
 * 2) gaze.x/y가 없을 때만 gaze.irisX/irisY(0..1 canonical 정규화 좌표, iris.ts
 *    computeAvgIris() 그대로 — px 아님)를 NORMALIZED로 보여준다. 단 이 fallback은
 *    payload.interaction이 아예 없는 producer에서만 적용한다 —
 *    CalibrationRealtimeMetricsBridge가 만드는 payload는 GazeInteractionProvider가 없어
 *    interaction 필드 자체를 만들지 않고(undefined), RealtimeMetricsBridge(Patient)가
 *    만드는 payload는 hoveredTargetId가 null이더라도 interaction 객체 자체는 항상 채워서
 *    보낸다. 이 차이를 그대로 구분자로 쓴다 — 새 source/context 필드를 추가하지 않고도
 *    "이 payload가 calibration에서 왔는가"를 안전하게 판별할 수 있다.
 *    이 게이트가 없으면 Patient에서 눈 감음/저신뢰도로 gaze.x/y가 일시적으로 null이 되는
 *    프레임(irisX/irisY는 여전히 존재)마다 화면이 "실시간 홍채 좌표"로 잘못 바뀐다 —
 *    Patient 기존 동작 회귀를 막기 위한 핵심 조건이다.
 * 3) 둘 다 없으면(얼굴 미검출 등) NONE — 화면에는 "—"로 표시한다.
 */
export function resolveGazeCoordinateDisplay(
  payload: Pick<RealtimeMetricsPayload, 'gaze' | 'interaction'> | null | undefined,
): GazeCoordinateDisplay {
  if (!payload) {
    return { kind: 'NONE' };
  }

  if (isFiniteNumber(payload.gaze.x) && isFiniteNumber(payload.gaze.y)) {
    return { kind: 'PX', x: payload.gaze.x, y: payload.gaze.y };
  }

  if (payload.interaction === undefined && isFiniteNumber(payload.gaze.irisX) && isFiniteNumber(payload.gaze.irisY)) {
    return { kind: 'NORMALIZED', x: payload.gaze.irisX, y: payload.gaze.irisY };
  }

  return { kind: 'NONE' };
}
