import { describe, expect, it } from 'vitest';
import { GazeFilter } from './GazeFilter';

describe('GazeFilter (Look-Talk GazePipeline 포팅)', () => {
  it('blink=true면 추적 실패(-1,-1,0)를 반환한다', () => {
    const filter = new GazeFilter();
    const result = filter.update(100, 100, 0.9, true);
    expect(result).toEqual({ x: -1, y: -1, fixationCount: 0 });
  });

  it('conf<=0.3이면 추적 실패를 반환한다(0.3 경계값 포함)', () => {
    const filter = new GazeFilter();
    expect(filter.update(100, 100, 0.3, false).x).toBe(-1);
    expect(filter.update(100, 100, 0.30001, false).x).not.toBe(-1);
  });

  it('sx/sy가 null이면 추적 실패를 반환한다', () => {
    const filter = new GazeFilter();
    const result = filter.update(null, null, 0.9, false);
    expect(result.x).toBe(-1);
  });

  it('리셋 직후 첫 유효 프레임은 원시 입력을 거의 그대로 반환한다(버퍼 1개+Kalman P=0 초기 상태)', () => {
    const filter = new GazeFilter();
    const result = filter.update(200, 300, 0.9, false);
    expect(result.x).toBeCloseTo(200, 0);
    expect(result.y).toBeCloseTo(300, 0);
    expect(result.fixationCount).toBe(1);
  });

  it('연속 프레임에서 프레임당 이동량이 max_step_px(50)를 넘지 않는다', () => {
    const filter = new GazeFilter();
    let prev = filter.update(100, 100, 0.9, false);

    // 정착 후 먼 지점으로 점프 — dead zone을 넘는 큰 움직임이어야 max_step 클램프가 걸린다.
    for (let i = 0; i < 3; i += 1) {
      prev = filter.update(100, 100, 0.9, false);
    }

    for (let i = 0; i < 10; i += 1) {
      const next = filter.update(800, 100, 0.9, false);
      const movement = Math.hypot(next.x - prev.x, next.y - prev.y);
      expect(movement).toBeLessThanOrEqual(50 + 1e-6);
      prev = next;
    }
  });

  it('아주 작은 흔들림(<dead zone)은 이전 출력 그대로 유지한다', () => {
    const filter = new GazeFilter();
    // 동일 좌표로 여러 프레임 넣어 안정화.
    let stable = filter.update(400, 400, 0.9, false);
    for (let i = 0; i < 5; i += 1) {
      stable = filter.update(400, 400, 0.9, false);
    }

    // 1px 수준의 미세한 흔들림 — dead zone(최소 10px) 이내이므로 출력이 바뀌지 않아야 한다.
    const jittered = filter.update(401, 400, 0.9, false);
    expect(jittered.x).toBe(stable.x);
    expect(jittered.y).toBe(stable.y);
  });

  it('같은 지점을 충분히 오래 응시하면 fixationCount가 FIXATION_FRAMES(6) 이상이 된다', () => {
    const filter = new GazeFilter();
    let result = filter.update(500, 500, 0.9, false);

    for (let i = 0; i < 10; i += 1) {
      result = filter.update(500, 500, 0.9, false);
    }

    expect(result.fixationCount).toBeGreaterThanOrEqual(6);
  });

  it('blink 이후 재추적 시 fixation은 리셋된다', () => {
    const filter = new GazeFilter();
    for (let i = 0; i < 8; i += 1) {
      filter.update(500, 500, 0.9, false);
    }

    filter.update(500, 500, 0.9, true); // blink

    const afterBlink = filter.update(500, 500, 0.9, false);
    // 깜빡임 뒤의 고정은 새로 판정하므로 fixationCount가 다시 1부터 시작해야 한다.
    expect(afterBlink.fixationCount).toBe(1);
  });

  it('blink로 끊긴 구간은 이전 출력을 유지해 재개 첫 프레임도 max_step_px로 클램프된다', () => {
    const filter = new GazeFilter();
    let stable = filter.update(400, 400, 0.9, false);
    for (let i = 0; i < 5; i += 1) {
      stable = filter.update(400, 400, 0.9, false);
    }

    for (let i = 0; i < 5; i += 1) {
      expect(filter.update(400, 400, 0.9, true).x).toBe(-1);
    }

    // 눈을 뜬 첫 프레임의 홍채가 아래로 크게 치우쳐 들어와도 한 프레임 이동은 50px 이내다.
    const resumed = filter.update(400, 900, 0.9, false);
    const movement = Math.hypot(resumed.x - stable.x, resumed.y - stable.y);
    expect(movement).toBeLessThanOrEqual(50 + 1);
  });

  it('저신뢰도(눈꺼풀 전이 구간)로 끊긴 구간도 이전 출력을 유지한다', () => {
    const filter = new GazeFilter();
    let stable = filter.update(400, 400, 0.9, false);
    for (let i = 0; i < 5; i += 1) {
      stable = filter.update(400, 400, 0.9, false);
    }

    expect(filter.update(400, 700, 0.2, false).x).toBe(-1);

    const resumed = filter.update(400, 900, 0.9, false);
    const movement = Math.hypot(resumed.x - stable.x, resumed.y - stable.y);
    expect(movement).toBeLessThanOrEqual(50 + 1);
  });

  it('얼굴 미검출(sx=null)은 이전 출력까지 버려 다음 유효 프레임이 원시 좌표로 시작한다', () => {
    const filter = new GazeFilter();
    for (let i = 0; i < 6; i += 1) {
      filter.update(400, 400, 0.9, false);
    }

    expect(filter.update(null, null, 0.9, false).x).toBe(-1);

    // 이어 붙일 기준점이 없으므로 클램프 없이 새 좌표에서 다시 시작한다.
    const resumed = filter.update(400, 900, 0.9, false);
    expect(resumed.y).toBeCloseTo(900, 0);
  });
});
