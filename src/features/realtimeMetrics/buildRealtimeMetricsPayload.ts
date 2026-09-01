import type { InputMethod } from '../../shared/types/backend';
import type { BlinkCalibrationSnapshot, MouthCalibrationSnapshot } from '../calibration/inputCalibration';
import type { PatientCalibrationStage } from '../calibration/PatientCalibrationFlow';
import { viewportNormalizedToCssPx } from '../calibration/viewportTargets';
import { EAR_CLOSE_THRESHOLD, EAR_OPEN_THRESHOLD } from '../faceTracking/gaze/blinkGate';
import type { GazeSignal } from '../faceTracking/types';
import type { GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import { MOUTH_CLOSE_THRESHOLD, MOUTH_OPEN_THRESHOLD } from '../multimodalInput/MouthController';
import { REALTIME_METRICS_FRAME_MESSAGE } from './types';
import type { RealtimeMetricsFrameMessage, RealtimeMetricsPayload } from './types';

/**
 * gaze.x/y(PX)를 계산한 main window 자신의 viewport 크기. viewportNormalizedToCssPx()
 * (calibration/viewportTargets.ts)가 이미 동일하게 window.innerWidth/innerHeight를
 * 기준으로 px를 계산하므로, 여기서도 같은 기준을 그대로 읽어 payload에 실어 보낸다 —
 * 팝업(RealtimeGazePosition)이 자기 자신의 window.innerWidth/innerHeight를 원본 gaze
 * viewport로 착각하지 않도록 하기 위함이다. 새 tracking이나 별도 계산이 아니라 이미
 * 존재하는 전역값을 읽기만 한다.
 */
function currentCoordinateSpace(): NonNullable<RealtimeMetricsPayload['coordinateSpace']> {
  return { width: window.innerWidth, height: window.innerHeight };
}

export interface CalibrationRealtimeMetricsStage {
  flowStage: PatientCalibrationStage;
  blinkProgress: BlinkCalibrationSnapshot | null;
  mouthProgress: MouthCalibrationSnapshot | null;
}

/**
 * flowStage → 팝업 display mode. 9pt(useCalibrationRunner({mode:'pre'}))는
 * BLINK_RUNNING/MOUTH_RUNNING으로 절대 전이하지 않으므로(useCalibrationRunner.ts의
 * handleFrame이 mode==='patient'일 때만 그 분기를 탄다) 이 함수는 자연히 항상 'GAZE'를
 * 반환한다 — 9pt/16pt를 구분하는 별도 분기를 추가하지 않는다.
 */
function buildCalibrationField(
  stage: CalibrationRealtimeMetricsStage,
): NonNullable<RealtimeMetricsPayload['calibration']> {
  if (stage.flowStage === 'BLINK_RUNNING') {
    return {
      mode: 'BLINK',
      phaseProgress: stage.blinkProgress?.phaseProgress,
      trialNumber: stage.blinkProgress?.trialNumber,
      totalTrials: stage.blinkProgress?.totalTrials,
    };
  }

  if (stage.flowStage === 'MOUTH_RUNNING') {
    return {
      mode: 'MOUTH',
      phaseProgress: stage.mouthProgress?.phaseProgress,
      trialNumber: stage.mouthProgress?.trialNumber,
      totalTrials: stage.mouthProgress?.totalTrials,
    };
  }

  return { mode: 'GAZE' };
}

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
    coordinateSpace: currentCoordinateSpace(),
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
 * - inputMethod: null. displayMode.ts는 이 함수가 채우는 `calibration` 필드를 항상
 *   inputMethod보다 먼저 확인하므로, 여기서는 inputMethod를 굳이 합성하지 않는다.
 * - calibration: stage 인자가 주어지면 flowStage(GAZE_RUNNING/BLINK_RUNNING/MOUTH_RUNNING)를
 *   그대로 팝업 표시 모드로 변환해서 담는다(§realtimeMetrics displayMode.ts). stage를 생략한
 *   호출(기존 테스트 등)은 calibration 필드 자체를 만들지 않는다 — 이 경우도
 *   resolveRealtimeMetricsDisplayMode()가 inputMethod=null → 기본값 GAZE로 판정하므로
 *   동작은 동일하다.
 * - coordinateSpace: gaze.x/y(px)와 동일하게 이 main window 자신의 window.innerWidth/
 *   innerHeight를 그대로 싣는다 — 팝업(RealtimeGazePosition)이 gaze dot을 자기 panel
 *   크기에 맞게 다시 scaling할 때 쓴다(§mapGazeToPanel.ts).
 */
export function buildCalibrationRealtimeMetricsPayload(
  signal: GazeSignal | null,
  cursorNormalized: { x: number; y: number } | null,
  stage?: CalibrationRealtimeMetricsStage,
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
    calibration: stage ? buildCalibrationField(stage) : undefined,
    coordinateSpace: currentCoordinateSpace(),
    timestamp: signal?.timestamp ?? Date.now(),
  };
}
