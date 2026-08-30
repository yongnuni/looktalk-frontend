import { useCallback, useEffect, useRef } from 'react';
import { toRealtimeMetricsFrameMessage } from './buildRealtimeMetricsPayload';
import { REALTIME_METRICS_CHANNEL_NAME, REALTIME_METRICS_READY_MESSAGE } from './types';
import type { RealtimeMetricsChannelMessage, RealtimeMetricsPayload } from './types';

// 팝업 표시용 전송 주기(~10Hz). tracking/selection 자체는 이 값과 무관하게 기존 FPS
// 그대로 매 프레임 수행된다 — 여기서 throttle하는 건 "BroadcastChannel로 내보내는 빈도"뿐이다.
const SEND_INTERVAL_MS = 100;

export interface RealtimeMetricsProducer {
  /** payload를 캐시해 두고, 마지막 전송 이후 SEND_INTERVAL_MS가 지났으면 즉시 전송한다. */
  publish: (payload: RealtimeMetricsPayload, nowMs?: number) => void;
}

/**
 * Realtime Metrics Window(팝업)로 보내는 BroadcastChannel producer의 공통 lifecycle.
 * Patient runtime(RealtimeMetricsBridge, GazeFrame 기반)과 Calibration runtime
 * (CalibrationRealtimeMetricsBridge, GazeSignal 기반)이 서로 다른 프레임 소스를 쓰더라도
 * "채널을 열고 유지 → READY 수신 시 캐시된 최신값 즉시 응답 → 10Hz throttle 전송"이라는
 * 동일한 통신 로직은 여기 하나로 모은다(요청 사양: "새로운 별도 통신 시스템을 만들지 마").
 */
export function useRealtimeMetricsProducer(): RealtimeMetricsProducer {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastPayloadRef = useRef<RealtimeMetricsPayload | null>(null);
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    const channel = new BroadcastChannel(REALTIME_METRICS_CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<RealtimeMetricsChannelMessage>) => {
      if (event.data?.type === REALTIME_METRICS_READY_MESSAGE && lastPayloadRef.current) {
        channel.postMessage(toRealtimeMetricsFrameMessage(lastPayloadRef.current));
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const publish = useCallback((payload: RealtimeMetricsPayload, nowMs: number = Date.now()) => {
    lastPayloadRef.current = payload;

    if (nowMs - lastSentAtRef.current < SEND_INTERVAL_MS) {
      return;
    }

    lastSentAtRef.current = nowMs;
    channelRef.current?.postMessage(toRealtimeMetricsFrameMessage(payload));
  }, []);

  return { publish };
}
