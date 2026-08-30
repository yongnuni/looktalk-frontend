import { useMemo } from 'react';
import { resolveRealtimeMetricsDisplayMode } from '../../features/realtimeMetrics/displayMode';
import { resolveGazeCoordinateDisplay } from '../../features/realtimeMetrics/gazeCoordinateDisplay';
import type { GazeCoordinateDisplay } from '../../features/realtimeMetrics/gazeCoordinateDisplay';
import { useRealtimeMetricsChannel } from '../../features/realtimeMetrics/useRealtimeMetricsChannel';
import type { RealtimeMetricsDisplayMode } from '../../features/realtimeMetrics/types';
import './RealtimeMetricsWindowPage.css';

/**
 * Realtime Metrics Window — 별도 브라우저 창(window.open, features/realtimeMetrics/
 * openRealtimeMetricsWindow.ts)으로 열리는 전용 route. 절대 useCamera()/
 * createFaceLandmarker()/useFaceTracking()을 호출하지 않는다 — 오직 메인 창의
 * RealtimeMetricsBridge가 BroadcastChannel로 흘려주는 값만 표시한다.
 */

function formatPx(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${Math.round(value)} px`;
}

function formatRatio(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

function formatEyeState(eyeClosed: boolean | null | undefined): string {
  if (eyeClosed === null || eyeClosed === undefined) return '—';
  return eyeClosed ? 'CLOSED' : 'OPEN';
}

function formatMouthState(mouthOpen: boolean | null | undefined): string {
  if (mouthOpen === null || mouthOpen === undefined) return '—';
  return mouthOpen ? 'OPEN' : 'CLOSED';
}

/** kind별로 단위를 절대 섞지 않는다 — PX는 항상 "N px", NORMALIZED는 항상 소수점 3자리뿐. */
function formatGazeAxis(display: GazeCoordinateDisplay, axis: 'x' | 'y'): string {
  if (display.kind === 'PX') return formatPx(display[axis]);
  if (display.kind === 'NORMALIZED') return formatRatio(display[axis], 3);
  return '—';
}

const MODE_TITLE: Record<RealtimeMetricsDisplayMode, string> = {
  GAZE: '실시간 시선 좌표',
  BLINK: '실시간 눈 움직임',
  MOUTH: '실시간 입 움직임',
};

// homography가 아직 없는 calibration 수집 구간에서 iris normalized fallback을 보여줄 때의 제목.
// gaze.x/y(px)가 있으면 이 제목 대신 항상 MODE_TITLE.GAZE("실시간 시선 좌표")를 그대로 쓴다.
const NORMALIZED_GAZE_TITLE = '실시간 홍채 좌표';

export default function RealtimeMetricsWindowPage() {
  const { payload, connected } = useRealtimeMetricsChannel();
  const mode = resolveRealtimeMetricsDisplayMode(payload?.inputMethod);
  const coordinateDisplay = resolveGazeCoordinateDisplay(payload);
  const isNormalizedFallback = mode === 'GAZE' && coordinateDisplay.kind === 'NORMALIZED';

  const statusLabel = useMemo(() => {
    if (!connected || !payload) return 'NO SIGNAL';
    if (!payload.hasSignal) return 'TRACKING...';
    return 'TRACKING';
  }, [connected, payload]);

  const statusOk = statusLabel === 'TRACKING';
  const title = isNormalizedFallback ? NORMALIZED_GAZE_TITLE : MODE_TITLE[mode];

  return (
    <main className="realtime-metrics-window">
      <header className="realtime-metrics-window__header">
        <h1>{title}</h1>
      </header>

      <section className="realtime-metrics-window__body">
        {mode === 'GAZE' && (
          <dl className="realtime-metrics-window__rows">
            <div>
              <dt>X</dt>
              <dd>{formatGazeAxis(coordinateDisplay, 'x')}</dd>
            </div>
            <div>
              <dt>Y</dt>
              <dd>{formatGazeAxis(coordinateDisplay, 'y')}</dd>
            </div>
          </dl>
        )}

        {mode === 'BLINK' && (
          <dl className="realtime-metrics-window__rows">
            <div>
              <dt>EAR</dt>
              <dd>{formatRatio(payload?.eye.ear, 3)}</dd>
            </div>
            <div>
              <dt>CLOSE 기준</dt>
              <dd>{formatRatio(payload?.eye.closeThreshold, 3)}</dd>
            </div>
            <div>
              <dt>OPEN 기준</dt>
              <dd>{formatRatio(payload?.eye.openThreshold, 3)}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{formatEyeState(payload?.eye.eyeClosed)}</dd>
            </div>
          </dl>
        )}

        {mode === 'MOUTH' && (
          <dl className="realtime-metrics-window__rows">
            <div>
              <dt>MAR</dt>
              <dd>{formatRatio(payload?.mouth.mar, 3)}</dd>
            </div>
            <div>
              <dt>OPEN 기준</dt>
              <dd>{formatRatio(payload?.mouth.openThreshold, 3)}</dd>
            </div>
            <div>
              <dt>CLOSE 기준</dt>
              <dd>{formatRatio(payload?.mouth.closeThreshold, 3)}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{formatMouthState(payload?.mouth.mouthOpen)}</dd>
            </div>
          </dl>
        )}

        {mode === 'GAZE' && payload?.interaction?.hoveredTargetId && (
          <dl className="realtime-metrics-window__rows realtime-metrics-window__rows--sub">
            <div>
              <dt>응시 대상</dt>
              <dd>{payload.interaction.hoveredTargetId}</dd>
            </div>
            <div>
              <dt>선택 진행도</dt>
              <dd>{formatRatio((payload.interaction.progress ?? 0) * 100, 0)}%</dd>
            </div>
            <div>
              <dt>고정 감지</dt>
              <dd>{payload.interaction.fixationCount}</dd>
            </div>
          </dl>
        )}
      </section>

      <footer className="realtime-metrics-window__footer">
        {isNormalizedFallback ? (
          'NORMALIZED'
        ) : (
          <>
            <span className={`realtime-metrics-window__dot${statusOk ? ' realtime-metrics-window__dot--ok' : ''}`} />
            {statusLabel}
          </>
        )}
      </footer>
    </main>
  );
}
