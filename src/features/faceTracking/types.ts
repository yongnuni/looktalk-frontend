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
