import { getKeyLabel } from '../layouts/qwertyLayouts';
import './KeyboardKey.css';

interface KeyboardKeyProps {
  value: string;
  hovered?: boolean;
  /** 0..1 — hovered일 때만 의미가 있다(Dwell 진행률 시각화). */
  dwellProgress?: number;
  active?: boolean; // Shift 등 토글 상태 표시용
  wide?: boolean; // Space처럼 넓게 그릴 키
  onSelect: (value: string) => void;
  /** false면 gaze target은 유지하고 실제 pointer click만 막는다. */
  pointerSelectionEnabled?: boolean;
}

export default function KeyboardKey({
  value,
  hovered,
  dwellProgress = 0,
  active,
  wide,
  onSelect,
  pointerSelectionEnabled = true,
}: KeyboardKeyProps) {
  const classNames = ['keyboard-key'];
  if (hovered) classNames.push('keyboard-key--hovered');
  if (active) classNames.push('keyboard-key--active');
  if (wide) classNames.push('keyboard-key--wide');
  if (!pointerSelectionEnabled) classNames.push('keyboard-key--pointer-disabled');

  return (
    <button
      type="button"
      className={classNames.join(' ')}
      data-key-id={value}
      style={hovered ? { ['--dwell-progress' as string]: dwellProgress } : undefined}
      onClick={pointerSelectionEnabled ? () => onSelect(value) : undefined}
    >
      {getKeyLabel(value)}
    </button>
  );
}
