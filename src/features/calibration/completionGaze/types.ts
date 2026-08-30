export interface CalibrationCompletionGazeFrame {
  now: number;
  hasSignal: boolean;
  cursorCssPx: { x: number; y: number } | null;
}

export type CalibrationCompletionGazeListener = (
  frame: CalibrationCompletionGazeFrame,
) => void;

export type SubscribeCalibrationCompletionGaze = (
  listener: CalibrationCompletionGazeListener,
) => () => void;

export interface CalibrationCompletionGazeTarget {
  id: string;
  element: HTMLElement | null;
  enabled: boolean;
  onSelect: () => void;
}
