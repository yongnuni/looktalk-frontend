import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Look-Talk 원본: src/tracking/mouth.py distance()/mouth_aspect_ratio() (28-64행)
 *
 * MAR = 상순-하순 유클리드 거리 / 좌우 구각 유클리드 거리 (mouth_width가 1e-6 미만이면 0)
 */
export const MAR_LANDMARK_INDICES = {
  upperLip: 13,
  lowerLip: 14,
  leftMouth: 78,
  rightMouth: 308,
} as const;

function euclideanDistance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function computeMouthAspectRatio(landmarks: NormalizedLandmark[]): number {
  const { upperLip, lowerLip, leftMouth, rightMouth } = MAR_LANDMARK_INDICES;

  const mouthHeight = euclideanDistance(landmarks[upperLip], landmarks[lowerLip]);
  const mouthWidth = euclideanDistance(landmarks[leftMouth], landmarks[rightMouth]);

  if (mouthWidth < 1e-6) {
    return 0.0;
  }

  return mouthHeight / mouthWidth;
}
