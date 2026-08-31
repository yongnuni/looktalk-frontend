import type { GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import type { BlinkController } from './BlinkController';
import type { DwellController } from './DwellController';
import type { GazeInputMode } from './gazeInputMode';
import type { MouthController } from './MouthController';
import type { InputSelectionState, KeyTarget } from './types';

export const IDLE_SELECTION: InputSelectionState = { hoveredKeyId: null, progress: 0, selectedKeyId: null };

/**
 * Global Gaze Runtime이 흘려주는 한 프레임(GazeFrame)을 Dwell/Blink/Mouth
 * controller에 적용해 선택 상태를 계산하는 순수 판정 로직. `GazeInteractionFrameProvider`의
 * 구독 배선에서 분리해 React 없이 deterministic하게 테스트한다.
 *
 * Look-Talk main.py 1287-1341행과 동일한 분기를 유지한다: 신호가 없으면(hasSignal=false)
 * update()를 호출하지 않고 명시적으로 reset()만 한다 — DwellController.update(-1,-1,...)로
 * 대체하지 않는 이유는 MouthController가 gazeX<0을 자체적으로 완전히 리셋하지 않기
 * 때문이다(hover만 무효화되고 mouth open/close 상태 머신은 별개로 남는다).
 */
export function processGazeFrameForSelection(
  frame: GazeFrame,
  targets: KeyTarget[],
  inputMode: GazeInputMode,
  dwellController: DwellController,
  blinkController: BlinkController,
  mouthController: MouthController,
  availableTargetIds?: ReadonlySet<string>,
): InputSelectionState {
  if (!frame.hasSignal) {
    dwellController.reset();
    blinkController.reset();
    mouthController.reset();
    return IDLE_SELECTION;
  }

  const gazeX = frame.cursorCssPx?.x ?? -1;
  const gazeY = frame.cursorCssPx?.y ?? -1;

  if (inputMode === 'BLINK') {
    const signal = frame.signal;

    // 눈을 감아 cursor가 사라진 프레임은 blink 상태 머신에 필요하다. 그 외 원인으로
    // 좌표가 무효이거나 얼굴 신호가 없으면 현재 gesture를 폐기한다.
    if (!signal || (frame.cursorCssPx === null && !signal.eyeClosed)) {
      dwellController.reset();
      blinkController.reset();
      mouthController.reset();
      return IDLE_SELECTION;
    }

    const blinkState = blinkController.update(gazeX, gazeY, targets, signal.ear, frame.now);
    dwellController.reset();
    mouthController.reset();

    return {
      hoveredKeyId: blinkState.lockedKeyId ?? blinkState.hoveredKeyId,
      progress: 0,
      selectedKeyId: blinkState.selectedKeyId,
    };
  }

  if (inputMode === 'MOUTH') {
    if (frame.cursorCssPx === null || !frame.signal) {
      dwellController.reset();
      blinkController.reset();
      mouthController.reset();
      return IDLE_SELECTION;
    }

    const mar = frame.signal?.mar ?? 0;
    const mouthState = mouthController.update(gazeX, gazeY, targets, mar, frame.now);
    dwellController.reset();
    blinkController.reset();

    const selectedKeyId = mouthState.selectedKeyId;
    const selectedTargetIsAvailable =
      selectedKeyId !== null &&
      (availableTargetIds?.has(selectedKeyId) ?? targets.some((target) => target.id === selectedKeyId));

    return {
      hoveredKeyId: mouthState.lockedKeyId ?? mouthState.hoveredKeyId,
      progress: 0,
      selectedKeyId: selectedTargetIsAvailable ? selectedKeyId : null,
      // 실제 MouthController 판정 결과를 그대로 위로 전달한다(§realtimeMetrics) —
      // 팝업이 mar>=threshold 같은 별도 판정을 새로 만들지 않도록 하기 위함.
      mouthOpen: mouthState.isOpen,
    };
  }

  const dwellState = dwellController.update(gazeX, gazeY, targets, frame.now);
  blinkController.reset();
  mouthController.reset();
  return dwellState;
}
