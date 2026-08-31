import cursorImage from '../../assets/cursor.png';
import './GazeCursorOverlay.css';

interface GazeCursorImageProps {
  x: number;
  y: number;
  className?: string;
}

/** Runtime overlay와 standalone calibration이 공유하는 단일 cursor.png 표현. */
export default function GazeCursorImage({
  x,
  y,
  className,
}: GazeCursorImageProps) {
  return (
    <img
      src={cursorImage}
      alt=""
      className={`gaze-cursor-overlay${className ? ` ${className}` : ''}`}
      draggable={false}
      style={{ left: `${x}px`, top: `${y}px` }}
    />
  );
}
