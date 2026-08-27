import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it, vi } from 'vitest';
import { MAR_LANDMARK_INDICES } from '../faceTracking/gaze/mar';
import {
  LANDMARK_POINT_STYLES,
  averageLandmarkPoint,
  calculateCanvasBackingSize,
  calculateCoverRect,
  drawMirroredCoverVideo,
  projectCanonicalLandmark,
  visitLandmarks,
} from './landmarkDrawing';
import { FULL_FACE_CONTOUR_INDICES } from './landmarkGroups';

function landmark(x: number, y: number, z = 0): NormalizedLandmark {
  return { x, y, z, visibility: 1 };
}

describe('landmark drawing geometry', () => {
  it('full 모드는 478개 전체가 아니라 공식 contour 인덱스만 순회한다', () => {
    const landmarks = Array.from({ length: 478 }, (_, index) =>
      landmark(index / 1000, 0.5),
    );
    const visited: number[] = [];

    visitLandmarks(landmarks, 'full', (_point, index) => visited.push(index));

    expect(visited).toEqual(FULL_FACE_CONTOUR_INDICES);
    expect(visited.length).toBeLessThan(landmarks.length);
  });

  it('looktalk 점 순회는 MAR 계산의 대표 4점만 포함한다', () => {
    const landmarks = Array.from({ length: 478 }, (_, index) =>
      landmark(index / 1000, 0.5),
    );
    const visited: Array<{ index: number; group: string }> = [];

    visitLandmarks(landmarks, 'looktalk', (_point, index, group) => {
      visited.push({ index, group });
    });

    expect(new Set(visited.map(({ index }) => index))).toEqual(
      new Set(Object.values(MAR_LANDMARK_INDICES)),
    );
    expect(visited.every(({ group }) => group === 'mouth')).toBe(true);
  });

  it('기존 iris 인덱스들의 평균으로 중심점 하나를 계산한다', () => {
    const landmarks: NormalizedLandmark[] = [];
    landmarks[1] = landmark(0.2, 0.4, -0.1);
    landmarks[2] = landmark(0.4, 0.6, 0.1);

    const center = averageLandmarkPoint(landmarks, [1, 2]);
    expect(center?.x).toBeCloseTo(0.3);
    expect(center?.y).toBeCloseTo(0.5);
    expect(center?.z).toBeCloseTo(0);
    expect(averageLandmarkPoint(landmarks, [1, 3])).toBeNull();
  });

  it('16:9 영상은 16:9 영역을 자르지 않고 채운다', () => {
    expect(calculateCoverRect(1920, 1080, 400, 225)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 225,
    });
  });

  it('4:3 영상은 16:9 영역 중앙을 기준으로 위아래만 cover crop한다', () => {
    expect(calculateCoverRect(640, 480, 400, 225)).toEqual({
      x: 0,
      y: -37.5,
      width: 400,
      height: 300,
    });
  });

  it('영상만 한 번 좌우 반전하고 canonical 좌표는 다시 반전하지 않는다', () => {
    const scale = vi.fn();
    const translate = vi.fn();
    const context = {
      save: vi.fn(),
      translate,
      scale,
      drawImage: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const video = {} as HTMLVideoElement;
    const coverRect = { x: 0, y: 0, width: 400, height: 225 };

    drawMirroredCoverVideo(context, video, coverRect, 400);

    expect(translate).toHaveBeenCalledWith(400, 0);
    expect(scale).toHaveBeenCalledWith(-1, 1);
    expect(projectCanonicalLandmark(landmark(0.25, 0.5), coverRect)).toEqual({
      x: 100,
      y: 112.5,
    });
  });

  it('DPR과 촬영용 점 반지름을 CSS px 기준으로 유지한다', () => {
    expect(calculateCanvasBackingSize(400, 225, 2)).toEqual({
      width: 800,
      height: 450,
      dpr: 2,
    });
    expect(LANDMARK_POINT_STYLES.full.radius).toBe(2.75);
    expect(LANDMARK_POINT_STYLES.iris.radius).toBe(5.5);
    expect(LANDMARK_POINT_STYLES.mouth.radius).toBe(5);
  });
});
