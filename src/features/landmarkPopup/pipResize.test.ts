import { describe, expect, it } from 'vitest';
import {
  PIP_CAMERA_ASPECT_RATIO,
  clampPipWidth,
  getDefaultPipWidth,
  getPipCameraHeight,
  getPipWidthBounds,
  getPointerResizedWidth,
} from './pipResize';

describe('landmark PiP resize', () => {
  it('기본 폭은 viewport의 25%이며 일반 데스크톱에서는 최소 360px을 지킨다', () => {
    expect(getDefaultPipWidth(1920, 1080)).toBe(480);
    expect(getDefaultPipWidth(1280, 800)).toBe(360);
  });

  it('너비·높이 화면 경계를 모두 고려해 최소/최대 폭을 clamp한다', () => {
    const bounds = getPipWidthBounds(1000, 600);

    expect(clampPipWidth(100, 1000, 600)).toBe(bounds.min);
    expect(clampPipWidth(1000, 1000, 600)).toBe(bounds.max);
    expect(bounds.max).toBeLessThanOrEqual(720);
  });

  it('좁은 viewport에서는 고정 최소 폭보다 화면 안쪽 clamp를 우선한다', () => {
    const bounds = getPipWidthBounds(340, 300);

    expect(bounds.min).toBe(bounds.max);
    expect(bounds.max).toBeLessThan(340);
  });

  it('우측 상단 고정 방향으로 왼쪽 핸들을 끌며 16:9 카메라 비율을 유지한다', () => {
    const enlarged = getPointerResizedWidth(400, 300, 100, 1920, 1080);
    const reduced = getPointerResizedWidth(400, 300, 380, 1920, 1080);

    expect(enlarged).toBe(600);
    expect(reduced).toBe(360);
    expect(enlarged / getPipCameraHeight(enlarged)).toBe(
      PIP_CAMERA_ASPECT_RATIO,
    );
  });
});
