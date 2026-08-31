export {
  FixationDetector,
  IDLE_FIXATION_STATE,
  isValidGaze,
  type FixationDetectorOptions,
  type FixationState,
} from './FixationDetector';
export { FixationHitbox, type FixationHitboxOptions } from './FixationHitbox';
export { KeyboardFixationLayer, type GazeHitResolver } from './KeyboardFixationLayer';
export {
  boundsCenter,
  boundsContain,
  boundsHeight,
  boundsWidth,
  easeOut,
  expandedBounds,
  lerpBounds,
  type Bounds,
  type FixationTarget,
} from './fixationGeometry';
