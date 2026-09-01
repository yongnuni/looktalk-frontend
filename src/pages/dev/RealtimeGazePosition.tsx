import { resolveGazeCoordinateDisplay } from '../../features/realtimeMetrics/gazeCoordinateDisplay';
import { mapGazeToPanel } from '../../features/realtimeMetrics/mapGazeToPanel';
import type { RealtimeMetricsPayload } from '../../features/realtimeMetrics/types';
import { formatGazeCoordinatePair } from './realtimeMetricsFormat';
import './RealtimeGazePosition.css';

interface RealtimeGazePositionProps {
  payload: RealtimeMetricsPayload | null;
  connected: boolean;
}

/** dot이 panel 오른쪽 15% 안쪽에 들어오면 라벨을 왼쪽으로 뒤집어 panel 밖으로 잘리지
 * 않게 한다(§8 panel 경계 처리). */
const LABEL_FLIP_THRESHOLD = 0.85;

/**
 * Realtime Metrics Window 상단의 "실시간 시선 위치" 시각화 영역. GAZE/BLINK/MOUTH 모든
 * mode에서 동일하게 렌더링한다(§10) — "지금 어디를 보고 있는지"와 "지금 EAR/MAR이 어떻게
 * 변하는지"를 같은 화면에서 함께 보여주기 위함이다.
 *
 * 새 tracking을 만들지 않는다 — payload.gaze/coordinateSpace(이미 BroadcastChannel로
 * 들어오고 있는 값)만 읽는다. 점의 화면 위치(mapGazeToPanel의 fraction)와 라벨에 쓰는
 * 실제 측정값(formatGazeCoordinatePair)은 서로 다른 계산이다 — 점 위치만 panel 크기에
 *맞게 scaling하고, 라벨의 측정값은 절대 변조하지 않는다(§2).
 */
export default function RealtimeGazePosition({ payload, connected }: RealtimeGazePositionProps) {
  const display = resolveGazeCoordinateDisplay(payload);
  const position = mapGazeToPanel(display, payload?.coordinateSpace);
  const label = formatGazeCoordinatePair(display);

  const hasDot =
    connected &&
    Boolean(payload?.hasSignal) &&
    position.fractionX !== null &&
    position.fractionY !== null &&
    label !== null;

  return (
    <div className="realtime-gaze-position">
      {hasDot ? (
        <div
          className={
            (position.fractionX ?? 0) >= LABEL_FLIP_THRESHOLD
              ? 'realtime-gaze-position__dot-wrap realtime-gaze-position__dot-wrap--label-left'
              : 'realtime-gaze-position__dot-wrap'
          }
          style={{
            left: `${(position.fractionX ?? 0) * 100}%`,
            top: `${(position.fractionY ?? 0) * 100}%`,
          }}
        >
          <span className="realtime-gaze-position__dot" />
          <span className="realtime-gaze-position__label">({label})</span>
        </div>
      ) : (
        <span className="realtime-gaze-position__empty">NO SIGNAL</span>
      )}
    </div>
  );
}
