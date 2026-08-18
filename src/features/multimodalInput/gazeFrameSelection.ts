import type { GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import type { DwellController } from './DwellController';
import type { GazeInputMode } from './gazeInputMode';
import type { MouthController } from './MouthController';
import type { InputSelectionState, KeyTarget } from './types';

export const IDLE_SELECTION: InputSelectionState = { hoveredKeyId: null, progress: 0, selectedKeyId: null };

/**
 * Front Step 11 — Global Gaze Runtime이 흘려주는 한 프레임(GazeFrame)을 Dwell/Mouth
 * controller에 적용해 선택 상태를 계산하는 순수 판정 로직. `useGazeSelection`의 RAF/구독
 * 배선에서 분리해 React 없이 deterministic하게 테스트한다.
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
  mouthController: MouthController,
): InputSelectionState {
  if (!frame.hasSignal) {
    dwellController.reset();
    mouthController.reset();
    return IDLE_SELECTION;
  }

  const gazeX = frame.cursorCssPx?.x ?? -1;
  const gazeY = frame.cursorCssPx?.y ?? -1;

  if (inputMode === 'MOUTH') {
    const mar = frame.signal?.mar ?? 0;
    const mouthState = mouthController.update(gazeX, gazeY, targets, mar, frame.now);
    dwellController.reset();

    return {
      hoveredKeyId: mouthState.lockedKeyId ?? mouthState.hoveredKeyId,
      progress: mouthState.progress,
      selectedKeyId: mouthState.selectedKeyId,
    };
  }

  const dwellState = dwellController.update(gazeX, gazeY, targets, frame.now);
  mouthController.reset();
  return dwellState;
}
