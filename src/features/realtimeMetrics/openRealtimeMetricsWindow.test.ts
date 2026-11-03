import { beforeEach, describe, expect, it, vi } from 'vitest';

// module-level metricsWindowRef를 테스트 간 격리하기 위해 매 테스트마다 모듈을 다시 import한다.
function stubWindowWithOpen(openImpl: () => Window | null) {
  vi.stubGlobal('window', {
    open: vi.fn(openImpl),
    location: { origin: 'http://localhost' },
  });
}

function fakeWindow(
  overrides: Partial<{ closed: boolean; focus: () => void }> = {},
) {
  return {
    closed: false,
    focus: vi.fn(),
    ...overrides,
  } as unknown as Window & { focus: ReturnType<typeof vi.fn> };
}

describe('openRealtimeMetricsWindow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('팝업이 비활성화된 상태에서는 disabled를 반환한다', async () => {
    const win = fakeWindow();
    stubWindowWithOpen(() => win);

    const { openRealtimeMetricsWindow } =
      await import('./openRealtimeMetricsWindow');
    const result = openRealtimeMetricsWindow();

    expect(result).toBe('disabled');
  });

  it('팝업이 비활성화된 상태에서는 window.open을 호출하지 않는다', async () => {
    const win = fakeWindow();
    stubWindowWithOpen(() => win);

    const { openRealtimeMetricsWindow } =
      await import('./openRealtimeMetricsWindow');

    openRealtimeMetricsWindow();

    expect(window.open).not.toHaveBeenCalled();
  });

  it('반복 호출해도 팝업을 생성하지 않는다', async () => {
    const win = fakeWindow();
    stubWindowWithOpen(() => win);

    const { openRealtimeMetricsWindow } =
      await import('./openRealtimeMetricsWindow');

    const firstResult = openRealtimeMetricsWindow();
    const secondResult = openRealtimeMetricsWindow();

    expect(firstResult).toBe('disabled');
    expect(secondResult).toBe('disabled');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('기존 창이 존재하더라도 새로운 팝업을 생성하지 않는다', async () => {
    const win = fakeWindow();
    stubWindowWithOpen(() => win);

    const { openRealtimeMetricsWindow } =
      await import('./openRealtimeMetricsWindow');

    const result = openRealtimeMetricsWindow();

    expect(result).toBe('disabled');
    expect(win.focus).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it('팝업 비활성화 상태에서는 window.open이 null을 반환하는 상황도 발생하지 않는다', async () => {
    stubWindowWithOpen(() => null);

    const { openRealtimeMetricsWindow } =
      await import('./openRealtimeMetricsWindow');

    const result = openRealtimeMetricsWindow();

    expect(result).toBe('disabled');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('isRealtimeMetricsWindowOpen()은 팝업 비활성화 상태에서 항상 false를 반환한다', async () => {
    const win = fakeWindow();
    stubWindowWithOpen(() => win);

    const { openRealtimeMetricsWindow, isRealtimeMetricsWindowOpen } =
      await import('./openRealtimeMetricsWindow');

    expect(isRealtimeMetricsWindowOpen()).toBe(false);

    openRealtimeMetricsWindow();

    expect(isRealtimeMetricsWindowOpen()).toBe(false);

    expect(window.open).not.toHaveBeenCalled();
  });
});
