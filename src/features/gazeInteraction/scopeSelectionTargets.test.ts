import { describe, expect, it } from 'vitest';
import { DwellController } from '../multimodalInput/DwellController';
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

  it('KEYBOARD — 일반키 중앙과 가장자리 내부를 커서 위치 synthetic target으로 반환한다', () => {
    const keyA = fakeTarget('keyboard:a', { left: 0, top: 0, right: 40, bottom: 40 });

    expect(buildSelectionTargets('KEYBOARD', [keyA], { x: 20, y: 20 })).toEqual([
      { id: 'keyboard:a', centerX: 20, centerY: 20 },
    ]);
    expect(buildSelectionTargets('KEYBOARD', [keyA], { x: 39.999, y: 39.999 })).toEqual([
      { id: 'keyboard:a', centerX: 39.999, centerY: 39.999 },
    ]);
  });

  it.each([
    ['Space', 'keyboard: ', { left: 100, top: 100, right: 600, bottom: 200 }, { x: 599.999, y: 199.999 }],
    ['확인', 'keyboard:확인', { left: 620, top: 100, right: 800, bottom: 200 }, { x: 799.999, y: 199.999 }],
    ['NLP 추천', 'keyboard:suggestion_1', { left: 0, top: 0, right: 500, bottom: 90 }, { x: 499.999, y: 89.999 }],
  ])('KEYBOARD — 큰 %s rect의 가장자리 내부도 선택 가능하다', (_label, id, rect, cursor) => {
    const target = fakeTarget(id, rect);
    expect(buildSelectionTargets('KEYBOARD', [target], cursor)).toEqual([
      { id, centerX: cursor.x, centerY: cursor.y },
    ]);
  });

  it('KEYBOARD — 키 사이와 행 사이 gap에서는 어떤 target도 반환하지 않는다', () => {
    const left = fakeTarget('keyboard:a', { left: 0, top: 0, right: 40, bottom: 40 });
    const right = fakeTarget('keyboard:b', { left: 50, top: 0, right: 90, bottom: 40 });
    const below = fakeTarget('keyboard:c', { left: 0, top: 50, right: 40, bottom: 90 });

    expect(buildSelectionTargets('KEYBOARD', [left, right, below], { x: 45, y: 20 })).toEqual([]);
    expect(buildSelectionTargets('KEYBOARD', [left, right, below], { x: 20, y: 45 })).toEqual([]);
  });

  it('KEYBOARD — right/bottom 경계는 제외한다', () => {
    const key = fakeTarget('keyboard:a', { left: 0, top: 0, right: 40, bottom: 40 });

    expect(buildSelectionTargets('KEYBOARD', [key], { x: 40, y: 20 })).toEqual([]);
    expect(buildSelectionTargets('KEYBOARD', [key], { x: 20, y: 40 })).toEqual([]);
  });

  it('KEYBOARD — resize 후 최신 DOM rect로 다시 hit-test한다', () => {
    const rect = { left: 0, top: 0, right: 40, bottom: 40 };
    const key = fakeTarget('keyboard:a', rect);

    expect(buildSelectionTargets('KEYBOARD', [key], { x: 70, y: 20 })).toEqual([]);
    rect.right = 80;
    expect(buildSelectionTargets('KEYBOARD', [key], { x: 70, y: 20 })).toEqual([
      { id: 'keyboard:a', centerX: 70, centerY: 20 },
    ]);
  });

  it('KEYBOARD — rectangular hit 뒤 synthetic target은 center-distance 판정에서 탈락하지 않는다', () => {
    const cursor = { x: 599.999, y: 199.999 };
    const space = fakeTarget('keyboard: ', { left: 100, top: 100, right: 600, bottom: 200 });
    const targets = buildSelectionTargets('KEYBOARD', [space], cursor);
    const selection = new DwellController().update(cursor.x, cursor.y, targets, 1_000);

    expect(selection.hoveredKeyId).toBe('keyboard: ');
  });

  it('KEYBOARD — cursor가 null이면 후보가 없다', () => {
    const keyA = fakeTarget('keyboard:a', { left: 0, top: 0, right: 40, bottom: 40 });
    expect(buildSelectionTargets('KEYBOARD', [keyA], null)).toEqual([]);
  });

  it('빈 eligibleTargets면 어떤 scope든 빈 배열', () => {
    expect(buildSelectionTargets('MAIN', [], { x: 1, y: 1 })).toEqual([]);
    expect(buildSelectionTargets('KEYBOARD', [], { x: 1, y: 1 })).toEqual([]);
  });
});
