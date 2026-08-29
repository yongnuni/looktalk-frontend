import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it, vi } from 'vitest';
import {
  LEFT_IRIS_LANDMARK_INDICES,
  RIGHT_IRIS_LANDMARK_INDICES,
} from '../faceTracking/gaze/iris';
import { MAR_LANDMARK_INDICES } from '../faceTracking/gaze/mar';
import {
  EYE_CONTOUR_STYLE,
  LANDMARK_POINT_STYLES,
  averageLandmarkPoint,
  calculateCanvasBackingSize,
  calculateCoverRect,
  calculateLandmarkVisualMetrics,
  calculateLandmarkVisualScale,
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
    const irisIndices = new Set<number>([
      ...LEFT_IRIS_LANDMARK_INDICES,
      ...RIGHT_IRIS_LANDMARK_INDICES,
    ]);

    visitLandmarks(landmarks, 'full', (_point, index) => visited.push(index));

    expect(visited).toEqual(FULL_FACE_CONTOUR_INDICES);
    expect(visited).toHaveLength(128);
    expect(visited.some((index) => irisIndices.has(index))).toBe(false);
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
    expect(LANDMARK_POINT_STYLES.full.radius).toBe(3.4);
    expect(LANDMARK_POINT_STYLES.iris.radius).toBe(5.5);
    expect(LANDMARK_POINT_STYLES.mouth.radius).toBe(5);
  });

  it('480px CSS 너비를 기준으로 visual scale 1을 사용한다', () => {
    const metrics = calculateLandmarkVisualMetrics(480);

    expect(metrics.visualScale).toBe(1);
    expect(metrics.pointStyles.full.radius).toBe(3.4);
    expect(metrics.pointStyles.full.strokeWidth).toBe(1.25);
    expect(metrics.pointStyles.iris.radius).toBe(5.5);
    expect(metrics.pointStyles.iris.strokeWidth).toBe(1.5);
    expect(metrics.pointStyles.mouth.radius).toBe(5);
    expect(metrics.pointStyles.mouth.strokeWidth).toBe(1.5);
    expect(metrics.eyeContourStyle.haloWidth).toBe(3.5);
    expect(metrics.eyeContourStyle.width).toBe(1.5);
  });

  it('작은 PiP에는 최소 visual scale 0.9를 적용한다', () => {
    expect(calculateLandmarkVisualScale(240)).toBe(0.9);
    expect(
      calculateLandmarkVisualMetrics(240).pointStyles.full.radius,
    ).toBeCloseTo(3.06);
  });

  it('큰 PiP에서는 점과 선을 비례 확대한다', () => {
    const metrics = calculateLandmarkVisualMetrics(720);

    expect(metrics.visualScale).toBe(1.5);
    expect(metrics.pointStyles.full.radius).toBeCloseTo(5.1);
    expect(metrics.pointStyles.full.strokeWidth).toBeCloseTo(1.875);
    expect(metrics.pointStyles.iris.radius).toBeCloseTo(8.25);
    expect(metrics.pointStyles.mouth.radius).toBeCloseTo(7.5);
    expect(metrics.eyeContourStyle.haloWidth).toBeCloseTo(5.25);
    expect(metrics.eyeContourStyle.width).toBeCloseTo(2.25);
  });

  it('매우 큰 PiP에서도 visual scale 상한 1.7을 넘지 않는다', () => {
    const metrics = calculateLandmarkVisualMetrics(1920);

    expect(metrics.visualScale).toBe(1.7);
    expect(metrics.pointStyles.full.radius).toBeCloseTo(5.78);
    expect(metrics.pointStyles.iris.radius).toBeCloseTo(9.35);
    expect(metrics.pointStyles.iris.strokeWidth).toBeCloseTo(2.55);
    expect(metrics.pointStyles.mouth.radius).toBeCloseTo(8.5);
    expect(metrics.pointStyles.mouth.strokeWidth).toBeCloseTo(2.55);
    expect(metrics.eyeContourStyle.haloWidth).toBeCloseTo(5.95);
    expect(metrics.eyeContourStyle.width).toBeCloseTo(2.55);
  });

  it('DPR은 backing size만 바꾸고 CSS 너비 기반 visual scale에는 반영되지 않는다', () => {
    const cssWidth = 480;
    const dprOneBacking = calculateCanvasBackingSize(cssWidth, 270, 1);
    const dprTwoBacking = calculateCanvasBackingSize(cssWidth, 270, 2);

    expect(dprOneBacking.width).toBe(480);
    expect(dprTwoBacking.width).toBe(960);
    expect(calculateLandmarkVisualScale(cssWidth)).toBe(1);
  });

  it('looktalk 표시 색상은 기존 노랑·빨강·초록 구성을 유지한다', () => {
    expect(LANDMARK_POINT_STYLES.full).toMatchObject({
      fill: '#ffffff',
      stroke: '#111111',
    });
    expect(EYE_CONTOUR_STYLE).toMatchObject({
      haloColor: '#111111',
      color: '#ffe000',
    });
    expect(LANDMARK_POINT_STYLES.iris).toMatchObject({
      fill: '#ff2020',
      stroke: '#ffffff',
    });
    expect(LANDMARK_POINT_STYLES.mouth).toMatchObject({
      fill: '#33e06f',
      stroke: '#111111',
    });
  });
});
