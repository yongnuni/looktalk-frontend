import { useEffect, useRef } from 'react';
import { useGazeInteraction } from '../gazeInteraction/GazeInteractionContext';
import { useGazeRuntime, type GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import { useUserSettings } from '../userSetting/hooks/useUserSettings';
import { buildRealtimeMetricsPayload } from './buildRealtimeMetricsPayload';
import { useRealtimeMetricsProducer } from './useRealtimeMetricsProducer';

/**
 * Realtime Metrics Window(별도 브라우저 창)의 Patient runtime producer. UI를 렌더링하지
 * 않는다(return null).
 *
 * 이 컴포넌트는 새 계산을 전혀 하지 않는다 — GazeRuntimeProvider.subscribeFrame()이 흘려주는
 * GazeFrame과 GazeInteractionProvider가 이미 계산해 둔 hoveredTargetId/progress/mouthOpen을
 * 그대로 읽어 BroadcastChannel로 내보낼 뿐이다(MediaPipe/GazeFilter/DwellController/
 * MouthController 인스턴스를 추가로 만들지 않는다). BroadcastChannel lifecycle/throttle
 * 자체는 useRealtimeMetricsProducer()(Calibration 쪽 producer와 공유)가 담당한다.
 *
 * PatientGazeRuntimeLayout에서 GazeInteractionProvider의 자식으로 마운트해야 한다
 * (useGazeInteraction()이 그 안에서만 동작하므로).
 */
export function RealtimeMetricsBridge() {
  const { subscribeFrame } = useGazeRuntime();
  const { hoveredTargetId, progress, mouthOpen } = useGazeInteraction();
  const { settings } = useUserSettings();
  const { publish } = useRealtimeMetricsProducer();

  const hoveredTargetIdRef = useRef(hoveredTargetId);
  const progressRef = useRef(progress);
  const mouthOpenRef = useRef(mouthOpen);
  const inputMethodRef = useRef(settings?.currentInputMethod ?? null);

  useEffect(() => {
    hoveredTargetIdRef.current = hoveredTargetId;
  }, [hoveredTargetId]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    mouthOpenRef.current = mouthOpen;
  }, [mouthOpen]);

  useEffect(() => {
    inputMethodRef.current = settings?.currentInputMethod ?? null;
  }, [settings?.currentInputMethod]);

  useEffect(() => {
    const handleFrame = (frame: GazeFrame) => {
      const payload = buildRealtimeMetricsPayload(
        frame,
        {
          hoveredTargetId: hoveredTargetIdRef.current,
          progress: progressRef.current,
          mouthOpen: mouthOpenRef.current,
        },
        inputMethodRef.current,
      );

      publish(payload, frame.now);
    };

    return subscribeFrame(handleFrame);
  }, [subscribeFrame, publish]);

  return null;
}
