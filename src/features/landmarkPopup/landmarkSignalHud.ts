import type { GazeSignal } from '../faceTracking/types';

export const EMPTY_LANDMARK_SIGNAL_HUD = 'EAR --- · MAR ---';

export function formatLandmarkSignalHud(signal: GazeSignal | null): string {
  if (!signal || !Number.isFinite(signal.ear) || !Number.isFinite(signal.mar)) {
    return EMPTY_LANDMARK_SIGNAL_HUD;
  }

  return `EAR ${signal.ear.toFixed(3)} · MAR ${signal.mar.toFixed(3)}`;
}
