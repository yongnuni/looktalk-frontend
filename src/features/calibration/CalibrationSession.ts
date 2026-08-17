import {
  CALIBRATION_GRID_POINTS,
  CALIB_COLLECT_SEC,
  CALIB_MIN_CONFIDENCE,
  CALIB_STABILIZE_SEC,
  CALIB_STD_X,
  CALIB_STD_Y,
  type NormalizedPoint,
} from './constants';
import { computeReprojectionRmse, solveHomography, type Homography3x3 } from './homography';
import type { CalibrationPointStatus } from './types';

function median(values: number[]): number {
  if (values.length === 0) {
    return 0.5;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Look-Talk 원본: src/tracking/calibration.py Calibrator.update()(255-420행)의
 * 점별 샘플 수집 로직만 포팅한다. Ridge/head-pose baseline/CSV export/last-good-H
 * fallback은 Integration Plan §0.8, §7.4에 따라 이번 Step 1 범위가 아니다.
 *
 * x/y를 독립적으로 정렬·트림·중앙값 계산하는 것까지 Python과 동일하게 맞춘다
 * (calibration.py:308-345 — 트림된 대표점의 x/y가 서로 다른 원본 샘플에서 올 수 있음).
 */
function trimmedMedianPoint(samples: NormalizedPoint[]): NormalizedPoint {
  if (samples.length > 5) {
    const xs = samples.map((s) => s.x).sort((a, b) => a - b);
    const ys = samples.map((s) => s.y).sort((a, b) => a - b);
    const n = xs.length;
    const lo = Math.floor(n * 0.2);
    const hi = Math.floor(n * 0.8);

    return {
      x: median(xs.slice(lo, hi)),
      y: median(ys.slice(lo, hi)),
    };
  }

  if (samples.length === 0) {
    return { x: 0.5, y: 0.5 };
  }

  return {
    x: median(samples.map((s) => s.x)),
    y: median(samples.map((s) => s.y)),
  };
}

export interface CalibrationSessionSnapshot {
  done: boolean;
  pointIndex: number;
  totalPoints: number;
  currentTarget: NormalizedPoint | null;
  pointStatus: CalibrationPointStatus;
  pointElapsedRatio: number;
  warning: string;
  retryCount: number;
  irisPoints: NormalizedPoint[]; // 완료된 점들의 대표 iris 좌표(디버그/시각화용)
  homography: Homography3x3 | null;
  reprojectionRmseNormalized: number | null;
}

export class CalibrationSession {
  // target 렌더링 도메인 자체가 FULL VIEWPORT로 확정됨(제품 요구사항 변경) — 화면에
  // 그리는 좌표와 Homography 학습 좌표가 이제 동일한 CALIBRATION_GRID_POINTS
  // (NORMALIZED_VIEWPORT)다. 과거에 있었던 local/viewport 이중 좌표 분리는 "작은
  // 장식용 컨테이너 안에 타깃을 그린다"는 잘못된 전제 위에서만 필요했던 것이라 제거했다.
  private readonly targetPoints: NormalizedPoint[];

  private idx = 0;
  private samples: NormalizedPoint[] = [];
  private pointRetryCounts = new Map<number, number>();
  private irisPoints: NormalizedPoint[] = [];
  private holdStartMs: number | null = null;
  private warning = '';
  private done = false;
  private homography: Homography3x3 | null = null;
  private reprojectionRmseNormalized: number | null = null;

  constructor(targetPoints: NormalizedPoint[] = CALIBRATION_GRID_POINTS) {
    this.targetPoints = targetPoints;
  }

  reset(): void {
    this.idx = 0;
    this.samples = [];
    this.pointRetryCounts = new Map();
    this.irisPoints = [];
    this.holdStartMs = null;
    this.warning = '';
    this.done = false;
    this.homography = null;
    this.reprojectionRmseNormalized = null;
  }

  /** 매 프레임(throttle 없이) 호출한다. Look-Talk과 동일하게 confidence 게이트 이후에만 샘플을 쌓는다. */
  update(irisX: number, irisY: number, confidence: number, nowMs: number): void {
    if (this.done) {
      return;
    }

    if (this.holdStartMs === null) {
      this.holdStartMs = nowMs;
    }

    const elapsedSec = (nowMs - this.holdStartMs) / 1000;

    if (elapsedSec >= CALIB_STABILIZE_SEC && confidence > CALIB_MIN_CONFIDENCE) {
      this.samples.push({ x: irisX, y: irisY });
    }

    const totalSec = CALIB_STABILIZE_SEC + CALIB_COLLECT_SEC;

    if (elapsedSec >= totalSec) {
      this.finalizeCurrentPoint();
    }
  }

  private finalizeCurrentPoint(): void {
    const xs = this.samples.map((s) => s.x);
    const ys = this.samples.map((s) => s.y);
    const stdX = standardDeviation(xs);
    const stdY = standardDeviation(ys);
    const isUnstable = stdX > CALIB_STD_X || stdY > CALIB_STD_Y;
    const retryCount = this.pointRetryCounts.get(this.idx) ?? 0;

    if (isUnstable && retryCount < 1) {
      this.pointRetryCounts.set(this.idx, retryCount + 1);
      this.warning = '시선이 불안정합니다. 한 번 더 측정합니다.';
      this.samples = [];
      this.holdStartMs = null;
      return;
    }

    this.warning = isUnstable ? '시선이 다소 불안정하지만 현재 측정값을 사용합니다.' : '';

    const representative = trimmedMedianPoint(this.samples);
    this.irisPoints.push(representative);

    this.idx += 1;
    this.samples = [];
    this.holdStartMs = null;

    if (this.idx >= this.targetPoints.length) {
      this.homography = solveHomography(this.irisPoints, this.targetPoints);

      if (this.homography) {
        this.reprojectionRmseNormalized = computeReprojectionRmse(this.homography, this.irisPoints, this.targetPoints);
      }

      this.done = true;
    }
  }

  getSnapshot(nowMs: number): CalibrationSessionSnapshot {
    const totalSec = CALIB_STABILIZE_SEC + CALIB_COLLECT_SEC;
    const elapsedSec = this.holdStartMs === null ? 0 : (nowMs - this.holdStartMs) / 1000;
    const pointElapsedRatio = this.done ? 1 : Math.min(1, elapsedSec / totalSec);
    const pointStatus: CalibrationPointStatus = elapsedSec >= CALIB_STABILIZE_SEC ? 'collecting' : 'stabilizing';

    return {
      done: this.done,
      pointIndex: this.idx,
      totalPoints: this.targetPoints.length,
      // NORMALIZED_VIEWPORT 좌표 그 자체 — 렌더링과 Homography 학습이 동일한 값을 쓴다.
      currentTarget: this.done ? null : (this.targetPoints[this.idx] ?? null),
      pointStatus,
      pointElapsedRatio,
      warning: this.warning,
      retryCount: this.pointRetryCounts.get(this.idx) ?? 0,
      irisPoints: this.irisPoints,
      homography: this.homography,
      reprojectionRmseNormalized: this.reprojectionRmseNormalized,
    };
  }
}
