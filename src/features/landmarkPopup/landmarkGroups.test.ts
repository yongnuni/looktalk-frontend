import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import {
  MAR_LANDMARK_INDICES,
} from '../faceTracking/gaze/mar';
import {
  FULL_FACE_CONTOUR_CONNECTIONS,
  FULL_FACE_CONTOUR_INDICES,
  LOOKTALK_IRIS_INDEX_GROUPS,
  LOOKTALK_LEFT_EYE_INDICES,
  LOOKTALK_MOUTH_INDICES,
  LOOKTALK_MOUTH_VERTICAL_CONNECTION,
  LOOKTALK_RIGHT_EYE_INDICES,
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

  it('looktalk 눈은 Python draw_eye_contour의 좌·우 7점 순서를 그대로 사용한다', () => {
    expect(LOOKTALK_LEFT_EYE_INDICES).toEqual([
      33, 133, 159, 145, 160, 161, 246,
    ]);
    expect(LOOKTALK_RIGHT_EYE_INDICES).toEqual([
      362, 263, 386, 374, 385, 384, 466,
    ]);
  });

  it('Python과 같은 홍채 중심·링 및 MAR 입 4점을 사용한다', () => {
    expect(LOOKTALK_IRIS_INDEX_GROUPS).toEqual([
      { center: 468, ring: [469, 470, 471, 472] },
      { center: 473, ring: [474, 475, 476, 477] },
    ]);
    expect(new Set(LOOKTALK_MOUTH_INDICES)).toEqual(
      new Set(Object.values(MAR_LANDMARK_INDICES)),
    );
    expect(LOOKTALK_MOUTH_VERTICAL_CONNECTION).toEqual({ start: 13, end: 14 });
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
