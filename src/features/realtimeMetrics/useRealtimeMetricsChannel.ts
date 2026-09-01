import { useEffect, useRef, useState } from 'react';
import { REALTIME_METRICS_CHANNEL_NAME, REALTIME_METRICS_FRAME_MESSAGE, REALTIME_METRICS_READY_MESSAGE } from './types';
import type { RealtimeMetricsChannelMessage, RealtimeMetricsPayload } from './types';

/** 이 시간(ms) 동안 새 프레임이 없으면 "연결 끊김"으로 간주한다(메인 창이 닫히거나
 * PATIENT runtime을 벗어난 경우). 전송 주기(100ms)의 넉넉한 배수. */
const STALE_AFTER_MS = 1500;
const STALE_CHECK_INTERVAL_MS = 500;

export interface UseRealtimeMetricsChannelResult {
  payload: RealtimeMetricsPayload | null;
  /** true면 최근 STALE_AFTER_MS 이내에 메인 창으로부터 프레임을 받았다. */
  connected: boolean;
}

/**
 * Realtime Metrics Window(팝업)에서만 쓰는 consumer 훅. useGazeRuntime()을 이 창에서
 * 새로 호출하지 않는다 — React Context는 창 사이에서 공유되지 않으므로, 메인 창의
 * RealtimeMetricsBridge가 BroadcastChannel로 흘려주는 값만 구독한다.
 *
 * mount 시 READY 메시지를 보내 메인 창이 캐시해 둔 최신 값을 즉시 받아온다(그렇지 않으면
 * 다음 정기 전송(최대 100ms)까지 화면이 비어 있게 된다). 팝업을 닫았다 다시 열어도
 * 새 channel 인스턴스 + 새 READY 전송으로 항상 재연결된다.
 */
export function useRealtimeMetricsChannel(): UseRealtimeMetricsChannelResult {
  const [payload, setPayload] = useState<RealtimeMetricsPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const lastReceivedAtRef = useRef(0);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    const channel = new BroadcastChannel(REALTIME_METRICS_CHANNEL_NAME);

    channel.onmessage = (event: MessageEvent<RealtimeMetricsChannelMessage>) => {
      if (event.data?.type !== REALTIME_METRICS_FRAME_MESSAGE) {
        return;
      }

      lastReceivedAtRef.current = Date.now();
      setConnected(true);
      setPayload(event.data.payload);
    };

    channel.postMessage({ type: REALTIME_METRICS_READY_MESSAGE });

    const staleTimer = window.setInterval(() => {
      if (lastReceivedAtRef.current !== 0 && Date.now() - lastReceivedAtRef.current > STALE_AFTER_MS) {
        setConnected(false);
      }
    }, STALE_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(staleTimer);
      channel.close();
    };
  }, []);

  return { payload, connected };
}
