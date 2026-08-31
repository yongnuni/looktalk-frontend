import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import type { GazeSignal } from '../faceTracking/types';
import { EAR_CLOSE_THRESHOLD, EAR_OPEN_THRESHOLD } from '../faceTracking/gaze/blinkGate';
import { MOUTH_CLOSE_THRESHOLD, MOUTH_OPEN_THRESHOLD } from '../multimodalInput/MouthController';
import { buildCalibrationRealtimeMetricsPayload, buildRealtimeMetricsPayload } from './buildRealtimeMetricsPayload';

// vitest 기본 환경(node)에는 window가 없다 — buildCalibrationRealtimeMetricsPayload가 쓰는
// viewportNormalizedToCssPx(window.innerWidth/innerHeight)를 위해 이 파일에서만 stub한다
// (gazeFrameBuilder.test.ts와 동일한 관례).
beforeAll(() => {
  vi.stubGlobal('window', { innerWidth: 1920, innerHeight: 1080 });
});

const BASE = 10_000;

function calibrationSignal(overrides: Partial<GazeSignal> = {}): GazeSignal {
  return { irisX: 0.5, irisY: 0.4, ear: 0.28, mar: 0.31, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE, ...overrides };
}

function frame(overrides: Partial<GazeFrame> = {}): GazeFrame {
  return {
    hasSignal: true,
    signal: { irisX: 0.5, irisY: 0.4, ear: 0.28, mar: 0.31, irisConfidence: 0.9, eyeClosed: false, timestamp: BASE },
    cursorCssPx: { x: 642, y: 318 },
    fixationCount: 3,
    now: BASE,
    ...overrides,
  };
}

describe('buildRealtimeMetricsPayload', () => {
  it('정상 프레임에서는 cursorCssPx/signal 값을 그대로 옮기고, threshold는 기존 상수를 그대로 사용한다', () => {
    const payload = buildRealtimeMetricsPayload(
      frame(),
      { hoveredTargetId: 'key-A', progress: 0.5, mouthOpen: null },
      'EYE_TRACKING',
    );

    expect(payload.hasSignal).toBe(true);
    expect(payload.gaze).toEqual({ x: 642, y: 318, irisX: 0.5, irisY: 0.4, confidence: 0.9 });
    expect(payload.eye).toEqual({ ear: 0.28, eyeClosed: false, closeThreshold: EAR_CLOSE_THRESHOLD, openThreshold: EAR_OPEN_THRESHOLD });
    expect(payload.mouth).toEqual({ mar: 0.31, mouthOpen: null, openThreshold: MOUTH_OPEN_THRESHOLD, closeThreshold: MOUTH_CLOSE_THRESHOLD });
    expect(payload.interaction).toEqual({ hoveredTargetId: 'key-A', progress: 0.5, fixationCount: 3 });
    expect(payload.inputMethod).toBe('EYE_TRACKING');
    expect(payload.timestamp).toBe(BASE);
  });

  it('MouthController가 판정한 mouthOpen을 그대로 옮긴다(팝업에서 mar>=threshold를 다시 판정하지 않음)', () => {
    const payload = buildRealtimeMetricsPayload(
      frame(),
      { hoveredTargetId: null, progress: 0, mouthOpen: true },
      'MOUTH',
    );

    expect(payload.mouth.mouthOpen).toBe(true);
  });

  it('hasSignal=false(얼굴 미검출/calibration 없음)면 gaze/eye/mouth 값이 모두 null이다', () => {
    const payload = buildRealtimeMetricsPayload(
      frame({ hasSignal: false, signal: null, cursorCssPx: null, fixationCount: 0 }),
      { hoveredTargetId: null, progress: 0, mouthOpen: null },
      null,
    );

    expect(payload.hasSignal).toBe(false);
    expect(payload.gaze.x).toBeNull();
    expect(payload.gaze.y).toBeNull();
    expect(payload.eye.ear).toBeNull();
    expect(payload.eye.eyeClosed).toBeNull();
    expect(payload.mouth.mar).toBeNull();
    expect(payload.inputMethod).toBeNull();
    // threshold는 신호 유무와 무관하게 항상 채워진다(팝업이 상수를 잃지 않도록).
    expect(payload.eye.closeThreshold).toBe(EAR_CLOSE_THRESHOLD);
    expect(payload.mouth.openThreshold).toBe(MOUTH_OPEN_THRESHOLD);
  });

  it('GazeFilter가 무효 판정(cursorCssPx=null)한 프레임도 gaze.x/y가 null로 안전하게 표시된다', () => {
    const payload = buildRealtimeMetricsPayload(
      frame({ cursorCssPx: null }),
      { hoveredTargetId: null, progress: 0, mouthOpen: null },
      'EYE_TRACKING',
    );

    expect(payload.gaze.x).toBeNull();
    expect(payload.gaze.y).toBeNull();
  });
});

describe('buildCalibrationRealtimeMetricsPayload', () => {
  it('cursorNormalized가 없으면(homography 미확정, 16점 수집 중) gaze.x/y는 null이다 — normalized 값을 px로 속이지 않는다', () => {
    const payload = buildCalibrationRealtimeMetricsPayload(calibrationSignal(), null);

    expect(payload.hasSignal).toBe(true);
    expect(payload.gaze.x).toBeNull();
    expect(payload.gaze.y).toBeNull();
    expect(payload.gaze.irisX).toBe(0.5);
    expect(payload.eye.ear).toBe(0.28);
    expect(payload.mouth.mar).toBe(0.31);
    // Calibration에는 MouthController가 없으므로 새로 판정하지 않고 null(판정 불가)로 둔다.
    expect(payload.mouth.mouthOpen).toBeNull();
    // GazeInteractionProvider가 없으므로 interaction 필드 자체를 만들지 않는다.
    expect(payload.interaction).toBeUndefined();
    // resolveRealtimeMetricsDisplayMode(null)이 기본값 GAZE를 반환하도록 항상 null.
    expect(payload.inputMethod).toBeNull();
  });

  it('cursorNormalized가 있으면(homography 확정 이후) viewportNormalizedToCssPx와 동일한 방식으로 CSS px로 변환된다', () => {
    const payload = buildCalibrationRealtimeMetricsPayload(calibrationSignal(), { x: 0.5, y: 0.25 });

    // window.innerWidth=1920, innerHeight=1080 stub 기준 — CalibrationPage.tsx가 화면에
    // 그리는 자기 커서와 동일한 변환(viewportNormalizedToCssPx)을 그대로 재사용한 값이다.
    expect(payload.gaze.x).toBe(960);
    expect(payload.gaze.y).toBe(270);
  });

  it('signal이 없으면(얼굴 미검출) hasSignal=false이고 모든 신호값이 null이다', () => {
    const payload = buildCalibrationRealtimeMetricsPayload(null, null);

    expect(payload.hasSignal).toBe(false);
    expect(payload.gaze.irisX).toBeNull();
    expect(payload.eye.ear).toBeNull();
    expect(payload.mouth.mar).toBeNull();
    // threshold는 신호 유무와 무관하게 항상 채워진다.
    expect(payload.eye.closeThreshold).toBe(EAR_CLOSE_THRESHOLD);
    expect(payload.mouth.openThreshold).toBe(MOUTH_OPEN_THRESHOLD);
  });
});
