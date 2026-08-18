/**
 * Look-Talk 원본: src/tracking/gaze_pipeline.py GazePipeline.__init__()의
 * cv2.KalmanFilter(4,2) 설정을 그대로 포팅한다.
 *
 * state = [x, y, vx, vy] (4x1), measurement = [x, y] (2x1)
 * transitionMatrix(F) = [[1,0,1,0],[0,1,0,1],[0,0,1,0],[0,0,0,1]] (등속 모델)
 * measurementMatrix(H) = [[1,0,0,0],[0,1,0,0]]
 * processNoiseCov(Q) = I(4) * 0.003
 * measurementNoiseCov(R) = I(2) * 0.3
 *
 * OpenCV의 cv2.KalmanFilter는 생성 시 errorCovPost를 0 행렬로 초기화하고, Python
 * gaze_pipeline.py의 reset()/_reset_tracking_state() 어디도 errorCovPost를 다시
 * 건드리지 않는다(전체 파일 확인 완료) — 오직 statePost(평균 상태)만 재설정한다.
 * 이 클래스도 동일하게 P(오차 공분산)는 생성 시 1회만 0으로 두고, resetState()는
 * state만 바꾼다.
 */

const F: number[][] = [
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

const H: number[][] = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
];

const PROCESS_NOISE = 0.003;
const MEASUREMENT_NOISE = 0.3;

function zeros(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
}

function identity(n: number): number[][] {
  const m = zeros(n, n);
  for (let i = 0; i < n; i += 1) m[i][i] = 1;
  return m;
}

function matMul(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const inner = b.length;
  const cols = b[0].length;
  const result = zeros(rows, cols);

  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;
      for (let k = 0; k < inner; k += 1) sum += a[i][k] * b[k][j];
      result[i][j] = sum;
    }
  }

  return result;
}

function transpose(a: number[][]): number[][] {
  const rows = a.length;
  const cols = a[0].length;
  const result = zeros(cols, rows);

  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      result[j][i] = a[i][j];
    }
  }

  return result;
}

function matAdd(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((value, j) => value + b[i][j]));
}

function matSub(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((value, j) => value - b[i][j]));
}

function scaleMat(a: number[][], scalar: number): number[][] {
  return a.map((row) => row.map((value) => value * scalar));
}

function invert2x2(m: number[][]): number[][] {
  const [[a, b], [c, d]] = m;
  const det = a * d - b * c;
  const invDet = Math.abs(det) < 1e-12 ? 0 : 1 / det;

  return [
    [d * invDet, -b * invDet],
    [-c * invDet, a * invDet],
  ];
}

function matVecMul(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((sum, value, k) => sum + value * v[k], 0));
}

export class KalmanFilter2D {
  private state: number[] = [0, 0, 0, 0];
  private errorCov: number[][] = zeros(4, 4);

  /** Python의 kalman.statePost 직접 대입에 대응한다. errorCov(P)는 건드리지 않는다. */
  resetState(x: number, y: number): void {
    this.state = [x, y, 0, 0];
  }

  predict(): void {
    this.state = matVecMul(F, this.state);
    const fp = matMul(F, this.errorCov);
    const fpft = matMul(fp, transpose(F));
    this.errorCov = matAdd(fpft, scaleMat(identity(4), PROCESS_NOISE));
  }

  correct(measuredX: number, measuredY: number): { x: number; y: number } {
    const measurement = [measuredX, measuredY];
    const predictedMeasurement = matVecMul(H, this.state);
    const innovation = [measurement[0] - predictedMeasurement[0], measurement[1] - predictedMeasurement[1]];

    const pht = matMul(this.errorCov, transpose(H)); // 4x2
    const hpht = matMul(H, pht); // 2x2
    const innovationCov = matAdd(hpht, scaleMat(identity(2), MEASUREMENT_NOISE));
    const gain = matMul(pht, invert2x2(innovationCov)); // 4x2

    const correction = matVecMul(gain, innovation);
    this.state = this.state.map((value, i) => value + correction[i]);

    const gainH = matMul(gain, H); // 4x4
    this.errorCov = matMul(matSub(identity(4), gainH), this.errorCov);

    return { x: this.state[0], y: this.state[1] };
  }
}
