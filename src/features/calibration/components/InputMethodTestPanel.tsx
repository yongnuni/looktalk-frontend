import { useCallback, useMemo, useRef, useState } from 'react';
import FullViewportKeyboardOverlay from '../../keyboard/components/FullViewportKeyboardOverlay';
import { collectKeyTargets } from '../../keyboard/domKeyTargets';
import { useKeyboardInput } from '../../keyboard/hooks/useKeyboardInput';
import { FUNCTION_KEY_CONFIRM } from '../../keyboard/layouts/qwertyLayouts';
import {
  INPUT_TEST_ENTRY_LOCK_MS,
  useFrameGazeSelection,
} from '../../multimodalInput/hooks/useFrameGazeSelection';
import type { SubscribeGazeFrame } from '../../multimodalInput/hooks/useFrameGazeSelection';
import type {
  BlinkCalibrationResult,
  MouthCalibrationResult,
} from '../inputCalibration';
import {
  InputMethodTestSession,
  type InputMethodTestResult,
  type InputTestMethod,
} from '../inputMethodTest';
import { INPUT_METHOD_TEST_CONFIG } from '../inputMethodTestConfig';
import {
  resolveBlinkThresholdsFromResult,
  resolveMouthThresholdsFromResult,
} from '../runtimeInputThresholds';
import './InputMethodTestPanel.css';

interface InputMethodTestPanelProps {
  method: InputTestMethod;
  targetWord: string;
  subscribeFrame: SubscribeGazeFrame;
  blinkCalibration: BlinkCalibrationResult | null;
  mouthCalibration: MouthCalibrationResult | null;
  onComplete: (result: InputMethodTestResult) => void;
}

const NOOP = () => undefined;

export default function InputMethodTestPanel({
  method,
  targetWord,
  subscribeFrame,
  blinkCalibration,
  mouthCalibration,
  onComplete,
}: InputMethodTestPanelProps) {
  const config = INPUT_METHOD_TEST_CONFIG[method];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session] = useState(
    () => new InputMethodTestSession(method, targetWord, performance.now()),
  );

  const handleConfirm = useCallback(
    (input: string) => {
      const confirmation = session.confirm(input, performance.now());

      if (confirmation.status === 'incorrect') {
        setErrorMessage('목표 단어와 다릅니다. 다시 입력해 주세요.');
        return;
      }

      if (confirmation.status === 'completed') {
        onComplete(confirmation.result);
      }
    },
    [onComplete, session],
  );

  const {
    keyboardState,
    text,
    handleKeySelect: applyKeySelect,
  } = useKeyboardInput({ onConfirm: handleConfirm });

  const handleKeySelect = useCallback(
    (keyValue: string) => {
      if (keyValue !== FUNCTION_KEY_CONFIRM) {
        setErrorMessage(null);
      }
      applyKeySelect(keyValue);
    },
    [applyKeySelect],
  );

  const getTargets = useCallback(
    () => (containerRef.current ? collectKeyTargets(containerRef.current) : []),
    [],
  );
  const blinkThresholds = useMemo(
    () => resolveBlinkThresholdsFromResult(blinkCalibration),
    [blinkCalibration],
  );
  const mouthThresholds = useMemo(
    () => resolveMouthThresholdsFromResult(mouthCalibration),
    [mouthCalibration],
  );
  const { dwell } = useFrameGazeSelection({
    subscribeFrame,
    getTargets,
    onKeySelect: handleKeySelect,
    inputMode: config.inputMode,
    blinkThresholds,
    mouthThresholds,
    entryLockMs: INPUT_TEST_ENTRY_LOCK_MS,
  });

  return (
    <FullViewportKeyboardOverlay
      ariaLabel={`${config.title} 한 글자 입력 테스트`}
      draftText={text}
      draftPlaceholder="현재 입력 결과가 여기에 표시됩니다."
      errorMessage={errorMessage}
      statusMessage={`입력 방식 안내: ${config.guide}`}
      onClose={NOOP}
      keyboardState={keyboardState}
      onKeySelect={handleKeySelect}
      suggestionsEnabled={false}
      showSuggestions={false}
      showClose={false}
      gazeTargetsEnabled={false}
      pointerSelectionEnabled={false}
      hoveredKeyId={dwell.hoveredKeyId}
      selectionProgress={dwell.progress}
      containerRef={containerRef}
      autoLandmarkPopup={false}
      headerContent={
        <section className="input-method-test-card" aria-live="polite">
          <p className="input-method-test-card__title">&lt;{config.title} 입력 방식&gt;</p>
          <p className="input-method-test-card__instruction">
            초성, 중성, 종성으로 이루어진 한 단어를 입력하세요!
          </p>
          <strong className="input-method-test-card__target" aria-label={`목표 단어 ${targetWord}`}>
            {targetWord}
          </strong>
        </section>
      }
    />
  );
}
