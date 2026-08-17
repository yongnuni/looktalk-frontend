export interface NormalizedPoint {
  x: number;
  y: number;
}

// Look-Talk 원본: src/config.py CALIB_POINTS(37-57행) 생성 로직 — 4x4 그리드, margin=0.08.
// px 종속 값이 아니라 이미 정규화 [0,1] 비율이라 그대로 포팅한다(Integration Plan §7.2).
export const CALIB_GRID_ROWS = 4;
export const CALIB_GRID_COLS = 4;
export const CALIB_MARGIN = 0.08;

export function buildCalibrationGrid(
  rows = CALIB_GRID_ROWS,
  cols = CALIB_GRID_COLS,
  margin = CALIB_MARGIN,
): NormalizedPoint[] {
  const points: NormalizedPoint[] = [];
  const top = 1 - margin;

  for (let row = 0; row < rows; row += 1) {
    const y = margin + ((top - margin) * row) / (rows - 1);

    for (let col = 0; col < cols; col += 1) {
      const x = margin + ((top - margin) * col) / (cols - 1);
      points.push({ x, y });
    }
  }

  return points;
}

export const CALIBRATION_GRID_POINTS: NormalizedPoint[] = buildCalibrationGrid();

// Look-Talk 원본: src/config.py(65-70행) — 시간 상수는 좌표계와 무관해 그대로 포팅.
export const CALIB_STABILIZE_SEC = 1.0;
export const CALIB_COLLECT_SEC = 2.0;

// Look-Talk 원본: calibration.py의 트림 후 표준편차 임계값. iris는 정규화 [0,1] 좌표이므로
// px 변환 없이 그대로 포팅 가능(Integration Plan §7.4에서 언급한 "px 기준 150px"과는
// 성격이 다른, 애초에 정규화 공간 상수다).
export const CALIB_STD_X = 0.008;
export const CALIB_STD_Y = 0.008;

// Look-Talk 원본: calibration.py Calibrator.update()의 `conf > 0.4` 샘플 수집 게이트.
export const CALIB_MIN_CONFIDENCE = 0.4;

// Final C(정확도 재검토) — Look-Talk 원본은 calibration.py 643행 `max_calib_rmse_px = 150.0`
// (raw pixel space)로 재투영 오차가 너무 크면 새 calibration을 거부하고 이전 last_good_H로
// 자동 폴백한다(654-716행, console 경고만 출력하고 UI에는 노출하지 않음). Web은 좌표계가
// 다르고(정규화 0..1, §7.5) 고정 화면 해상도가 없어 150px를 그대로 옮길 수 없다 — 대신
// homography.test.ts에서 확인한 실측 스케일(정상 범위 RMSE~0.006-0.032, 사용자가 실제로
// 신고했던 깨진 상태가 RMSE=0.1853)을 근거로 한 provisional 값이다. Python처럼 말없이
// 이전 값으로 자동 대체하지 않고(사용자가 왜 재측정을 권유받는지 알 수 없게 되므로), 대신
// MeasurementResultModal에서 이 값을 넘으면 비침습적 경고 배너를 보여주고 선택은 막지
// 않는다(§8.5 viewport compatibility와 동일한 "권유만, 차단 없음" 원칙) — 정식 production
// threshold는 실제 기기 QA 후 재조정한다.
export const CALIBRATION_RMSE_WARNING_THRESHOLD_NORMALIZED = 0.05;
