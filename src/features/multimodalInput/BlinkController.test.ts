import { describe, expect, it } from 'vitest';
import { BlinkController } from './BlinkController';
import type { KeyTarget } from './types';

const TARGETS: KeyTarget[] = [
  { id: 'A', centerX: 100, centerY: 100 },
  { id: 'B', centerX: 300, centerY: 100 },
];

const OPEN_EAR = 0.3;
const CLOSED_EAR = 0.1;
const BASE = 10_000;

function armOnA(controller: BlinkController, nowMs = BASE): void {
  controller.update(100, 100, TARGETS, OPEN_EAR, nowMs);
}

function closeEyes(controller: BlinkController, nowMs: number): void {
  // 눈 감김 프레임에는 GazeFilter가 cursor를 무효화한다.
  controller.update(-1, -1, TARGETS, CLOSED_EAR, nowMs);
}

describe('BlinkController (Look-Talk blink.py BlinkDetector 포팅)', () => {
  it('자연 깜빡임(0.25초 이하)은 선택하지 않는다', () => {
    const controller = new BlinkController();
    armOnA(controller);
    closeEyes(controller, BASE + 10);

    const result = controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 210);

    expect(result.selectedKeyId).toBeNull();
  });

  it('0.30~0.80초 의도적 깜빡임이 눈을 뜰 때 잠근 키를 한 번 선택한다', () => {
    const controller = new BlinkController();
    armOnA(controller);
    closeEyes(controller, BASE + 10);

    const result = controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 310);

    expect(result.selectedKeyId).toBe('A');
  });

  it('눈을 계속 감고 있는 동안에는 선택을 발생시키지 않는다', () => {
    const controller = new BlinkController();
    armOnA(controller);
    closeEyes(controller, BASE + 10);

    expect(controller.update(-1, -1, TARGETS, CLOSED_EAR, BASE + 310).selectedKeyId).toBeNull();
    expect(controller.update(-1, -1, TARGETS, CLOSED_EAR, BASE + 600).selectedKeyId).toBeNull();
  });

  it('눈을 다시 뜬 뒤에는 새로운 의도적 깜빡임으로 다시 선택할 수 있다', () => {
    const controller = new BlinkController();
    armOnA(controller);
    closeEyes(controller, BASE + 10);
    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 310).selectedKeyId).toBe('A');

    closeEyes(controller, BASE + 450);
    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 750).selectedKeyId).toBe('A');
  });

  it('0.80초를 초과해 계속 감은 LONG_CLOSURE는 눈을 떠도 선택하지 않는다', () => {
    const controller = new BlinkController();
    armOnA(controller);
    closeEyes(controller, BASE + 10);
    controller.update(-1, -1, TARGETS, CLOSED_EAR, BASE + 811);

    const result = controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 900);

    expect(result.selectedKeyId).toBeNull();
  });

  it('눈을 뜰 때 시선이나 잠근 target이 유효하지 않으면 선택하지 않는다', () => {
    const invalidGaze = new BlinkController();
    armOnA(invalidGaze);
    closeEyes(invalidGaze, BASE + 10);
    expect(invalidGaze.update(-1, -1, TARGETS, OPEN_EAR, BASE + 310).selectedKeyId).toBeNull();

    const missingTarget = new BlinkController();
    armOnA(missingTarget);
    closeEyes(missingTarget, BASE + 10);
    expect(missingTarget.update(100, 100, [], OPEN_EAR, BASE + 310).selectedKeyId).toBeNull();
  });

  it('reset 뒤 이미 감겨 있던 눈은 먼저 다시 뜨기 전까지 새 blink로 시작하지 않는다', () => {
    const controller = new BlinkController();
    armOnA(controller);
    closeEyes(controller, BASE + 10);
    controller.reset();

    closeEyes(controller, BASE + 100);
    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 500).selectedKeyId).toBeNull();

    closeEyes(controller, BASE + 650);
    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 950).selectedKeyId).toBe('A');
  });

  it('세션에서 전달한 개인 close/open threshold를 사용한다', () => {
    const controller = new BlinkController({
      closeThreshold: 0.25,
      openThreshold: 0.27,
    });

    controller.update(100, 100, TARGETS, 0.3, BASE);
    controller.update(-1, -1, TARGETS, 0.24, BASE + 10);

    expect(controller.update(100, 100, TARGETS, 0.28, BASE + 310).selectedKeyId).toBe('A');
  });
});
