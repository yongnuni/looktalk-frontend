import { describe, expect, it } from 'vitest';
import {
  PIP_CAMERA_ASPECT_RATIO,
  PIP_MIN_WIDTH,
  PIP_VIEWPORT_MARGIN,
  clampPipGeometry,
  clampPipWidth,
  getDefaultPipGeometry,
  getDefaultPipWidth,
  getDraggedPipGeometry,
  getPipCameraHeight,
  getPipHeight,
  getPipWidthBounds,
  getPointerResizedGeometry,
  shouldStartPipDrag,
} from './pipResize';

describe('landmark PiP geometry', () => {
  it('기본 폭은 viewport의 25%이며 우측 상단 12px 여백에서 시작한다', () => {
    expect(getDefaultPipWidth(1920, 1080)).toBe(480);
    expect(getDefaultPipWidth(1280, 800)).toBe(PIP_MIN_WIDTH);
    expect(getDefaultPipGeometry(1920, 1080)).toEqual({
      x: 1920 - PIP_VIEWPORT_MARGIN - 480,
      y: PIP_VIEWPORT_MARGIN,
      width: 480,
    });
  });

  it('고정 720px 상한 없이 viewport 너비와 높이로 최대 폭을 계산한다', () => {
    const bounds = getPipWidthBounds(1920, 1080);

    expect(bounds.max).toBeGreaterThan(720);
    expect(clampPipWidth(100, 1920, 1080)).toBe(bounds.min);
    expect(clampPipWidth(4000, 1920, 1080)).toBe(bounds.max);
    expect(getPipCameraHeight(bounds.max) * PIP_CAMERA_ASPECT_RATIO).toBeCloseTo(
      bounds.max,
    );
  });

  it('좁은 viewport에서는 고정 최소 폭보다 화면 안쪽 clamp를 우선한다', () => {
    const bounds = getPipWidthBounds(340, 300);

    expect(bounds.min).toBe(bounds.max);
    expect(bounds.max).toBe(340 - PIP_VIEWPORT_MARGIN * 2);
  });

  it('드래그 위치를 모든 viewport 경계 안으로 clamp한다', () => {
    const start = { x: 500, y: 100, width: 400 };
    const moved = getDraggedPipGeometry(
      start,
      { x: 600, y: 200 },
      { x: -1000, y: 2000 },
      1200,
      800,
    );

    expect(moved.x).toBe(PIP_VIEWPORT_MARGIN);
    expect(moved.y).toBe(800 - PIP_VIEWPORT_MARGIN - getPipHeight(moved.width));
  });

  it('좌·우 하단 모서리 resize가 반대쪽 기준점을 유지하고 16:9를 지킨다', () => {
    const start = { x: 500, y: 100, width: 400 };
    const southwest = getPointerResizedGeometry(
      start,
      'sw',
      { x: 500, y: 365 },
      { x: 300, y: 365 },
      1920,
      1080,
    );
    const southeast = getPointerResizedGeometry(
      start,
      'se',
      { x: 900, y: 365 },
      { x: 1100, y: 365 },
      1920,
      1080,
    );

    expect(southwest.width).toBe(600);
    expect(southwest.x + southwest.width).toBe(start.x + start.width);
    expect(southeast.width).toBe(600);
    expect(southeast.x).toBe(start.x);
    expect(getPipCameraHeight(southeast.width)).toBe(600 / PIP_CAMERA_ASPECT_RATIO);
  });

  it('모서리를 viewport 끝까지 끌어도 반대쪽 anchor를 움직이지 않는다', () => {
    const start = { x: 500, y: 100, width: 400 };
    const southwest = getPointerResizedGeometry(
      start,
      'sw',
      { x: 500, y: 365 },
      { x: -2000, y: 365 },
      1920,
      1080,
    );

    expect(southwest.x).toBe(PIP_VIEWPORT_MARGIN);
    expect(southwest.x + southwest.width).toBe(start.x + start.width);
  });

  it('viewport 변경 시 기존 위치와 크기를 함께 다시 clamp한다', () => {
    const clamped = clampPipGeometry({ x: 1400, y: 700, width: 1900 }, 1000, 600);
    const bounds = getPipWidthBounds(1000, 600);

    expect(clamped.width).toBe(bounds.max);
    expect(clamped.x).toBeGreaterThanOrEqual(PIP_VIEWPORT_MARGIN);
    expect(clamped.y).toBeGreaterThanOrEqual(PIP_VIEWPORT_MARGIN);
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(1000 - PIP_VIEWPORT_MARGIN);
    expect(clamped.y + getPipHeight(clamped.width)).toBeLessThanOrEqual(
      600 - PIP_VIEWPORT_MARGIN,
    );
  });

  it('왼쪽 버튼만 제목 표시줄 drag를 시작하고 X 대상은 제외한다', () => {
    expect(shouldStartPipDrag(0, false)).toBe(true);
    expect(shouldStartPipDrag(0, true)).toBe(false);
    expect(shouldStartPipDrag(2, false)).toBe(false);
  });
});
