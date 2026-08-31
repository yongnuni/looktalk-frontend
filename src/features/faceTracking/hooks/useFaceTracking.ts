import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { createFaceLandmarker } from '../mediapipe/createFaceLandmarker';
import { toCanonicalLandmarks } from '../mediapipe/landmarkNormalizer';
import type { MirrorStrategy } from '../mediapipe/mirrorStrategy';
import { computeAvgIris } from '../gaze/iris';
import { computeAverageEar } from '../gaze/ear';
import { computeMouthAspectRatio } from '../gaze/mar';
import { computeIrisConfidence } from '../gaze/irisConfidence';
import {
  nextEyeClosedState,
  type EyeClosureThresholds,
} from '../gaze/blinkGate';
import type { FaceTrackingFrame, GazeSignal } from '../types';

export type FaceLandmarkerLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface FaceTrackingSnapshot {
  fps: number;
  landmarkCount: number;
  delegate: 'GPU' | 'CPU' | null;
  signal: GazeSignal | null;
  canonicalLandmarks: NormalizedLandmark[] | null; // debug overlay 용. 프레임마다가 아니라 throttle된 값.
}

interface UseFaceTrackingOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  mirrorStrategy: MirrorStrategy;
  /** 생략하면 기존 0.18/0.22를 사용한다. EAR 계산식 자체는 바꾸지 않는다. */
  blinkThresholds?: EyeClosureThresholds;
  /**
   * 매 프레임(throttle 없이) 호출된다. Python Look-Talk의 Calibrator.update()처럼
   * 프레임 단위 샘플 수집이 필요한 소비자(Step 1 calibration 등)를 위한 것 — debug
   * 표시용 `snapshot`은 별도로 100ms 간격 throttle된 값을 쓴다. 매 렌더마다 새
   * 함수를 넘기면 매번 재구독되므로, 호출 측에서 useCallback 등으로 안정화할 것.
   */
  onFrame?: (signal: GazeSignal | null) => void;
  /**
   * 랜드마크 시각화처럼 전체 배열이 필요한 소비자에게 매 추론 프레임을 전달한다.
   * React state 갱신용이 아니며, 전달받은 배열을 변경하거나 보관하지 않아야 한다.
   */
  onTrackingFrame?: (frame: FaceTrackingFrame) => void;
}

interface UseFaceTrackingResult {
  loadState: FaceLandmarkerLoadState;
  loadError: string | null;
  snapshot: FaceTrackingSnapshot;
}

const EMPTY_SNAPSHOT: FaceTrackingSnapshot = {
  fps: 0,
  landmarkCount: 0,
  delegate: null,
  signal: null,
  canonicalLandmarks: null,
};

// debug UI 갱신 주기. 감지/FPS 계산 자체는 매 프레임 수행하되, React state 갱신만
// 이 주기로 throttle한다(Integration Plan §13.4 "고빈도 값을 매 프레임 state로 저장하지
// 않는다" 원칙을 debug 페이지에도 적용 — 60fps state 갱신에 의한 렌더 폭주 방지).
const UI_UPDATE_INTERVAL_MS = 100;
const FPS_WINDOW_MS = 500;

export function useFaceTracking({
  videoRef,
  active,
  mirrorStrategy,
  blinkThresholds,
  onFrame,
  onTrackingFrame,
}: UseFaceTrackingOptions): UseFaceTrackingResult {
  // 'loading'을 effect 본문에서 동기적으로 setState하지 않기 위해(react-hooks/set-state-in-effect),
  // 로드 결과만 비동기 콜백에서 저장하고 loadState는 active와 조합해 파생시킨다.
  type LoadResult = { status: 'ready'; delegate: 'GPU' | 'CPU' } | { status: 'error'; message: string };
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [snapshot, setSnapshot] = useState<FaceTrackingSnapshot>(EMPTY_SNAPSHOT);

  const loadState: FaceLandmarkerLoadState = !active
    ? 'idle'
    : loadResult === null
      ? 'loading'
      : loadResult.status;
  const loadError = loadResult?.status === 'error' ? loadResult.message : null;

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const delegateRef = useRef<'GPU' | 'CPU' | null>(null);
  const rafRef = useRef<number | null>(null);
  const mirrorFlipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const eyeClosedRef = useRef(false);
  const mirrorStrategyRef = useRef(mirrorStrategy);
  const blinkThresholdsRef = useRef(blinkThresholds);

  const frameCountRef = useRef(0);
  const fpsWindowStartRef = useRef(0);
  const fpsRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  const onTrackingFrameRef = useRef(onTrackingFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    onTrackingFrameRef.current = onTrackingFrame;
  }, [onTrackingFrame]);

  useEffect(() => {
    mirrorStrategyRef.current = mirrorStrategy;
    // 전략을 바꾸면 이전 전략에서 누적된 눈 감김 히스테리시스가 섞이지 않도록 리셋한다.
    eyeClosedRef.current = false;
  }, [mirrorStrategy]);

  useEffect(() => {
    blinkThresholdsRef.current = blinkThresholds;
    eyeClosedRef.current = false;
  }, [blinkThresholds]);

  // FaceLandmarker 로드/정리
  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    createFaceLandmarker()
      .then(({ landmarker, delegate }) => {
        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        delegateRef.current = delegate;
        setLoadResult({ status: 'ready', delegate });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadResult({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      delegateRef.current = null;
      setLoadResult(null);
    };
  }, [active]);

  // requestAnimationFrame 루프
  useEffect(() => {
    if (loadState !== 'ready') {
      return;
    }

    const video = videoRef.current;

    if (!video) {
      return;
    }

    frameCountRef.current = 0;
    fpsWindowStartRef.current = performance.now();
    lastUiUpdateRef.current = 0;

    const tick = () => {
      const landmarker = landmarkerRef.current;

      if (landmarker && video.readyState >= 2 && video.videoWidth > 0) {
        const timestamp = performance.now();
        const currentStrategy = mirrorStrategyRef.current;

        let detectionSource: HTMLVideoElement | HTMLCanvasElement = video;

        if (currentStrategy === 'PRE_INFERENCE_FRAME_FLIP') {
          if (!mirrorFlipCanvasRef.current) {
            mirrorFlipCanvasRef.current = document.createElement('canvas');
          }

          const canvas = mirrorFlipCanvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const ctx = canvas.getContext('2d');

          if (ctx) {
            // Python cv2.flip(frame, 1) 대응: 추론 입력 자체를 좌우 반전한다.
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();
            detectionSource = canvas;
          }
        }

        const result = landmarker.detectForVideo(detectionSource, timestamp);
        const rawLandmarks = result.faceLandmarks[0];

        frameCountRef.current += 1;
        const elapsedSinceWindowStart = timestamp - fpsWindowStartRef.current;

        if (elapsedSinceWindowStart >= FPS_WINDOW_MS) {
          fpsRef.current = (frameCountRef.current / elapsedSinceWindowStart) * 1000;
          frameCountRef.current = 0;
          fpsWindowStartRef.current = timestamp;
        }

        // signal 계산과 onFrame 통지는 매 프레임 수행한다(throttle 없음) — Step 1
        // calibration처럼 프레임 단위 샘플이 필요한 소비자가 있기 때문이다.
        let canonical: NormalizedLandmark[] | null = null;
        let signal: GazeSignal | null = null;

        if (rawLandmarks) {
          canonical = toCanonicalLandmarks(rawLandmarks, currentStrategy);
          const iris = computeAvgIris(canonical);
          const ear = computeAverageEar(canonical);
          const mar = computeMouthAspectRatio(canonical);
          const irisConfidence = computeIrisConfidence(canonical);

          eyeClosedRef.current = nextEyeClosedState(
            ear,
            eyeClosedRef.current,
            blinkThresholdsRef.current,
          );

          signal = {
            irisX: iris.x,
            irisY: iris.y,
            ear,
            mar,
            irisConfidence,
            eyeClosed: eyeClosedRef.current,
            timestamp,
          };
        }

        onFrameRef.current?.(signal);
        onTrackingFrameRef.current?.({
          rawLandmarks: rawLandmarks ?? null,
          canonicalLandmarks: canonical,
          signal,
          timestamp,
        });

        // React state 갱신(debug UI 표시용)만 throttle한다(§13.4 원칙, debug 페이지 적용).
        if (timestamp - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
          lastUiUpdateRef.current = timestamp;

          setSnapshot({
            fps: fpsRef.current,
            landmarkCount: canonical?.length ?? 0,
            delegate: delegateRef.current,
            canonicalLandmarks: canonical,
            signal,
          });
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [loadState, videoRef]);

  return { loadState, loadError, snapshot };
}
