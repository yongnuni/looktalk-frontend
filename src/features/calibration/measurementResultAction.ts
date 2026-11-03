import type { InputMethod } from '../../shared/types/backend';

export type MeasurementResultAction =
  | { type: 'view-analysis' }
  | { type: 'apply-method'; method: InputMethod };

interface Dependencies {
  saveCalibration: () => Promise<void>;
  applyInputMethod: (method: InputMethod) => Promise<unknown>;
  onApplied: (method: InputMethod) => void;
  onViewAnalysis: () => void;
}

/** Both actions persist the result, but only an explicit method choice updates settings. */
export async function completeMeasurementResultAction(
  action: MeasurementResultAction,
  dependencies: Dependencies,
): Promise<void> {
  await dependencies.saveCalibration();
  if (action.type === 'view-analysis') {
    dependencies.onViewAnalysis();
    return;
  }
  await dependencies.applyInputMethod(action.method);
  dependencies.onApplied(action.method);
}
