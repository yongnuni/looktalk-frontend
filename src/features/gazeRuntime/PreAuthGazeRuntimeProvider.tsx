import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ReactNode } from 'react';

import { useCamera } from '../camera/hooks/useCamera';

import type { GazeCalibrationResult } from '../calibration/types';

import { GazeFilter } from '../faceTracking/gaze/GazeFilter';

import { useFaceTracking } from '../faceTracking/hooks/useFaceTracking';

import { DEFAULT_MIRROR_STRATEGY } from '../faceTracking/mediapipe/mirrorStrategy';

import type { GazeSignal } from '../faceTracking/types';

import { buildGazeFrame } from './gazeFrameBuilder';

import {
  GazeRuntimeContext,
  type FrameListener,
  type GazeRuntimeContextValue,
  type TrackingFrameListener,
} from './GazeRuntimeContext';

/**
 * 로그인 전 Gaze Runtime Provider
 *
 * 기존 GazeRuntimeProvider와 동일한
 *
 * Camera
 * → FaceLandmarker
 * → iris/EAR/MAR
 * → Homography
 * → GazeFilter
 *
 * 흐름을 사용한다.
 *
 * 차이점:
 *
 * 기존 GazeRuntimeProvider
 * → useActiveCalibration()
 * → 로그인 후 16점 active calibration
 *
 * PreAuthGazeRuntimeProvider
 * → sessionStorage.preCalibrationResult
 * → 로그인 전 9점 calibration
 */

const UI_UPDATE_INTERVAL_MS = 50;

const PRE_CALIBRATION_STORAGE_KEY = 'preCalibrationResult';

const HIDDEN_VIDEO_STYLE = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
} as const;

interface PreAuthGazeRuntimeProviderProps {
  children: ReactNode;
}

/**
 * sessionStorage에 저장된 로그인 전 9점
 * calibration 결과를 안전하게 읽는다.
 */
function loadPreCalibrationResult(): GazeCalibrationResult | null {
  const storedResult = sessionStorage.getItem(PRE_CALIBRATION_STORAGE_KEY);

  if (!storedResult) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedResult) as GazeCalibrationResult;

    if (
      !parsed ||
      parsed.coordinateSpace !== 'NORMALIZED_VIEWPORT' ||
      !parsed.homography
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error(
      '로그인 전 9점 캘리브레이션 결과를 불러오지 못했습니다.',
      error,
    );

    return null;
  }
}

export function PreAuthGazeRuntimeProvider({
  children,
}: PreAuthGazeRuntimeProviderProps) {
  // =========================================================
  // Camera
  // =========================================================

  const {
    permission,
    videoRef,
    errorMessage: cameraError,
    start,
  } = useCamera();

  // =========================================================
  // 로그인 전 9점 Calibration
  // =========================================================

  /*
   * 로그인 전 9점 결과는 PreCalibrationPage에서:
   *
   * sessionStorage.setItem(
   *   'preCalibrationResult',
   *   JSON.stringify(result),
   * )
   *
   * 로 저장된다.
   *
   * Provider가 mount될 때 한 번만 읽는다.
   */
  const [preCalibration] = useState<GazeCalibrationResult | null>(
    loadPreCalibrationResult,
  );

  const preCalibrationRef = useRef<GazeCalibrationResult | null>(
    preCalibration,
  );

  // =========================================================
  // Runtime 내부 상태
  // =========================================================

  const gazeFilterRef = useRef(new GazeFilter());

  const listenersRef = useRef(new Set<FrameListener>());

  const lastUiUpdateRef = useRef(0);

  const lastValidCursorRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const [cursorCssPx, setCursorCssPx] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [trackingValid, setTrackingValid] = useState(false);

  const [eyeClosed, setEyeClosed] = useState(false);

  const [fixationCount, setFixationCount] = useState(0);

  const [mar, setMar] = useState<number | null>(null);

  // =========================================================
  // Frame Subscribe
  // =========================================================

  const subscribeFrame = useCallback((listener: FrameListener) => {
    listenersRef.current.add(listener);

    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  // 랜드마크 PiP는 환자 Runtime에만 mount된다. 로그인 전 동작은 바꾸지 않고 Context의
  // 공통 계약만 맞추기 위해 빈 구독 해제 함수를 반환한다.
  const subscribeTrackingFrame = useCallback((listener: TrackingFrameListener) => {
    void listener;
    return () => undefined;
  }, []);

  // =========================================================
  // Face Tracking Frame 처리
  // =========================================================

  const handleFrame = useCallback((signal: GazeSignal | null) => {
    const now = signal?.timestamp ?? performance.now();

    /*
     * 기존 로그인 후 Runtime과 동일한
     * buildGazeFrame()을 사용한다.
     *
     * 단 active calibration 대신
     * 로그인 전 9점 calibration을 전달한다.
     */
    const frame = buildGazeFrame(
      preCalibrationRef.current,
      gazeFilterRef.current,
      signal,
      now,
    );

    // Dwell / Mouth 등 시간 기반 controller에
    // throttle 없이 모든 frame을 전달한다.
    for (const listener of listenersRef.current) {
      listener(frame);
    }

    // React UI state만 50ms 간격으로 갱신한다.
    if (now - lastUiUpdateRef.current < UI_UPDATE_INTERVAL_MS) {
      return;
    }

    lastUiUpdateRef.current = now;

    /*
     * 기존 GazeRuntimeProvider와 동일한 정책:
     *
     * 추적 실패 시 cursor 위치를 null로 지우지 않고
     * 마지막 유효 위치를 유지한다.
     */
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

  // =========================================================
  // FaceLandmarker
  // =========================================================

  const { loadState: faceLoadState, loadError: faceLoadError } =
    useFaceTracking({
      videoRef,

      active: permission === 'granted',

      mirrorStrategy: DEFAULT_MIRROR_STRATEGY,

      onFrame: handleFrame,
    });

  // =========================================================
  // 카메라 수동 시작
  // =========================================================

  const startInput = useCallback(() => {
    void start();
  }, [start]);

  // =========================================================
  // 로그인 페이지 진입 시 카메라 자동 시작
  // =========================================================

  /*
   * 9점 캘리브레이션 직후에는 이미 카메라 권한이
   * granted일 가능성이 높다.
   *
   * 다만 route 변경 과정에서 useCamera instance가
   * 새로 생성되므로 Runtime에서도 다시 stream을
   * 확보해야 한다.
   */
  const autoStartAttemptedRef = useRef(false);

  useEffect(() => {
    if (
      autoStartAttemptedRef.current ||
      permission !== 'idle' ||
      !preCalibration
    ) {
      return;
    }

    autoStartAttemptedRef.current = true;

    void start();
  }, [permission, preCalibration, start]);

  // =========================================================
  // Context
  // =========================================================

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

      /*
       * Context 계약은 기존 이름이 activeCalibration이므로
       * 로그인 전에도 이 필드로 9점 calibration을 전달한다.
       *
       * 소비자 입장에서는 "현재 Runtime이 사용하는 calibration"
       * 이라는 의미로 동일하게 사용할 수 있다.
       */
      activeCalibration: preCalibration,

      /*
       * 로그인 전 9점에서는 Backend의 active calibration
       * compatibility 판정이 존재하지 않는다.
       */
      compatibility: null,

      subscribeFrame,

      subscribeTrackingFrame,
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
      preCalibration,
      subscribeFrame,
      subscribeTrackingFrame,
    ],
  );

  // =========================================================
  // Render
  // =========================================================

  return (
    <GazeRuntimeContext.Provider value={value}>
      {children}

      {/*
        로그인 전 Runtime이 소유하는 유일한 video.

        Login / Signup / PasswordReset 페이지 각각에서
        video를 새로 생성하지 않는다.
      */}
      <video ref={videoRef} style={HIDDEN_VIDEO_STYLE} playsInline muted />
    </GazeRuntimeContext.Provider>
  );
}
