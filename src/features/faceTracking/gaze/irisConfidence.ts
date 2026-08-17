import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { computeAverageEar } from './ear';

/**
 * Look-Talk 원본: src/tracking/eye_tracking.py iris_confidence() (104-172행)
 *
 * LEFT_IRIS/RIGHT_IRIS는 iris.ts의 5점 평균과 다른, 홍채 중심 단일 landmark다
 * (eye_tracking.py:11-12). center_score()는 Python 원본에서도 top_idx/bottom_idx를
 * 인자로 받지만 실제로는 쓰지 않는 죽은 매개변수라 여기서는 아예 시그니처에서 뺐다
 * (계산값은 동일, noUnusedParameters 위반만 피함).
 */
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;

const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_OUTER = 263;
const RIGHT_EYE_INNER = 362;

function centerScore(landmarks: NormalizedLandmark[], irisX: number, outerIdx: number, innerIdx: number): number {
  const centerX = (landmarks[outerIdx].x + landmarks[innerIdx].x) / 2;
  const eyeWidth = Math.abs(landmarks[outerIdx].x - landmarks[innerIdx].x);

  return Math.max(0, 1 - Math.abs(irisX - centerX) / (eyeWidth / 2 + 1e-6));
}

export function computeIrisConfidence(landmarks: NormalizedLandmark[], closedThreshold = 0.18): number {
  const avgEar = computeAverageEar(landmarks);

  if (avgEar < closedThreshold) {
    return 0;
  }

  const leftIrisX = landmarks[LEFT_IRIS_CENTER].x;
  const rightIrisX = landmarks[RIGHT_IRIS_CENTER].x;

  const leftScore = centerScore(landmarks, leftIrisX, LEFT_EYE_OUTER, LEFT_EYE_INNER);
  const rightScore = centerScore(landmarks, rightIrisX, RIGHT_EYE_OUTER, RIGHT_EYE_INNER);

  const score = (avgEar * 3 * (leftScore + rightScore)) / 2;

  return Math.min(1, score);
}
