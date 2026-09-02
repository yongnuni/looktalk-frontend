import { describe, expect, it } from 'vitest';
import type { GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import { BlinkController } from '../multimodalInput/BlinkController';
import { DwellController } from '../multimodalInput/DwellController';
import { processGazeFrameForSelection } from '../multimodalInput/gazeFrameSelection';
import { MouthController } from '../multimodalInput/MouthController';
import { filterEligibleTargets, hitTestTargets, toSyntheticSelectionTargets } from './targetHitTest';
import { createTargetRegistry } from './targetRegistry';
import type { GazeTargetEntry } from './types';

/**
 * Front Step 12 — GazeInteractionProvider의 매 프레임 처리(hit-test → synthetic target →
 * processGazeFrameForSelection, Front Step 11 그대로 재사용)를 React 없이 재현해
 * end-to-end로 검증한다. 실제 webcam/DOM은 쓰지 않는다.
 */
const BASE = 10_000;

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

function frame(overrides: Partial<GazeFrame> = {}): GazeFrame {
  return {
    hasSignal: true,
    signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: 0.1, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE },
    cursorCssPx: { x: 250, y: 250 },
    fixationCount: 0,
    now: BASE,
    ...overrides,
  };
}

/** Provider의 handleFrame과 동일한 순서로 한 프레임을 처리한다(테스트 helper). */
function processFrame(
  registryEntries: GazeTargetEntry[],
  gazeFrame: GazeFrame,
  dwell: DwellController,
  blink: BlinkController,
  mouth: MouthController,
) {
  const eligible = filterEligibleTargets(registryEntries, 'MAIN');
  const hit =
    gazeFrame.hasSignal && gazeFrame.cursorCssPx && eligible.length > 0
      ? hitTestTargets(gazeFrame.cursorCssPx, eligible)
      : null;
  const synthetic = toSyntheticSelectionTargets(hit, gazeFrame.cursorCssPx);
  return processGazeFrameForSelection(gazeFrame, synthetic, 'DWELL', dwell, blink, mouth);
}

const CARD = fakeTarget('main-memo', { left: 100, top: 100, right: 400, bottom: 400 });

describe('GazeInteractionProvider 프레임 처리 (registry + hit-test + Step 11 selection 재사용)', () => {
  it('10. DWELL — 큰 target 위에서 threshold(1.2초) 경과 후 정확히 한 번 select된다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    processFrame([CARD], frame({ now: BASE }), dwell, blink, mouth);
    const beforeThreshold = processFrame([CARD], frame({ now: BASE + 1199 }), dwell, blink, mouth);
    expect(beforeThreshold.selectedKeyId).toBeNull();

    const atThreshold = processFrame([CARD], frame({ now: BASE + 1200 }), dwell, blink, mouth);
    expect(atThreshold.selectedKeyId).toBe('main-memo');

    // cooldown 중이라 곧바로 같은 위치를 봐도 재선택되지 않는다(더블 액션 방지, §36).
    const rightAfter = processFrame([CARD], frame({ now: BASE + 1210 }), dwell, blink, mouth);
    expect(rightAfter.selectedKeyId).toBeNull();
  });

  it('9. target 이탈 — dwell 진행 중 커서가 rect 밖으로 나가면 progress가 리셋된다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    processFrame([CARD], frame({ now: BASE, cursorCssPx: { x: 250, y: 250 } }), dwell, blink, mouth);
    const midway = processFrame([CARD], frame({ now: BASE + 600, cursorCssPx: { x: 250, y: 250 } }), dwell, blink, mouth);
    expect(midway.progress).toBeGreaterThan(0);

    // rect 밖으로 이탈
    const left = processFrame([CARD], frame({ now: BASE + 650, cursorCssPx: { x: 900, y: 900 } }), dwell, blink, mouth);
    expect(left.hoveredKeyId).toBeNull();
    expect(left.progress).toBe(0);
  });

  it('8. tracking invalid(hasSignal=false)면 selection이 발생하지 않고 controller가 리셋된다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    processFrame([CARD], frame({ now: BASE }), dwell, blink, mouth);
    processFrame([CARD], frame({ now: BASE + 600 }), dwell, blink, mouth);

    const invalid = processFrame(
      [CARD],
      frame({ now: BASE + 700, hasSignal: false, cursorCssPx: null, signal: null }),
      dwell,
      blink,
      mouth,
    );
    expect(invalid).toEqual({ hoveredKeyId: null, progress: 0, selectedKeyId: null });

    // 리셋되었으므로 다시 봐도 처음부터 다시 쌓여야 한다.
    processFrame([CARD], frame({ now: BASE + 800 }), dwell, blink, mouth);
    const resumed = processFrame([CARD], frame({ now: BASE + 900 }), dwell, blink, mouth);
    expect(resumed.progress).toBeCloseTo(100 / 1200, 3);
  });

  it('11. MOUTH — 기존 MouthController 계약(gaze-lock + 입벌림 hold)대로 큰 target도 select된다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();
    const CLOSED_MAR = 0.1;
    const OPEN_MAR = 0.4;

    const closedFrame = (now: number) =>
      frame({
        now,
        cursorCssPx: { x: 250, y: 250 },
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: CLOSED_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: now },
      });
    const openFrame = (now: number) =>
      frame({
        now,
        cursorCssPx: { x: 250, y: 250 },
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.3, mar: OPEN_MAR, irisConfidence: 0.9, eyeClosed: false, timestamp: now },
      });

    const eligible = filterEligibleTargets([CARD], 'MAIN');

    function runMouth(gazeFrame: GazeFrame) {
      const hit =
        gazeFrame.hasSignal && gazeFrame.cursorCssPx ? hitTestTargets(gazeFrame.cursorCssPx, eligible) : null;
      const synthetic = toSyntheticSelectionTargets(hit, gazeFrame.cursorCssPx);
      return processGazeFrameForSelection(gazeFrame, synthetic, 'MOUTH', dwell, blink, mouth);
    }

    runMouth(closedFrame(BASE));
    runMouth(closedFrame(BASE + 250)); // 0.25초 응시 → 잠금
    runMouth(openFrame(BASE + 300)); // 입벌림 시작
    const result = runMouth(openFrame(BASE + 600)); // 0.3초 유지 → 선택

    expect(result.selectedKeyId).toBe('main-memo');
  });

  it('BLINK — 큰 target을 보다가 의도적으로 깜빡이면 공통 registry action을 한 번 선택한다', () => {
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();
    const eligible = filterEligibleTargets([CARD], 'MAIN');

    const runBlink = (gazeFrame: GazeFrame) => {
      const hit =
        gazeFrame.hasSignal && gazeFrame.cursorCssPx ? hitTestTargets(gazeFrame.cursorCssPx, eligible) : null;
      const synthetic = toSyntheticSelectionTargets(hit, gazeFrame.cursorCssPx);
      return processGazeFrameForSelection(gazeFrame, synthetic, 'BLINK', dwell, blink, mouth);
    };

    // mouth와 같은 0.25초 응시로 target을 먼저 잠근다.
    runBlink(frame({ now: BASE }));
    runBlink(frame({ now: BASE + 250 }));
    runBlink(
      frame({
        now: BASE + 260,
        cursorCssPx: null,
        signal: { irisX: 0.5, irisY: 0.5, ear: 0.1, mar: 0.1, irisConfidence: 0.9, eyeClosed: true, timestamp: BASE + 260 },
      }),
    );
    expect(
      runBlink(
        frame({
          now: BASE + 500,
          cursorCssPx: null,
          signal: { irisX: 0.5, irisY: 0.5, ear: 0.1, mar: 0.1, irisConfidence: 0.9, eyeClosed: true, timestamp: BASE + 500 },
        }),
      ).selectedKeyId,
    ).toBeNull();

    const result = runBlink(frame({ now: BASE + 570 }));
    expect(result.selectedKeyId).toBe('main-memo');
    expect(result.progress).toBe(0);
  });

  it('15. registry가 비면(예: route 이동으로 페이지 target이 전부 unregister) 이전 dwell 진행이 남지 않고 즉시 idle이 된다', () => {
    const registry = createTargetRegistry();
    registry.register(CARD);
    const dwell = new DwellController();
    const blink = new BlinkController();
    const mouth = new MouthController();

    processFrame(registry.values(), frame({ now: BASE }), dwell, blink, mouth);
    const midway = processFrame(registry.values(), frame({ now: BASE + 600 }), dwell, blink, mouth);
    expect(midway.progress).toBeGreaterThan(0);

    // MainPage unmount 시뮬레이션 — 모든 target unregister.
    registry.unregister('main-memo');

    const afterUnregister = processFrame(registry.values(), frame({ now: BASE + 650 }), dwell, blink, mouth);
    expect(afterUnregister).toEqual({ hoveredKeyId: null, progress: 0, selectedKeyId: null });
  });
});
