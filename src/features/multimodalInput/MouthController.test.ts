import { describe, expect, it } from 'vitest';
import { MouthController } from './MouthController';
import type { KeyTarget } from './types';

const TARGETS: KeyTarget[] = [
  { id: 'A', centerX: 100, centerY: 100 },
  { id: 'B', centerX: 300, centerY: 100 },
];

const CLOSED_MAR = 0.1;
const OPEN_MAR = 0.4;

// DwellController.test.ts와 동일한 이유로 0이 아닌 기준시각에서 시작한다
// (MouthController.lastClickMs 초기값도 0이라 t=0은 cooldown 판정과 우연히 충돌할 수 있다).
const BASE = 10_000;

describe('MouthController (Look-Talk mouth.py MouthClickDetector 포팅)', () => {
  it('입을 다물고 0.25초 미만 응시하면 아직 키가 잠기지 않는다', () => {
    const controller = new MouthController();
    controller.update(100, 100, TARGETS, CLOSED_MAR, BASE);
    const result = controller.update(100, 100, TARGETS, CLOSED_MAR, BASE + 249);
    expect(result.lockedKeyId).toBeNull();
  });

  it('입을 다물고 0.25초 이상 응시하면 키가 잠긴다', () => {
    const controller = new MouthController();
    controller.update(100, 100, TARGETS, CLOSED_MAR, BASE);
    const result = controller.update(100, 100, TARGETS, CLOSED_MAR, BASE + 250);
    expect(result.lockedKeyId).toBe('A');
  });

  function lockKeyA(controller: MouthController, atMs: number): void {
    controller.update(100, 100, TARGETS, CLOSED_MAR, atMs);
    controller.update(100, 100, TARGETS, CLOSED_MAR, atMs + 250);
  }

  it('키를 잠근 뒤 입을 벌려 hold_time(0.3초) 미만이면 선택되지 않는다', () => {
    const controller = new MouthController();
    lockKeyA(controller, BASE);

    controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 300); // 입벌림 시작
    const result = controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 300 + 299);
    expect(result.selectedKeyId).toBeNull();
    expect(result.isOpen).toBe(true);
  });

  it('키를 잠근 뒤 입을 벌려 hold_time(0.3초) 이상 유지하면 잠긴 키가 선택된다', () => {
    const controller = new MouthController();
    lockKeyA(controller, BASE);

    controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 300);
    const result = controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 300 + 300);
    expect(result.selectedKeyId).toBe('A');
  });

  it('입을 벌리는 동안 시선이 다른 키로 이동해도 벌리기 전에 잠근 키가 선택된다', () => {
    const controller = new MouthController();
    lockKeyA(controller, BASE);

    controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 300); // A를 잠근 채로 입벌림 시작
    // 입이 열린 동안 시선이 B 쪽으로 이동해도 start_key(A)는 이미 고정됨.
    const result = controller.update(300, 100, TARGETS, OPEN_MAR, BASE + 300 + 300);
    expect(result.selectedKeyId).toBe('A');
  });

  it('잠근 키를 벗어난 뒤 입을 벌리면 이전 키를 선택하지 않는다', () => {
    const controller = new MouthController();
    lockKeyA(controller, BASE);

    controller.update(1000, 1000, TARGETS, OPEN_MAR, BASE + 300);
    const result = controller.update(1000, 1000, TARGETS, OPEN_MAR, BASE + 600);

    expect(result.selectedKeyId).toBeNull();
  });

  it('잠긴 키 없이 입을 벌리면 hold_time을 채워도 선택되지 않는다', () => {
    const controller = new MouthController();
    // 응시 없이(먼 위치) 바로 입을 연다 — locked_key가 없는 상태.
    controller.update(1000, 1000, TARGETS, OPEN_MAR, BASE);
    const result = controller.update(1000, 1000, TARGETS, OPEN_MAR, BASE + 300);
    expect(result.selectedKeyId).toBeNull();
  });

  it('같은 입벌림 동작 중에는 clicked 플래그로 중복 선택을 막는다', () => {
    const controller = new MouthController();
    lockKeyA(controller, BASE);
    controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 300);
    const clicked = controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 600);
    expect(clicked.selectedKeyId).toBe('A');

    // 입을 계속 벌리고 있는 동안(닫힘 없이) 추가 프레임이 와도 같은 open 세션에서는
    // clicked=true라 재선택되지 않는다(Python mouth.py 636-787행 update() 참고).
    const stillOpen = controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 900);
    expect(stillOpen.selectedKeyId).toBeNull();
  });

  it('선택 직후 곧바로 재잠금+재입벌림하면 cooldown(0.5초)이 이미 지나 다시 선택된다', () => {
    // Python 원본의 lock_time(0.25s)+hold_time(0.3s)=0.55s > cooldown(0.5s)이므로,
    // "닫힘 -> 재잠금 -> 재입벌림"의 정상 사이클은 항상 cooldown 종료 이후에 완료된다 —
    // 즉 cooldown은 이 경로에서는 사실상 선택을 막지 못한다. Look-Talk 원본 그대로
    // 포팅한 결과이며 Web에서 임의로 동작을 바꾸지 않는다(§Final Audit에 기록).
    const controller = new MouthController();
    lockKeyA(controller, BASE);
    controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 300);
    const clicked = controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 600);
    expect(clicked.selectedKeyId).toBe('A');

    controller.update(100, 100, TARGETS, CLOSED_MAR, BASE + 650); // 닫힘
    lockKeyA(controller, BASE + 700); // 재잠금(0.25s)
    controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 950); // 재입벌림
    const retry = controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 950 + 300); // hold 0.3s
    expect(retry.selectedKeyId).toBe('A');
  });

  it('hold_time 전에 입을 다시 닫으면 선택 없이 상태가 초기화된다', () => {
    const controller = new MouthController();
    lockKeyA(controller, BASE);

    controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 300); // 입벌림
    const closed = controller.update(100, 100, TARGETS, CLOSED_MAR, BASE + 400); // hold_time 전에 닫음
    expect(closed.selectedKeyId).toBeNull();
    expect(closed.lockedKeyId).toBeNull();

    // 닫힌 뒤 곧바로 다시 열어도 새로 잠금부터 다시 해야 한다(잠긴 키 없음 -> 선택 불가).
    const reopened = controller.update(100, 100, TARGETS, OPEN_MAR, BASE + 700 + 300);
    expect(reopened.selectedKeyId).toBeNull();
  });

  it('세션에서 전달한 개인 open/close threshold를 사용한다', () => {
    const controller = new MouthController({
      openThreshold: 0.2,
      closeThreshold: 0.15,
    });

    controller.update(100, 100, TARGETS, 0.1, BASE);
    controller.update(100, 100, TARGETS, 0.1, BASE + 250);
    controller.update(100, 100, TARGETS, 0.25, BASE + 300);

    expect(controller.update(100, 100, TARGETS, 0.25, BASE + 600).selectedKeyId).toBe('A');
  });
});
