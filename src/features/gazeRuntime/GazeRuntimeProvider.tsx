import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useCamera } from '../camera/hooks/useCamera';
import { useActiveCalibration } from '../calibration/hooks/useActiveCalibration';
import { GazeFilter } from '../faceTracking/gaze/GazeFilter';
import { useFaceTracking } from '../faceTracking/hooks/useFaceTracking';
import { DEFAULT_MIRROR_STRATEGY } from '../faceTracking/mediapipe/mirrorStrategy';
import type { GazeSignal } from '../faceTracking/types';
import { buildGazeFrame } from './gazeFrameBuilder';
import { GazeRuntimeContext, type FrameListener, type GazeRuntimeContextValue } from './GazeRuntimeContext';

/**
 * Front Step 11 — Global Gaze Runtime Provider.
 *
 * Camera → FaceLandmarker → iris/EAR/MAR → active calibration Homography → GazeFilter를
 * PATIENT route tree 전체가 공유하는 단일 인스턴스로 승격한다. 알고리즘 자체(GazeFilter,
 * Homography, DwellController, MouthController)는 Step 0~9에서 이미 구현된 것을 그대로
 * 재사용한다 — 여기서는 그 lifecycle(누가 Camera/FaceLandmarker를 소유하는가)만 바뀐다.
 *
 * 이번 Step에서 만들지 않는 것(§10/§11 명시): Global Gaze Cursor 렌더링, Gaze Target
 * Registry, scope 개념. `cursorCssPx`는 state로만 계산되고 아직 어디에도 그려지지 않는다.
 */

const UI_UPDATE_INTERVAL_MS = 50;

const HIDDEN_VIDEO_STYLE = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
} as const;

interface GazeRuntimeProviderProps {
  children: ReactNode;
}

export function GazeRuntimeProvider({ children }: GazeRuntimeProviderProps) {
  const { permission, videoRef, errorMessage: cameraError, start } = useCamera();
  // Step 10의 PatientCalibrationGate가 이미 동일 calibrationStore를 채워 둔 뒤에만 이
  // Provider가 mount된다(router.tsx: Gate → GazeRuntimeLayout → Outlet) — status가 이미
  // 'idle'이 아니므로 여기서 다시 호출해도 중복 GET이 발생하지 않는다(§20).
  const { active: activeCalibration, compatibility } = useActiveCalibration();

  const gazeFilterRef = useRef(new GazeFilter());
  const listenersRef = useRef(new Set<FrameListener>());
  const lastUiUpdateRef = useRef(0);
  const lastValidCursorRef = useRef<{ x: number; y: number } | null>(null);
  const activeCalibrationRef = useRef(activeCalibration);

  useEffect(() => {
    activeCalibrationRef.current = activeCalibration;
  }, [activeCalibration]);

  const [cursorCssPx, setCursorCssPx] = useState<{ x: number; y: number } | null>(null);
  const [trackingValid, setTrackingValid] = useState(false);
  const [eyeClosed, setEyeClosed] = useState(false);
  const [fixationCount, setFixationCount] = useState(0);
  const [mar, setMar] = useState<number | null>(null);

  const subscribeFrame = useCallback((listener: FrameListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const handleFrame = useCallback((signal: GazeSignal | null) => {
    const now = signal?.timestamp ?? performance.now();
    const frame = buildGazeFrame(activeCalibrationRef.current, gazeFilterRef.current, signal, now);

    for (const listener of listenersRef.current) {
      listener(frame);
    }

    if (now - lastUiUpdateRef.current < UI_UPDATE_INTERVAL_MS) {
      return;
    }

    lastUiUpdateRef.current = now;

    // Look-Talk main.py와 동일하게: 얼굴 미검출/active calibration 없음(hasSignal=false)
    // 이었던 프레임에서는 cursorCssPx/fixationCount/mar를 건드리지 않고 마지막 유효 값을
    // 유지한다 — trackingValid/eyeClosed만 이 프레임 기준으로 갱신한다.
    setTrackingValid(frame.hasSignal && frame.cursorCssPx !== null);
    setEyeClosed(frame.signal?.eyeClosed ?? false);

    if (frame.hasSignal) {
      if (frame.cursorCssPx) {
        lastValidCursorRef.current = frame.cursorCssPx;
      }
      setCursorCssPx(lastValidCursorRef.current);
      setFixationCount(frame.fixationCount);
      setMar(frame.signal?.mar ?? null);
    }
  }, []);

  const { loadState: faceLoadState, loadError: faceLoadError } = useFaceTracking({
    videoRef,
    active: permission === 'granted',
    mirrorStrategy: DEFAULT_MIRROR_STRATEGY,
    onFrame: handleFrame,
  });

  const startInput = useCallback(() => {
    void start();
  }, [start]);

  // §16 — Calibration이 확인된 PATIENT가 PATIENT 영역에 진입하면 카메라 시작을 한 번
  // 자동으로 시도한다. 실패/거부돼도 무한 재시도하지 않는다 — permission이 'denied'/
  // 'error'로 유지되고, 각 페이지는 기존 UI convention대로 startInput()을 수동 재시도
  // 버튼으로 노출할 수 있다(브라우저가 user gesture 없는 getUserMedia를 막는 환경에서는
  // 이 자동 시작이 실패할 수 있음 — 최종 보고에 한계로 남긴다).
  const autoStartAttemptedRef = useRef(false);

  useEffect(() => {
    if (autoStartAttemptedRef.current || permission !== 'idle' || !activeCalibration) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void start();
  }, [permission, activeCalibration, start]);

  const value = useMemo<GazeRuntimeContextValue>(
    () => ({
      permission,
      cameraError,
      videoRef,
      startInput,
      faceLoadState,
      faceLoadError,
      cursorCssPx,
      trackingValid,
      eyeClosed,
      fixationCount,
      mar,
      activeCalibration,
      compatibility,
      subscribeFrame,
    }),
    [
      permission,
      cameraError,
      videoRef,
      startInput,
      faceLoadState,
      faceLoadError,
      cursorCssPx,
      trackingValid,
      eyeClosed,
      fixationCount,
      mar,
      activeCalibration,
      compatibility,
      subscribeFrame,
    ],
  );

  return (
    <GazeRuntimeContext.Provider value={value}>
      {children}
      {/* Runtime이 소유하는 유일한 <video> — PATIENT route 전환에도 유지되어야 하므로
          자식 page가 아니라 Provider 자신이 렌더링한다(§13/§27). */}
      <video ref={videoRef} style={HIDDEN_VIDEO_STYLE} playsInline muted />
    </GazeRuntimeContext.Provider>
  );
}
