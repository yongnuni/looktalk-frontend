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

/**
 * 잠금(LOCK_TIME_MS=250)까지 A를 응시한다. 눈을 감는 시점에 잠금이 성립해 있어야
 * 제스처가 시작되므로, 대부분의 케이스는 이 헬퍼로 시작한다.
 */
function lockOnA(controller: BlinkController, startMs = BASE): void {
  controller.update(100, 100, TARGETS, OPEN_EAR, startMs);
  controller.update(100, 100, TARGETS, OPEN_EAR, startMs + 250);
}

function closeEyes(controller: BlinkController, nowMs: number): void {
  // 눈 감김 프레임에는 GazeFilter가 cursor를 무효화한다.
  controller.update(-1, -1, TARGETS, CLOSED_EAR, nowMs);
}

describe('BlinkController (Look-Talk blink.py BlinkDetector 포팅)', () => {
  it('자연 깜빡임(0.25초 이하)은 선택하지 않는다', () => {
    const controller = new BlinkController();
    lockOnA(controller);
    closeEyes(controller, BASE + 260);

    const result = controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 460);

    expect(result.selectedKeyId).toBeNull();
  });

  it('0.30~1.20초 의도적 깜빡임이 눈을 뜰 때 잠근 키를 한 번 선택한다', () => {
    const controller = new BlinkController();
    lockOnA(controller);
    closeEyes(controller, BASE + 260);

    const result = controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 560);

    expect(result.selectedKeyId).toBe('A');
  });

  it('눈을 계속 감고 있는 동안에는 선택을 발생시키지 않는다', () => {
    const controller = new BlinkController();
    lockOnA(controller);
    closeEyes(controller, BASE + 260);

    expect(controller.update(-1, -1, TARGETS, CLOSED_EAR, BASE + 560).selectedKeyId).toBeNull();
    expect(controller.update(-1, -1, TARGETS, CLOSED_EAR, BASE + 900).selectedKeyId).toBeNull();
  });

  it('눈을 감고 있는 동안에도 잠근 키의 hover 표시를 유지한다', () => {
    const controller = new BlinkController();
    lockOnA(controller);

    const closed = controller.update(-1, -1, TARGETS, CLOSED_EAR, BASE + 260);

    expect(closed.hoveredKeyId).toBe('A');
  });

  it('눈을 뜰 때 좌표가 튀거나 무효여도 잠근 키가 선택된다', () => {
    // 이번 수정의 핵심: 눈을 다시 뜬 첫 프레임의 좌표는 GazeFilter 재개 직후라 신뢰할 수
    // 없으므로, 잠금이 눈을 감는 시점에 확정된 뒤에는 그 좌표로 재검증하지 않는다.
    const invalidGaze = new BlinkController();
    lockOnA(invalidGaze);
    closeEyes(invalidGaze, BASE + 260);
    expect(invalidGaze.update(-1, -1, TARGETS, OPEN_EAR, BASE + 560).selectedKeyId).toBe('A');

    const driftedGaze = new BlinkController();
    lockOnA(driftedGaze);
    closeEyes(driftedGaze, BASE + 260);
    // 눈을 뜬 프레임에서 시선이 옆 키(B)로 튀어도 A가 선택된다.
    expect(driftedGaze.update(300, 100, TARGETS, OPEN_EAR, BASE + 560).selectedKeyId).toBe('A');
  });

  it('0.25초 미만만 응시해 잠기지 않았으면 의도적 깜빡임에도 선택하지 않는다', () => {
    const controller = new BlinkController();
    controller.update(100, 100, TARGETS, OPEN_EAR, BASE);
    controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 100);
    closeEyes(controller, BASE + 110);

    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 410).selectedKeyId).toBeNull();
  });

  it('다른 키를 0.25초 이상 응시하면 잠금이 그 키로 옮겨간다', () => {
    const controller = new BlinkController();
    lockOnA(controller);

    controller.update(300, 100, TARGETS, OPEN_EAR, BASE + 300);
    controller.update(300, 100, TARGETS, OPEN_EAR, BASE + 550);
    closeEyes(controller, BASE + 560);

    expect(controller.update(300, 100, TARGETS, OPEN_EAR, BASE + 860).selectedKeyId).toBe('B');
  });

  it('선택 후에는 잠금이 풀려 다시 0.25초 응시해야 입력된다', () => {
    const controller = new BlinkController();
    lockOnA(controller);
    closeEyes(controller, BASE + 260);
    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 560).selectedKeyId).toBe('A');

    // 눈을 뜬 직후 바로 다시 감으면 잠금이 아직 재성립하지 않아 선택되지 않는다.
    closeEyes(controller, BASE + 700);
    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 1000).selectedKeyId).toBeNull();

    // 다시 0.25초를 응시하면 잠기고, 그 다음 깜빡임은 선택된다.
    controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 1050);
    controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 1300);
    closeEyes(controller, BASE + 1310);
    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 1610).selectedKeyId).toBe('A');
  });

  it('1.20초를 초과해 계속 감은 LONG_CLOSURE는 눈을 떠도 선택하지 않는다', () => {
    const controller = new BlinkController();
    lockOnA(controller);
    closeEyes(controller, BASE + 260);
    controller.update(-1, -1, TARGETS, CLOSED_EAR, BASE + 1461);

    const result = controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 1550);

    expect(result.selectedKeyId).toBeNull();
  });

  it('reset 뒤 이미 감겨 있던 눈은 먼저 다시 뜨기 전까지 새 blink로 시작하지 않는다', () => {
    const controller = new BlinkController();
    lockOnA(controller);
    closeEyes(controller, BASE + 260);
    controller.reset();

    closeEyes(controller, BASE + 350);
    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 750).selectedKeyId).toBeNull();

    // 다시 뜬 뒤 0.25초를 응시해 잠근 다음에야 새 blink가 성립한다.
    lockOnA(controller, BASE + 800);
    closeEyes(controller, BASE + 1060);
    expect(controller.update(100, 100, TARGETS, OPEN_EAR, BASE + 1360).selectedKeyId).toBe('A');
  });

  it('세션에서 전달한 개인 close/open threshold를 사용한다', () => {
    const controller = new BlinkController({
      closeThreshold: 0.25,
      openThreshold: 0.27,
    });

    controller.update(100, 100, TARGETS, 0.3, BASE);
    controller.update(100, 100, TARGETS, 0.3, BASE + 250);
    controller.update(-1, -1, TARGETS, 0.24, BASE + 260);

    expect(controller.update(100, 100, TARGETS, 0.28, BASE + 560).selectedKeyId).toBe('A');
  });
});
