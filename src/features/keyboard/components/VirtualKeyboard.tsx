import KeyboardKey from './KeyboardKey';
import {
  FUNCTION_KEY_DEL,
  FUNCTION_KEY_LANGUAGE,
  FUNCTION_KEY_SHIFT,
  FUNCTION_KEY_SPACE,
} from '../layouts/qwertyLayouts';
import { getLayoutRows, type KeyboardState } from '../keyboardStateMachine';
import './VirtualKeyboard.css';

// Look-Talk keyboard.py는 확인(confirm) 버튼을 문자 키 grid가 아니라 입력창 옆
// 상단(confirm_rect)에 배치한다(216-238행). Web도 동일하게 확인 키는 여기서 렌더링하지
// 않고 FullViewportKeyboardOverlay가 draft 텍스트 옆에 렌더링한다 — 값(FUNCTION_KEY_CONFIRM)과
// keyboardStateMachine의 처리 로직은 그대로이므로 버튼 위치만 옮긴 것이다.
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
        // row.length로 10-key/9-key grid를 가른다(하드코딩된 행 index가 아니다) — 한글
        // 레이아웃은 [10,10,9,9], 영문 QWERTY는 [10,10,10,9]로 9키 행 위치가 서로 달라서다.
        <div className={`keyboard-row keyboard-row--${row.length}`} key={`row-${rowIndex}`}>
          {row.map((keyValue) => renderKey(keyValue))}
        </div>
      ))}

      <div className="keyboard-row keyboard-row--function">
        {renderKey(FUNCTION_KEY_SHIFT)}
        {renderKey(FUNCTION_KEY_LANGUAGE)}
        {renderKey(FUNCTION_KEY_SPACE, true)}
        {renderKey(FUNCTION_KEY_DEL)}
      </div>
    </div>
  );
}
