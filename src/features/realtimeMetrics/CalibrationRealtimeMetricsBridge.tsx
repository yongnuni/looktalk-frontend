import { useEffect } from 'react';
import type { BlinkCalibrationSnapshot, MouthCalibrationSnapshot } from '../calibration/inputCalibration';
import type { PatientCalibrationStage } from '../calibration/PatientCalibrationFlow';
import type { GazeSignal } from '../faceTracking/types';
import { buildCalibrationRealtimeMetricsPayload } from './buildRealtimeMetricsPayload';
import { useRealtimeMetricsProducer } from './useRealtimeMetricsProducer';

interface CalibrationRealtimeMetricsBridgeProps {
  /** useCalibrationRunner()가 이미 계산해 50ms throttle로 state화해 둔 값을 그대로 받는다
   * (여기서 새로 tracking하지 않는다). */
  signal: GazeSignal | null;
  /** useCalibrationRunner().cursorNormalized 그대로 — homography가 아직 없으면(점 수집 중) null. */
  cursorNormalized: { x: number; y: number } | null;
  /** useCalibrationRunner()의 flowStage 그대로 — 팝업이 GAZE/BLINK/MOUTH 중 어느 모드로
   * 보여야 하는지 결정한다(§displayMode.ts). 9pt(mode:'pre')는 이 값이 항상 GAZE_RUNNING이라
   * 자연히 GAZE 모드로만 표시된다. */
  flowStage: PatientCalibrationStage;
  blinkProgress: BlinkCalibrationSnapshot | null;
  mouthProgress: MouthCalibrationSnapshot | null;
}

/**
 * Realtime Metrics Window(별도 브라우저 창)의 Calibration runtime producer. UI를
 * 렌더링하지 않는다(return null). CalibrationPage/PreCalibrationPage 안에서만 마운트한다 —
 * 카메라/FaceLandmarker/homography 계산은 이미 useCalibrationRunner()가 소유하고 있고, 이
 * 컴포넌트는 그 결과값만 읽어 같은 BroadcastChannel로 내보낸다(RealtimeMetricsBridge와
 * 채널/throttle 로직을 useRealtimeMetricsProducer()로 공유).
 */
export function CalibrationRealtimeMetricsBridge({
  signal,
  cursorNormalized,
  flowStage,
  blinkProgress,
  mouthProgress,
}: CalibrationRealtimeMetricsBridgeProps) {
  const { publish } = useRealtimeMetricsProducer();

  useEffect(() => {
    publish(
      buildCalibrationRealtimeMetricsPayload(signal, cursorNormalized, {
        flowStage,
        blinkProgress,
        mouthProgress,
      }),
    );
  }, [signal, cursorNormalized, flowStage, blinkProgress, mouthProgress, publish]);

  return null;
}
