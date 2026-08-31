import { describe, expect, it, vi } from 'vitest';
import {
  LANDMARK_WINDOW_INITIAL_HEIGHT,
  LANDMARK_WINDOW_INITIAL_WIDTH,
  LANDMARK_WINDOW_NAME,
  buildLandmarkWindowFeatures,
  calculateContainedVideoSize,
  calculateLandmarkWindowGeometry,
  calculateMinimumOuterWindowSize,
  openLandmarkWindow,
} from './landmarkWindow';

const SCREEN = {
  availLeft: 0,
  availTop: 0,
  availWidth: 1920,
  availHeight: 1040,
};

describe('landmark external window', () => {
  it('초기 520x340 창을 현재 모니터 우측 상단 부근에 둔다', () => {
    expect(calculateLandmarkWindowGeometry(SCREEN)).toEqual({
      width: LANDMARK_WINDOW_INITIAL_WIDTH,
      height: LANDMARK_WINDOW_INITIAL_HEIGHT,
      left: 1376,
      top: 24,
    });
    expect(buildLandmarkWindowFeatures(SCREEN)).toContain('resizable=yes');
  });

  it('full과 looktalk 모두 같은 고정 window name을 사용한다', () => {
    const popup = {} as Window;
    const open = vi.fn(() => popup);
    const owner = { open, screen: SCREEN } as unknown as Window;

    expect(openLandmarkWindow(owner)).toBe(popup);
    expect(openLandmarkWindow(owner)).toBe(popup);
    expect(open).toHaveBeenNthCalledWith(
      1,
      '',
      LANDMARK_WINDOW_NAME,
      buildLandmarkWindowFeatures(SCREEN),
    );
    expect(open).toHaveBeenNthCalledWith(
      2,
      '',
      LANDMARK_WINDOW_NAME,
      buildLandmarkWindowFeatures(SCREEN),
    );
  });

  it('popup 차단 시 null을 그대로 반환한다', () => {
    const owner = {
      open: vi.fn(() => null),
      screen: SCREEN,
    } as unknown as Window;
    expect(openLandmarkWindow(owner)).toBeNull();
  });

  it('제목을 제외한 stage 안에서 16:9 contain 크기를 계산한다', () => {
    expect(calculateContainedVideoSize(520, 296)).toEqual({
      width: 520,
      height: 292.5,
    });
    expect(calculateContainedVideoSize(320, 120)).toEqual({
      width: 120 * (16 / 9),
      height: 120,
    });
    expect(calculateContainedVideoSize(0, 120)).toEqual({ width: 0, height: 0 });
  });

  it('작은 창은 X와 영상을 위한 최소 콘텐츠 크기로만 보정한다', () => {
    expect(calculateMinimumOuterWindowSize(280, 200, 296, 238)).toEqual({
      width: 336,
      height: 268,
    });
    expect(calculateMinimumOuterWindowSize(520, 296, 536, 334)).toBeNull();
  });
});
