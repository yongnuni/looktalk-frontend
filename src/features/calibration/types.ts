import type { MirrorStrategy } from '../faceTracking/mediapipe/mirrorStrategy';

/** Integration Plan §7.7 — Backend 저장 스키마와 동일한 형태. Step 1은 이 값을 메모리에만 유지한다. */
export interface GazeCalibrationResult {
  schemaVersion: 1;
  mappingType: 'RAW_HOMOGRAPHY';
  coordinateSpace: 'NORMALIZED_VIEWPORT';
  homography: [[number, number, number], [number, number, number], [number, number, number]];
  mirrorX: true;
  mirrorStrategy: MirrorStrategy;
  grid: {
    rows: number;
    cols: number;
    margin: number;
  };
  calibratedViewport: {
    widthPx: number;
    heightPx: number;
    aspectRatio: number;
    orientation: 'portrait' | 'landscape';
  };
  reprojectionRmseNormalized: number;
  createdAtLocal: string;
}

export type CalibrationPointStatus = 'stabilizing' | 'collecting';

export type CalibrationRunnerStatus =
  | 'idle' // 카메라/FaceLandmarker 준비 전
  | 'running' // 16점 진행 중
  | 'done' // Homography 계산 완료, candidate 생성됨
  | 'verifying'; // 완료 후 gaze cursor로 확인하는 단계(진행 중 상태와 병행 표시용)

export interface CalibrationProgress {
  status: CalibrationRunnerStatus;
  pointIndex: number; // 0-based, 현재 진행 중인 점
  totalPoints: number;
  pointStatus: CalibrationPointStatus;
  pointElapsedRatio: number; // 0..1, 현재 점의 stabilize+collect 진행률
  warning: string | null; // Look-Talk의 시선 불안정 경고 메시지에 대응
  retryCount: number; // 현재 점의 재측정 횟수(0 또는 1)
}
