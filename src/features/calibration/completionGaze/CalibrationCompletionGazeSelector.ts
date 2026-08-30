import { hitTestTargets, toSyntheticSelectionTargets } from '../../gazeInteraction/targetHitTest';
import type { GazeTargetEntry } from '../../gazeInteraction/types';
import { DwellController } from '../../multimodalInput/DwellController';
import type {
  CalibrationCompletionGazeFrame,
  CalibrationCompletionGazeTarget,
} from './types';

export interface CalibrationCompletionSelection {
  hoveredTarget: CalibrationCompletionGazeTarget | null;
  progress: number;
  selectedTarget: CalibrationCompletionGazeTarget | null;
}

const IDLE_SELECTION: CalibrationCompletionSelection = {
  hoveredTarget: null,
  progress: 0,
  selectedTarget: null,
};

function toTargetEntry(target: CalibrationCompletionGazeTarget): GazeTargetEntry {
  return {
    id: target.id,
    scope: 'MODAL',
    element: target.element as HTMLElement,
    enabledRef: { current: target.enabled },
    onSelectRef: { current: target.onSelect },
  };
}

/**
 * 캘리브레이션 route 전용의 작은 adapter다. 기존 DOM rect hit-test와 DwellController를
 * 재사용하되 완료 화면이 전역 GazeInteractionProvider 밖에 있다는 이유로 생기는 공백만 메운다.
 */
export class CalibrationCompletionGazeSelector {
  private readonly dwellController = new DwellController();
  private selectedLockId: string | null = null;

  reset(): void {
    this.dwellController.reset();
    this.selectedLockId = null;
  }

  update(
    frame: CalibrationCompletionGazeFrame,
    targets: ReadonlyArray<CalibrationCompletionGazeTarget>,
  ): CalibrationCompletionSelection {
    if (!frame.hasSignal || !frame.cursorCssPx) {
      this.reset();
      return IDLE_SELECTION;
    }

    const eligibleTargets = targets.filter(
      (target): target is CalibrationCompletionGazeTarget & { element: HTMLElement } =>
        target.enabled && target.element !== null,
    );
    const entries = eligibleTargets.map(toTargetEntry);
    const hit = hitTestTargets(frame.cursorCssPx, entries);
    const hitTarget = hit
      ? eligibleTargets.find((target) => target.id === hit.id) ?? null
      : null;

    if (this.selectedLockId) {
      if (hitTarget?.id === this.selectedLockId) {
        return {
          hoveredTarget: hitTarget,
          progress: 1,
          selectedTarget: null,
        };
      }

      this.selectedLockId = null;
      this.dwellController.reset();
    }

    const selection = this.dwellController.update(
      frame.cursorCssPx.x,
      frame.cursorCssPx.y,
      toSyntheticSelectionTargets(hit, frame.cursorCssPx),
      frame.now,
    );
    const selectedTarget = selection.selectedKeyId
      ? eligibleTargets.find((target) => target.id === selection.selectedKeyId) ?? null
      : null;

    if (selectedTarget) {
      this.selectedLockId = selectedTarget.id;
    }

    return {
      hoveredTarget: hitTarget,
      progress: selection.progress,
      selectedTarget,
    };
  }
}
