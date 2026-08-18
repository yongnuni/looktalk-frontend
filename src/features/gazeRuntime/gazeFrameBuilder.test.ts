import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GazeFilter } from '../faceTracking/gaze/GazeFilter';
import type { GazeSignal } from '../faceTracking/types';
import type { GazeCalibrationResult } from '../calibration/types';
import { buildGazeFrame } from './gazeFrameBuilder';

// vitest 기본 환경(node)에는 window가 없다 — 이 파일에서만 실제로 쓰이는
// viewportNormalizedToCssPx(window.innerWidth/innerHeight)를 위해 로컬로 stub한다.
// 다른 테스트 전역에 영향을 주지 않도록 이 파일 안에서만 정의한다.
beforeAll(() => {
  vi.stubGlobal('window', { innerWidth: 1920, innerHeight: 1080 });
});

// 항등 homography — normalized viewport 좌표가 그대로 나온다.
const IDENTITY_CALIBRATION: GazeCalibrationResult = {
  schemaVersion: 1,
  mappingType: 'RAW_HOMOGRAPHY',
  coordinateSpace: 'NORMALIZED_VIEWPORT',
  homography: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  mirrorX: true,
  mirrorStrategy: 'PRE_INFERENCE_FRAME_FLIP',
  grid: { rows: 4, cols: 4, margin: 0.08 },
  calibratedViewport: { widthPx: 1920, heightPx: 1080, aspectRatio: 1920 / 1080, orientation: 'landscape' },
  reprojectionRmseNormalized: 0.01,
  createdAtLocal: '2026-01-01T00:00:00.000Z',
};

function signal(overrides: Partial<GazeSignal> = {}): GazeSignal {
  return {
    irisX: 0.5,
    irisY: 0.5,
    ear: 0.3,
    mar: 0.1,
    irisConfidence: 0.9,
    eyeClosed: false,
    timestamp: 1000,
    ...overrides,
  };
}

describe('buildGazeFrame', () => {
  it('1. active calibration을 실제로 사용한다 — calibration이 없으면 hasSignal=false', () => {
    const frame = buildGazeFrame(null, new GazeFilter(), signal(), 1000);
    expect(frame.hasSignal).toBe(false);
    expect(frame.cursorCssPx).toBeNull();
  });

  it('signal 자체가 없으면(얼굴 미검출) hasSignal=false', () => {
    const frame = buildGazeFrame(IDENTITY_CALIBRATION, new GazeFilter(), null, 1000);
    expect(frame.hasSignal).toBe(false);
    expect(frame.signal).toBeNull();
  });

  it('3. tracking invalid(저신뢰도)이면 cursorCssPx가 null로 올바르게 전달된다', () => {
    const frame = buildGazeFrame(IDENTITY_CALIBRATION, new GazeFilter(), signal({ irisConfidence: 0.1 }), 1000);
    expect(frame.hasSignal).toBe(true);
    expect(frame.cursorCssPx).toBeNull();
  });

  it('유효한 프레임에서는 calibration+GazeFilter를 거쳐 실제 viewport CSS px 좌표가 나온다', () => {
    const filter = new GazeFilter();
    // GazeFilter는 dead-zone/EMA가 있어 첫 프레임만으로는 검증이 흔들릴 수 있으므로
    // 여러 프레임을 연속으로 흘려 값이 유효 범위(0..1920 x, 0..1080 y)로 수렴하는지 확인한다.
    let frame = buildGazeFrame(IDENTITY_CALIBRATION, filter, signal(), 1000);
    for (let i = 0; i < 5; i += 1) {
      frame = buildGazeFrame(IDENTITY_CALIBRATION, filter, signal({ timestamp: 1000 + i * 16 }), 1000 + i * 16);
    }
    expect(frame.hasSignal).toBe(true);
    expect(frame.cursorCssPx).not.toBeNull();
    expect(frame.cursorCssPx!.x).toBeGreaterThanOrEqual(0);
    expect(frame.cursorCssPx!.x).toBeLessThanOrEqual(1920);
    expect(frame.cursorCssPx!.y).toBeGreaterThanOrEqual(0);
    expect(frame.cursorCssPx!.y).toBeLessThanOrEqual(1080);
  });

  it('4. eyeClosed가 frame.signal에 그대로 반영된다', () => {
    const closedFrame = buildGazeFrame(IDENTITY_CALIBRATION, new GazeFilter(), signal({ eyeClosed: true }), 1000);
    expect(closedFrame.hasSignal).toBe(true);
    expect(closedFrame.signal?.eyeClosed).toBe(true);
    // blink=true이면 GazeFilter 자체가 -1 sentinel을 반환한다(Front Step 2 GazeFilter.test.ts).
    expect(closedFrame.cursorCssPx).toBeNull();

    const openFrame = buildGazeFrame(IDENTITY_CALIBRATION, new GazeFilter(), signal({ eyeClosed: false }), 1000);
    expect(openFrame.signal?.eyeClosed).toBe(false);
  });
});
