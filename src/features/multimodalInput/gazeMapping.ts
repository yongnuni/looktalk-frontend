import { applyHomography } from '../calibration/homography';
import { viewportNormalizedToCssPx } from '../calibration/viewportTargets';
import type { GazeCalibrationResult } from '../calibration/types';
import type { GazeFilter, GazeFilterResult } from '../faceTracking/gaze/GazeFilter';
import type { GazeSignal } from '../faceTracking/types';

/**
 * calibration Homography → viewport CSS px → GazeFilter 순서로 적용한다(Integration Plan
 * §13.1 좌표 경계). 독립 실행형 `useGazeInput`(dev debug 전용, GazeDwellDebugPage가 사용)과
 * Front Step 11의 `GazeRuntimeProvider`(Global Runtime) 양쪽이 이 함수를 그대로 재사용해,
 * 동일한 좌표 변환/필터 적용 로직이 두 곳에 따로 구현되지 않게 한다.
 */
export function mapGazeSignalToFilteredCssPx(
  calibration: GazeCalibrationResult,
  gazeFilter: GazeFilter,
  signal: GazeSignal,
): GazeFilterResult {
  const normalized = applyHomography(calibration.homography, signal.irisX, signal.irisY);
  const cssPoint = viewportNormalizedToCssPx(normalized);
  return gazeFilter.update(cssPoint.x, cssPoint.y, signal.irisConfidence, signal.eyeClosed);
}
