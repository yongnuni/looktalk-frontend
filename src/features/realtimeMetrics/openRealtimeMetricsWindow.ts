import {
  REALTIME_METRICS_ROUTE_PATH,
  REALTIME_METRICS_WINDOW_NAME,
} from './types';

// 실시간 시선 좌표 별도 팝업 사용 여부
// false: 팝업 실행 안 함
// true: 팝업 실행
const ENABLE_REALTIME_METRICS_POPUP = false;

const WINDOW_FEATURES =
  'width=380,height=260,resizable=yes,menubar=no,toolbar=no,location=no,status=no';

/** 모듈 스코프에 단 하나의 참조만 유지한다(leak 방지). */
let metricsWindowRef: Window | null = null;

export type OpenRealtimeMetricsWindowResult =
  | 'opened'
  | 'focused'
  | 'blocked'
  | 'disabled';

/**
 * Realtime Metrics Window를 연다.
 *
 * ENABLE_REALTIME_METRICS_POPUP이 false이면
 * 별도 브라우저 창을 생성하지 않는다.
 *
 * true이면 기존 팝업 동작을 그대로 사용한다.
 */
export function openRealtimeMetricsWindow(): OpenRealtimeMetricsWindowResult {
  // 팝업 기능이 OFF이면 새 창을 생성하지 않는다.
  if (!ENABLE_REALTIME_METRICS_POPUP) {
    metricsWindowRef = null;
    return 'disabled';
  }

  if (metricsWindowRef && !metricsWindowRef.closed) {
    // 기존 창이 있으면 새 창을 생성하지 않는다.
    // 기존 창에 focus()도 호출하지 않는다.
    return 'focused';
  }

  const url = new URL(
    REALTIME_METRICS_ROUTE_PATH,
    window.location.origin,
  ).toString();

  const win = window.open(url, REALTIME_METRICS_WINDOW_NAME, WINDOW_FEATURES);

  if (!win) {
    // 팝업 차단
    metricsWindowRef = null;
    return 'blocked';
  }

  metricsWindowRef = win;
  return 'opened';
}

/**
 * 실시간 시선 좌표 팝업이 현재 열려 있는지 확인한다.
 *
 * 팝업 기능이 OFF이면 항상 false를 반환한다.
 */
export function isRealtimeMetricsWindowOpen(): boolean {
  if (!ENABLE_REALTIME_METRICS_POPUP) {
    return false;
  }

  return metricsWindowRef !== null && !metricsWindowRef.closed;
}
