import { useMemo } from 'react';
import { resolveRealtimeMetricsDisplayMode } from '../../features/realtimeMetrics/displayMode';
import { resolveGazeCoordinateDisplay } from '../../features/realtimeMetrics/gazeCoordinateDisplay';
import { useRealtimeMetricsChannel } from '../../features/realtimeMetrics/useRealtimeMetricsChannel';
import type { RealtimeMetricsDisplayMode } from '../../features/realtimeMetrics/types';
import RealtimeGazePosition from './RealtimeGazePosition';
import { formatGazeCoordinatePair, formatRatio } from './realtimeMetricsFormat';
import './RealtimeMetricsWindowPage.css';

/**
 * Realtime Metrics Window — 별도 브라우저 창(window.open, features/realtimeMetrics/
 * openRealtimeMetricsWindow.ts)으로 열리는 전용 route. 절대 useCamera()/
 * createFaceLandmarker()/useFaceTracking()을 호출하지 않는다 — 오직 메인 창의
 * RealtimeMetricsBridge가 BroadcastChannel로 흘려주는 값만 표시한다.
 */

function formatEyeState(eyeClosed: boolean | null | undefined): string {
  if (eyeClosed === null || eyeClosed === undefined) return '—';
  return eyeClosed ? '눈 감음' : '눈 뜸';
}

function formatMouthState(mouthOpen: boolean | null | undefined): string {
  if (mouthOpen === null || mouthOpen === undefined) return '—';
  return mouthOpen ? '입벌림' : '입닫음';
}

function formatCalibrationProgress(phaseProgress: number | null | undefined): string {
  if (phaseProgress === null || phaseProgress === undefined || !Number.isFinite(phaseProgress)) {
    return '—';
  }
  return `${Math.round(phaseProgress * 100)}%`;
}

function formatTrial(trialNumber: number | undefined, totalTrials: number | undefined): string | null {
  if (trialNumber === undefined || totalTrials === undefined) {
    return null;
  }
  return `${trialNumber} / ${totalTrials}`;
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
  const mode = resolveRealtimeMetricsDisplayMode({
    inputMethod: payload?.inputMethod,
    calibrationMode: payload?.calibration?.mode,
  });
  const coordinateDisplay = resolveGazeCoordinateDisplay(payload);
  const coordinatePair = formatGazeCoordinatePair(coordinateDisplay);
  const calibrationTrial = formatTrial(
    payload?.calibration?.trialNumber,
    payload?.calibration?.totalTrials,
  );
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
        <RealtimeGazePosition payload={payload} connected={connected} />

        {mode === 'GAZE' && (
          <dl className="realtime-metrics-window__rows">
            <div className="realtime-metrics-window__coordinate-row">
              <dt>위치좌표 x,y</dt>
              <dd>{coordinatePair ? `(${coordinatePair})` : '—'}</dd>
            </div>
          </dl>
        )}

        {mode === 'BLINK' && (
          <dl className="realtime-metrics-window__rows">
            <div>
              <dt>깜빡임 시간</dt>
              <dd>{formatRatio(payload?.eye.ear, 3)}</dd>
            </div>
            <div>
              <dt>눈 감음 기준</dt>
              <dd>{formatRatio(payload?.eye.closeThreshold, 3)}</dd>
            </div>
            <div>
              <dt>눈 뜸 기준</dt>
              <dd>{formatRatio(payload?.eye.openThreshold, 3)}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{formatEyeState(payload?.eye.eyeClosed)}</dd>
            </div>
            {payload?.calibration?.mode === 'BLINK' && (
              <div>
                <dt>진행률</dt>
                <dd>{formatCalibrationProgress(payload.calibration.phaseProgress)}</dd>
              </div>
            )}
            {payload?.calibration?.mode === 'BLINK' && calibrationTrial && (
              <div>
                <dt>Trial</dt>
                <dd>{calibrationTrial}</dd>
              </div>
            )}
          </dl>
        )}

        {mode === 'MOUTH' && (
          <dl className="realtime-metrics-window__rows">
            <div>
              <dt>입벌림 시간</dt>
              <dd>{formatRatio(payload?.mouth.mar, 3)}</dd>
            </div>
            <div>
              <dt>입벌림 기준</dt>
              <dd>{formatRatio(payload?.mouth.openThreshold, 3)}</dd>
            </div>
            <div>
              <dt>입닫음 기준</dt>
              <dd>{formatRatio(payload?.mouth.closeThreshold, 3)}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{formatMouthState(payload?.mouth.mouthOpen)}</dd>
            </div>
            {payload?.calibration?.mode === 'MOUTH' && (
              <div>
                <dt>진행률</dt>
                <dd>{formatCalibrationProgress(payload.calibration.phaseProgress)}</dd>
              </div>
            )}
            {payload?.calibration?.mode === 'MOUTH' && calibrationTrial && (
              <div>
                <dt>Trial</dt>
                <dd>{calibrationTrial}</dd>
              </div>
            )}
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
