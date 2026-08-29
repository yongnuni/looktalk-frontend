import { useEffect, useRef, useState } from 'react';
import {
  INPUT_TEST_ENTRY_LOCK_MS,
  isInputTestEntryUnlocked,
} from '../../calibration/inputMethodTest';
import type { FrameListener } from '../../gazeRuntime/GazeRuntimeContext';
import { BlinkController, type BlinkControllerThresholds } from '../BlinkController';
import { DwellController } from '../DwellController';
import type { GazeInputMode } from '../gazeInputMode';
import { IDLE_SELECTION, processGazeFrameForSelection } from '../gazeFrameSelection';
import { MouthController, type MouthControllerThresholds } from '../MouthController';
import type { InputSelectionState, KeyTarget } from '../types';

const UI_UPDATE_INTERVAL_MS = 50;

export type SubscribeGazeFrame = (listener: FrameListener) => () => void;

interface UseFrameGazeSelectionOptions {
  subscribeFrame: SubscribeGazeFrame;
  getTargets: () => KeyTarget[];
  onKeySelect?: (keyId: string) => void;
  inputMode?: GazeInputMode;
  blinkThresholds?: BlinkControllerThresholds;
  mouthThresholds?: MouthControllerThresholds;
  /** 0이면 기존 runtime 화면, 350ms이면 calibration 직후 입력 테스트의 release gate다. */
  entryLockMs?: number;
}

export interface UseFrameGazeSelectionResult {
  dwell: InputSelectionState;
}

/** 카메라 소유권과 무관하게 기존 Dwell/Blink/Mouth controller를 frame subscriber에 연결한다. */
export function useFrameGazeSelection({
  subscribeFrame,
  getTargets,
  onKeySelect,
  inputMode = 'DWELL',
  blinkThresholds,
  mouthThresholds,
  entryLockMs = 0,
}: UseFrameGazeSelectionOptions): UseFrameGazeSelectionResult {
  const dwellControllerRef = useRef(new DwellController());
  const blinkControllerRef = useRef(new BlinkController(blinkThresholds));
  const mouthControllerRef = useRef(new MouthController(mouthThresholds));
  const getTargetsRef = useRef(getTargets);
  const onKeySelectRef = useRef(onKeySelect);
  const inputModeRef = useRef(inputMode);
  const enteredAtMsRef = useRef(0);
  const lastUiUpdateRef = useRef(0);

  useEffect(() => {
    getTargetsRef.current = getTargets;
  }, [getTargets]);

  useEffect(() => {
    onKeySelectRef.current = onKeySelect;
  }, [onKeySelect]);

  const blinkCloseThreshold = blinkThresholds?.closeThreshold;
  const blinkOpenThreshold = blinkThresholds?.openThreshold;
  const mouthOpenThreshold = mouthThresholds?.openThreshold;
  const mouthCloseThreshold = mouthThresholds?.closeThreshold;

  useEffect(() => {
    inputModeRef.current = inputMode;
    enteredAtMsRef.current = performance.now();
    dwellControllerRef.current.reset();
    blinkControllerRef.current = new BlinkController(
      blinkCloseThreshold === undefined || blinkOpenThreshold === undefined
        ? undefined
        : { closeThreshold: blinkCloseThreshold, openThreshold: blinkOpenThreshold },
    );
    mouthControllerRef.current = new MouthController(
      mouthOpenThreshold === undefined || mouthCloseThreshold === undefined
        ? undefined
        : { openThreshold: mouthOpenThreshold, closeThreshold: mouthCloseThreshold },
    );
  }, [
    blinkCloseThreshold,
    blinkOpenThreshold,
    inputMode,
    mouthCloseThreshold,
    mouthOpenThreshold,
  ]);

  const [dwell, setDwell] = useState<InputSelectionState>(IDLE_SELECTION);

  useEffect(() => {
    const handleFrame: FrameListener = (frame) => {
      if (
        entryLockMs > 0 &&
        !isInputTestEntryUnlocked(enteredAtMsRef.current, frame.now, entryLockMs)
      ) {
        dwellControllerRef.current.reset();
        blinkControllerRef.current.reset();
        mouthControllerRef.current.reset();
        return;
      }

      const selection = processGazeFrameForSelection(
        frame,
        getTargetsRef.current(),
        inputModeRef.current,
        dwellControllerRef.current,
        blinkControllerRef.current,
        mouthControllerRef.current,
      );

      if (selection.selectedKeyId) {
        onKeySelectRef.current?.(selection.selectedKeyId);
      }

      if (frame.now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiUpdateRef.current = frame.now;
        setDwell(selection);
      }
    };

    return subscribeFrame(handleFrame);
  }, [entryLockMs, subscribeFrame]);

  return { dwell };
}

export { INPUT_TEST_ENTRY_LOCK_MS };
