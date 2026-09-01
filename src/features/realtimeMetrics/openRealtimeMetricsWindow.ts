import { REALTIME_METRICS_ROUTE_PATH, REALTIME_METRICS_WINDOW_NAME } from './types';

const WINDOW_FEATURES = 'width=380,height=260,resizable=yes,menubar=no,toolbar=no,location=no,status=no';

/** 모듈 스코프에 단 하나의 참조만 유지한다(leak 방지) — 새 open() 시도마다 늘어나지 않는다. */
let metricsWindowRef: Window | null = null;

export type OpenRealtimeMetricsWindowResult = 'opened' | 'focused' | 'blocked';

/**
 * Realtime Metrics Window를 연다(사용자 gesture, 예: 버튼 클릭, 에서 호출해야 팝업 차단을
 * 피할 수 있다). 이미 열려 있으면 새 창을 만들지 않는다 — 화면 녹화 중 팝업을 최소화해
 * 둔 경우가 있으므로, 기존 창을 focus()해서 앞으로 가져오거나 최소화를 풀지 않는다
 * (LandmarkPopupProvider.prepareWindow()와 동일한 정책). 사용자가 창을 닫은 뒤에는
 * 참조가 stale(closed=true)해지므로 자동으로 새 창을 다시 연다.
 */
export function openRealtimeMetricsWindow(): OpenRealtimeMetricsWindowResult {
  if (metricsWindowRef && !metricsWindowRef.closed) {
    return 'focused';
  }

  const url = new URL(REALTIME_METRICS_ROUTE_PATH, window.location.origin).toString();
  const win = window.open(url, REALTIME_METRICS_WINDOW_NAME, WINDOW_FEATURES);

  if (!win) {
    // 팝업 차단됨 — 예외를 던지지 않고 호출 측이 사용자에게 안내할 수 있도록 결과만 알려준다.
    metricsWindowRef = null;
    return 'blocked';
  }

  metricsWindowRef = win;
  return 'opened';
}

/** launcher가 가벼운 polling(500~1000ms)으로 "지금 팝업이 열려 있는가"를 확인할 때 쓴다.
 * 매 frame 체크하지 않는다 — setInterval 기반의 저빈도 polling 전용 API. */
export function isRealtimeMetricsWindowOpen(): boolean {
  return metricsWindowRef !== null && !metricsWindowRef.closed;
}
