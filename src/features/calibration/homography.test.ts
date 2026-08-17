import { describe, expect, it } from 'vitest';
import { applyHomography, computeReprojectionRmse, solveHomography } from './homography';
import { buildCalibrationGrid } from './constants';

describe('solveHomography', () => {
  it('퇴화 입력(4점 미만)에는 null을 반환한다', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(solveHomography(points, points)).toBeNull();
  });

  it('실제 4x4 캘리브레이션 그리드 + 좁은 iris 클러스터에서도 사분면 매핑이 성립한다 (Front Step 1 Accuracy Audit 회귀 테스트)', () => {
    const targets = buildCalibrationGrid();
    // Look-Talk 자체 추정 안구 이동 범위(±0.01~0.03)에 맞춘 좁은 클러스터.
    const span = 0.03;
    const trueGain = span * 0.8;
    const iris = targets.map((t) => ({
      x: 0.5 + (t.x - 0.5) * trueGain,
      y: 0.5 + (t.y - 0.5) * trueGain,
    }));

    const H = solveHomography(iris, targets);
    expect(H).not.toBeNull();
    if (!H) return;

    const rmse = computeReprojectionRmse(H, iris, targets);
    expect(rmse).toBeLessThan(0.05);

    const topLeft = applyHomography(H, iris[0].x, iris[0].y);
    const topRight = applyHomography(H, iris[3].x, iris[3].y);
    const bottomLeft = applyHomography(H, iris[12].x, iris[12].y);
    const bottomRight = applyHomography(H, iris[15].x, iris[15].y);
    const center = applyHomography(H, 0.5, 0.5);

    expect(topLeft.x).toBeLessThan(0.5);
    expect(topLeft.y).toBeLessThan(0.5);
    expect(topRight.x).toBeGreaterThan(0.5);
    expect(topRight.y).toBeLessThan(0.5);
    expect(bottomLeft.x).toBeLessThan(0.5);
    expect(bottomLeft.y).toBeGreaterThan(0.5);
    expect(bottomRight.x).toBeGreaterThan(0.5);
    expect(bottomRight.y).toBeGreaterThan(0.5);
    expect(center.x).toBeCloseTo(0.5, 1);
    expect(center.y).toBeCloseTo(0.5, 1);
  });

  it('순수 아핀 변환은 거의 정확히 복원한다', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0.5, y: 0.5 },
    ];
    const dst = src.map((p) => ({ x: 2 * p.x + 0.1, y: 1.5 * p.y - 0.05 }));

    const H = solveHomography(src, dst);
    expect(H).not.toBeNull();
    if (!H) return;

    src.forEach((p, i) => {
      const projected = applyHomography(H, p.x, p.y);
      expect(projected.x).toBeCloseTo(dst[i].x, 6);
      expect(projected.y).toBeCloseTo(dst[i].y, 6);
    });
  });
});
