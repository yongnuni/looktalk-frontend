import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import {
  LEFT_IRIS_LANDMARK_INDICES,
  RIGHT_IRIS_LANDMARK_INDICES,
} from '../faceTracking/gaze/iris';
import { MAR_LANDMARK_INDICES } from '../faceTracking/gaze/mar';
import {
  FULL_FACE_CONTOUR_CONNECTIONS,
  FULL_FACE_CONTOUR_INDICES,
  LOOKTALK_IRIS_INDEX_GROUPS,
  LOOKTALK_LEFT_EYE_CONNECTIONS,
  LOOKTALK_MOUTH_INDICES,
  LOOKTALK_RIGHT_EYE_CONNECTIONS,
  collectConnectionIndices,
} from './landmarkGroups';

describe('landmark visualization groups', () => {
  it('전체 모드는 MediaPipe 공식 contours의 시작·끝 인덱스 합집합만 사용한다', () => {
    expect(FULL_FACE_CONTOUR_CONNECTIONS).toEqual(
      FaceLandmarker.FACE_LANDMARKS_CONTOURS,
    );
    expect(new Set(FULL_FACE_CONTOUR_INDICES)).toEqual(
      new Set(
        FaceLandmarker.FACE_LANDMARKS_CONTOURS.flatMap(({ start, end }) => [
          start,
          end,
        ]),
      ),
    );
    expect(FULL_FACE_CONTOUR_INDICES).toHaveLength(128);
    expect(FULL_FACE_CONTOUR_CONNECTIONS).not.toEqual(
      FaceLandmarker.FACE_LANDMARKS_TESSELATION,
    );
    expect(FULL_FACE_CONTOUR_INDICES.length).toBeLessThan(
      collectConnectionIndices(FaceLandmarker.FACE_LANDMARKS_TESSELATION).length,
    );
  });

  it('핵심 모드의 눈은 MediaPipe 공식 좌·우 eye contour를 그대로 사용한다', () => {
    expect(LOOKTALK_LEFT_EYE_CONNECTIONS).toEqual(
      FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    );
    expect(LOOKTALK_RIGHT_EYE_CONNECTIONS).toEqual(
      FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    );
  });

  it('홍채 중심과 입 점은 기존 iris 및 MAR 계산 인덱스를 재사용한다', () => {
    expect(LOOKTALK_IRIS_INDEX_GROUPS).toEqual([
      LEFT_IRIS_LANDMARK_INDICES,
      RIGHT_IRIS_LANDMARK_INDICES,
    ]);
    expect(new Set(LOOKTALK_MOUTH_INDICES)).toEqual(
      new Set(Object.values(MAR_LANDMARK_INDICES)),
    );
  });

  it('connection 시작·끝 인덱스를 중복 없이 수집한다', () => {
    expect(
      collectConnectionIndices([
        { start: 1, end: 2 },
        { start: 2, end: 3 },
        { start: 3, end: 1 },
      ]),
    ).toEqual([1, 2, 3]);
  });
});
