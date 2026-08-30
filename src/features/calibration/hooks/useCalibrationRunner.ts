import { useCallback, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useCamera } from '../../camera/hooks/useCamera';
import type { CameraPermissionState } from '../../camera/types';

import {
  useFaceTracking,
  type FaceLandmarkerLoadState,
} from '../../faceTracking/hooks/useFaceTracking';
import { GazeFilter } from '../../faceTracking/gaze/GazeFilter';

import { DEFAULT_MIRROR_STRATEGY } from '../../faceTracking/mediapipe/mirrorStrategy';
import type { FaceTrackingFrame, GazeSignal } from '../../faceTracking/types';
import type {
  FrameListener,
  TrackingFrameListener,
} from '../../gazeRuntime/GazeRuntimeContext';
import { buildGazeFrame } from '../../gazeRuntime/gazeFrameBuilder';

import {
  CalibrationSession,
  type CalibrationSessionSnapshot,
} from '../CalibrationSession';
import {
  PatientCalibrationFlow,
  type PatientCalibrationStage,
  type PatientInputTestResults,
  type PatientInputTestTargets,
} from '../PatientCalibrationFlow';
import {
  BlinkCalibrationSession,
  MouthCalibrationSession,
  type BlinkCalibrationSnapshot,
  type MouthCalibrationSnapshot,
} from '../inputCalibration';
import type { InputMethodTestResult } from '../inputMethodTest';
import { resolveBlinkThresholdsFromResult } from '../runtimeInputThresholds';

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
import type {
  CalibrationCompletionGazeListener,
  SubscribeCalibrationCompletionGaze,
} from '../completionGaze/types';
import { viewportNormalizedToCssPx } from '../viewportTargets';

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

  /** 완료 화면의 명시적 버튼 target이 React render throttle 없이 같은 좌표를 구독한다. */
  subscribeCompletionGaze: SubscribeCalibrationCompletionGaze;

  /** 입력 테스트가 기존 selection controller를 재사용하는 매-frame 구독. */
  subscribeInputFrame: (listener: FrameListener) => () => void;

  /** 같은 FaceLandmarker frame을 Landmark PiP에 전달하는 구독. */
  subscribeTrackingFrame: (listener: TrackingFrameListener) => () => void;

  flowStage: PatientCalibrationStage;

  blinkProgress: BlinkCalibrationSnapshot | null;

  mouthProgress: MouthCalibrationSnapshot | null;

  inputTestTargets: PatientInputTestTargets;

  inputTestResults: PatientInputTestResults;

  completeInputTest: (result: InputMethodTestResult) => void;

  restartBlink: () => void;

  continueBlinkWithDefaults: () => void;

  restartMouth: () => void;

  continueMouthWithDefaults: () => void;

  markSaving: () => void;

  markSaveFailed: () => void;

  markComplete: () => void;

  restart: () => void;
}

export function useCalibrationRunner(
  options: UseCalibrationRunnerOptions = {},
): UseCalibrationRunnerResult {
  const mode = options.mode ?? 'patient';

  // patient / pre 설정을 mode 기준으로 계산한다.
  //
  // 기존에는 configRef.current를 렌더링 중 읽으면서
  // react-hooks/refs lint 오류가 발생했기 때문에,
  // ref 대신 useMemo로 동일한 설정을 유지한다.
  const config = useMemo(() => getCalibrationRunnerConfig(mode), [mode]);

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
  const patientFlowRef = useRef(new PatientCalibrationFlow());
  const blinkSessionRef = useRef(new BlinkCalibrationSession());
  const mouthSessionRef = useRef(new MouthCalibrationSession());
  const inputGazeFilterRef = useRef(new GazeFilter());
  const gazeResultRef = useRef<GazeCalibrationResult | null>(null);

  const resultBuiltRef = useRef(false);
  const lastUiUpdateRef = useRef(0);
  const completionGazeListenersRef = useRef(
    new Set<CalibrationCompletionGazeListener>(),
  );
  const inputFrameListenersRef = useRef(new Set<FrameListener>());
  const trackingFrameListenersRef = useRef(new Set<TrackingFrameListener>());

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

  const [flowStage, setFlowStage] = useState<PatientCalibrationStage>('GAZE_RUNNING');
  const [blinkProgress, setBlinkProgress] = useState<BlinkCalibrationSnapshot | null>(null);
  const [mouthProgress, setMouthProgress] = useState<MouthCalibrationSnapshot | null>(null);
  const blinkThresholds = useMemo(
    () => resolveBlinkThresholdsFromResult(blinkProgress?.result ?? null),
    [blinkProgress?.result],
  );
  const [inputTestTargets, setInputTestTargets] = useState<PatientInputTestTargets>({
    gaze: null,
    blink: null,
    mouth: null,
  });
  const [inputTestResults, setInputTestResults] = useState<PatientInputTestResults>({
    gaze: null,
    blink: null,
    mouth: null,
  });

  const subscribeCompletionGaze = useCallback(
    (listener: CalibrationCompletionGazeListener) => {
      completionGazeListenersRef.current.add(listener);

      return () => {
        completionGazeListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const subscribeInputFrame = useCallback((listener: FrameListener) => {
    inputFrameListenersRef.current.add(listener);
    return () => {
      inputFrameListenersRef.current.delete(listener);
    };
  }, []);

  const subscribeTrackingFrame = useCallback((listener: TrackingFrameListener) => {
    trackingFrameListenersRef.current.add(listener);
    return () => {
      trackingFrameListenersRef.current.delete(listener);
    };
  }, []);

  const handleTrackingFrame = useCallback((frame: FaceTrackingFrame) => {
    for (const listener of trackingFrameListenersRef.current) {
      listener(frame);
    }
  }, []);

  const syncPatientFlowState = useCallback(() => {
    const snapshot = patientFlowRef.current.getSnapshot();
    setFlowStage(snapshot.stage);
    setInputTestTargets(snapshot.inputTestTargets);
    setInputTestResults(snapshot.inputTests);
  }, []);

  // ============================================================
  // Calibration Store
  // ============================================================

  // 기존 정식 16점에서는 candidate를 calibrationStore에 저장한다.
  //
  // 로그인 전 9점에서는 아직 사용자 계정이 확정되지 않았으므로
  // 기존 patient calibration candidate는 건드리지 않는다.
  const setCandidate = useCalibrationStore((state) => state.setCandidate);

  const clearCandidate = useCalibrationStore((state) => state.clearCandidate);
  const setInputCalibration = useCalibrationStore((state) => state.setInputCalibration);
  const clearInputCalibration = useCalibrationStore((state) => state.clearInputCalibration);

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

  const finishBlinkCalibration = useCallback(
    (snapshot: BlinkCalibrationSnapshot) => {
      if (!snapshot.result) {
        return;
      }

      patientFlowRef.current.completeBlink(snapshot.result);
      setBlinkProgress(snapshot);
      syncPatientFlowState();
    },
    [syncPatientFlowState],
  );

  const finishMouthCalibration = useCallback(
    (snapshot: MouthCalibrationSnapshot) => {
      if (!snapshot.result) {
        return;
      }

      patientFlowRef.current.completeMouth(snapshot.result);
      const flowSnapshot = patientFlowRef.current.getSnapshot();

      if (flowSnapshot.blink && flowSnapshot.mouth) {
        setInputCalibration({
          blink: flowSnapshot.blink,
          mouth: flowSnapshot.mouth,
        });
      }

      setMouthProgress(snapshot);
      syncPatientFlowState();
    },
    [setInputCalibration, syncPatientFlowState],
  );

  const completeInputTest = useCallback(
    (testResult: InputMethodTestResult) => {
      const previousStage = patientFlowRef.current.getSnapshot().stage;
      patientFlowRef.current.completeInputTest(testResult);
      const nextStage = patientFlowRef.current.getSnapshot().stage;

      if (nextStage === previousStage) {
        return;
      }

      if (nextStage === 'BLINK_RUNNING') {
        blinkSessionRef.current = new BlinkCalibrationSession();
        setBlinkProgress(blinkSessionRef.current.getCurrentSnapshot());
        setMouthProgress(null);
      } else if (nextStage === 'MOUTH_RUNNING') {
        mouthSessionRef.current = new MouthCalibrationSession();
        setMouthProgress(mouthSessionRef.current.getCurrentSnapshot());
      }

      syncPatientFlowState();
    },
    [syncPatientFlowState],
  );

  // ============================================================
  // Frame
  // ============================================================

  const handleFrame = useCallback(
    (signal: GazeSignal | null) => {
      const session = sessionRef.current;

      const now = signal?.timestamp ?? performance.now();

      const stageAtFrameStart = patientFlowRef.current.getSnapshot().stage;

      if (signal && (mode === 'pre' || stageAtFrameStart === 'GAZE_RUNNING')) {
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

        gazeResultRef.current = builtResult;
        setResult(builtResult);

        // 기존 로그인 후 16점에서만 candidate를 저장한다.
        //
        // 로그인 전 9점에서는 기존 calibrationStore의 candidate를
        // 덮어쓰지 않는다.
        if (config.persistCandidate) {
          setCandidate(builtResult);
          patientFlowRef.current.completeGaze(builtResult);
          syncPatientFlowState();
        }

        setPointDiagnostics(
          diagnoseHomography(
            snapshot.homography,
            snapshot.irisPoints,
            config.targetPoints,
          ),
        );
      }

      let nextBlinkProgress: BlinkCalibrationSnapshot | null = null;
      let nextMouthProgress: MouthCalibrationSnapshot | null = null;

      if (mode === 'patient' && stageAtFrameStart === 'BLINK_RUNNING') {
        nextBlinkProgress = blinkSessionRef.current.update(signal?.ear ?? null, now);

        if (nextBlinkProgress.done) {
          finishBlinkCalibration(nextBlinkProgress);
        }
      } else if (mode === 'patient' && stageAtFrameStart === 'MOUTH_RUNNING') {
        nextMouthProgress = mouthSessionRef.current.update(signal?.mar ?? null, now);

        if (nextMouthProgress.done) {
          finishMouthCalibration(nextMouthProgress);
        }
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

        if (nextBlinkProgress) {
          setBlinkProgress(nextBlinkProgress);
        }

        if (nextMouthProgress) {
          setMouthProgress(nextMouthProgress);
        }
      }

      const cursorCssPx = nextCursor
        ? viewportNormalizedToCssPx(nextCursor)
        : null;
      const inputFrame = buildGazeFrame(
        gazeResultRef.current,
        inputGazeFilterRef.current,
        signal,
        now,
      );
      const completionFrame = {
        now,
        hasSignal: signal !== null && cursorCssPx !== null,
        signal,
        cursorCssPx,
        fixationCount: 0,
      };

      for (const listener of inputFrameListenersRef.current) {
        listener(inputFrame);
      }

      for (const listener of completionGazeListenersRef.current) {
        listener(completionFrame);
      }
    },
    [
      buildResult,
      config,
      finishBlinkCalibration,
      finishMouthCalibration,
      mode,
      setCandidate,
      syncPatientFlowState,
    ],
  );

  // ============================================================
  // Face Tracking
  // ============================================================

  const { loadState: faceLoadState, loadError: faceLoadError } =
    useFaceTracking({
      videoRef,

      active: permission === 'granted',

      mirrorStrategy: DEFAULT_MIRROR_STRATEGY,

      blinkThresholds,

      onFrame: handleFrame,

      onTrackingFrame: handleTrackingFrame,
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
    if (mode === 'patient') {
      clearInputCalibration();
    }

    void start();
  }, [clearInputCalibration, mode, start]);

  const restartBlink = useCallback(() => {
    patientFlowRef.current.retryBlink();
    blinkSessionRef.current = new BlinkCalibrationSession();
    mouthSessionRef.current = new MouthCalibrationSession();
    setBlinkProgress(blinkSessionRef.current.getCurrentSnapshot());
    setMouthProgress(null);
    syncPatientFlowState();
  }, [syncPatientFlowState]);

  const continueBlinkWithDefaults = useCallback(() => {
    if (patientFlowRef.current.getSnapshot().stage !== 'BLINK_RUNNING') {
      return;
    }

    finishBlinkCalibration(blinkSessionRef.current.continueWithDefaults());
  }, [finishBlinkCalibration]);

  const restartMouth = useCallback(() => {
    patientFlowRef.current.retryMouth();
    mouthSessionRef.current = new MouthCalibrationSession();
    setMouthProgress(mouthSessionRef.current.getCurrentSnapshot());
    syncPatientFlowState();
  }, [syncPatientFlowState]);

  const continueMouthWithDefaults = useCallback(() => {
    if (patientFlowRef.current.getSnapshot().stage !== 'MOUTH_RUNNING') {
      return;
    }

    finishMouthCalibration(mouthSessionRef.current.continueWithDefaults());
  }, [finishMouthCalibration]);

  const markSaving = useCallback(() => {
    patientFlowRef.current.startSaving();
    syncPatientFlowState();
  }, [syncPatientFlowState]);

  const markSaveFailed = useCallback(() => {
    patientFlowRef.current.savingFailed();
    syncPatientFlowState();
  }, [syncPatientFlowState]);

  const markComplete = useCallback(() => {
    patientFlowRef.current.complete();
    syncPatientFlowState();
  }, [syncPatientFlowState]);

  // ============================================================
  // Restart
  // ============================================================

  const restart = useCallback(() => {
    sessionRef.current.reset();
    patientFlowRef.current.restartGaze();
    blinkSessionRef.current = new BlinkCalibrationSession();
    mouthSessionRef.current = new MouthCalibrationSession();

    resultBuiltRef.current = false;
    gazeResultRef.current = null;
    inputGazeFilterRef.current.reset();

    setResult(null);

    setPointDiagnostics(null);

    setCursorNormalized(null);

    syncPatientFlowState();

    setBlinkProgress(null);

    setMouthProgress(null);

    const now = performance.now();
    const resetInputFrame = {
      now,
      hasSignal: false,
      signal: null,
      cursorCssPx: null,
      fixationCount: 0,
    };
    for (const listener of inputFrameListenersRef.current) {
      listener(resetInputFrame);
    }
    for (const listener of completionGazeListenersRef.current) {
      listener(resetInputFrame);
    }

    setProgress(sessionRef.current.getSnapshot(now));

    // 정식 16점 재측정에서는 기존 candidate를 폐기한다.
    //
    // 로그인 전 9점에서는 기존 정식 calibration candidate를
    // 건드리지 않는다.
    if (config.persistCandidate) {
      clearCandidate();
      clearInputCalibration();
    }
  }, [clearCandidate, clearInputCalibration, config, syncPatientFlowState]);

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

    subscribeCompletionGaze,

    subscribeInputFrame,

    subscribeTrackingFrame,

    flowStage,

    blinkProgress,

    mouthProgress,

    inputTestTargets,

    inputTestResults,

    completeInputTest,

    restartBlink,

    continueBlinkWithDefaults,

    restartMouth,

    continueMouthWithDefaults,

    markSaving,

    markSaveFailed,

    markComplete,

    restart,
  };
}
