import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useCamera } from '../../camera/hooks/useCamera';
import type { CameraPermissionState } from '../../camera/types';
import { GazeFilter } from '../../faceTracking/gaze/GazeFilter';
import { useFaceTracking, type FaceLandmarkerLoadState } from '../../faceTracking/hooks/useFaceTracking';
import { DEFAULT_MIRROR_STRATEGY } from '../../faceTracking/mediapipe/mirrorStrategy';
import type { GazeSignal } from '../../faceTracking/types';
import type { GazeCalibrationResult } from '../../calibration/types';
import { DwellController } from '../DwellController';
import { mapGazeSignalToFilteredCssPx } from '../gazeMapping';
import type { GazeInputMode } from '../gazeInputMode';
import { MouthController } from '../MouthController';
import type { InputSelectionState, KeyTarget } from '../types';

// UI 표시(커서/hover/progress) 갱신 주기. 필터/Dwell 계산 자체는 매 프레임 수행한다
// (Integration Plan §13.4/성능 원칙 — 고주파 처리는 ref/class, React state는 throttle).
const UI_UPDATE_INTERVAL_MS = 50;

const IDLE_DWELL: InputSelectionState = { hoveredKeyId: null, progress: 0, selectedKeyId: null };

interface UseGazeInputOptions {
  calibration: GazeCalibrationResult | null;
  /** 현재 화면에 렌더링된 key 요소들의 viewport CSS px 중심을 매 프레임 새로 계산해 반환한다. */
  getTargets: () => KeyTarget[];
  /**
   * dwell이 확정되는 그 프레임에 직접 호출된다(throttle 없음, render effect 아님).
   * 매 렌더마다 새 함수를 넘기면 매번 재구독되므로 호출 측에서 useCallback으로 안정화할 것.
   */
  onKeySelect?: (keyId: string) => void;
  /**
   * Look-Talk main.py의 mouth_mode 토글과 동일하게 dwell/mouth는 상호 배타적이다
   * (1287-1341행 — mouth_mode일 때는 dwell.reset()만 하고 dwell 클릭은 발생시키지 않으며,
   * 그 반대도 동일). 기본값 'DWELL'.
   */
  inputMode?: GazeInputMode;
}

export interface UseGazeInputResult {
  permission: CameraPermissionState;
  cameraError: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  startInput: () => void;
  faceLoadState: FaceLandmarkerLoadState;
  faceLoadError: string | null;
  /** 필터링된 gaze 커서, viewport CSS px. 추적 실패 중에는 마지막 유효 위치를 유지한다(Python last_gaze_x/y). */
  cursorCssPx: { x: number; y: number } | null;
  fixationCount: number;
  /** dwell/mouth 공용 선택 상태. inputMode==='MOUTH'일 때는 hoveredKeyId가 잠긴(locked) 키를 우선한다. */
  dwell: InputSelectionState;
  eyeClosed: boolean;
  trackingValid: boolean;
}

export function useGazeInput({
  calibration,
  getTargets,
  onKeySelect,
  inputMode = 'DWELL',
}: UseGazeInputOptions): UseGazeInputResult {
  const { permission, videoRef, errorMessage: cameraError, start } = useCamera();

  const gazeFilterRef = useRef(new GazeFilter());
  const dwellControllerRef = useRef(new DwellController());
  const mouthControllerRef = useRef(new MouthController());
  const lastValidCursorRef = useRef<{ x: number; y: number } | null>(null);
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
    mouthControllerRef.current.reset();
  }, [inputMode]);

  const [cursorCssPx, setCursorCssPx] = useState<{ x: number; y: number } | null>(null);
  const [fixationCount, setFixationCount] = useState(0);
  const [dwell, setDwell] = useState<InputSelectionState>(IDLE_DWELL);
  const [eyeClosed, setEyeClosed] = useState(false);
  const [trackingValid, setTrackingValid] = useState(false);

  const handleFrame = useCallback(
    (signal: GazeSignal | null) => {
      const now = signal?.timestamp ?? performance.now();

      // Look-Talk main.py: calibration 없음/얼굴 미검출이면 dwell.reset()/mouth.reset()만
      // 하고 아예 update()를 호출하지 않는다(1330-1340행) — 동일하게 처리.
      if (!calibration || !signal) {
        dwellControllerRef.current.reset();
        mouthControllerRef.current.reset();

        if (now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
          lastUiUpdateRef.current = now;
          setDwell(IDLE_DWELL);
          setTrackingValid(false);
          setEyeClosed(signal?.eyeClosed ?? false);
        }

        return;
      }

      const filtered = mapGazeSignalToFilteredCssPx(calibration, gazeFilterRef.current, signal);

      let gazeXForDwell = -1;
      let gazeYForDwell = -1;
      const isValid = filtered.x !== -1;

      if (isValid) {
        lastValidCursorRef.current = { x: filtered.x, y: filtered.y };
        gazeXForDwell = filtered.x;
        gazeYForDwell = filtered.y;
      }

      // Look-Talk main.py 1287-1341행: mouth_mode일 때는 dwell을 hover 판정에만 쓰고(클릭은
      // 발생시키지 않음) mouth.reset()은 하지 않는 대신, 실제 클릭은 mouth 쪽에서만 낸다 —
      // 상호 배타적으로 둘 중 하나만 selectedKeyId를 낼 수 있게 한다.
      let dwellState: InputSelectionState;

      if (inputModeRef.current === 'MOUTH') {
        const mouthState = mouthControllerRef.current.update(
          gazeXForDwell,
          gazeYForDwell,
          getTargetsRef.current(),
          signal.mar,
          now,
        );
        dwellControllerRef.current.reset();
        dwellState = { hoveredKeyId: mouthState.lockedKeyId ?? mouthState.hoveredKeyId, progress: mouthState.progress, selectedKeyId: mouthState.selectedKeyId };
      } else {
        dwellState = dwellControllerRef.current.update(gazeXForDwell, gazeYForDwell, getTargetsRef.current(), now);
        mouthControllerRef.current.reset();
      }

      if (dwellState.selectedKeyId) {
        onKeySelectRef.current?.(dwellState.selectedKeyId);
      }

      if (now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiUpdateRef.current = now;
        setCursorCssPx(lastValidCursorRef.current);
        setFixationCount(filtered.fixationCount);
        setDwell(dwellState);
        setEyeClosed(signal.eyeClosed);
        setTrackingValid(isValid);
      }
    },
    [calibration],
  );

  const { loadState: faceLoadState, loadError: faceLoadError } = useFaceTracking({
    videoRef,
    active: permission === 'granted',
    mirrorStrategy: DEFAULT_MIRROR_STRATEGY,
    onFrame: handleFrame,
  });

  const startInput = useCallback(() => {
    void start();
  }, [start]);

  return {
    permission,
    cameraError,
    videoRef,
    startInput,
    faceLoadState,
    faceLoadError,
    cursorCssPx,
    fixationCount,
    dwell,
    eyeClosed,
    trackingValid,
  };
}
