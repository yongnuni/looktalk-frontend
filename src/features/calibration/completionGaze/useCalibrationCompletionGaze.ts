import { useEffect, useRef } from 'react';
import { CalibrationCompletionGazeSelector } from './CalibrationCompletionGazeSelector';
import type {
  CalibrationCompletionGazeTarget,
  SubscribeCalibrationCompletionGaze,
} from './types';

interface UseCalibrationCompletionGazeOptions {
  active: boolean;
  subscribe: SubscribeCalibrationCompletionGaze;
  getTargets: () => ReadonlyArray<CalibrationCompletionGazeTarget>;
}

export function useCalibrationCompletionGaze({
  active,
  subscribe,
  getTargets,
}: UseCalibrationCompletionGazeOptions): void {
  const selectorRef = useRef(new CalibrationCompletionGazeSelector());
  const getTargetsRef = useRef(getTargets);
  const hoveredElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    getTargetsRef.current = getTargets;
  }, [getTargets]);

  useEffect(() => {
    const selector = selectorRef.current;
    const clearHoverVisual = () => {
      const previous = hoveredElementRef.current;
      previous?.removeAttribute('data-gaze-hovered');
      previous?.style.removeProperty('--gaze-progress');
      hoveredElementRef.current = null;
    };

    if (!active) {
      selector.reset();
      clearHoverVisual();
      return;
    }

    const unsubscribe = subscribe((frame) => {
      const selection = selector.update(frame, getTargetsRef.current());
      const nextElement = selection.hoveredTarget?.element ?? null;
      const previous = hoveredElementRef.current;

      if (previous && previous !== nextElement) {
        previous.removeAttribute('data-gaze-hovered');
        previous.style.removeProperty('--gaze-progress');
      }

      if (nextElement) {
        nextElement.setAttribute('data-gaze-hovered', 'true');
        nextElement.style.setProperty('--gaze-progress', String(selection.progress));
      }

      hoveredElementRef.current = nextElement;
      selection.selectedTarget?.onSelect();
    });

    return () => {
      unsubscribe();
      selector.reset();
      clearHoverVisual();
    };
  }, [active, subscribe]);
}
