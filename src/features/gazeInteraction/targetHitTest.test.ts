import { describe, expect, it } from 'vitest';
import { filterEligibleTargets, hitTestTargets, toSyntheticSelectionTargets } from './targetHitTest';
import type { GazeTargetEntry } from './types';

function fakeTarget(
  id: string,
  rect: { left: number; top: number; right: number; bottom: number },
  overrides: Partial<GazeTargetEntry> = {},
): GazeTargetEntry {
  return {
    id,
    scope: 'MAIN',
    enabledRef: { current: true },
    onSelectRef: { current: () => {} },
    element: {
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
    } as unknown as HTMLElement,
    ...overrides,
  };
}

// 큰 카드형 버튼 — VirtualKeyboard key처럼 작지 않다(§12).
const BIG_CARD = fakeTarget('card', { left: 100, top: 100, right: 400, bottom: 400 });

describe('hitTestTargets', () => {
  it('4. cursor가 DOM rect 내부면 hit', () => {
    const hit = hitTestTargets({ x: 200, y: 200 }, [BIG_CARD]);
    expect(hit?.id).toBe('card');
  });

  it('5. cursor가 DOM rect 밖이면 hit 아님', () => {
    const hit = hitTestTargets({ x: 500, y: 500 }, [BIG_CARD]);
    expect(hit).toBeNull();
  });

  it('6. 큰 button의 중심에서 멀리 떨어진 edge 쪽이어도 rect 내부라면 hit(center-only 문제 없음)', () => {
    // 중심은 (250,250)인데 커서는 rect 가장자리(105,105)에 가깝다 — 145px 이상 중심에서
    // 벗어나 있지만(키보드 assist_radius 35px보다 훨씬 큼) rect 안이라 hit이어야 한다.
    const hit = hitTestTargets({ x: 105, y: 105 }, [BIG_CARD]);
    expect(hit?.id).toBe('card');
  });

  it('Python KeyRect처럼 left/top은 포함하고 right/bottom은 제외한다', () => {
    expect(hitTestTargets({ x: 100, y: 100 }, [BIG_CARD])?.id).toBe('card');
    expect(hitTestTargets({ x: 399.999, y: 399.999 }, [BIG_CARD])?.id).toBe('card');
    expect(hitTestTargets({ x: 400, y: 200 }, [BIG_CARD])).toBeNull();
    expect(hitTestTargets({ x: 200, y: 400 }, [BIG_CARD])).toBeNull();
  });

  it('여러 target 중 실제로 커서를 포함하는 것만 hit된다', () => {
    const other = fakeTarget('other', { left: 500, top: 500, right: 600, bottom: 600 });
    const hit = hitTestTargets({ x: 550, y: 550 }, [BIG_CARD, other]);
    expect(hit?.id).toBe('other');
  });

  it('매 호출마다 최신 DOM rect를 읽어 resize 이전 좌표를 캐시하지 않는다', () => {
    const rect = { left: 0, top: 0, right: 100, bottom: 100 };
    const target = fakeTarget('resized', rect);

    expect(hitTestTargets({ x: 150, y: 50 }, [target])).toBeNull();

    rect.right = 200;
    expect(hitTestTargets({ x: 150, y: 50 }, [target])?.id).toBe('resized');
  });
});

describe('filterEligibleTargets', () => {
  it('7. disabled target은 후보에서 제외된다', () => {
    const disabled = fakeTarget('disabled-card', { left: 0, top: 0, right: 100, bottom: 100 }, {
      enabledRef: { current: false },
    });
    const eligible = filterEligibleTargets([BIG_CARD, disabled], 'MAIN');
    expect(eligible.map((t) => t.id)).toEqual(['card']);
  });

  it('13. scope가 다른 target은 후보에서 제외된다', () => {
    const keyboardScoped = fakeTarget('kb', { left: 0, top: 0, right: 50, bottom: 50 }, { scope: 'KEYBOARD' });
    const eligible = filterEligibleTargets([BIG_CARD, keyboardScoped], 'MAIN');
    expect(eligible.map((t) => t.id)).toEqual(['card']);
  });
});

describe('toSyntheticSelectionTargets', () => {
  it('hit이 없으면 빈 배열(선택 후보 없음)', () => {
    expect(toSyntheticSelectionTargets(null, { x: 1, y: 1 })).toEqual([]);
  });

  it('hit이 있으면 커서 위치를 중심으로 하는 1개짜리 target을 만든다(DwellController의 center+반경 판정을 그대로 통과시키기 위함)', () => {
    const synthetic = toSyntheticSelectionTargets(BIG_CARD, { x: 105, y: 105 });
    expect(synthetic).toEqual([{ id: 'card', centerX: 105, centerY: 105 }]);
  });
});
