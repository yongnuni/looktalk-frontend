import { describe, expect, it } from 'vitest';
import { buildSelectionTargets } from '../scopeSelectionTargets';
import type { GazeTargetEntry } from '../types';
import { FixationDetector } from './FixationDetector';
import { FixationHitbox } from './FixationHitbox';
import { expandedBounds, type Bounds, type FixationTarget } from './fixationGeometry';
import { KeyboardFixationLayer } from './KeyboardFixationLayer';

/**
 * Look-Talk 원본: tests/test_fixation_hitbox.py를 그대로 옮긴 검증.
 *
 * 핵심 불변식 세 가지를 고정한다.
 * 1. 고정이 성립하지 않으면 기존 판정(hitTestTargets)과 결과가 완전히 같다.
 * 2. 확장은 인접 키를 최대 1/3까지만 덮고, 겹치는 구간에서는 확장된 쪽이 이긴다.
 * 3. 확장은 판정 영역에만 존재한다 — 키캡의 위치·크기는 정적으로 유지된다.
 */

// 1도 = 40px 인 가상의 화면. 임계값이 px로 딱 떨어져 검증이 명확해진다.
const PX_PER_DEG = 40;

const RELEASE_PX = PX_PER_DEG * 1.5; // 고정 해제 반경
const MIN_DURATION_MS = 150;

// 키 반폭(90px)이 고정 해제 반경(60px)보다 크고, 좌우 여백(15px)이 키 폭의 1/6보다
// 작은 배치 — 원본 키보드 레이아웃과 같은 비율 관계라 1/3 침범 한도가 실제로 걸린다.
const KEY_SIZE = 180;
const KEY_GAP = 15;
const ORIGIN = 100;

interface TestKey extends FixationTarget {
  rect: Bounds;
}

function buildKeys(keySize = KEY_SIZE, gap = KEY_GAP, cols = 10, rows = 4): TestKey[] {
  const pitch = keySize + gap;
  const keys: TestKey[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const left = ORIGIN + col * pitch;
      const top = ORIGIN + row * pitch;

      keys.push({
        id: `key-${row}-${col}`,
        rect: { left, top, right: left + keySize, bottom: top + keySize },
      });
    }
  }

  return keys;
}

function centerOf(key: TestKey): { x: number; y: number } {
  return {
    x: (key.rect.left + key.rect.right) / 2,
    y: (key.rect.top + key.rect.bottom) / 2,
  };
}

/** 같은 행에서 좌우로 맞닿은 두 키와 그 사이 여백 좌표. */
function adjacentPair(keys: TestKey[]) {
  const left = keys[0];
  const right = keys[1];

  return {
    left,
    right,
    gapPoint: { x: (left.rect.right + right.rect.left) / 2, y: centerOf(left).y },
  };
}

function detector() {
  return new FixationDetector({
    pxPerDeg: PX_PER_DEG,
    velocityDegPerSec: 30, // = 1200 px/s
    dispersionDeg: 1.0,
    releaseDeg: 1.5,
    minDurationMs: MIN_DURATION_MS,
    maxGapMs: 300,
  });
}

function hitbox(options: { expandRatio?: number; enabled?: boolean; visualEnabled?: boolean; personalRadiusPx?: number } = {}) {
  return new FixationHitbox<TestKey>({
    enabled: options.enabled ?? true,
    detector: detector(),
    expandRatio: options.expandRatio ?? 0.5,
    visualEnabled: options.visualEnabled,
    personalRadiusPx: options.personalRadiusPx ?? null,
  });
}

/** 한 점을 계속 응시시켜 고정을 성립시킨다. */
function hold(
  box: FixationHitbox<TestKey>,
  keys: TestKey[],
  point: { x: number; y: number },
  start = 0,
  durationMs = 400,
  stepMs = 50,
): number {
  let now = start;
  const end = start + durationMs;

  while (now <= end + 1e-9) {
    box.update(point.x, point.y, keys, true, now);
    now += stepMs;
  }

  return now;
}

// =========================================================
// FixationDetector — I-VT / I-DT
// =========================================================

describe('FixationDetector', () => {
  it('한 점을 최소 지속 시간 이상 보면 고정이 성립한다', () => {
    const det = detector();

    expect(det.update(500, 500, true, 0).active).toBe(false);

    // 최소 지속 시간 직전까지는 아직 고정이 아니다.
    expect(det.update(500, 500, true, MIN_DURATION_MS - 10).active).toBe(false);
    expect(det.update(500, 500, true, MIN_DURATION_MS).active).toBe(true);
  });

  it('도약(saccade) 속도가 나오면 고정이 끊긴다', () => {
    const det = detector();

    for (let now = 0; now <= 400; now += 50) {
      det.update(500, 500, true, now);
    }

    expect(det.state.active).toBe(true);

    // 50ms 동안 200px 이동 = 4000px/s = 100deg/s > 30deg/s
    const state = det.update(700, 500, true, 450);

    expect(state.active).toBe(false);
  });

  it('해제 반경을 넘는 느린 표류는 고정으로 보지 않는다', () => {
    const det = detector();

    for (let now = 0; now <= 400; now += 50) {
      det.update(500, 500, true, now);
    }

    expect(det.state.active).toBe(true);

    // 프레임당 20px(=400px/s=10deg/s)로 천천히 밀려 해제 반경(60px) 밖으로 나간다.
    let now = 450;
    let x = 500;

    while (x < 500 + RELEASE_PX + 40) {
      x += 20;
      det.update(x, 500, true, now);
      now += 50;
    }

    expect(det.state.active).toBe(false);
  });

  it('분산 반경 안의 미세 흔들림은 고정을 유지한다', () => {
    const det = detector();
    const jitter = [0, 3, -4, 2, -3, 5, -2, 4, -5, 1, 3];

    let now = 0;

    for (const offset of jitter) {
      det.update(500 + offset, 500 - offset, true, now);
      now += 50;
    }

    expect(det.state.active).toBe(true);
  });

  it('프레임 간격이 끊기면 느린 이동으로 위장하지 않고 새로 시작한다', () => {
    const det = detector();

    for (let now = 0; now <= 400; now += 50) {
      det.update(500, 500, true, now);
    }

    expect(det.state.active).toBe(true);

    // maxGapMs(300ms)를 넘긴 뒤 멀리 떨어진 좌표 → 이어 붙이지 않고 리셋된다.
    const state = det.update(1200, 900, true, 400 + 500);

    expect(state.active).toBe(false);
    expect(state.velocityDegPerSec).toBeNull();
  });

  it('추적이 무효한 프레임은 고정을 지운다', () => {
    const det = detector();

    for (let now = 0; now <= 400; now += 50) {
      det.update(500, 500, true, now);
    }

    expect(det.state.active).toBe(true);

    expect(det.update(500, 500, false, 450).active).toBe(false);
    expect(det.update(-1, -1, true, 500).active).toBe(false);
  });
});

// =========================================================
// 확장 판정 지오메트리
// =========================================================

describe('FixationHitbox — 확장 판정', () => {
  it('고정이 서기 전의 키 사이 여백은 여전히 아무 키도 아니다', () => {
    const keys = buildKeys();
    const { gapPoint } = adjacentPair(keys);
    const box = hitbox();

    // 탐색(도약) 중에는 확장이 걸리지 않는다 → 기존 판정과 동일
    box.update(gapPoint.x, gapPoint.y, keys, true, 0);

    expect(box.hitTest(keys, gapPoint.x, gapPoint.y)).toBeNull();
  });

  it('고정된 키가 옆 여백을 흡수한다', () => {
    const keys = buildKeys();
    const { left, gapPoint } = adjacentPair(keys);
    const box = hitbox();

    hold(box, keys, centerOf(left));

    expect(box.active).toBe(true);
    expect(box.anchorTarget).toBe(left);
    expect(box.hitTest(keys, gapPoint.x, gapPoint.y)).toBe(left);
  });

  it('겹치는 구간은 확장된 키가 가져가되 인접 키의 1/3에서 멈춘다', () => {
    const keys = buildKeys();
    const { left, right } = adjacentPair(keys);
    const box = hitbox();

    hold(box, keys, centerOf(left));
    expect(box.anchorTarget).toBe(left);

    const third = (right.rect.right - right.rect.left) / 3;
    const y = centerOf(right).y;

    expect(box.hitTest(keys, right.rect.left, y)).toBe(left);
    expect(box.hitTest(keys, right.rect.left + third - 2, y)).toBe(left);

    expect(box.hitTest(keys, right.rect.left + third + 2, y)).toBe(right);
    expect(box.hitTest(keys, centerOf(right).x, centerOf(right).y)).toBe(right);
  });

  it('어떤 키도 자기 면적의 1/3 넘게 다른 키의 확장에 먹히지 않는다', () => {
    const keys = buildKeys();

    for (const key of keys) {
      const bounds = expandedBounds(key, keys, 0.5);

      for (const other of keys) {
        if (other === key) continue;

        const overlapW = Math.min(bounds.right, other.rect.right) - Math.max(bounds.left, other.rect.left);
        const overlapH = Math.min(bounds.bottom, other.rect.bottom) - Math.max(bounds.top, other.rect.top);

        if (overlapW <= 0 || overlapH <= 0) continue;

        const otherArea = (other.rect.right - other.rect.left) * (other.rect.bottom - other.rect.top);

        expect(overlapW * overlapH).toBeLessThanOrEqual(otherArea / 3 + 1);
      }
    }
  });

  it('겹침 구간이라도 그쪽에 새 고정이 서면 확장이 넘어간다(고착 방지)', () => {
    const keys = buildKeys();
    const { left, right } = adjacentPair(keys);
    const box = hitbox();

    const now = hold(box, keys, centerOf(left));
    expect(box.anchorTarget).toBe(left);

    const overlapPoint = {
      x: right.rect.left + (right.rect.right - right.rect.left) / 6,
      y: centerOf(right).y,
    };

    // 옮겨간 직후에는 아직 이전 확장이 이긴다.
    box.update(overlapPoint.x, overlapPoint.y, keys, true, now + 50);
    expect(box.hitTest(keys, overlapPoint.x, overlapPoint.y)).toBe(left);

    // 그 자리에 고정이 성립하면 확장이 그 키로 넘어간다.
    hold(box, keys, overlapPoint, now + 100);

    expect(box.anchorTarget).toBe(right);
    expect(box.hitTest(keys, overlapPoint.x, overlapPoint.y)).toBe(right);
  });

  it('고정 중심이 여백에 떨어지면 가장 가까운 키에 앵커가 붙는다', () => {
    const keys = buildKeys();
    const { left, gapPoint } = adjacentPair(keys);
    const box = hitbox();

    hold(box, keys, { x: left.rect.right + 1, y: centerOf(left).y });

    expect(box.active).toBe(true);
    expect(box.anchorTarget).toBe(left);
    expect(box.hitTest(keys, gapPoint.x, gapPoint.y)).toBe(left);
  });

  it('시선이 키 가장자리로 흘러도 확장이 풀리지 않는다', () => {
    const keys = buildKeys();
    const { left, gapPoint } = adjacentPair(keys);
    const box = hitbox();

    const now = hold(box, keys, centerOf(left));

    // 반폭 > 고정 해제 반경 — 각도 기준만으로 판단하면 여기서 풀려 버린다.
    expect((left.rect.right - left.rect.left) / 2).toBeGreaterThan(RELEASE_PX);

    box.update(gapPoint.x, gapPoint.y, keys, true, now);

    expect(box.anchorTarget).toBe(left);
    expect(box.hitTest(keys, gapPoint.x, gapPoint.y)).toBe(left);
  });

  it('다른 키의 실제 사각형을 보기 시작하면 확장이 즉시 내려가고 그쪽으로 옮겨 간다', () => {
    const keys = buildKeys();
    const { left, right, gapPoint } = adjacentPair(keys);
    const box = hitbox();

    const now = hold(box, keys, centerOf(left));
    expect(box.anchorTarget).toBe(left);

    box.update(centerOf(right).x, centerOf(right).y, keys, true, now);
    expect(box.anchorTarget).toBeNull();

    hold(box, keys, centerOf(right), now + 50);

    expect(box.anchorTarget).toBe(right);
    expect(box.hitTest(keys, gapPoint.x, gapPoint.y)).toBe(right);
  });

  it('개인별 오차 반경을 최소 확장량으로 쓸 수 있다', () => {
    const keys = buildKeys();
    const topLeft = keys[0]; // 첫 행 왼쪽 끝 — 위쪽은 빈 공간

    const box = new FixationHitbox<TestKey>({
      detector: detector(),
      expandRatio: 0, // 키 크기 기반 확장을 끈 상태
      personalRadiusPx: 30,
    });

    hold(box, keys, centerOf(topLeft));
    expect(box.anchorTarget).toBe(topLeft);

    const centerX = centerOf(topLeft).x;

    expect(box.hitTest(keys, centerX, topLeft.rect.top - 20)).toBe(topLeft);
    expect(box.hitTest(keys, centerX, topLeft.rect.top - 45)).toBeNull();
  });

  it('확장 영역에서 한참 벗어난 좌표는 아무 키도 선택하지 않는다', () => {
    const keys = buildKeys();
    const { left } = adjacentPair(keys);
    const box = hitbox();

    hold(box, keys, centerOf(left));

    const farY = left.rect.top - (left.rect.bottom - left.rect.top) * 2;

    expect(box.hitTest(keys, centerOf(left).x, farY)).toBeNull();
  });

  it('확장량은 고정 px가 아니라 키 크기에서 나온다', () => {
    const margin = (keys: TestKey[]) => {
      const box = hitbox();
      const key = keys[0];
      hold(box, keys, centerOf(key));
      const rect = box.anchorDebugRect() as Bounds;
      return key.rect.left - rect.left;
    };

    const smallKeys = buildKeys(90, 8);
    const largeKeys = buildKeys(180, 15);

    expect(margin(smallKeys)).toBeCloseTo(90 * 0.5, 5);
    expect(margin(largeKeys)).toBeCloseTo(180 * 0.5, 5);
    expect(margin(largeKeys)).toBeGreaterThan(margin(smallKeys));
  });

  it('Shift/한영 전환으로 target 목록이 새로 만들어져도 확장이 유지된다', () => {
    const keys = buildKeys();
    const { left, gapPoint } = adjacentPair(keys);
    const box = hitbox();

    const now = hold(box, keys, centerOf(left));
    expect(box.active).toBe(true);

    const rebuilt = buildKeys();
    expect(rebuilt.every((key, index) => key !== keys[index])).toBe(true);

    box.update(centerOf(left).x, centerOf(left).y, rebuilt, true, now);

    expect(rebuilt).toContain(box.anchorTarget);
    expect(box.hitTest(rebuilt, gapPoint.x, gapPoint.y)).toBe(rebuilt[0]);
  });

  it('꺼 두면 확장이 없던 때와 판정이 완전히 같다', () => {
    const keys = buildKeys();
    const { left, gapPoint } = adjacentPair(keys);
    const box = hitbox({ enabled: false });

    hold(box, keys, centerOf(left));

    expect(box.active).toBe(false);
    expect(box.hitTest(keys, gapPoint.x, gapPoint.y)).toBeNull();
    expect(box.hitTest(keys, centerOf(left).x, centerOf(left).y)).toBe(left);
  });
});

// =========================================================
// 시각 확대 — 표시 전용
// =========================================================

describe('FixationHitbox — 시각 확대', () => {
  it('확대는 실제 키캡 크기에서 시작해 짧은 ease-out으로 커진다', () => {
    const keys = buildKeys();
    const { left } = adjacentPair(keys);
    const box = hitbox();

    let now = 0;

    while (box.anchorTarget === null && now < 1000) {
      box.update(centerOf(left).x, centerOf(left).y, keys, true, now);
      now += 50;
    }

    expect(box.anchorVisualRect()).toEqual(left.rect);

    box.update(centerOf(left).x, centerOf(left).y, keys, true, now + 500);
    const grown = box.anchorVisualRect() as Bounds;

    expect(grown.left).toBeLessThan(left.rect.left);
    expect(grown.right).toBeGreaterThan(left.rect.right);
    expect(grown.top).toBeLessThan(left.rect.top);
    expect(grown.bottom).toBeGreaterThan(left.rect.bottom);
  });

  it('보이는 것보다 판정이 조금 더 너그럽다(암묵 확장)', () => {
    const keys = buildKeys();
    const { left } = adjacentPair(keys);
    const box = hitbox();

    hold(box, keys, centerOf(left));

    const visual = box.anchorVisualRect() as Bounds;
    const hit = box.anchorDebugRect() as Bounds;

    expect(hit.left).toBeLessThanOrEqual(visual.left);
    expect(hit.top).toBeLessThanOrEqual(visual.top);
    expect(visual.right).toBeLessThanOrEqual(hit.right);
    expect(visual.bottom).toBeLessThanOrEqual(hit.bottom);
  });

  it('시각 확대만 꺼도 히트박스 확장은 그대로 동작한다', () => {
    const keys = buildKeys();
    const { left, gapPoint } = adjacentPair(keys);
    const box = hitbox({ visualEnabled: false });

    hold(box, keys, centerOf(left));

    expect(box.anchorVisualRect()).toBeNull();
    expect(box.hitTest(keys, gapPoint.x, gapPoint.y)).toBe(left);
  });
});

// =========================================================
// 공용 경로 — 세 트리거가 함께 쓰는 buildSelectionTargets
// =========================================================

interface FakeElement {
  element: HTMLElement;
  attributes: Record<string, string>;
  styles: Record<string, string>;
}

function fakeKeyEntry(id: string, rect: Bounds): GazeTargetEntry & { fake: FakeElement } {
  const attributes: Record<string, string> = {};
  const styles: Record<string, string> = {};

  const element = {
    getBoundingClientRect: () => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
    setAttribute: (name: string, value: string) => {
      attributes[name] = value;
    },
    removeAttribute: (name: string) => {
      delete attributes[name];
    },
    style: {
      setProperty: (name: string, value: string) => {
        styles[name] = value;
      },
      removeProperty: (name: string) => {
        delete styles[name];
      },
    },
  } as unknown as HTMLElement;

  return {
    id,
    scope: 'KEYBOARD',
    element,
    enabledRef: { current: true },
    onSelectRef: { current: () => {} },
    fake: { element, attributes, styles },
  };
}

describe('KeyboardFixationLayer — buildSelectionTargets 경로', () => {
  const leftRect: Bounds = { left: 100, top: 100, right: 280, bottom: 280 };
  const rightRect: Bounds = { left: 295, top: 100, right: 475, bottom: 280 };
  const gapPoint = { x: 287.5, y: 190 };
  const leftCenter = { x: 190, y: 190 };

  const entries = () => [fakeKeyEntry('keyboard:ㅂ', leftRect), fakeKeyEntry('keyboard:ㅈ', rightRect)];

  function run(
    layer: KeyboardFixationLayer,
    targets: GazeTargetEntry[],
    cursor: { x: number; y: number },
    now: number,
  ) {
    layer.update('KEYBOARD', targets, cursor, now);
    return buildSelectionTargets('KEYBOARD', targets, cursor, layer.resolveHit);
  }

  it('고정이 서면 키 사이 여백에서도 hover가 끊기지 않는다', () => {
    const layer = new KeyboardFixationLayer({ detector: detector() });
    const targets = entries();

    let now = 0;

    for (let i = 0; i < 10; i += 1) {
      run(layer, targets, leftCenter, now);
      now += 50;
    }

    expect(layer.active).toBe(true);
    expect(layer.anchorId).toBe('keyboard:ㅂ');

    const inGap = run(layer, targets, gapPoint, now);

    expect(inGap).toEqual([{ id: 'keyboard:ㅂ', centerX: gapPoint.x, centerY: gapPoint.y }]);
  });

  it('고정이 없으면 기존 rect 판정 그대로 — 여백은 후보가 없다', () => {
    const layer = new KeyboardFixationLayer({ enabled: false, detector: detector() });
    const targets = entries();

    let now = 0;
    let result = buildSelectionTargets('KEYBOARD', targets, gapPoint, layer.resolveHit);

    for (let i = 0; i < 10; i += 1) {
      result = run(layer, targets, gapPoint, now);
      now += 50;
    }

    expect(result).toEqual([]);
  });

  it('KEYBOARD scope가 아니면 확장을 걸지 않고 확대 스타일도 남기지 않는다', () => {
    const layer = new KeyboardFixationLayer({ detector: detector() });
    const targets = entries();
    const anchorElement = (targets[0] as ReturnType<typeof fakeKeyEntry>).fake;

    let now = 0;

    for (let i = 0; i < 10; i += 1) {
      run(layer, targets, leftCenter, now);
      now += 50;
    }

    expect(anchorElement.attributes['data-fixation-anchor']).toBe('true');
    expect(anchorElement.styles.transform).toBeDefined();

    layer.update('MAIN', targets, leftCenter, now);

    expect(layer.active).toBe(false);
    expect(anchorElement.attributes['data-fixation-anchor']).toBeUndefined();
    expect(anchorElement.styles.transform).toBeUndefined();
  });

  it('확대는 transform으로만 그린다 — 다음 프레임 측정이 부풀지 않는다', () => {
    const layer = new KeyboardFixationLayer({ detector: detector() });
    const targets = entries();

    let now = 0;

    for (let i = 0; i < 20; i += 1) {
      run(layer, targets, leftCenter, now);
      now += 50;
    }

    const bounds = layer.anchorDebugRect() as Bounds;

    // 확장 폭은 키 폭(180)의 0.5배와 여백+1/3 한도(15+60) 중 작은 쪽 — 프레임을 아무리
    // 돌려도 이 값이 커지지 않아야 한다(측정 피드백 루프 없음).
    expect(bounds.right - leftRect.right).toBeCloseTo(75, 5);
    expect(leftRect.left - bounds.left).toBeCloseTo(90, 5);
  });
});
