import { describe, expect, it } from 'vitest';
import type { GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import { DwellController } from './DwellController';
import { processGazeFrameForSelection } from './gazeFrameSelection';
import { MouthController } from './MouthController';
import type { KeyTarget } from './types';

const TARGETS: KeyTarget[] = [{ id: 'A', centerX: 100, centerY: 100 }];
const BASE = 10_000;

function frame(overrides: Partial<GazeFrame> = {}): GazeFrame {
  return {
    hasSignal: true,
    signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: 0.1, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE },
    cursorCssPx: { x: 100, y: 100 },
    fixationCount: 0,
    now: BASE,
    ...overrides,
  };
}

describe('processGazeFrameForSelection (Front Step 11 keyboard-selection adapter 판정 로직)', () => {
  it('hasSignal=false면 두 controller 모두 명시적으로 reset되고 IDLE을 반환한다(mouth open 상태 등 잔여값을 남기지 않음)', () => {
    const dwell = new DwellController();
    const mouth = new MouthController();

    // 먼저 정상 프레임으로 dwell 진행을 만든 뒤
    processGazeFrameForSelection(frame(), TARGETS, 'DWELL', dwell, mouth);
    // 신호가 끊기면
    const result = processGazeFrameForSelection(frame({ hasSignal: false, cursorCssPx: null }), TARGETS, 'DWELL', dwell, mouth);

    expect(result).toEqual({ hoveredKeyId: null, progress: 0, selectedKeyId: null });
    // 리셋되었으므로 같은 위치로 돌아와도 진행률이 0부터 다시 시작해야 한다(이어붙이기 없음).
    processGazeFrameForSelection(frame({ now: BASE + 100 }), TARGETS, 'DWELL', dwell, mouth);
    const resumed = processGazeFrameForSelection(frame({ now: BASE + 200 }), TARGETS, 'DWELL', dwell, mouth);
    expect(resumed.progress).toBeCloseTo(100 / 1200, 3);
  });

  it('5. DWELL 모드 — Global Runtime 신호로도 기존 Dwell(1.2초 응시) 선택이 그대로 동작한다', () => {
    const dwell = new DwellController();
    const mouth = new MouthController();

    processGazeFrameForSelection(frame({ now: BASE }), TARGETS, 'DWELL', dwell, mouth);
    const result = processGazeFrameForSelection(frame({ now: BASE + 1200 }), TARGETS, 'DWELL', dwell, mouth);

    expect(result.selectedKeyId).toBe('A');
  });

  it('6. MOUTH 모드 — Global Runtime 신호로도 기존 Mouth(gaze-lock + 입벌림 hold) 선택이 그대로 동작한다', () => {
    const dwell = new DwellController();
    const mouth = new MouthController();
    const CLOSED_MAR = 0.1;
    const OPEN_MAR = 0.4;

    // 0.25초 이상 같은 키를 입 다문 채 응시 → 잠금
    processGazeFrameForSelection(
      frame({ now: BASE, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: CLOSED_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE } }),
      TARGETS,
      'MOUTH',
      dwell,
      mouth,
    );
    processGazeFrameForSelection(
      frame({ now: BASE + 250, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: CLOSED_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 250 } }),
      TARGETS,
      'MOUTH',
      dwell,
      mouth,
    );

    // 입을 벌리고 0.3초 유지 → 잠긴 키 선택
    processGazeFrameForSelection(
      frame({ now: BASE + 300, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: OPEN_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 300 } }),
      TARGETS,
      'MOUTH',
      dwell,
      mouth,
    );
    const result = processGazeFrameForSelection(
      frame({ now: BASE + 600, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: OPEN_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 600 } }),
      TARGETS,
      'MOUTH',
      dwell,
      mouth,
    );

    expect(result.selectedKeyId).toBe('A');
  });

  it('MOUTH 모드에서는 dwell controller가, DWELL 모드에서는 mouth controller가 매 프레임 reset되어 서로 간섭하지 않는다(Look-Talk main.py 1287-1341행과 동일한 상호 배타)', () => {
    const dwell = new DwellController();
    const mouth = new MouthController();

    // DWELL로 진행 중이던 상태에서
    processGazeFrameForSelection(frame({ now: BASE }), TARGETS, 'DWELL', dwell, mouth);
    // MOUTH로 전환되면 dwell 진행은 사라져야 한다 — 이후 다시 DWELL로 돌아와도 처음부터.
    processGazeFrameForSelection(
      frame({ now: BASE + 100, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: 0.1, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 100 } }),
      TARGETS,
      'MOUTH',
      dwell,
      mouth,
    );
    const backToDwell = processGazeFrameForSelection(frame({ now: BASE + 200 }), TARGETS, 'DWELL', dwell, mouth);

    expect(backToDwell.progress).toBeCloseTo(0, 3);
  });
});
