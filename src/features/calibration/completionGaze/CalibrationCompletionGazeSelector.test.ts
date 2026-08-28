import { describe, expect, it, vi } from 'vitest';
import { CalibrationCompletionGazeSelector } from './CalibrationCompletionGazeSelector';
import type {
  CalibrationCompletionGazeFrame,
  CalibrationCompletionGazeTarget,
} from './types';

const BASE_TIME = 10_000;

function elementWithRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
): HTMLElement {
  return {
    getBoundingClientRect: () => ({ left, top, right, bottom }),
  } as unknown as HTMLElement;
}

function frame(
  now: number,
  cursorCssPx: { x: number; y: number } | null = { x: 150, y: 125 },
): CalibrationCompletionGazeFrame {
  return {
    now,
    hasSignal: cursorCssPx !== null,
    cursorCssPx,
  };
}

describe('CalibrationCompletionGazeSelector', () => {
  it('명시적으로 전달된 DOM rect 안의 버튼만 dwell target으로 선택한다', () => {
    const selector = new CalibrationCompletionGazeSelector();
    const targets: CalibrationCompletionGazeTarget[] = [
      {
        id: 'retest',
        element: elementWithRect(100, 100, 200, 150),
        enabled: true,
        onSelect: vi.fn(),
      },
      {
        id: 'login',
        element: elementWithRect(300, 100, 400, 150),
        enabled: true,
        onSelect: vi.fn(),
      },
    ];

    expect(selector.update(frame(BASE_TIME), targets).hoveredTarget?.id).toBe('retest');
    expect(
      selector.update(frame(BASE_TIME + 600), targets).progress,
    ).toBeCloseTo(0.5);

    const selected = selector.update(frame(BASE_TIME + 1200), targets);
    expect(selected.selectedTarget?.id).toBe('retest');
    selected.selectedTarget?.onSelect();

    const held = selector.update(frame(BASE_TIME + 2500), targets);
    expect(held.selectedTarget).toBeNull();
    held.selectedTarget?.onSelect();
    expect(targets[0]?.onSelect).toHaveBeenCalledTimes(1);
    expect(targets[1]?.onSelect).not.toHaveBeenCalled();
  });

  it('신호 소실·disabled target에서 진행을 reset하고 다시 진입하면 새 dwell을 허용한다', () => {
    const selector = new CalibrationCompletionGazeSelector();
    const target: CalibrationCompletionGazeTarget = {
      id: 'confirm',
      element: elementWithRect(100, 100, 200, 150),
      enabled: true,
      onSelect: vi.fn(),
    };

    selector.update(frame(BASE_TIME), [target]);
    selector.update(frame(BASE_TIME + 600), [target]);
    expect(selector.update(frame(BASE_TIME + 700, null), [target]).progress).toBe(0);

    target.enabled = false;
    expect(selector.update(frame(BASE_TIME + 800), [target]).hoveredTarget).toBeNull();

    target.enabled = true;
    selector.update(frame(BASE_TIME + 1000), [target]);
    expect(
      selector.update(frame(BASE_TIME + 2200), [target]).selectedTarget?.id,
    ).toBe('confirm');
  });
});
