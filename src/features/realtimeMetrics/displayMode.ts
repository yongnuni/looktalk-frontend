import type { InputMethod } from '../../shared/types/backend';
import type { RealtimeMetricsDisplayMode } from './types';

/**
 * 팝업 표시 모드 우선순위: 1) calibration 단계, 2) currentInputMethod, 3) 기본 GAZE.
 *
 * 이 코드베이스의 calibration은 시선-화면 매핑(homography) 16점 측정 하나뿐이고, gaze/blink/
 * mouth를 구분하는 별도 calibration 단계 개념이 없다(features/calibration/types.ts의
 * CalibrationRunnerStatus는 idle/running/done/verifying뿐 — 재확인 완료). 따라서 1번
 * 우선순위는 현재 코드에 적용할 대상이 없다 — calibration 구조를 이번 작업에서 새로
 * 만들지 않는다는 원칙에 따라, 여기서는 2)/3) 순서만 실제로 구현한다.
 *
 * resolveGazeInputMode()(multimodalInput/gazeInputMode.ts)와 달리 BLINK를 DWELL로
 * fallback시키지 않는다 — 실시간 모니터는 실제 currentInputMethod를 그대로 구분해서 보여줘야
 * BLINK 사용자의 EAR 화면이 사라지지 않는다.
 *
 * Calibration(CalibrationRealtimeMetricsBridge)에서 오는 payload는 inputMethod를 항상
 * null로 보낸다(캘리브레이션 중에는 아직 판단할 대상이 아님) — 이 함수의 기본 분기(GAZE)가
 * 자연히 적용되므로, "calibration이면 GAZE를 강제 표시"하기 위한 별도 source/context
 * 필드를 payload 타입에 추가하지 않았다.
 */
export function resolveRealtimeMetricsDisplayMode(
  inputMethod: InputMethod | null | undefined,
): RealtimeMetricsDisplayMode {
  if (inputMethod === 'BLINK') {
    return 'BLINK';
  }

  if (inputMethod === 'MOUTH') {
    return 'MOUTH';
  }

  return 'GAZE';
}
