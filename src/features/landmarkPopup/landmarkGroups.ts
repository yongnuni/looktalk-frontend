import { FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  LEFT_IRIS_LANDMARK_INDICES,
  RIGHT_IRIS_LANDMARK_INDICES,
} from '../faceTracking/gaze/iris';
import { MAR_LANDMARK_INDICES } from '../faceTracking/gaze/mar';

export interface LandmarkConnection {
  start: number;
  end: number;
}

/** MediaPipe가 공식적으로 공개하는 얼굴 주요 윤곽 연결만 사용한다. */
export const FULL_FACE_CONTOUR_CONNECTIONS: ReadonlyArray<LandmarkConnection> =
  FaceLandmarker.FACE_LANDMARKS_CONTOURS;

/** 핵심 모드의 눈 윤곽 역시 MediaPipe 공식 좌/우 눈 연결을 그대로 사용한다. */
export const LOOKTALK_LEFT_EYE_CONNECTIONS: ReadonlyArray<LandmarkConnection> =
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYE;
export const LOOKTALK_RIGHT_EYE_CONNECTIONS: ReadonlyArray<LandmarkConnection> =
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE;

export function collectConnectionIndices(
  connections: ReadonlyArray<LandmarkConnection>,
): number[] {
  const indices = new Set<number>();

  for (const { start, end } of connections) {
    if (Number.isInteger(start) && start >= 0) {
      indices.add(start);
    }
    if (Number.isInteger(end) && end >= 0) {
      indices.add(end);
    }
  }

  return [...indices];
}

export const FULL_FACE_CONTOUR_INDICES = collectConnectionIndices(
  FULL_FACE_CONTOUR_CONNECTIONS,
);

export const LOOKTALK_EYE_INDICES = collectConnectionIndices([
  ...LOOKTALK_LEFT_EYE_CONNECTIONS,
  ...LOOKTALK_RIGHT_EYE_CONNECTIONS,
]);

/** 실제 iris 계산 코드가 export하는 좌/우 인덱스를 중심점 평균에 재사용한다. */
export const LOOKTALK_IRIS_INDEX_GROUPS = [
  LEFT_IRIS_LANDMARK_INDICES,
  RIGHT_IRIS_LANDMARK_INDICES,
] as const;

/** 실제 MAR 계산에 쓰이는 네 점만 표시한다. */
export const LOOKTALK_MOUTH_INDICES = [...new Set(Object.values(MAR_LANDMARK_INDICES))];
