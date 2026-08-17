import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { CameraPermissionState } from '../camera/types';
import type { GazeCalibrationResult } from '../calibration/types';
import type { CalibrationCompatibility } from '../calibration/viewportCompatibility';
import type { FaceLandmarkerLoadState } from '../faceTracking/hooks/useFaceTracking';
import type { GazeSignal } from '../faceTracking/types';

/**
 * Front Step 11 — Global Gaze Runtime의 context 계약. Provider 구현은 별도 파일
 * (`GazeRuntimeProvider.tsx`)에 있다 — Fast Refresh가 컴포넌트만 export하는 파일에서만
 * 정상 동작하므로(`react-refresh/only-export-components`), 컴포넌트가 아닌 context/타입/훅은
 * 이 파일에 분리해 둔다.
 */

export interface GazeFrame {
  /** false면 이번 프레임엔 얼굴 신호 자체가 없거나(미검출) active calibration이 없다 —
   * 이 경우 소비자(Dwell/Mouth adapter)는 controller를 명시적으로 reset해야 한다
   * (Look-Talk main.py가 tracking_valid=false일 때 dwell.reset()/mouth.reset()만 하고
   * update()를 아예 호출하지 않는 것과 동일한 분기). */
  hasSignal: boolean;
  signal: GazeSignal | null;
  /** GazeFilter 적용 후 유효한 프레임에서만 non-null(§13.1 좌표 경계 이후, viewport CSS px). */
  cursorCssPx: { x: number; y: number } | null;
  fixationCount: number;
  now: number;
}

export type FrameListener = (frame: GazeFrame) => void;

export interface GazeRuntimeContextValue {
  permission: CameraPermissionState;
  cameraError: string | null;
  /** Provider가 소유/렌더링하는 hidden video의 ref. 소비자는 읽기 전용으로만 참고한다 —
   * 각 페이지가 자신만의 <video>를 새로 렌더링하면 안 된다(카메라는 Runtime만 소유). */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** 자동 시작이 실패/거부된 경우를 위한 수동 재시도(기존 UI convention 재사용). */
  startInput: () => void;
  faceLoadState: FaceLandmarkerLoadState;
  faceLoadError: string | null;

  /** 추적 실패 중에는 마지막 유효 위치를 유지한다(Python last_gaze_x/y와 동일 정책). */
  cursorCssPx: { x: number; y: number } | null;
  trackingValid: boolean;
  eyeClosed: boolean;
  fixationCount: number;
  mar: number | null;

  activeCalibration: GazeCalibrationResult | null;
  compatibility: CalibrationCompatibility | null;

  /** 매 프레임(throttle 없이) 호출되는 구독. Dwell/Mouth처럼 시간 기반 판정이 필요한
   * 소비자를 위한 것 — React state(위 필드들)는 UI 표시용으로만 50ms 간격 throttle된다. */
  subscribeFrame: (listener: FrameListener) => () => void;
}

export const GazeRuntimeContext = createContext<GazeRuntimeContextValue | null>(null);

export function useGazeRuntime(): GazeRuntimeContextValue {
  const context = useContext(GazeRuntimeContext);

  if (!context) {
    throw new Error('useGazeRuntime()은 GazeRuntimeProvider 내부에서만 사용할 수 있다.');
  }

  return context;
}
