import type { GazeCalibrationResult } from '../calibration/types';
import type { GazeFilter } from '../faceTracking/gaze/GazeFilter';
import type { GazeSignal } from '../faceTracking/types';
import { mapGazeSignalToFilteredCssPx } from '../multimodalInput/gazeMapping';
import type { GazeFrame } from './GazeRuntimeContext';

/**
 * Front Step 11 — 한 프레임의 (calibration, GazeFilter, signal)을 GazeFrame으로 변환하는
 * 순수 판정 로직. GazeRuntimeProvider의 RAF 배선에서 분리해 React/카메라 없이 deterministic
 *하게 테스트한다. GazeFilter 인스턴스 자체는 내부 상태를 갖지만(Kalman/버퍼 등), 이는
 * Front Step 2에서 이미 GazeFilter.test.ts로 검증된 부분이라 여기서는 다시 검증하지 않는다.
 *
 * Look-Talk main.py와 동일: 얼굴 미검출/active calibration 없음이면 GazeFilter를 아예
 * 건드리지 않는다(다음 정상 프레임에서 그대로 이어받도록) — hasSignal=false로만 알린다.
 */
export function buildGazeFrame(
  calibration: GazeCalibrationResult | null,
  gazeFilter: GazeFilter,
  signal: GazeSignal | null,
  now: number,
): GazeFrame {
  if (!calibration || !signal) {
    return { hasSignal: false, signal, cursorCssPx: null, fixationCount: 0, now };
  }

  const filtered = mapGazeSignalToFilteredCssPx(calibration, gazeFilter, signal);
  const isValid = filtered.x !== -1;

  return {
    hasSignal: true,
    signal,
    cursorCssPx: isValid ? { x: filtered.x, y: filtered.y } : null,
    fixationCount: filtered.fixationCount,
    now,
  };
}
