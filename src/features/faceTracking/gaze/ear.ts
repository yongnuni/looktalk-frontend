import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Look-Talk 원본: src/tracking/blink.py (14-50행)
 *
 * EAR = |top.y - bottom.y| / |outer.x - inner.x| (eye_width가 1e-3 이하면 0)
 * 좌/우 EAR을 각각 계산해 단순 평균한다.
 */
export const EAR_LANDMARK_INDICES = {
  leftOuter: 33,
  leftInner: 133,
  leftUpper: 159,
  leftLower: 145,
  rightOuter: 263,
  rightInner: 362,
  rightUpper: 386,
  rightLower: 374,
} as const;

function eyeAspectRatio(
  landmarks: NormalizedLandmark[],
  outerIdx: number,
  innerIdx: number,
  topIdx: number,
  bottomIdx: number,
): number {
  const eyeWidth = Math.abs(landmarks[outerIdx].x - landmarks[innerIdx].x);
  const eyeHeight = Math.abs(landmarks[topIdx].y - landmarks[bottomIdx].y);

  if (eyeWidth <= 1e-3) {
    return 0.0;
  }

  return eyeHeight / eyeWidth;
}

export function computeAverageEar(landmarks: NormalizedLandmark[]): number {
  const { leftOuter, leftInner, leftUpper, leftLower, rightOuter, rightInner, rightUpper, rightLower } =
    EAR_LANDMARK_INDICES;

  const left = eyeAspectRatio(landmarks, leftOuter, leftInner, leftUpper, leftLower);
  const right = eyeAspectRatio(landmarks, rightOuter, rightInner, rightUpper, rightLower);

  return (left + right) / 2.0;
}
