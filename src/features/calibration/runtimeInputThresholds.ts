import type { EyeClosureThresholds } from '../faceTracking/gaze/blinkGate';
import type { MouthControllerThresholds } from '../multimodalInput/MouthController';
import type {
  BlinkCalibrationResult,
  InputCalibrationResult,
  MouthCalibrationResult,
} from './inputCalibration';

export function resolveBlinkThresholdsFromResult(
  result: BlinkCalibrationResult | null,
): EyeClosureThresholds | undefined {
  if (!result || result.fallback) {
    return undefined;
  }

  return {
    closeThreshold: result.closeThreshold,
    openThreshold: result.openThreshold,
  };
}

export function resolveBlinkThresholds(
  result: InputCalibrationResult | null,
): EyeClosureThresholds | undefined {
  return resolveBlinkThresholdsFromResult(result?.blink ?? null);
}

export function resolveMouthThresholdsFromResult(
  result: MouthCalibrationResult | null,
): MouthControllerThresholds | undefined {
  if (!result || result.fallback) {
    return undefined;
  }

  return {
    openThreshold: result.openThreshold,
    closeThreshold: result.closeThreshold,
  };
}

export function resolveMouthThresholds(
  result: InputCalibrationResult | null,
): MouthControllerThresholds | undefined {
  return resolveMouthThresholdsFromResult(result?.mouth ?? null);
}
