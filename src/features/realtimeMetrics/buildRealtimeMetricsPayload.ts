import type { InputMethod } from '../../shared/types/backend';
import { viewportNormalizedToCssPx } from '../calibration/viewportTargets';
import { EAR_CLOSE_THRESHOLD, EAR_OPEN_THRESHOLD } from '../faceTracking/gaze/blinkGate';
import type { GazeSignal } from '../faceTracking/types';
import type { GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import { MOUTH_CLOSE_THRESHOLD, MOUTH_OPEN_THRESHOLD } from '../multimodalInput/MouthController';
import { REALTIME_METRICS_FRAME_MESSAGE } from './types';
import type { RealtimeMetricsFrameMessage, RealtimeMetricsPayload } from './types';

export interface RealtimeMetricsInteractionInput {
  hoveredTargetId: string | null;
  progress: number | null;
  /** GazeInteractionContextValue.mouthOpen 그대로(§GazeInteractionProvider) — 팝업 전용 재계산 없음. */
  mouthOpen: boolean | null;
}

/**
 * 한 GazeFrame(+ GazeInteraction 상태 + 실제 backend currentInputMethod)을
 * RealtimeMetricsPayload로 변환하는 순수 함수. RealtimeMetricsBridge의 구독 배선에서
 * 분리해 React/BroadcastChannel 없이 deterministic하게 테스트한다
 * (gazeFrameBuilder.ts/gazeFrameSelection.ts와 동일한 관례).
 */
export function buildRealtimeMetricsPayload(
  frame: GazeFrame,
  interaction: RealtimeMetricsInteractionInput,
  inputMethod: InputMethod | null,
): RealtimeMetricsPayload {
  const signal = frame.signal;
  const cursor = frame.cursorCssPx;

  return {
    hasSignal: frame.hasSignal,
    gaze: {
      x: cursor ? cursor.x : null,
      y: cursor ? cursor.y : null,
      irisX: signal ? signal.irisX : null,
      irisY: signal ? signal.irisY : null,
      confidence: signal ? signal.irisConfidence : null,
    },
    eye: {
      ear: signal ? signal.ear : null,
      eyeClosed: signal ? signal.eyeClosed : null,
      closeThreshold: EAR_CLOSE_THRESHOLD,
      openThreshold: EAR_OPEN_THRESHOLD,
    },
    mouth: {
      mar: signal ? signal.mar : null,
      mouthOpen: interaction.mouthOpen,
      openThreshold: MOUTH_OPEN_THRESHOLD,
      closeThreshold: MOUTH_CLOSE_THRESHOLD,
    },
    interaction: {
      hoveredTargetId: interaction.hoveredTargetId,
      progress: interaction.progress,
      fixationCount: frame.fixationCount,
    },
    inputMethod,
    timestamp: frame.now,
  };
}

export function toRealtimeMetricsFrameMessage(payload: RealtimeMetricsPayload): RealtimeMetricsFrameMessage {
  return { type: REALTIME_METRICS_FRAME_MESSAGE, payload };
}

/**
 * Calibration runtime(useCalibrationRunner.ts) 전용 변환. Patient runtime의 GazeFrame과
 * 달리 Calibration에는 GazeRuntimeProvider/GazeFilter/GazeInteractionProvider가 없다 —
 * CalibrationSession이 16점 수집을 마치고 homography를 풀기 전까지는 화면 좌표 자체가
 * 존재하지 않는다(cursorNormalized===null). 이 함수는 그 사실을 그대로 반영한다:
 *
 * - gaze.x/y: cursorNormalized가 있을 때만(=homography 확정 이후) viewportNormalizedToCssPx()로
 *   CSS px 변환해서 채운다 — CalibrationPage.tsx가 자신의 화면 커서를 그릴 때 쓰는 것과
 *   동일한 값/동일한 변환 함수다(GazeFilter의 Kalman/smoothing/dead-zone/fixation은 전혀
 *   적용되지 않은 raw homography 투영값). 점 수집 중(homography 없음)에는 null로 둔다 —
 *   0..1 정규화 값을 px라고 속여 보여주지 않는다.
 * - eye/mouth의 raw 값(ear/mar/eyeClosed)은 signal에 이미 있으므로 그대로 옮긴다.
 * - mouth.mouthOpen: MouthController 자체가 Calibration에는 존재하지 않으므로 새로
 *   threshold 판정을 만들지 않고 null(판정 불가)로 둔다.
 * - interaction: DwellController/MouthController/GazeFilter의 fixation이 전부 Calibration에
 *   없으므로 필드 자체를 생략한다(undefined) — 억지로 0/null 채운 가짜 값을 만들지 않는다.
 * - inputMethod: null. resolveRealtimeMetricsDisplayMode(null)이 이미 기본값 'GAZE'를
 *   반환하므로, 이 값만으로 팝업이 자동으로 "실시간 시선 좌표" 모드를 보여준다(별도
 *   source/context 필드를 추가하지 않아도 됨).
 */
export function buildCalibrationRealtimeMetricsPayload(
  signal: GazeSignal | null,
  cursorNormalized: { x: number; y: number } | null,
): RealtimeMetricsPayload {
  const cursorCssPx = cursorNormalized ? viewportNormalizedToCssPx(cursorNormalized) : null;

  return {
    hasSignal: signal !== null,
    gaze: {
      x: cursorCssPx ? cursorCssPx.x : null,
      y: cursorCssPx ? cursorCssPx.y : null,
      irisX: signal ? signal.irisX : null,
      irisY: signal ? signal.irisY : null,
      confidence: signal ? signal.irisConfidence : null,
    },
    eye: {
      ear: signal ? signal.ear : null,
      eyeClosed: signal ? signal.eyeClosed : null,
      closeThreshold: EAR_CLOSE_THRESHOLD,
      openThreshold: EAR_OPEN_THRESHOLD,
    },
    mouth: {
      mar: signal ? signal.mar : null,
      mouthOpen: null,
      openThreshold: MOUTH_OPEN_THRESHOLD,
      closeThreshold: MOUTH_CLOSE_THRESHOLD,
    },
    inputMethod: null,
    timestamp: signal?.timestamp ?? Date.now(),
  };
}
