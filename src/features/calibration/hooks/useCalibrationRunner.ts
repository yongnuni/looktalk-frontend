import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useCamera } from '../../camera/hooks/useCamera';
import type { CameraPermissionState } from '../../camera/types';
import { useFaceTracking, type FaceLandmarkerLoadState } from '../../faceTracking/hooks/useFaceTracking';
import { DEFAULT_MIRROR_STRATEGY } from '../../faceTracking/mediapipe/mirrorStrategy';
import type { GazeSignal } from '../../faceTracking/types';
import { CalibrationSession, type CalibrationSessionSnapshot } from '../CalibrationSession';
import { CALIBRATION_GRID_POINTS, CALIB_GRID_COLS, CALIB_GRID_ROWS, CALIB_MARGIN } from '../constants';
import { applyHomography, diagnoseHomography, type HomographyPointDiagnostic } from '../homography';
import { useCalibrationStore } from '../store/calibrationStore';
import type { GazeCalibrationResult } from '../types';

// 진행률/타깃/커서 UI 갱신 주기. 감지·샘플 수집 자체는 useFaceTracking의 onFrame으로
// 매 프레임 수행되지만(§13.4 원칙과 동일하게), React state 갱신만 이 주기로 throttle한다.
const UI_UPDATE_INTERVAL_MS = 50;

// useState 초기값은 ref를 읽지 않고 계산해야 하므로(react-hooks/refs), CalibrationSession의
// 초기 스냅샷 모양을 여기 별도로 정의한다 — sessionRef.current.getSnapshot(0)과 동일한 값이다.
const IDLE_SNAPSHOT: CalibrationSessionSnapshot = {
  done: false,
  pointIndex: 0,
  totalPoints: CALIBRATION_GRID_POINTS.length,
  currentTarget: CALIBRATION_GRID_POINTS[0] ?? null,
  pointStatus: 'stabilizing',
  pointElapsedRatio: 0,
  warning: '',
  retryCount: 0,
  irisPoints: [],
  homography: null,
  reprojectionRmseNormalized: null,
};

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
  // Front Step 1 Accuracy Audit 항목 6: 16점 각각의 iris/target/predicted/오차.
  // production threshold는 아직 없음 — 개발 진단 표시 전용.
  pointDiagnostics: HomographyPointDiagnostic[] | null;
  // 진짜 browser viewport(주소창/탭 아래, LookTalk 페이지 영역) 기준 정규화(0..1) 좌표
  // (window.innerWidth/innerHeight 기준). 화면에 그리려면 viewportNormalizedToCssPx()로
  // CSS px 변환 후 position:fixed로 렌더링한다.
  cursorNormalized: { x: number; y: number } | null;
  restart: () => void;
}

export function useCalibrationRunner(): UseCalibrationRunnerResult {
  const { permission, videoRef, errorMessage: cameraError, start } = useCamera();

  // CALIBRATION_GRID_POINTS 자체가 이제 NORMALIZED_VIEWPORT라 DOM 측정 없이 즉시
  // 생성할 수 있다(이전 turn의 stage-rect 기반 지연 생성 로직 제거).
  const sessionRef = useRef(new CalibrationSession());
  const resultBuiltRef = useRef(false);
  const lastUiUpdateRef = useRef(0);

  const [progress, setProgress] = useState<CalibrationSessionSnapshot>(IDLE_SNAPSHOT);
  const [result, setResult] = useState<GazeCalibrationResult | null>(null);
  const [pointDiagnostics, setPointDiagnostics] = useState<HomographyPointDiagnostic[] | null>(null);
  const [cursorNormalized, setCursorNormalized] = useState<{ x: number; y: number } | null>(null);

  // Step 5(Backend persistence) 이전까지는 candidate 하나만 세션 메모리(zustand)에 보관한다.
  // active/candidate 이중 트랙은 Step 5에서 Backend GET/POST와 함께 store를 확장한다.
  const setCandidate = useCalibrationStore((state) => state.setCandidate);
  const clearCandidate = useCalibrationStore((state) => state.clearCandidate);

  const buildResult = useCallback(
    (
      homography: NonNullable<CalibrationSessionSnapshot['homography']>,
      rmse: number | null,
    ): GazeCalibrationResult => {
      // LookTalk Web v1의 interaction domain은 browser content viewport(주소창/탭 등
      // browser chrome, OS taskbar 등은 제외)다 — window.innerWidth/innerHeight가 정확히
      // 이 영역이므로 별도 fullscreen 없이 그대로 기록한다(§7.5.2).
      const widthPx = window.innerWidth;
      const heightPx = window.innerHeight;

      return {
        schemaVersion: 1,
        mappingType: 'RAW_HOMOGRAPHY',
        coordinateSpace: 'NORMALIZED_VIEWPORT',
        homography,
        mirrorX: true,
        mirrorStrategy: DEFAULT_MIRROR_STRATEGY,
        grid: { rows: CALIB_GRID_ROWS, cols: CALIB_GRID_COLS, margin: CALIB_MARGIN },
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
    [],
  );

  const handleFrame = useCallback(
    (signal: GazeSignal | null) => {
      const session = sessionRef.current;
      const now = signal?.timestamp ?? performance.now();

      if (signal) {
        session.update(signal.irisX, signal.irisY, signal.irisConfidence, now);
      }

      const snapshot = session.getSnapshot(now);

      if (snapshot.done && snapshot.homography && !resultBuiltRef.current) {
        resultBuiltRef.current = true;
        const builtResult = buildResult(snapshot.homography, snapshot.reprojectionRmseNormalized);
        setResult(builtResult);
        setCandidate(builtResult);
        setPointDiagnostics(diagnoseHomography(snapshot.homography, snapshot.irisPoints, CALIBRATION_GRID_POINTS));
      }

      let nextCursor: { x: number; y: number } | null = null;

      if (snapshot.done && snapshot.homography && signal) {
        const projected = applyHomography(snapshot.homography, signal.irisX, signal.irisY);
        nextCursor = {
          x: Math.min(Math.max(projected.x, 0), 1),
          y: Math.min(Math.max(projected.y, 0), 1),
        };
      }

      if (now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiUpdateRef.current = now;
        setProgress(snapshot);
        setCursorNormalized(nextCursor);
      }
    },
    [buildResult, setCandidate],
  );

  const { loadState: faceLoadState, loadError: faceLoadError } = useFaceTracking({
    videoRef,
    active: permission === 'granted',
    mirrorStrategy: DEFAULT_MIRROR_STRATEGY,
    onFrame: handleFrame,
  });

  // 사용자 시작 버튼 → 카메라 권한/FaceLandmarker 준비(useFaceTracking이 permission
  // === 'granted'가 되면 자동 시작) → faceLoadState === 'ready'가 되는 순간
  // CalibrationPage가 full-viewport overlay를 띄우고 handleFrame이 바로 수집을 시작한다.
  // Browser Fullscreen API는 쓰지 않는다(§7.5.2) — LookTalk Web v1의 interaction domain은
  // browser content viewport(window.innerWidth/innerHeight)이지 OS/browser chrome이 아니다.
  const startCalibration = useCallback(() => {
    void start();
  }, [start]);

  const restart = useCallback(() => {
    sessionRef.current.reset();
    resultBuiltRef.current = false;
    setResult(null);
    setPointDiagnostics(null);
    setCursorNormalized(null);
    setProgress(sessionRef.current.getSnapshot(performance.now()));
    clearCandidate();
  }, [clearCandidate]);

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
