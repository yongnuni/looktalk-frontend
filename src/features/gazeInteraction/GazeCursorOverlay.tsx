import { createPortal } from 'react-dom';
import { useGazeRuntime } from '../gazeRuntime/GazeRuntimeContext';
import cursorImage from '../../assets/cursor.png';
import './GazeCursorOverlay.css';

/**
 * PATIENT 전체에서 공통으로 사용하는 Gaze Cursor.
 * 시선 좌표(cursorCssPx)에 cursor.png 이미지만 표시한다.
 */
export default function GazeCursorOverlay() {
  const { cursorCssPx, activeCalibration } = useGazeRuntime();

  if (!activeCalibration || !cursorCssPx) {
    return null;
  }

  return createPortal(
    <img
      src={cursorImage}
      alt=""
      className="gaze-cursor-overlay"
      draggable={false}
      style={{
        left: `${cursorCssPx.x}px`,
        top: `${cursorCssPx.y}px`,
      }}
    />,
    document.body,
  );
}
