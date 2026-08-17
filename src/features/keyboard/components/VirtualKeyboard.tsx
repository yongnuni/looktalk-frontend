import KeyboardKey from './KeyboardKey';
import {
  FUNCTION_KEY_CONFIRM,
  FUNCTION_KEY_DEL,
  FUNCTION_KEY_LANGUAGE,
  FUNCTION_KEY_SHIFT,
  FUNCTION_KEY_SPACE,
} from '../layouts/qwertyLayouts';
import { getLayoutRows, type KeyboardState } from '../keyboardStateMachine';
import './VirtualKeyboard.css';

interface VirtualKeyboardProps {
  keyboardState: KeyboardState;
  hoveredKeyId?: string | null;
  /** 0..1, hoveredKeyId에 대한 진행률(dwell/mouth 등 공통 InputSelectionState.progress). */
  dwellProgress?: number;
  /** mouse click과 gaze dwell이 공유하는 단일 콜백(Integration Plan §15.3/15.4). */
  onKeySelect: (keyValue: string) => void;
  /** UserSetting.keyEnlarged(Step 4에서 실제 연동) 대응. */
  keyEnlarged?: boolean;
}

export default function VirtualKeyboard({
  keyboardState,
  hoveredKeyId = null,
  dwellProgress = 0,
  onKeySelect,
  keyEnlarged = false,
}: VirtualKeyboardProps) {
  const rows = getLayoutRows(keyboardState);

  const renderKey = (value: string, wide = false) => (
    <KeyboardKey
      key={value}
      value={value}
      hovered={hoveredKeyId === value}
      dwellProgress={hoveredKeyId === value ? dwellProgress : 0}
      active={value === FUNCTION_KEY_SHIFT && keyboardState.isShift}
      wide={wide}
      onSelect={onKeySelect}
    />
  );

  return (
    <div className={`virtual-keyboard${keyEnlarged ? ' virtual-keyboard--enlarged' : ''}`}>
      {rows.map((row, rowIndex) => (
        <div className="keyboard-row" key={`row-${rowIndex}`}>
          {row.map((keyValue) => renderKey(keyValue))}
        </div>
      ))}

      <div className="keyboard-row keyboard-row--function">
        {renderKey(FUNCTION_KEY_SHIFT)}
        {renderKey(FUNCTION_KEY_LANGUAGE)}
        {renderKey(FUNCTION_KEY_SPACE, true)}
        {renderKey(FUNCTION_KEY_DEL)}
      </div>

      <div className="keyboard-row keyboard-row--confirm">
        {renderKey(FUNCTION_KEY_CONFIRM)}
      </div>
    </div>
  );
}
