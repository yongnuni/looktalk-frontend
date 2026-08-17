import type { NormalizedPoint } from './constants';

export type Homography3x3 = [[number, number, number], [number, number, number], [number, number, number]];

/**
 * Integration Plan §7.6: OpenCV 없이 16개 대응점으로 8-parameter projective transform을
 * least-squares로 직접 푼다. Python `cv2.findHomography(src, dst)`(method 미지정 = 전체 점
 * 최소자승, Look-Talk calibration.py:533-536)와 동일한 문제를 순수 TypeScript로 계산한다.
 *
 * === Front Step 1 Accuracy Audit에서 발견/수정된 부분 ===
 * 이전 구현은 대응점을 정규화(Hartley normalization)하지 않고 원시 좌표로 정규방정식
 * (AtA h = Atb)을 바로 풀었다. 실제 iris 좌표는 아주 좁은 범위(Look-Talk CLAUDE.md 자체
 * 추정치로 ±0.01~0.03 정도)에 몰려 있는데, 이 상태로 넓은 범위(0.08~0.92)의 target과
 * 함께 정규방정식을 풀면 AtA가 심하게 병적(ill-conditioned)이 된다 — 이 리포지토리
 * 안에서 직접 재현: iris span을 0.06→0.03→0.015→0.008로 좁혀가며 합성 데이터로 측정한
 * 결과, 미정규화 버전의 재투영 RMSE가 0.0097 → 0.097 → 7.19 → 0.79(정규화 단위, 즉
 * 화면 폭의 몇 배에 해당하는 완전히 깨진 값)까지 폭주했다. 같은 데이터에 Hartley
 * normalization(점 집합을 원점 중심·평균거리 sqrt(2)로 이동/스케일 후 풀고 역변환)을
 * 적용한 버전은 전 구간에서 0.03 이하로 안정적이었다. OpenCV의 `cv2.findHomography`는
 * 표준 DLT 관행대로 내부적으로 이 정규화를 수행하는 것으로 알려져 있으나(Hartley 1997),
 * 이 저장소에는 OpenCV C++ 소스가 없어 직접 열람은 못 했다 — 위 재현 실험 결과 자체가
 * "정규화가 왜 필요한지"의 직접적 근거다.
 */
export function solveHomography(srcPoints: NormalizedPoint[], dstPoints: NormalizedPoint[]): Homography3x3 | null {
  if (srcPoints.length !== dstPoints.length || srcPoints.length < 4) {
    return null;
  }

  const { normalized: srcNormalized, transform: srcTransform } = normalizePointSet(srcPoints);
  const { normalized: dstNormalized, transform: dstTransform } = normalizePointSet(dstPoints);

  const normalizedHomography = solveHomographyUnnormalized(srcNormalized, dstNormalized);

  if (!normalizedHomography) {
    return null;
  }

  // H = Tdst^-1 * Hn * Tsrc — 정규화된 좌표계에서 푼 결과를 원래 좌표계로 되돌린다.
  const dstTransformInverse = invert3x3(dstTransform);

  if (!dstTransformInverse) {
    return null;
  }

  return multiply3x3(multiply3x3(dstTransformInverse, normalizedHomography), srcTransform);
}

export function applyHomography(homography: Homography3x3, x: number, y: number): NormalizedPoint {
  const denom = homography[2][0] * x + homography[2][1] * y + homography[2][2];

  return {
    x: (homography[0][0] * x + homography[0][1] * y + homography[0][2]) / denom,
    y: (homography[1][0] * x + homography[1][1] * y + homography[1][2]) / denom,
  };
}

/** Look-Talk의 calib_reproj_rmse_px(calibration.py:582-588)와 동일한 정의를 정규화 단위로 계산한다. */
export function computeReprojectionRmse(
  homography: Homography3x3,
  srcPoints: NormalizedPoint[],
  dstPoints: NormalizedPoint[],
): number {
  const squaredErrors = srcPoints.map((src, index) => {
    const projected = applyHomography(homography, src.x, src.y);
    const target = dstPoints[index];
    const dx = projected.x - target.x;
    const dy = projected.y - target.y;
    return dx * dx + dy * dy;
  });

  const meanSquaredError = squaredErrors.reduce((sum, value) => sum + value, 0) / squaredErrors.length;

  return Math.sqrt(meanSquaredError);
}

export interface HomographyPointDiagnostic {
  index: number;
  source: NormalizedPoint;
  target: NormalizedPoint;
  predicted: NormalizedPoint;
  errorNormalized: number;
}

/**
 * Front Step 1 Accuracy Audit 항목 6: RMSE 하나로 뭉뚱그리지 않고 16점 각각의
 * 실제 iris/target/predicted/오차를 개발 진단용으로 노출한다. production threshold는
 * 아직 정하지 않는다 — 값을 보여주기만 한다.
 */
export function diagnoseHomography(
  homography: Homography3x3,
  srcPoints: NormalizedPoint[],
  dstPoints: NormalizedPoint[],
): HomographyPointDiagnostic[] {
  return srcPoints.map((source, index) => {
    const target = dstPoints[index];
    const predicted = applyHomography(homography, source.x, source.y);

    return {
      index,
      source,
      target,
      predicted,
      errorNormalized: Math.hypot(predicted.x - target.x, predicted.y - target.y),
    };
  });
}

// ── Hartley 정규화 ──────────────────────────────────────────────────────

function normalizePointSet(points: NormalizedPoint[]): { normalized: NormalizedPoint[]; transform: Homography3x3 } {
  const n = points.length;
  const centerX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const centerY = points.reduce((sum, p) => sum + p.y, 0) / n;

  const meanDistance = points.reduce((sum, p) => sum + Math.hypot(p.x - centerX, p.y - centerY), 0) / n;
  const scale = meanDistance > 1e-12 ? Math.SQRT2 / meanDistance : 1;

  const normalized = points.map((p) => ({
    x: (p.x - centerX) * scale,
    y: (p.y - centerY) * scale,
  }));

  const transform: Homography3x3 = [
    [scale, 0, -scale * centerX],
    [0, scale, -scale * centerY],
    [0, 0, 1],
  ];

  return { normalized, transform };
}

function multiply3x3(a: Homography3x3, b: Homography3x3): Homography3x3 {
  const result: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      for (let k = 0; k < 3; k += 1) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }

  return result as Homography3x3;
}

function invert3x3(m: Homography3x3): Homography3x3 | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (Math.abs(det) < 1e-12) {
    return null;
  }

  const invDet = 1 / det;

  return [
    [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ];
}

// ── 정규화된 좌표계에서 8-parameter DLT를 정규방정식으로 푼다 ──────────────

function solveHomographyUnnormalized(
  srcPoints: NormalizedPoint[],
  dstPoints: NormalizedPoint[],
): Homography3x3 | null {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < srcPoints.length; i += 1) {
    const { x, y } = srcPoints[i];
    const { x: targetX, y: targetY } = dstPoints[i];

    A.push([x, y, 1, 0, 0, 0, -x * targetX, -y * targetX]);
    b.push(targetX);

    A.push([0, 0, 0, x, y, 1, -x * targetY, -y * targetY]);
    b.push(targetY);
  }

  const h = solveLeastSquares(A, b);

  if (!h) {
    return null;
  }

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ];
}

function solveLeastSquares(A: number[][], b: number[]): number[] | null {
  const numUnknowns = A[0].length;

  const AtA: number[][] = Array.from({ length: numUnknowns }, () => new Array<number>(numUnknowns).fill(0));
  const Atb: number[] = new Array<number>(numUnknowns).fill(0);

  for (let row = 0; row < A.length; row += 1) {
    for (let i = 0; i < numUnknowns; i += 1) {
      Atb[i] += A[row][i] * b[row];

      for (let j = 0; j < numUnknowns; j += 1) {
        AtA[i][j] += A[row][i] * A[row][j];
      }
    }
  }

  return solveLinearSystem(AtA, Atb);
}

/** 부분 피벗 가우스 소거법. 대응점이 퇴화(공선 등)되어 특이행렬이면 null을 반환한다. */
function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const M = matrix.map((row) => [...row]);
  const v = [...vector];

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);

    for (let row = col + 1; row < n; row += 1) {
      const abs = Math.abs(M[row][col]);

      if (abs > maxAbs) {
        maxAbs = abs;
        pivotRow = row;
      }
    }

    if (maxAbs < 1e-10) {
      return null;
    }

    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
      [v[col], v[pivotRow]] = [v[pivotRow], v[col]];
    }

    for (let row = col + 1; row < n; row += 1) {
      const factor = M[row][col] / M[col][col];

      for (let k = col; k < n; k += 1) {
        M[row][k] -= factor * M[col][k];
      }

      v[row] -= factor * v[col];
    }
  }

  const solution = new Array<number>(n).fill(0);

  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = v[row];

    for (let k = row + 1; k < n; k += 1) {
      sum -= M[row][k] * solution[k];
    }

    solution[row] = sum / M[row][row];
  }

  return solution;
}
