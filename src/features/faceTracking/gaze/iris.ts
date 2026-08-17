import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Look-Talk 원본: src/tracking/eye_tracking.py get_avg_iris() (60-99행)
 *
 * 좌/우 홍채 각각 5점(중심 + 링 4점)을 단순 평균한 뒤, 좌/우 평균을 다시 평균낸다.
 * 좌/우를 개별 값으로 유지하지 않고 여기서 하나의 스칼라 쌍으로 합쳐진다 — Python과 동일.
 */
export const LEFT_IRIS_LANDMARK_INDICES = [468, 469, 470, 471, 472] as const;
export const RIGHT_IRIS_LANDMARK_INDICES = [473, 474, 475, 476, 477] as const;

export interface IrisPoint {
  x: number;
  y: number;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeAvgIris(landmarks: NormalizedLandmark[]): IrisPoint {
  const leftX = mean(LEFT_IRIS_LANDMARK_INDICES.map((index) => landmarks[index].x));
  const leftY = mean(LEFT_IRIS_LANDMARK_INDICES.map((index) => landmarks[index].y));
  const rightX = mean(RIGHT_IRIS_LANDMARK_INDICES.map((index) => landmarks[index].x));
  const rightY = mean(RIGHT_IRIS_LANDMARK_INDICES.map((index) => landmarks[index].y));

  return {
    x: (leftX + rightX) / 2,
    y: (leftY + rightY) / 2,
  };
}
