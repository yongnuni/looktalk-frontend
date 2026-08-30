import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  GazeInteractionFrameProvider,
} from '../../gazeInteraction/GazeInteractionProvider';
import type {
  GazeFrame,
  SubscribeGazeFrame,
} from '../../gazeRuntime/GazeRuntimeContext';
import type {
  BlinkCalibrationResult,
  MouthCalibrationResult,
} from '../inputCalibration';
import {
  INPUT_TEST_ENTRY_LOCK_MS,
  isInputTestEntryUnlocked,
  type InputTestMethod,
} from '../inputMethodTest';
import { INPUT_METHOD_TEST_CONFIG } from '../inputMethodTestConfig';
import {
  resolveBlinkThresholdsFromResult,
  resolveMouthThresholdsFromResult,
} from '../runtimeInputThresholds';

interface InputMethodTestInteractionProviderProps {
  children: ReactNode;
  method: InputTestMethod;
  subscribeFrame: SubscribeGazeFrame;
  blinkCalibration: BlinkCalibrationResult | null;
  mouthCalibration: MouthCalibrationResult | null;
}

function createLockedFrame(frame: GazeFrame): GazeFrame {
  return {
    now: frame.now,
    hasSignal: false,
    signal: null,
    cursorCssPx: null,
    fixationCount: 0,
  };
}

/**
 * Calibration camera frame과 방금 측정한 threshold만 기존 interaction 계층에 주입한다.
 * 입력 방식은 이 provider 안에서만 override되며 사용자 설정은 읽거나 저장하지 않는다.
 */
export default function InputMethodTestInteractionProvider({
  children,
  method,
  subscribeFrame,
  blinkCalibration,
  mouthCalibration,
}: InputMethodTestInteractionProviderProps) {
  const enteredAtMsRef = useRef(Number.POSITIVE_INFINITY);
  const inputMode = INPUT_METHOD_TEST_CONFIG[method].inputMode;
  const blinkThresholds = useMemo(
    () => resolveBlinkThresholdsFromResult(blinkCalibration),
    [blinkCalibration],
  );
  const mouthThresholds = useMemo(
    () => resolveMouthThresholdsFromResult(mouthCalibration),
    [mouthCalibration],
  );

  useEffect(() => {
    enteredAtMsRef.current = performance.now();
  }, [method]);

  const subscribeUnlockedFrame = useCallback<SubscribeGazeFrame>(
    (listener) =>
      subscribeFrame((frame) => {
        listener(
          isInputTestEntryUnlocked(
            enteredAtMsRef.current,
            frame.now,
            INPUT_TEST_ENTRY_LOCK_MS,
          )
            ? frame
            : createLockedFrame(frame),
        );
      }),
    [subscribeFrame],
  );

  return (
    <GazeInteractionFrameProvider
      subscribeFrame={subscribeUnlockedFrame}
      inputMode={inputMode}
      blinkThresholds={blinkThresholds}
      mouthThresholds={mouthThresholds}
      initialScope="KEYBOARD"
    >
      {children}
    </GazeInteractionFrameProvider>
  );
}
