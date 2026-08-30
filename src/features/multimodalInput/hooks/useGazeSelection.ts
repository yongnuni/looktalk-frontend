import { useEffect, useRef, useState } from 'react';
import { useGazeRuntime, type GazeFrame } from '../../gazeRuntime/GazeRuntimeContext';
import { BlinkController } from '../BlinkController';
import { DwellController } from '../DwellController';
import type { GazeInputMode } from '../gazeInputMode';
import { IDLE_SELECTION, processGazeFrameForSelection } from '../gazeFrameSelection';
import { MouthController } from '../MouthController';
import type { InputSelectionState, KeyTarget } from '../types';

// 기존 useGazeInput과 동일한 throttle 주기 — Front Step 2/§13.4/§29 원칙 유지.
const UI_UPDATE_INTERVAL_MS = 50;

interface UseGazeSelectionOptions {
  /** 현재 화면에 렌더링된 key 요소들의 viewport CSS px 중심을 매 프레임 새로 계산해 반환한다. */
  getTargets: () => KeyTarget[];
  /**
   * dwell/mouth가 확정되는 그 프레임에 직접 호출된다(throttle 없음, render effect 아님).
   * 매 렌더마다 새 함수를 넘기면 매번 재구독되므로 호출 측에서 useCallback으로 안정화할 것.
   */
  onKeySelect?: (keyId: string) => void;
  inputMode?: GazeInputMode;
}

export interface UseGazeSelectionResult {
  /** 세 입력 모드의 공용 선택 상태. gesture 모드에서는 잠긴(locked) target을 우선한다. */
  dwell: InputSelectionState;
}

/**
 * Front Step 11 — Global Gaze Runtime(카메라/FaceLandmarker/Homography/GazeFilter)을
 * 소비하는 keyboard-selection adapter. Step 0~9의 옛 `useGazeInput()`이 카메라부터
 * Dwell/Mouth 선택까지 한 hook 안에서 전부 소유하던 것과 달리, 이 hook은 Runtime이
 * `subscribeFrame()`으로 흘려주는 매 프레임 신호를 받아 선택(Dwell/Blink/Mouth)만 담당한다.
 *
 * 실제 판정 로직은 `processGazeFrameForSelection`(순수 함수, gazeFrameSelection.ts)에
 * 있다 — 여기서는 controller 인스턴스 보관과 React state throttle만 담당한다.
 */
export function useGazeSelection({
  getTargets,
  onKeySelect,
  inputMode = 'DWELL',
}: UseGazeSelectionOptions): UseGazeSelectionResult {
  const { subscribeFrame } = useGazeRuntime();

  const dwellControllerRef = useRef(new DwellController());
  const blinkControllerRef = useRef(new BlinkController());
  const mouthControllerRef = useRef(new MouthController());
  const getTargetsRef = useRef(getTargets);
  const onKeySelectRef = useRef(onKeySelect);
  const inputModeRef = useRef(inputMode);
  const lastUiUpdateRef = useRef(0);

  useEffect(() => {
    getTargetsRef.current = getTargets;
  }, [getTargets]);

  useEffect(() => {
    onKeySelectRef.current = onKeySelect;
  }, [onKeySelect]);

  useEffect(() => {
    inputModeRef.current = inputMode;
    // 입력 방식이 바뀌면 이전 모드가 진행 중이던 hover/lock/hold 진행 상태를 남기지 않는다.
    dwellControllerRef.current.reset();
    blinkControllerRef.current.reset();
    mouthControllerRef.current.reset();
  }, [inputMode]);

  const [dwell, setDwell] = useState<InputSelectionState>(IDLE_SELECTION);

  useEffect(() => {
    const handleFrame = (frame: GazeFrame) => {
      const dwellState = processGazeFrameForSelection(
        frame,
        getTargetsRef.current(),
        inputModeRef.current,
        dwellControllerRef.current,
        blinkControllerRef.current,
        mouthControllerRef.current,
      );

      if (dwellState.selectedKeyId) {
        onKeySelectRef.current?.(dwellState.selectedKeyId);
      }

      if (frame.now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiUpdateRef.current = frame.now;
        setDwell(dwellState);
      }
    };

    return subscribeFrame(handleFrame);
  }, [subscribeFrame]);

  return { dwell };
}
