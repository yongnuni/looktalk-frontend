import { describe, expect, it } from 'vitest';
import { LandmarkAutoOpenController } from './landmarkAutoOpen';

describe('LandmarkAutoOpenController', () => {
  it('calibration full을 input test looktalk으로 단일 variant 전환한다', () => {
    const controller = new LandmarkAutoOpenController();
    expect(controller.request({ key: 'patient-gaze', variant: 'full' }).variant).toBe('full');
    expect(
      controller.request({ key: 'patient-gaze-test', variant: 'looktalk' }).variant,
    ).toBe('looktalk');
  });

  it('X로 닫은 같은 stage는 다시 열지 않고 다음 stage는 다시 연다', () => {
    const controller = new LandmarkAutoOpenController();
    controller.request({ key: 'patient-blink', variant: 'full' });
    expect(controller.dismissActive().variant).toBeNull();
    expect(controller.request({ key: 'patient-blink', variant: 'full' }).variant).toBeNull();
    expect(
      controller.request({ key: 'patient-blink-test', variant: 'looktalk' }).variant,
    ).toBe('looktalk');
  });

  it('이전 session cleanup은 새 session popup을 닫지 않는다', () => {
    const controller = new LandmarkAutoOpenController();
    controller.request({ key: 'keyboard-1', variant: 'looktalk' });
    controller.request({ key: 'keyboard-2', variant: 'looktalk' });
    expect(controller.release('keyboard-1').handled).toBe(false);
    expect(controller.release('keyboard-2')).toEqual({ handled: true, variant: null });
  });

  it('같은 stage라도 새 session key이면 다시 연다', () => {
    const controller = new LandmarkAutoOpenController();
    controller.request({ key: 'patient-blink:session-1', variant: 'full' });
    controller.dismissActive();

    expect(
      controller.request({ key: 'patient-blink:session-1', variant: 'full' }).variant,
    ).toBeNull();
    expect(
      controller.request({ key: 'patient-blink:session-2', variant: 'full' }).variant,
    ).toBe('full');
  });
});
