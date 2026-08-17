import { describe, expect, it } from 'vitest';
import { buildSelectionTargets } from './scopeSelectionTargets';
import type { GazeTargetEntry } from './types';

function fakeTarget(id: string, rect: { left: number; top: number; right: number; bottom: number }): GazeTargetEntry {
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
  };
}

describe('buildSelectionTargets', () => {
  it('MAIN — 큰 target은 hit-test 후 커서 위치를 중심으로 하는 1개짜리 synthetic target이 된다', () => {
    const card = fakeTarget('main-memo', { left: 100, top: 100, right: 400, bottom: 400 });
    const result = buildSelectionTargets('MAIN', [card], { x: 105, y: 105 });
    expect(result).toEqual([{ id: 'main-memo', centerX: 105, centerY: 105 }]);
  });

  it('MAIN — 커서가 rect 밖이면 후보가 없다', () => {
    const card = fakeTarget('main-memo', { left: 100, top: 100, right: 400, bottom: 400 });
    expect(buildSelectionTargets('MAIN', [card], { x: 900, y: 900 })).toEqual([]);
  });

  it('CHAT — MAIN과 동일한 rect-hit 정책을 쓴다(같은 종류의 큰 target)', () => {
    const room = fakeTarget('chat-room-1', { left: 0, top: 0, right: 200, bottom: 100 });
    const result = buildSelectionTargets('CHAT', [room], { x: 50, y: 50 });
    expect(result).toEqual([{ id: 'chat-room-1', centerX: 50, centerY: 50 }]);
  });

  it('KEYBOARD — hit-test로 후보를 좁히지 않고 모든 target의 rect 중심을 그대로 반환한다(nearest-key 판정은 DwellController가 한다)', () => {
    const keyA = fakeTarget('keyboard:a', { left: 0, top: 0, right: 40, bottom: 40 });
    const keyB = fakeTarget('keyboard:b', { left: 50, top: 0, right: 90, bottom: 40 });

    // 커서가 두 키 사이 어디에도 정확히 포함되지 않아도(45,20) 둘 다 후보로 나와야 한다.
    const result = buildSelectionTargets('KEYBOARD', [keyA, keyB], { x: 45, y: 20 });

    expect(result).toEqual([
      { id: 'keyboard:a', centerX: 20, centerY: 20 },
      { id: 'keyboard:b', centerX: 70, centerY: 20 },
    ]);
  });

  it('KEYBOARD — cursor가 null이어도(추적 실패) rect 중심 목록 자체는 그대로 반환한다(무효화는 processGazeFrameForSelection이 hasSignal로 처리)', () => {
    const keyA = fakeTarget('keyboard:a', { left: 0, top: 0, right: 40, bottom: 40 });
    const result = buildSelectionTargets('KEYBOARD', [keyA], null);
    expect(result).toEqual([{ id: 'keyboard:a', centerX: 20, centerY: 20 }]);
  });

  it('빈 eligibleTargets면 어떤 scope든 빈 배열', () => {
    expect(buildSelectionTargets('MAIN', [], { x: 1, y: 1 })).toEqual([]);
    expect(buildSelectionTargets('KEYBOARD', [], { x: 1, y: 1 })).toEqual([]);
  });
});
