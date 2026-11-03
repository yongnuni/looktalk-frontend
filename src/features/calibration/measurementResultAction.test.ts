import { describe, expect, it, vi } from 'vitest';
import { completeMeasurementResultAction } from './measurementResultAction';

const dependencies = () => ({
  saveCalibration: vi.fn(async () => {}),
  applyInputMethod: vi.fn(async () => {}),
  onApplied: vi.fn(),
  onViewAnalysis: vi.fn(),
});

describe('measurement result actions', () => {
  it('persists the result and opens the internal dashboard without choosing or saving an input method', async () => {
    const deps = dependencies();
    await completeMeasurementResultAction({ type: 'view-analysis' }, deps);
    expect(deps.saveCalibration).toHaveBeenCalledOnce();
    expect(deps.onViewAnalysis).toHaveBeenCalledOnce();
    expect(deps.applyInputMethod).not.toHaveBeenCalled();
    expect(deps.onApplied).not.toHaveBeenCalled();
  });

  it('waits for the required result save before showing the dashboard', async () => {
    const deps = dependencies();
    let release!: () => void;
    deps.saveCalibration.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    const pending = completeMeasurementResultAction({ type: 'view-analysis' }, deps);
    expect(deps.onViewAnalysis).not.toHaveBeenCalled();
    release();
    await pending;
    expect(deps.onViewAnalysis).toHaveBeenCalledOnce();
  });

  it.each(['EYE_TRACKING', 'BLINK', 'MOUTH'] as const)('preserves explicit %s selection and completion without analysis navigation', async method => {
    const deps = dependencies();
    await completeMeasurementResultAction({ type: 'apply-method', method }, deps);
    expect(deps.saveCalibration).toHaveBeenCalledOnce();
    expect(deps.applyInputMethod).toHaveBeenCalledWith(method);
    expect(deps.onApplied).toHaveBeenCalledWith(method);
    expect(deps.saveCalibration.mock.invocationCallOrder[0]).toBeLessThan(deps.applyInputMethod.mock.invocationCallOrder[0]);
    expect(deps.onViewAnalysis).not.toHaveBeenCalled();
  });

  it('does not show the dashboard or save a method when calibration persistence fails, including auth failures', async () => {
    const deps = dependencies();
    deps.saveCalibration.mockRejectedValue(new Error('401'));
    await expect(completeMeasurementResultAction({ type: 'view-analysis' }, deps)).rejects.toThrow('401');
    expect(deps.onViewAnalysis).not.toHaveBeenCalled();
    expect(deps.applyInputMethod).not.toHaveBeenCalled();
    expect(deps.onApplied).not.toHaveBeenCalled();
  });

  it('does not report completion if the settings PATCH fails', async () => {
    const deps = dependencies();
    deps.applyInputMethod.mockRejectedValue(new Error('settings failed'));
    await expect(completeMeasurementResultAction({ type: 'apply-method', method: 'BLINK' }, deps)).rejects.toThrow('settings failed');
    expect(deps.onApplied).not.toHaveBeenCalled();
    expect(deps.onViewAnalysis).not.toHaveBeenCalled();
  });
});
