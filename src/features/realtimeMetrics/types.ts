import type { InputMethod } from '../../shared/types/backend';

/**
 * Realtime Metrics Window — 메인 창(Look Talk 본 화면)의 GazeRuntime이 이미 계산한 값을
 * 별도 브라우저 Window(팝업)에 표시만 하기 위한 채널/타입 정의.
 *
 * React Context는 별도 Window 사이에서 공유되지 않으므로(서로 다른 JS 실행 환경/document),
 * 두 창 사이의 유일한 통신 수단으로 BroadcastChannel을 쓴다. postMessage(window.opener 기반)
 * 대신 BroadcastChannel을 선택한 이유: (1) origin이 항상 동일(같은 앱이 스스로 여는 팝업)해서
 * origin 검사가 필요한 postMessage의 이점이 없고, (2) opener 참조를 안전하게 유지/재연결하는
 * 로직(stale window reference 등)을 직접 구현할 필요 없이 channel name 하나로 재연결이
 * 자동으로 되며, (3) 팝업이 열려있지 않을 때 producer(main window)가 아무 조건 분기 없이
 * 그냥 postMessage해도 안전하다(리스너가 없으면 조용히 버려짐).
 */
export const REALTIME_METRICS_CHANNEL_NAME = 'looktalk-realtime-metrics';
export const REALTIME_METRICS_WINDOW_NAME = 'looktalk-realtime-metrics';
export const REALTIME_METRICS_ROUTE_PATH = '/monitor/realtime-metrics';

export const REALTIME_METRICS_FRAME_MESSAGE = 'LOOKTALK_METRICS_FRAME';
export const REALTIME_METRICS_READY_MESSAGE = 'LOOKTALK_METRICS_READY';

export type RealtimeMetricsDisplayMode = 'GAZE' | 'BLINK' | 'MOUTH';

export interface RealtimeMetricsPayload {
  /** frame.hasSignal 그대로 — false면 얼굴 미검출/활성 calibration 없음. */
  hasSignal: boolean;

  gaze: {
    /** 최종 화면 좌표. frame.cursorCssPx 그대로(viewport CSS px) — 팝업에서 재계산하지 않는다. */
    x: number | null;
    y: number | null;
    /** 참고용 정규화 좌표(0..1, canonical/mirrored). GazeSignal.irisX/irisY 그대로. */
    irisX: number | null;
    irisY: number | null;
    confidence: number | null;
  };

  eye: {
    ear: number | null;
    eyeClosed: boolean | null;
    /** blinkGate.ts의 EAR_CLOSE_THRESHOLD/EAR_OPEN_THRESHOLD를 그대로 가져온다(재계산/중복 하드코딩 금지). */
    closeThreshold: number;
    openThreshold: number;
  };

  mouth: {
    mar: number | null;
    /** MouthController가 실제로 판정한 isOpen 결과. 팝업이 mar>=threshold를 직접 재판정하지 않는다. */
    mouthOpen: boolean | null;
    /** MouthController.OPEN_THRESHOLD/CLOSE_THRESHOLD를 그대로 가져온다. */
    openThreshold: number;
    closeThreshold: number;
  };

  /** Patient runtime(GazeInteractionProvider)에서만 존재하는 값 — Calibration에는
   * DwellController/MouthController/GazeFilter의 fixation 개념 자체가 없으므로,
   * 억지로 계산하지 않고 이 필드 전체를 생략(undefined)한다. */
  interaction?: {
    hoveredTargetId: string | null;
    progress: number | null;
    fixationCount: number;
  };

  /** resolveGazeInputMode() 결과(DWELL/MOUTH)가 아니라 실제 backend currentInputMethod.
   * BLINK가 DWELL로 fallback되는 것과 무관하게 팝업 표시 모드는 이 값을 기준으로 판단한다. */
  inputMethod: InputMethod | null;

  timestamp: number;
}

export interface RealtimeMetricsFrameMessage {
  type: typeof REALTIME_METRICS_FRAME_MESSAGE;
  payload: RealtimeMetricsPayload;
}

export interface RealtimeMetricsReadyMessage {
  type: typeof REALTIME_METRICS_READY_MESSAGE;
}

export type RealtimeMetricsChannelMessage = RealtimeMetricsFrameMessage | RealtimeMetricsReadyMessage;
