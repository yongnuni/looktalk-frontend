import { describe, expect, it } from 'vitest';
import type { GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import { BlinkController } from './BlinkController';
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
    const blink = new BlinkController();
    const mouth = new MouthController();

    // 먼저 정상 프레임으로 dwell 진행을 만든 뒤
    processGazeFrameForSelection(frame(), TARGETS, 'DWELL', dwell, blink, mouth);
    // 신호가 끊기면
    const result = processGazeFrameForSelection(frame({ hasSignal: false, cursorCssPx: null }), TARGETS, 'DWELL', dwell, blink, mouth);

    expect(result).toEqual({ hoveredKeyId: null, progress: 0, selectedKeyId: null });
    // 리셋되었으므로 같은 위치로 돌아와도 진행률이 0부터 다시 시작해야 한다(이어붙이기 없음).
    processGazeFrameForSelection(frame({ now: BASE + 100 }), TARGETS, 'DWELL', dwell, blink, mouth);
    const resumed = processGazeFrameForSelection(frame({ now: BASE + 200 }), TARGETS, 'DWELL', dwell, blink, mouth);
    expect(resumed.progress).toBeCloseTo(100 / 1200, 3);
  });

  it('5. DWELL 모드 — Global Runtime 신호로도 기존 Dwell(1.2초 응시) 선택이 그대로 동작한다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    processGazeFrameForSelection(frame({ now: BASE }), TARGETS, 'DWELL', dwell, blink, mouth);
    const result = processGazeFrameForSelection(frame({ now: BASE + 1200 }), TARGETS, 'DWELL', dwell, blink, mouth);

    expect(result.selectedKeyId).toBe('A');
  });

  it('6. MOUTH 모드 — Global Runtime 신호로도 기존 Mouth(gaze-lock + 입벌림 hold) 선택이 그대로 동작한다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();
    const CLOSED_MAR = 0.1;
    const OPEN_MAR = 0.4;

    // 0.25초 이상 같은 키를 입 다문 채 응시 → 잠금
    processGazeFrameForSelection(
      frame({ now: BASE, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: CLOSED_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE } }),
      TARGETS,
      'MOUTH',
      dwell,
      blink,
      mouth,
    );
    processGazeFrameForSelection(
      frame({ now: BASE + 250, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: CLOSED_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 250 } }),
      TARGETS,
      'MOUTH',
      dwell,
      blink,
      mouth,
    );

    // 입을 벌리고 0.3초 유지 → 잠긴 키 선택
    processGazeFrameForSelection(
      frame({ now: BASE + 300, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: OPEN_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 300 } }),
      TARGETS,
      'MOUTH',
      dwell,
      blink,
      mouth,
    );
    const result = processGazeFrameForSelection(
      frame({ now: BASE + 600, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: OPEN_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 600 } }),
      TARGETS,
      'MOUTH',
      dwell,
      blink,
      mouth,
    );

    expect(result.selectedKeyId).toBe('A');
  });

  it('MOUTH 모드에서는 dwell controller가, DWELL 모드에서는 mouth controller가 매 프레임 reset되어 서로 간섭하지 않는다(Look-Talk main.py 1287-1341행과 동일한 상호 배타)', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    // DWELL로 진행 중이던 상태에서
    processGazeFrameForSelection(frame({ now: BASE }), TARGETS, 'DWELL', dwell, blink, mouth);
    // MOUTH로 전환되면 dwell 진행은 사라져야 한다 — 이후 다시 DWELL로 돌아와도 처음부터.
    processGazeFrameForSelection(
      frame({ now: BASE + 100, signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: 0.1, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 100 } }),
      TARGETS,
      'MOUTH',
      dwell,
      blink,
      mouth,
    );
    const backToDwell = processGazeFrameForSelection(frame({ now: BASE + 200 }), TARGETS, 'DWELL', dwell, blink, mouth);

    expect(backToDwell.progress).toBeCloseTo(0, 3);
  });

  it('DWELL에서 BLINK로 변경하면 진행 중이던 dwell 상태가 초기화된다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    processGazeFrameForSelection(frame({ now: BASE }), TARGETS, 'DWELL', dwell, blink, mouth);
    processGazeFrameForSelection(frame({ now: BASE + 600 }), TARGETS, 'DWELL', dwell, blink, mouth);
    processGazeFrameForSelection(frame({ now: BASE + 700 }), TARGETS, 'BLINK', dwell, blink, mouth);

    const backToDwell = processGazeFrameForSelection(
      frame({ now: BASE + 800 }),
      TARGETS,
      'DWELL',
      dwell,
      blink,
      mouth,
    );
    expect(backToDwell.progress).toBe(0);
  });

  it('BLINK 모드에서는 dwell 시간이 지나도 선택되지 않고 의도적 blink 완결 시 한 번만 선택된다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    const opened = (now: number) =>
      frame({
        now,
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: 0.1, irisConfidence: 0.9, eyeClosed: false, timestamp: now },
      });
    const closed = (now: number) =>
      frame({
        now,
        cursorCssPx: null,
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.1, mar: 0.1, irisConfidence: 0.9, eyeClosed: true, timestamp: now },
      });

    processGazeFrameForSelection(opened(BASE), TARGETS, 'BLINK', dwell, blink, mouth);
    const afterDwellTime = processGazeFrameForSelection(
      opened(BASE + 1200),
      TARGETS,
      'BLINK',
      dwell,
      blink,
      mouth,
    );
    expect(afterDwellTime.selectedKeyId).toBeNull();
    expect(afterDwellTime.progress).toBe(0);

    processGazeFrameForSelection(closed(BASE + 1210), [], 'BLINK', dwell, blink, mouth);
    const stillClosed = processGazeFrameForSelection(
      closed(BASE + 1510),
      [],
      'BLINK',
      dwell,
      blink,
      mouth,
    );
    expect(stillClosed.selectedKeyId).toBeNull();

    const selected = processGazeFrameForSelection(
      opened(BASE + 1510),
      TARGETS,
      'BLINK',
      dwell,
      blink,
      mouth,
    );
    expect(selected.selectedKeyId).toBe('A');

    const nextFrame = processGazeFrameForSelection(
      opened(BASE + 1520),
      TARGETS,
      'BLINK',
      dwell,
      blink,
      mouth,
    );
    expect(nextFrame.selectedKeyId).toBeNull();
  });

  it('눈꺼풀 전이 구간(감김 판정 전 좌표만 무효인 프레임)이 진행 중 blink를 폐기하지 않는다', () => {
    // 실제 카메라 프레임 순서를 그대로 재현한다. EAR이 open(0.22)과 close(0.18) 사이에
    // 있는 동안에는 eyeClosed가 아직 false지만 iris confidence가 0이라 cursorCssPx는
    // null이다 — 이 구간에서 gesture를 폐기하면 모든 깜빡임이 무효가 된다.
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    const run = (f: GazeFrame) =>
      processGazeFrameForSelection(f, TARGETS, 'BLINK', dwell, blink, mouth);

    const open = (now: number) =>
      frame({
        now,
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: 0.1, irisConfidence: 0.9, eyeClosed: false, timestamp: now },
      });
    // 눈꺼풀이 내려오는/올라가는 중 — 아직 eyeClosed는 아니지만 좌표는 이미 무효.
    const transition = (now: number) =>
      frame({
        now,
        cursorCssPx: null,
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.2, mar: 0.1, irisConfidence: 0, eyeClosed: false, timestamp: now },
      });
    const closed = (now: number) =>
      frame({
        now,
        cursorCssPx: null,
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.1, mar: 0.1, irisConfidence: 0, eyeClosed: true, timestamp: now },
      });

    // 0.25초 응시로 잠근다.
    run(open(BASE));
    run(open(BASE + 250));

    // 눈을 감는다 — 전이 프레임을 지나 완전히 감김.
    run(transition(BASE + 270));
    run(closed(BASE + 290));
    run(closed(BASE + 500));

    // 눈을 뜬다 — 다시 전이 구간을 거쳐 완전히 열림.
    run(transition(BASE + 610));
    const selected = run(open(BASE + 630));

    expect(selected.selectedKeyId).toBe('A');
  });

  it('BLINK 모드에서 얼굴 신호가 끊기거나 잠근 target이 사라지면 진행 중 gesture를 확정하지 않는다', () => {
    const runInvalidCase = (invalidFrame: GazeFrame, targets = TARGETS) => {
      const dwell = new DwellController();
      const blink = new BlinkController();
      const mouth = new MouthController();

      // 0.25초 응시로 잠금을 성립시켜 둔다 — 그래야 아래 무효 케이스가 "잠긴 gesture를
      // 확정하지 않는다"를 실제로 검증한다.
      processGazeFrameForSelection(frame({ now: BASE }), TARGETS, 'BLINK', dwell, blink, mouth);
      processGazeFrameForSelection(frame({ now: BASE + 250 }), TARGETS, 'BLINK', dwell, blink, mouth);
      processGazeFrameForSelection(
        frame({
          now: BASE + 260,
          cursorCssPx: null,
          signal: { irisX: 0.5, irisY: 0.5, ear: 0.1, mar: 0.1, irisConfidence: 0.9, eyeClosed: true, timestamp: BASE + 260 },
        }),
        [],
        'BLINK',
        dwell,
        blink,
        mouth,
      );

      return processGazeFrameForSelection(invalidFrame, targets, 'BLINK', dwell, blink, mouth);
    };

    expect(
      runInvalidCase(frame({ now: BASE + 570, hasSignal: false, signal: null, cursorCssPx: null }))
        .selectedKeyId,
    ).toBeNull();
    // 좌표만 무효한 프레임(저신뢰도/눈꺼풀 전이)은 폐기 사유가 아니다 — 잠근 키를 그대로
    // 확정한다. 눈을 뜬 직후 좌표는 원래 신뢰할 수 없기 때문이다.
    expect(
      runInvalidCase(
        frame({
          now: BASE + 570,
          cursorCssPx: null,
          signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: 0.1, irisConfidence: 0.1, eyeClosed: false, timestamp: BASE + 570 },
        }),
      ).selectedKeyId,
    ).toBe('A');
    // 잠근 키가 사라진 경우 — MOUTH와 같은 target 유효성 검증이 선택을 막는다.
    expect(runInvalidCase(frame({ now: BASE + 570 }), []).selectedKeyId).toBeNull();
  });

  it('MOUTH 모드에서는 dwell 시간과 진행 UI가 선택을 만들지 않고 무효 시선/target도 선택하지 않는다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    const afterDwellTime = processGazeFrameForSelection(
      frame({ now: BASE + 1200 }),
      TARGETS,
      'MOUTH',
      dwell,
      blink,
      mouth,
    );
    expect(afterDwellTime.selectedKeyId).toBeNull();
    expect(afterDwellTime.progress).toBe(0);

    processGazeFrameForSelection(frame({ now: BASE + 1300 }), TARGETS, 'MOUTH', dwell, blink, mouth);
    processGazeFrameForSelection(frame({ now: BASE + 1550 }), TARGETS, 'MOUTH', dwell, blink, mouth);
    processGazeFrameForSelection(
      frame({
        now: BASE + 1600,
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: 0.4, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 1600 },
      }),
      TARGETS,
      'MOUTH',
      dwell,
      blink,
      mouth,
    );
    const missingTarget = processGazeFrameForSelection(
      frame({
        now: BASE + 1900,
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: 0.4, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE + 1900 },
      }),
      [],
      'MOUTH',
      dwell,
      blink,
      mouth,
    );
    expect(missingTarget.selectedKeyId).toBeNull();

    const invalidGaze = processGazeFrameForSelection(
      frame({ now: BASE + 2000, cursorCssPx: null }),
      TARGETS,
      'MOUTH',
      dwell,
      blink,
      mouth,
    );
    expect(invalidGaze).toEqual({ hoveredKeyId: null, progress: 0, selectedKeyId: null });
  });

  it('BLINK와 MOUTH 사이를 전환하면 이전 gesture 상태가 남지 않는다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    processGazeFrameForSelection(frame({ now: BASE }), TARGETS, 'BLINK', dwell, blink, mouth);
    processGazeFrameForSelection(
      frame({
        now: BASE + 10,
        cursorCssPx: null,
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.1, mar: 0.1, irisConfidence: 0.9, eyeClosed: true, timestamp: BASE + 10 },
      }),
      [],
      'BLINK',
      dwell,
      blink,
      mouth,
    );

    processGazeFrameForSelection(frame({ now: BASE + 100 }), TARGETS, 'MOUTH', dwell, blink, mouth);
    const staleBlink = processGazeFrameForSelection(
      frame({ now: BASE + 400 }),
      TARGETS,
      'BLINK',
      dwell,
      blink,
      mouth,
    );

    expect(staleBlink.selectedKeyId).toBeNull();
  });
});
