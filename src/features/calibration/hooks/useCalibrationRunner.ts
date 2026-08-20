import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useCamera } from '../../camera/hooks/useCamera';
import type { CameraPermissionState } from '../../camera/types';

import {
  useFaceTracking,
  type FaceLandmarkerLoadState,
} from '../../faceTracking/hooks/useFaceTracking';

import { DEFAULT_MIRROR_STRATEGY } from '../../faceTracking/mediapipe/mirrorStrategy';
import type { GazeSignal } from '../../faceTracking/types';

import {
  CalibrationSession,
  type CalibrationSessionSnapshot,
} from '../CalibrationSession';

import {
  CALIBRATION_GRID_POINTS,
  CALIB_GRID_COLS,
  CALIB_GRID_ROWS,
  CALIB_MARGIN,
  PRE_CALIBRATION_GRID_POINTS,
  PRE_CALIB_GRID_COLS,
  PRE_CALIB_GRID_ROWS,
  type NormalizedPoint,
} from '../constants';

import {
  applyHomography,
  diagnoseHomography,
  type HomographyPointDiagnostic,
} from '../homography';

import { useCalibrationStore } from '../store/calibrationStore';
import type { GazeCalibrationResult } from '../types';

// 진행률/타깃/커서 UI 갱신 주기.
// 감지·샘플 수집 자체는 useFaceTracking의 onFrame으로 매 프레임 수행하지만,
// React state 갱신만 이 주기로 throttle한다.
const UI_UPDATE_INTERVAL_MS = 50;

// ============================================================
// Calibration Runner Mode
// ============================================================
//
// patient
// - 기존 로그인 후 16점 캘리브레이션
// - 4 x 4
// - calibrationStore candidate 저장
//
// pre
// - 로그인 전 9점 캘리브레이션
// - 3 x 3
// - 기존 patient calibration candidate는 건드리지 않음
//
// ============================================================

export type CalibrationRunnerMode = 'patient' | 'pre';

export interface UseCalibrationRunnerOptions {
  mode?: CalibrationRunnerMode;
}

interface CalibrationRunnerConfig {
  targetPoints: NormalizedPoint[];
  rows: number;
  cols: number;
  persistCandidate: boolean;
}

function getCalibrationRunnerConfig(
  mode: CalibrationRunnerMode,
): CalibrationRunnerConfig {
  if (mode === 'pre') {
    return {
      targetPoints: PRE_CALIBRATION_GRID_POINTS,
      rows: PRE_CALIB_GRID_ROWS,
      cols: PRE_CALIB_GRID_COLS,
      persistCandidate: false,
    };
  }

  return {
    targetPoints: CALIBRATION_GRID_POINTS,
    rows: CALIB_GRID_ROWS,
    cols: CALIB_GRID_COLS,
    persistCandidate: true,
  };
}

// useState 초기값은 ref를 읽지 않고 계산해야 하므로,
// CalibrationSession 초기 스냅샷과 동일한 값을 targetPoints 기준으로 생성한다.
function createIdleSnapshot(
  targetPoints: NormalizedPoint[],
): CalibrationSessionSnapshot {
  return {
    done: false,
    pointIndex: 0,
    totalPoints: targetPoints.length,
    currentTarget: targetPoints[0] ?? null,
    pointStatus: 'stabilizing',
    pointElapsedRatio: 0,
    warning: '',
    retryCount: 0,
    irisPoints: [],
    homography: null,
    reprojectionRmseNormalized: null,
  };
}

export interface UseCalibrationRunnerResult {
  permission: CameraPermissionState;

  cameraError: string | null;

  videoRef: RefObject<HTMLVideoElement | null>;

  /** 카메라 시작을 트리거한다. */
  startCalibration: () => void;

  faceLoadState: FaceLandmarkerLoadState;

  faceLoadError: string | null;

  progress: CalibrationSessionSnapshot;

  result: GazeCalibrationResult | null;

  // 각 calibration point의 iris / target / predicted / 오차.
  // production threshold는 아직 없음 — 개발 진단 표시 전용.
  pointDiagnostics: HomographyPointDiagnostic[] | null;

  // 진짜 browser viewport(주소창/탭 아래, LookTalk 페이지 영역) 기준
  // 정규화(0..1) 좌표.
  //
  // 화면에 그리려면 viewportNormalizedToCssPx()로
  // CSS px 변환 후 position:fixed로 렌더링한다.
  cursorNormalized: {
    x: number;
    y: number;
  } | null;

  restart: () => void;
}

export function useCalibrationRunner(
  options: UseCalibrationRunnerOptions = {},
): UseCalibrationRunnerResult {
  const mode = options.mode ?? 'patient';

  // patient/pre는 각각 별도 페이지에서 사용하며 mount 중 mode가 변경되지 않는 것을
  // 전제로 초기 config를 고정한다.
  const configRef = useRef<CalibrationRunnerConfig>(
    getCalibrationRunnerConfig(mode),
  );

  const config = configRef.current;

  // ============================================================
  // Camera
  // ============================================================

  const {
    permission,
    videoRef,
    errorMessage: cameraError,
    start,
  } = useCamera();

  // ============================================================
  // Calibration Session
  // ============================================================

  // 기존:
  // new CalibrationSession()
  //
  // 기본값으로 CALIBRATION_GRID_POINTS(16점)를 사용했다.
  //
  // 변경:
  // mode에 따라 targetPoints를 직접 전달한다.
  //
  // patient → 16점
  // pre     → 9점
  const sessionRef = useRef(new CalibrationSession(config.targetPoints));

  const resultBuiltRef = useRef(false);
  const lastUiUpdateRef = useRef(0);

  // ============================================================
  // State
  // ============================================================

  const [progress, setProgress] = useState<CalibrationSessionSnapshot>(() =>
    createIdleSnapshot(config.targetPoints),
  );

  const [result, setResult] = useState<GazeCalibrationResult | null>(null);

  const [pointDiagnostics, setPointDiagnostics] = useState<
    HomographyPointDiagnostic[] | null
  >(null);

  const [cursorNormalized, setCursorNormalized] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // ============================================================
  // Calibration Store
  // ============================================================

  // 기존 정식 16점에서는 candidate를 calibrationStore에 저장한다.
  //
  // 로그인 전 9점에서는 아직 사용자 계정이 확정되지 않았으므로
  // 기존 patient calibration candidate는 건드리지 않는다.
  const setCandidate = useCalibrationStore((state) => state.setCandidate);

  const clearCandidate = useCalibrationStore((state) => state.clearCandidate);

  // ============================================================
  // Result 생성
  // ============================================================

  const buildResult = useCallback(
    (
      homography: NonNullable<CalibrationSessionSnapshot['homography']>,
      rmse: number | null,
    ): GazeCalibrationResult => {
      // LookTalk Web v1의 interaction domain은
      // browser content viewport이다.
      //
      // 주소창/탭/browser chrome/OS taskbar 등은 제외되며
      // window.innerWidth / innerHeight가 실제 interaction 영역이다.
      const widthPx = window.innerWidth;
      const heightPx = window.innerHeight;

      return {
        schemaVersion: 1,

        mappingType: 'RAW_HOMOGRAPHY',

        coordinateSpace: 'NORMALIZED_VIEWPORT',

        homography,

        mirrorX: true,

        mirrorStrategy: DEFAULT_MIRROR_STRATEGY,

        grid: {
          rows: config.rows,
          cols: config.cols,
          margin: CALIB_MARGIN,
        },

        calibratedViewport: {
          widthPx,
          heightPx,
          aspectRatio: widthPx / heightPx,
          orientation: widthPx >= heightPx ? 'landscape' : 'portrait',
        },

        reprojectionRmseNormalized: rmse ?? 0,

        createdAtLocal: new Date().toISOString(),
      };
    },
    [config],
  );

  // ============================================================
  // Frame
  // ============================================================

  const handleFrame = useCallback(
    (signal: GazeSignal | null) => {
      const session = sessionRef.current;

      const now = signal?.timestamp ?? performance.now();

      if (signal) {
        session.update(signal.irisX, signal.irisY, signal.irisConfidence, now);
      }

      const snapshot = session.getSnapshot(now);

      // ========================================================
      // Calibration 완료
      // ========================================================

      if (snapshot.done && snapshot.homography && !resultBuiltRef.current) {
        resultBuiltRef.current = true;

        const builtResult = buildResult(
          snapshot.homography,
          snapshot.reprojectionRmseNormalized,
        );

        setResult(builtResult);

        // 기존 로그인 후 16점에서만 candidate를 저장한다.
        //
        // 로그인 전 9점에서는 기존 calibrationStore의 candidate를
        // 덮어쓰지 않는다.
        if (config.persistCandidate) {
          setCandidate(builtResult);
        }

        setPointDiagnostics(
          diagnoseHomography(
            snapshot.homography,
            snapshot.irisPoints,
            config.targetPoints,
          ),
        );
      }

      // ========================================================
      // Cursor
      // ========================================================

      let nextCursor: {
        x: number;
        y: number;
      } | null = null;

      if (snapshot.done && snapshot.homography && signal) {
        const projected = applyHomography(
          snapshot.homography,
          signal.irisX,
          signal.irisY,
        );

        nextCursor = {
          x: Math.min(Math.max(projected.x, 0), 1),

          y: Math.min(Math.max(projected.y, 0), 1),
        };
      }

      // ========================================================
      // UI State
      // ========================================================

      if (now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiUpdateRef.current = now;

        setProgress(snapshot);

        setCursorNormalized(nextCursor);
      }
    },
    [buildResult, config, setCandidate],
  );

  // ============================================================
  // Face Tracking
  // ============================================================

  const { loadState: faceLoadState, loadError: faceLoadError } =
    useFaceTracking({
      videoRef,

      active: permission === 'granted',

      mirrorStrategy: DEFAULT_MIRROR_STRATEGY,

      onFrame: handleFrame,
    });

  // ============================================================
  // Start
  // ============================================================

  // 사용자 시작 버튼
  // → 카메라 권한
  // → FaceLandmarker 준비
  // → faceLoadState === 'ready'
  // → CalibrationPage/PreCalibrationPage에서 full viewport overlay 표시
  // → handleFrame으로 샘플 수집
  //
  // Browser Fullscreen API는 사용하지 않는다.
  const startCalibration = useCallback(() => {
    void start();
  }, [start]);

  // ============================================================
  // Restart
  // ============================================================

  const restart = useCallback(() => {
    sessionRef.current.reset();

    resultBuiltRef.current = false;

    setResult(null);

    setPointDiagnostics(null);

    setCursorNormalized(null);

    setProgress(sessionRef.current.getSnapshot(performance.now()));

    // 정식 16점 재측정에서는 기존 candidate를 폐기한다.
    //
    // 로그인 전 9점에서는 기존 정식 calibration candidate를
    // 건드리지 않는다.
    if (config.persistCandidate) {
      clearCandidate();
    }
  }, [clearCandidate, config]);

  // ============================================================
  // Return
  // ============================================================

  return {
    permission,

    cameraError,

    videoRef,

    startCalibration,

    faceLoadState,

    faceLoadError,

    progress,

    result,

    pointDiagnostics,

    cursorNormalized,

    restart,
  };
}
