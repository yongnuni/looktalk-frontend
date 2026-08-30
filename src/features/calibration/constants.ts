export interface NormalizedPoint {
  x: number;
  y: number;
}

// ============================================================
// 공통 캘리브레이션 설정
// ============================================================
//
// 기존 16점 캘리브레이션과 로그인 전 9점 캘리브레이션은
// 동일한 NORMALIZED_VIEWPORT 좌표계와 margin=0.08을 사용한다.
//
// ============================================================

export const CALIB_MARGIN = 0.08;

// ============================================================
// 기존 로그인 후 16점 캘리브레이션
// ============================================================
//
// Look-Talk 원본:
// src/config.py CALIB_POINTS(37-57행)
//
// 4x4 grid, margin=0.08
//
// ============================================================

export const CALIB_GRID_ROWS = 4;
export const CALIB_GRID_COLS = 4;

// ============================================================
// 로그인 전 9점 캘리브레이션
// ============================================================
//
// 기존 16점과 동일한 좌표계 / margin을 사용하되
// 3x3 grid로 구성한다.
//
// ============================================================

export const PRE_CALIB_GRID_ROWS = 3;
export const PRE_CALIB_GRID_COLS = 3;

// ============================================================
// Grid 생성
// ============================================================
//
// rows / cols / margin을 전달하면 정규화된 [0, 1] viewport
// 좌표 배열을 생성한다.
//
// 기존 16점:
// buildCalibrationGrid(4, 4, 0.08)
//
// 로그인 전 9점:
// buildCalibrationGrid(3, 3, 0.08)
//
// ============================================================

export function buildCalibrationGrid(
  rows = CALIB_GRID_ROWS,
  cols = CALIB_GRID_COLS,
  margin = CALIB_MARGIN,
): NormalizedPoint[] {
  const points: NormalizedPoint[] = [];

  const top = 1 - margin;

  for (let row = 0; row < rows; row += 1) {
    const y = rows === 1 ? 0.5 : margin + ((top - margin) * row) / (rows - 1);

    for (let col = 0; col < cols; col += 1) {
      const x = cols === 1 ? 0.5 : margin + ((top - margin) * col) / (cols - 1);

      points.push({
        x,
        y,
      });
    }
  }

  return points;
}

// ============================================================
// 기존 16점 캘리브레이션 좌표
// ============================================================
//
// 4 x 4
//
// (0.08, 0.08) ... (0.92, 0.08)
//       ...
// (0.08, 0.92) ... (0.92, 0.92)
//
// 기존 CalibrationPage / useCalibrationRunner()에서
// 계속 이 값을 기본값으로 사용한다.
//
// ============================================================

export const CALIBRATION_GRID_POINTS: NormalizedPoint[] = buildCalibrationGrid(
  CALIB_GRID_ROWS,
  CALIB_GRID_COLS,
  CALIB_MARGIN,
);

// ============================================================
// 로그인 전 9점 캘리브레이션 좌표
// ============================================================
//
// 3 x 3
//
// (0.08, 0.08)  (0.50, 0.08)  (0.92, 0.08)
//
// (0.08, 0.50)  (0.50, 0.50)  (0.92, 0.50)
//
// (0.08, 0.92)  (0.50, 0.92)  (0.92, 0.92)
//
// 기존 16점 캘리브레이션과 동일하게
// 브라우저 content viewport 전체를 기준으로 한다.
//
// ============================================================

export const PRE_CALIBRATION_GRID_POINTS: NormalizedPoint[] =
  buildCalibrationGrid(PRE_CALIB_GRID_ROWS, PRE_CALIB_GRID_COLS, CALIB_MARGIN);

// ============================================================
// 측정 시간
// ============================================================
//
// Look-Talk 원본:
// src/config.py(65-70행)
//
// 시간 상수는 좌표계와 무관하므로
// 9점과 16점에서 동일하게 사용한다.
//
// 점 하나당:
//
// 1초 안정화
// +
// 2초 샘플 수집
//
// ============================================================

export const CALIB_STABILIZE_SEC = 1.0;
export const CALIB_COLLECT_SEC = 2.0;

// ============================================================
// 시선 안정성 Threshold
// ============================================================
//
// Look-Talk 원본 calibration.py의 트림 후 표준편차 임계값.
//
// iris 좌표는 정규화 [0,1] 공간이므로
// px 변환 없이 그대로 사용한다.
//
// 로그인 전 9점과 기존 16점 모두 동일하게 적용한다.
//
// ============================================================

export const CALIB_STD_X = 0.008;
export const CALIB_STD_Y = 0.008;

// ============================================================
// Iris Confidence
// ============================================================
//
// Look-Talk 원본:
// calibration.py Calibrator.update()
//
// conf > 0.4일 때만 calibration sample을 수집한다.
//
// ============================================================

export const CALIB_MIN_CONFIDENCE = 0.4;

// ============================================================
// RMSE Warning Threshold
// ============================================================
//
// Final C(정확도 재검토)
//
// Look-Talk 원본은 calibration.py 643행:
//
// max_calib_rmse_px = 150.0
//
// raw pixel space 기준이므로 Web의 NORMALIZED_VIEWPORT
// 좌표계에 그대로 적용할 수 없다.
//
// 현재 0.05는 provisional threshold.
//
// homography.test.ts에서 확인한 실측:
//
// 정상 범위:
// RMSE 약 0.006 ~ 0.032
//
// 문제가 발생했던 상태:
// RMSE 약 0.1853
//
// Python 구현처럼 이전 calibration으로 자동 대체하지 않고,
// MeasurementResultModal에서 경고만 표시하고 사용자의 선택을
// 막지 않는 방식으로 유지한다.
//
// 실제 기기 QA 이후 production threshold를 재조정한다.
//
// ============================================================

export const CALIBRATION_RMSE_WARNING_THRESHOLD_NORMALIZED = 0.05;
