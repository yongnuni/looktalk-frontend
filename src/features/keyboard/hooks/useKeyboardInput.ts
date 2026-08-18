import { useCallback, useRef, useState } from 'react';
import { HangulComposer } from '../composition/HangulComposer';
import { INITIAL_KEYBOARD_STATE, processKey, type KeyboardState } from '../keyboardStateMachine';

interface UseKeyboardInputOptions {
  /**
   * '확인' 키 선택 시 호출된다(Integration Plan §15.4 onConfirm/onSubmit 계약).
   * VirtualKeyboard는 이 콜백의 실제 동작(전송/검색 등)을 모른다 — 호출하는
   * 페이지가 결정한다.
   */
  onConfirm?: (composedText: string) => void;
}

export interface UseKeyboardInputResult {
  keyboardState: KeyboardState;
  text: string;
  /**
   * mouse click과 gaze dwell이 공유하는 단일 입력 경로다(Integration Plan §3-4).
   * VirtualKeyboard의 onClick도, useGazeInput의 onKeySelect도 전부 이 함수를 호출한다 —
   * 입력 방식별로 별도 keyboard 로직을 두지 않는다.
   */
  handleKeySelect: (keyValue: string) => void;
  clearText: () => void;
}

export function useKeyboardInput({ onConfirm }: UseKeyboardInputOptions = {}): UseKeyboardInputResult {
  const composerRef = useRef(new HangulComposer());
  const keyboardStateRef = useRef<KeyboardState>(INITIAL_KEYBOARD_STATE);

  const [keyboardState, setKeyboardState] = useState<KeyboardState>(INITIAL_KEYBOARD_STATE);
  const [text, setText] = useState('');

  const handleKeySelect = useCallback(
    (keyValue: string) => {
      const result = processKey(keyValue, keyboardStateRef.current, composerRef.current);

      if (result.confirmed) {
        onConfirm?.(composerRef.current.getComposedText());
        return;
      }

      keyboardStateRef.current = result.state;
      setKeyboardState(result.state);
      setText(composerRef.current.getComposedText());
    },
    [onConfirm],
  );

  const clearText = useCallback(() => {
    composerRef.current.reset();
    keyboardStateRef.current = INITIAL_KEYBOARD_STATE;
    setKeyboardState(INITIAL_KEYBOARD_STATE);
    setText('');
  }, []);

  return { keyboardState, text, handleKeySelect, clearText };
}
