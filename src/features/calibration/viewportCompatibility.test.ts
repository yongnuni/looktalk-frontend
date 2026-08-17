import { describe, expect, it } from 'vitest';
import { checkViewportCompatibility, type ViewportSnapshot } from './viewportCompatibility';

const stored: ViewportSnapshot = {
  widthPx: 1920,
  heightPx: 1080,
  aspectRatio: 1920 / 1080,
  orientation: 'landscape',
};

describe('checkViewportCompatibility', () => {
  it('returns compatible for an identical viewport', () => {
    const result = checkViewportCompatibility(stored, stored);
    expect(result.status).toBe('compatible');
    expect(result.orientationChanged).toBe(false);
  });

  it('returns compatible for a small aspect-ratio change', () => {
    const current: ViewportSnapshot = { widthPx: 1900, heightPx: 1080, aspectRatio: 1900 / 1080, orientation: 'landscape' };
    const result = checkViewportCompatibility(stored, current);
    expect(result.status).toBe('compatible');
  });

  it('returns uncertain when orientation changes even with a small aspect-ratio delta', () => {
    // near-square viewport pair so a landscape<->portrait flip does NOT also cross the
    // incompatible aspect-ratio threshold, isolating the orientation-change branch.
    const nearSquareStored: ViewportSnapshot = { widthPx: 1024, heightPx: 1000, aspectRatio: 1024 / 1000, orientation: 'landscape' };
    const current: ViewportSnapshot = { widthPx: 1000, heightPx: 1024, aspectRatio: 1000 / 1024, orientation: 'portrait' };
    const result = checkViewportCompatibility(nearSquareStored, current);
    expect(result.orientationChanged).toBe(true);
    expect(result.aspectRatioDelta).toBeLessThan(0.15);
    expect(result.status).toBe('uncertain');
  });

  it('returns uncertain when aspect-ratio delta crosses the uncertain threshold', () => {
    // stored aspect = 1920/1080 ~= 1.7778; current = 1422/1000 = 1.422 -> delta ~= 0.20
    // (>= 0.15 uncertain threshold, < 0.4 incompatible threshold)
    const current: ViewportSnapshot = { widthPx: 1422, heightPx: 1000, aspectRatio: 1422 / 1000, orientation: 'landscape' };
    const result = checkViewportCompatibility(stored, current);
    expect(result.status).toBe('uncertain');
  });

  it('returns incompatible when aspect-ratio delta is large', () => {
    // 1:1 square vs 16:9 -> delta well above 0.4
    const current: ViewportSnapshot = { widthPx: 1000, heightPx: 1000, aspectRatio: 1, orientation: 'landscape' };
    const result = checkViewportCompatibility(stored, current);
    expect(result.status).toBe('incompatible');
  });
});
