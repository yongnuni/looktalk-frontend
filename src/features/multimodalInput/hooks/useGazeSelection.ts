import { useMemo } from 'react';
import {
  resolveBlinkThresholds,
  resolveMouthThresholds,
} from '../../calibration/runtimeInputThresholds';
import { useCalibrationStore } from '../../calibration/store/calibrationStore';
import { useGazeRuntime } from '../../gazeRuntime/GazeRuntimeContext';
import type { GazeInputMode } from '../gazeInputMode';
import type { KeyTarget } from '../types';
import {
  useFrameGazeSelection,
  type UseFrameGazeSelectionResult,
} from './useFrameGazeSelection';

interface UseGazeSelectionOptions {
  getTargets: () => KeyTarget[];
  onKeySelect?: (keyId: string) => void;
  inputMode?: GazeInputMode;
}

/** Global Gaze Runtime을 기존 공용 selection controller에 연결하는 production adapter. */
export function useGazeSelection({
  getTargets,
  onKeySelect,
  inputMode = 'DWELL',
}: UseGazeSelectionOptions): UseFrameGazeSelectionResult {
  const { subscribeFrame } = useGazeRuntime();
  const inputCalibration = useCalibrationStore((state) => state.inputCalibration);
  const blinkThresholds = useMemo(
    () => resolveBlinkThresholds(inputCalibration),
    [inputCalibration],
  );
  const mouthThresholds = useMemo(
    () => resolveMouthThresholds(inputCalibration),
    [inputCalibration],
  );

  return useFrameGazeSelection({
    subscribeFrame,
    getTargets,
    onKeySelect,
    inputMode,
    blinkThresholds,
    mouthThresholds,
  });
}
