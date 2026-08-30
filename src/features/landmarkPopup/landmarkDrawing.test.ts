import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it, vi } from 'vitest';
import {
  LEFT_IRIS_LANDMARK_INDICES,
  RIGHT_IRIS_LANDMARK_INDICES,
} from '../faceTracking/gaze/iris';
import { MAR_LANDMARK_INDICES } from '../faceTracking/gaze/mar';
import {
  EYE_CONTOUR_STYLE,
  IRIS_RING_STYLE,
  LANDMARK_POINT_STYLES,
  MOUTH_VERTICAL_LINE_STYLE,
  calculateCanvasBackingSize,
  calculateCoverRect,
  calculateLandmarkVisualMetrics,
  calculateLandmarkVisualScale,
  drawLandmarkFrame,
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
    expect(LANDMARK_POINT_STYLES.full.radius).toBe(2.8);
    expect(LANDMARK_POINT_STYLES.mouth.radius).toBe(6);
  });

  it('480px CSS 너비를 기준으로 visual scale 1을 사용한다', () => {
    const metrics = calculateLandmarkVisualMetrics(480);

    expect(metrics.visualScale).toBe(1);
    expect(metrics.pointStyles.full.radius).toBe(2.8);
    expect(metrics.pointStyles.full.strokeWidth).toBe(1);
    expect(metrics.pointStyles.mouth.radius).toBe(6);
    expect(metrics.pointStyles.mouth.strokeWidth).toBe(0);
    expect(metrics.eyeContourStyle.width).toBe(1);
    expect(metrics.irisRingStyle.minimumRadius).toBe(3);
    expect(metrics.irisRingStyle.centerRadius).toBe(2);
    expect(metrics.mouthVerticalLineStyle.width).toBe(2);
  });

  it('작은 PiP에는 최소 visual scale 0.9를 적용한다', () => {
    expect(calculateLandmarkVisualScale(240)).toBe(0.9);
    expect(
      calculateLandmarkVisualMetrics(240).pointStyles.full.radius,
    ).toBeCloseTo(2.52);
  });

  it('큰 창에서는 full 점이 최대 약 3.78px에서 제한된다', () => {
    const metrics = calculateLandmarkVisualMetrics(720);

    expect(metrics.visualScale).toBe(1.35);
    expect(metrics.pointStyles.full.radius).toBeCloseTo(3.78);
    expect(metrics.pointStyles.full.strokeWidth).toBeCloseTo(1.35);
    expect(metrics.pointStyles.mouth.radius).toBeCloseTo(8.1);
    expect(metrics.eyeContourStyle.width).toBeCloseTo(1.35);
  });

  it('매우 큰 창에서도 visual scale 상한 1.35를 넘지 않는다', () => {
    const metrics = calculateLandmarkVisualMetrics(1920);

    expect(metrics.visualScale).toBe(1.35);
    expect(metrics.pointStyles.full.radius).toBeCloseTo(3.78);
    expect(metrics.pointStyles.mouth.radius).toBeCloseTo(8.1);
    expect(metrics.eyeContourStyle.width).toBeCloseTo(1.35);
  });

  it('DPR은 backing size만 바꾸고 CSS 너비 기반 visual scale에는 반영되지 않는다', () => {
    const cssWidth = 480;
    const dprOneBacking = calculateCanvasBackingSize(cssWidth, 270, 1);
    const dprTwoBacking = calculateCanvasBackingSize(cssWidth, 270, 2);

    expect(dprOneBacking.width).toBe(480);
    expect(dprTwoBacking.width).toBe(960);
    expect(calculateLandmarkVisualScale(cssWidth)).toBe(1);
  });

  it('looktalk 표시 색상은 Python OpenCV BGR을 Canvas RGB로 변환한다', () => {
    expect(LANDMARK_POINT_STYLES.full).toMatchObject({
      fill: '#ffffff',
      stroke: '#111111',
    });
    expect(EYE_CONTOUR_STYLE).toMatchObject({
      color: '#db7093',
    });
    expect(IRIS_RING_STYLE).toMatchObject({
      color: '#ffc800',
    });
    expect(LANDMARK_POINT_STYLES.mouth).toMatchObject({
      fill: '#00ff00',
      strokeWidth: 0,
    });
    expect(MOUTH_VERTICAL_LINE_STYLE).toMatchObject({
      color: '#ffff00',
      width: 2,
    });
  });

  it('looktalk은 landmarks 배열이 짧아도 범위 밖 점을 안전하게 건너뛴다', () => {
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const video = {
      videoWidth: 640,
      videoHeight: 360,
    } as HTMLVideoElement;

    expect(() => drawLandmarkFrame({
      canvas,
      video,
      landmarks: [landmark(0.5, 0.5)],
      variant: 'looktalk',
      cssWidth: 480,
      cssHeight: 270,
      devicePixelRatio: 2,
    })).not.toThrow();
  });
});
