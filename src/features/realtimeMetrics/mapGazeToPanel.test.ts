import { describe, expect, it } from 'vitest';
import { mapGazeToPanel } from './mapGazeToPanel';

describe('mapGazeToPanel', () => {
  it('NORMALIZED (0,0)는 panel 좌상단(fraction 0,0)이다', () => {
    expect(mapGazeToPanel({ kind: 'NORMALIZED', x: 0, y: 0 }, null)).toEqual({
      fractionX: 0,
      fractionY: 0,
    });
  });

  it('NORMALIZED (0.5,0.5)는 panel 중앙(fraction 0.5,0.5)이다', () => {
    expect(mapGazeToPanel({ kind: 'NORMALIZED', x: 0.5, y: 0.5 }, null)).toEqual({
      fractionX: 0.5,
      fractionY: 0.5,
    });
  });

  it('NORMALIZED (1,1)는 panel 우하단(fraction 1,1)이다', () => {
    expect(mapGazeToPanel({ kind: 'NORMALIZED', x: 1, y: 1 }, null)).toEqual({
      fractionX: 1,
      fractionY: 1,
    });
  });

  it('PX: viewport 1920x1080에서 gaze(960,540)는 panel 중앙이다', () => {
    expect(
      mapGazeToPanel({ kind: 'PX', x: 960, y: 540 }, { width: 1920, height: 1080 }),
    ).toEqual({ fractionX: 0.5, fractionY: 0.5 });
  });

  it('PX: gaze가 viewport 밖이면 0..1로 clamp한다', () => {
    expect(
      mapGazeToPanel({ kind: 'PX', x: -200, y: 5000 }, { width: 1920, height: 1080 }),
    ).toEqual({ fractionX: 0, fractionY: 1 });
  });

  it('NaN/Infinity 좌표는 점을 그리지 않는다(null)', () => {
    expect(
      mapGazeToPanel({ kind: 'PX', x: Number.NaN, y: 10 }, { width: 1920, height: 1080 }),
    ).toEqual({ fractionX: null, fractionY: null });

    expect(
      mapGazeToPanel({ kind: 'NORMALIZED', x: Number.POSITIVE_INFINITY, y: 0.5 }, null),
    ).toEqual({ fractionX: null, fractionY: null });
  });

  it('coordinate가 없으면(NONE) 점을 그리지 않는다', () => {
    expect(mapGazeToPanel({ kind: 'NONE' }, { width: 1920, height: 1080 })).toEqual({
      fractionX: null,
      fractionY: null,
    });
  });

  it('PX인데 coordinateSpace가 없거나(옛 payload) 잘못된 값이면 점을 그리지 않는다', () => {
    expect(mapGazeToPanel({ kind: 'PX', x: 100, y: 100 }, undefined)).toEqual({
      fractionX: null,
      fractionY: null,
    });
    expect(mapGazeToPanel({ kind: 'PX', x: 100, y: 100 }, { width: 0, height: 1080 })).toEqual({
      fractionX: null,
      fractionY: null,
    });
    expect(
      mapGazeToPanel({ kind: 'PX', x: 100, y: 100 }, { width: Number.NaN, height: 1080 }),
    ).toEqual({ fractionX: null, fractionY: null });
  });
});
