import type { InputMethod } from '../../shared/types/backend';
import type { RealtimeMetricsCalibrationMode, RealtimeMetricsDisplayMode } from './types';

export interface RealtimeMetricsDisplayModeInput {
  /** 실제 backend currentInputMethod(Patient runtime payload에서만 의미 있음). */
  inputMethod?: InputMethod | null;
  /** RealtimeMetricsPayload.calibration.mode 그대로(Calibration producer에서만 채워짐). */
  calibrationMode?: RealtimeMetricsCalibrationMode;
}

/**
 * 팝업 표시 모드 우선순위: 1) calibration 단계(calibrationMode), 2) currentInputMethod,
 * 3) 기본 GAZE.
 *
 * calibrationMode는 CalibrationRealtimeMetricsBridge가 flowStage(GAZE_RUNNING/
 * BLINK_RUNNING/MOUTH_RUNNING)로부터 만들어 payload.calibration.mode에 싣는 값이다
 * (buildRealtimeMetricsPayload.ts). Patient runtime payload는 이 필드를 아예 만들지
 * 않으므로(undefined) 자연히 2)/3) 순서로 fallback한다 — 기존 Patient runtime 동작(실제
 * currentInputMethod 기준 판정)은 회귀 없이 그대로 유지된다.
 *
 * resolveGazeInputMode()(multimodalInput/gazeInputMode.ts)와 달리 BLINK를 DWELL로
 * fallback시키지 않는다 — 실시간 모니터는 실제 currentInputMethod를 그대로 구분해서 보여줘야
 * BLINK 사용자의 EAR 화면이 사라지지 않는다.
 */
export function resolveRealtimeMetricsDisplayMode(
  input: RealtimeMetricsDisplayModeInput | null | undefined,
): RealtimeMetricsDisplayMode {
  if (input?.calibrationMode) {
    return input.calibrationMode;
  }

  if (input?.inputMethod === 'BLINK') {
    return 'BLINK';
  }

  if (input?.inputMethod === 'MOUTH') {
    return 'MOUTH';
  }

  return 'GAZE';
}
