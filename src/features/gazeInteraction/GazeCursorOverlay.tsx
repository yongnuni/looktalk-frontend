import { createPortal } from 'react-dom';
import { useGazeRuntime } from '../gazeRuntime/GazeRuntimeContext';
import { useGazeInteraction } from './GazeInteractionContext';
import './GazeCursorOverlay.css';

/**
 * Front Step 12 §5 — PATIENT 전체가 공유하는 단 하나의 Gaze Cursor. PatientHomePage가
 * 갖고 있던 로컬 `createPortal` cursor를 대체한다(§8) — 페이지별 cursor를 만들지 않는다.
 *
 * §7 — active calibration과 cursorCssPx가 모두 있을 때만 표시한다. 추적 실패 중 마지막
 * 유효 위치를 유지하는 정책은 GazeRuntimeProvider가 이미 담당한다(cursorCssPx 자체가
 * 마지막 유효값을 유지) — 여기서는 그 값을 그대로 그리기만 한다.
 */
export default function GazeCursorOverlay() {
  const { cursorCssPx, activeCalibration } = useGazeRuntime();
  const { progress } = useGazeInteraction();

  if (!activeCalibration || !cursorCssPx) {
    return null;
  }

  return createPortal(
    <div
      className="gaze-cursor-overlay"
      style={{
        left: `${cursorCssPx.x}px`,
        top: `${cursorCssPx.y}px`,
        ['--gaze-cursor-progress' as string]: progress,
      }}
    >
      <span className="gaze-cursor-overlay__ring" />
      <span className="gaze-cursor-overlay__dot" />
    </div>,
    document.body,
  );
}
