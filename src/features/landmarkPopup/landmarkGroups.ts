import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { MAR_LANDMARK_INDICES } from '../faceTracking/gaze/mar';

export interface LandmarkConnection {
  start: number;
  end: number;
}

/** MediaPipe가 공식적으로 공개하는 얼굴 주요 윤곽 연결만 사용한다. */
export const FULL_FACE_CONTOUR_CONNECTIONS: ReadonlyArray<LandmarkConnection> =
  FaceLandmarker.FACE_LANDMARKS_CONTOURS;

/** Python src/tracking/eye_tracking.py의 draw_eye_contour() 입력 순서를 그대로 쓴다. */
export const LOOKTALK_LEFT_EYE_INDICES = [
  33, 133, 159, 145, 160, 161, 246,
] as const;
export const LOOKTALK_RIGHT_EYE_INDICES = [
  362, 263, 386, 374, 385, 384, 466,
] as const;

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

/** Python은 각 홍채 중심점과 링 4점으로 반지름을 계산한다. */
export const LOOKTALK_IRIS_INDEX_GROUPS = [
  { center: 468, ring: [469, 470, 471, 472] },
  { center: 473, ring: [474, 475, 476, 477] },
] as const;

/** Python draw_mouth()가 표시하며 MAR 계산에도 쓰는 네 점. */
export const LOOKTALK_MOUTH_INDICES = [...new Set(Object.values(MAR_LANDMARK_INDICES))];
export const LOOKTALK_MOUTH_VERTICAL_CONNECTION: LandmarkConnection = {
  start: MAR_LANDMARK_INDICES.upperLip,
  end: MAR_LANDMARK_INDICES.lowerLip,
};
