import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface GazeSignal {
  irisX: number; // normalized 0..1, canonical(mirrored) 좌표
  irisY: number; // normalized 0..1
  ear: number;
  mar: number;
  // Look-Talk eye_tracking.py iris_confidence() 포팅값. Calibrator.update()가 샘플
  // 수집 게이트로 쓰는 값(conf > 0.4)과 동일한 산식 — Step 1 calibration에서 사용한다.
  irisConfidence: number;
  eyeClosed: boolean;
  timestamp: number;
}

/**
 * FaceLandmarker의 한 추론 프레임. 시선 계산과 별개로 카메라 위에 실제 랜드마크를
 * 그려야 하는 시각화 소비자에게만 전달하며, 배열은 소비자가 변경하지 않는다.
 */
export interface FaceTrackingFrame {
  rawLandmarks: ReadonlyArray<NormalizedLandmark> | null;
  canonicalLandmarks: ReadonlyArray<NormalizedLandmark> | null;
  signal: GazeSignal | null;
  timestamp: number;
}
