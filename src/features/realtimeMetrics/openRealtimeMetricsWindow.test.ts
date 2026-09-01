import { beforeEach, describe, expect, it, vi } from 'vitest';

// module-level metricsWindowRef를 테스트 간 격리하기 위해 매 테스트마다 모듈을 다시
// import한다(vi.resetModules() + dynamic import) — 파일 스코프 싱글턴이라는 실제 구현을
// 그대로 유지한 채로 테스트하기 위한 이 파일만의 관례.
function stubWindowWithOpen(openImpl: () => Window | null) {
  vi.stubGlobal('window', {
    open: vi.fn(openImpl),
    location: { origin: 'http://localhost' },
  });
}

function fakeWindow(overrides: Partial<{ closed: boolean; focus: () => void }> = {}) {
  return { closed: false, focus: vi.fn(), ...overrides } as unknown as Window & { focus: ReturnType<typeof vi.fn> };
}

describe('openRealtimeMetricsWindow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('처음 호출 시 window.open으로 새 창을 연다', async () => {
    const win = fakeWindow();
    stubWindowWithOpen(() => win);

    const { openRealtimeMetricsWindow } = await import('./openRealtimeMetricsWindow');
    const result = openRealtimeMetricsWindow();

    expect(result).toBe('opened');
    expect((window.open as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('이미 열려 있고 닫히지 않았다면 새 window.open을 호출하지 않는다(중복 생성 방지)', async () => {
    const win = fakeWindow();
    stubWindowWithOpen(() => win);

    const { openRealtimeMetricsWindow } = await import('./openRealtimeMetricsWindow');
    openRealtimeMetricsWindow();
    const result = openRealtimeMetricsWindow();

    expect(result).toBe('focused');
    expect((window.open as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('이미 열려 있으면 focus()를 호출하지 않는다(최소화 상태를 강제로 풀지 않기 위함)', async () => {
    const win = fakeWindow();
    stubWindowWithOpen(() => win);

    const { openRealtimeMetricsWindow } = await import('./openRealtimeMetricsWindow');
    openRealtimeMetricsWindow();
    openRealtimeMetricsWindow();

    expect((win as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
  });

  it('사용자가 창을 닫으면(closed=true) 다음 호출에서 새 창을 생성한다', async () => {
    const firstWindow = fakeWindow();
    const secondWindow = fakeWindow();
    const openImpl = vi.fn().mockReturnValueOnce(firstWindow).mockReturnValueOnce(secondWindow);
    vi.stubGlobal('window', { open: openImpl, location: { origin: 'http://localhost' } });

    const { openRealtimeMetricsWindow } = await import('./openRealtimeMetricsWindow');
    openRealtimeMetricsWindow();
    (firstWindow as unknown as { closed: boolean }).closed = true;
    const result = openRealtimeMetricsWindow();

    expect(result).toBe('opened');
    expect(openImpl).toHaveBeenCalledTimes(2);
  });

  it('window.open이 null을 반환하면(팝업 차단) blocked를 반환하고, calibration 자체는 이 값으로 실패시키지 않는다', async () => {
    stubWindowWithOpen(() => null);

    const { openRealtimeMetricsWindow } = await import('./openRealtimeMetricsWindow');
    const result = openRealtimeMetricsWindow();

    expect(result).toBe('blocked');
  });

  it('isRealtimeMetricsWindowOpen()은 현재 창 상태를 그대로 반영한다', async () => {
    const win = fakeWindow();
    stubWindowWithOpen(() => win);

    const { openRealtimeMetricsWindow, isRealtimeMetricsWindowOpen } = await import('./openRealtimeMetricsWindow');

    expect(isRealtimeMetricsWindowOpen()).toBe(false);
    openRealtimeMetricsWindow();
    expect(isRealtimeMetricsWindowOpen()).toBe(true);

    (win as unknown as { closed: boolean }).closed = true;
    expect(isRealtimeMetricsWindowOpen()).toBe(false);
  });
});
