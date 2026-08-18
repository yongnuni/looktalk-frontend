import { describe, expect, it } from 'vitest';
import { DwellController } from './DwellController';
import type { KeyTarget } from './types';

const TARGETS: KeyTarget[] = [
  { id: 'A', centerX: 100, centerY: 100 },
  { id: 'B', centerX: 300, centerY: 100 },
];

// 실제 런타임의 now(performance.now()/Date.now())는 항상 큰 양수라 cooldownEndMs
// 초기값(0)과 절대 충돌하지 않는다. 테스트에서 t=0을 쓰면 `now <= cooldownEndMs`(0<=0)에
// 우연히 걸려버리므로, 0이 아닌 기준시각에서 시작한다.
const BASE = 10_000;

describe('DwellController (Look-Talk dwell.py 포팅)', () => {
  it('gazeX/Y가 음수면 즉시 리셋되고 아무것도 hover하지 않는다', () => {
    const controller = new DwellController();
    const result = controller.update(-1, -1, TARGETS, BASE);
    expect(result).toEqual({ hoveredKeyId: null, progress: 0, selectedKeyId: null });
  });

  it('assist radius(35px) 밖이면 아무 키도 hover하지 않는다', () => {
    const controller = new DwellController();
    // A(100,100)에서 40px 떨어진 지점 — assist radius 밖.
    const result = controller.update(140, 100, TARGETS, BASE);
    expect(result.hoveredKeyId).toBeNull();
  });

  it('assist radius 안이면 nearest key를 hover한다', () => {
    const controller = new DwellController();
    const result = controller.update(110, 100, TARGETS, BASE);
    expect(result.hoveredKeyId).toBe('A');
  });

  it('1.2초 미만이면 selectedKeyId가 나오지 않는다', () => {
    const controller = new DwellController();
    controller.update(100, 100, TARGETS, BASE);
    const result = controller.update(100, 100, TARGETS, BASE + 1199);
    expect(result.selectedKeyId).toBeNull();
    expect(result.progress).toBeCloseTo(1199 / 1200, 3);
  });

  it('1.2초 이상 같은 키를 hover하면 selectedKeyId가 나온다', () => {
    const controller = new DwellController();
    controller.update(100, 100, TARGETS, BASE);
    const result = controller.update(100, 100, TARGETS, BASE + 1200);
    expect(result.selectedKeyId).toBe('A');
    expect(result.progress).toBe(1);
  });

  it('선택 직후 cooldown(0.4초) 동안은 재선택되지 않는다', () => {
    const controller = new DwellController();
    controller.update(100, 100, TARGETS, BASE);
    const clicked = controller.update(100, 100, TARGETS, BASE + 1200);
    expect(clicked.selectedKeyId).toBe('A');

    // cooldown 중(+1200~+1600ms) — 아직 다시 hover조차 안 된다.
    const duringCooldown = controller.update(100, 100, TARGETS, BASE + 1500);
    expect(duringCooldown.hoveredKeyId).toBeNull();

    // cooldown이 끝난 뒤에는 다시 정상적으로 hover/dwell이 진행된다.
    const afterCooldown = controller.update(100, 100, TARGETS, BASE + 1601);
    expect(afterCooldown.hoveredKeyId).toBe('A');
  });

  it('lock hysteresis: 한 번 잠긴 키는 lock radius(초기 40px) 안에서 유지된다', () => {
    const controller = new DwellController();
    controller.update(100, 100, TARGETS, BASE); // A에 정확히 lock
    // 30px 이내로 이동 — 여전히 A를 유지해야 한다(참고: 다른 키(B)와의 거리가 훨씬 멀어
    // nearest 재계산에서도 A가 nearest이므로 이 케이스는 hysteresis 없이도 A를 유지한다).
    const result = controller.update(130, 100, TARGETS, BASE + 100);
    expect(result.hoveredKeyId).toBe('A');
  });

  it('키를 완전히 벗어나면(hover 없음) dwell 진행이 초기화된다', () => {
    const controller = new DwellController();
    controller.update(100, 100, TARGETS, BASE);
    controller.update(100, 100, TARGETS, BASE + 600); // 절반 진행
    // 두 키 중 어디에도 해당하지 않는 먼 위치로 이동.
    const away = controller.update(1000, 1000, TARGETS, BASE + 700);
    expect(away.hoveredKeyId).toBeNull();
    expect(away.progress).toBe(0);

    // 다시 A로 돌아와도 타이머는 0부터 다시 시작해야 한다(이어붙이기 없음).
    controller.update(100, 100, TARGETS, BASE + 800);
    const resumed = controller.update(100, 100, TARGETS, BASE + 1000);
    expect(resumed.progress).toBeCloseTo(200 / 1200, 3);
  });
});
