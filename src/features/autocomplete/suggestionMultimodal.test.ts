import { describe, expect, it } from 'vitest';
import { BlinkController } from '../multimodalInput/BlinkController';
import { DwellController } from '../multimodalInput/DwellController';
import { MouthController } from '../multimodalInput/MouthController';
import type { KeyTarget } from '../multimodalInput/types';

const TARGET: KeyTarget = { id: 'keyboard:suggestion_1', centerX: 100, centerY: 100 };
const TARGETS = [TARGET];
const BASE = 10_000;

describe('추천 후보의 기존 dwell/blink/mouth 선택 파이프라인 재사용', () => {
  it('dwell은 임계시간 뒤 한 번만 suggestion_1을 선택한다', () => {
    const controller = new DwellController();
    controller.update(100, 100, TARGETS, BASE);
    expect(controller.update(100, 100, TARGETS, BASE + 1_200).selectedKeyId).toBe(TARGET.id);
    expect(controller.update(100, 100, TARGETS, BASE + 1_210).selectedKeyId).toBeNull();
  });

  it('blink는 잠근 suggestion_1을 눈을 뜰 때 한 번 선택한다', () => {
    const controller = new BlinkController();
    controller.update(100, 100, TARGETS, 0.3, BASE);
    controller.update(-1, -1, TARGETS, 0.1, BASE + 10);
    controller.update(-1, -1, TARGETS, 0.1, BASE + 310);
    expect(controller.update(100, 100, TARGETS, 0.3, BASE + 320).selectedKeyId).toBe(TARGET.id);
  });

  it('mouth는 기존 gaze-lock과 hold 임계값으로 suggestion_1을 선택한다', () => {
    const controller = new MouthController();
    controller.update(100, 100, TARGETS, 0.1, BASE);
    controller.update(100, 100, TARGETS, 0.1, BASE + 250);
    controller.update(100, 100, TARGETS, 0.4, BASE + 300);
    expect(controller.update(100, 100, TARGETS, 0.4, BASE + 600).selectedKeyId).toBe(TARGET.id);
  });
});
