import { createPortal } from 'react-dom';
import { useGazeRuntime } from '../gazeRuntime/GazeRuntimeContext';
import GazeCursorImage from './GazeCursorImage';

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
    <GazeCursorImage x={cursorCssPx.x} y={cursorCssPx.y} />,
    document.body,
  );
}
