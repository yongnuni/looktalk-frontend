import { useEffect, useRef, type RefObject } from 'react';
import type { TrackingFrameListener } from '../gazeRuntime/GazeRuntimeContext';
import type { LandmarkPopupVariant } from './LandmarkPopupContext';
import { drawLandmarkFrame } from './landmarkDrawing';
import {
  calculateContainedVideoSize,
  calculateMinimumOuterWindowSize,
} from './landmarkWindow';

interface LandmarkCameraWindowProps {
  variant: LandmarkPopupVariant;
  onClose: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  subscribeTrackingFrame: (listener: TrackingFrameListener) => () => void;
}

const TITLES: Record<LandmarkPopupVariant, string> = {
  full: '전체 얼굴 랜드마크',
  looktalk: '눈 · 홍채 · 입 랜드마크',
};

export default function LandmarkCameraWindow({
  variant,
  onClose,
  videoRef,
  subscribeTrackingFrame,
}: LandmarkCameraWindowProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const promptRef = useRef<HTMLParagraphElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const variantRef = useRef(variant);
  const displaySizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    variantRef.current = variant;
    if (variant === 'looktalk' && statusRef.current) {
      statusRef.current.hidden = true;
    }
  }, [variant]);

  useEffect(() => {
    const stage = stageRef.current;
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;

    if (!stage || !viewport || !canvas) {
      return;
    }

    const ownerWindow = stage.ownerDocument.defaultView ?? window;
    const enforceMinimumWindowSize = () => {
      const minimumOuterSize = calculateMinimumOuterWindowSize(
        ownerWindow.innerWidth,
        ownerWindow.innerHeight,
        ownerWindow.outerWidth,
        ownerWindow.outerHeight,
      );
      if (!minimumOuterSize) {
        return;
      }

      try {
        ownerWindow.resizeTo(minimumOuterSize.width, minimumOuterSize.height);
      } catch {
        // 일부 브라우저는 resizeTo를 무시한다. CSS는 작은 viewport에서도 X를 유지한다.
      }
    };
    const updateDisplaySize = () => {
      const stageRect = stage.getBoundingClientRect();
      const size = calculateContainedVideoSize(stageRect.width, stageRect.height);
      viewport.style.width = `${size.width}px`;
      viewport.style.height = `${size.height}px`;
      displaySizeRef.current = size;
    };

    enforceMinimumWindowSize();
    updateDisplaySize();
    const handleWindowResize = () => {
      enforceMinimumWindowSize();
      updateDisplaySize();
    };
    ownerWindow.addEventListener('resize', handleWindowResize);
    const Observer = ownerWindow.ResizeObserver ?? globalThis.ResizeObserver;
    const resizeObserver = Observer ? new Observer(updateDisplaySize) : null;
    resizeObserver?.observe(stage);

    const unsubscribe = subscribeTrackingFrame((frame) => {
      const video = videoRef.current;
      const { width, height } = displaySizeRef.current;

      if (!video || width <= 0 || height <= 0) {
        return;
      }

      drawLandmarkFrame({
        canvas,
        video,
        landmarks: frame.canonicalLandmarks,
        variant: variantRef.current,
        cssWidth: width,
        cssHeight: height,
        devicePixelRatio: ownerWindow.devicePixelRatio,
      });

      const faceDetected = (frame.canonicalLandmarks?.length ?? 0) > 0;
      if (promptRef.current) {
        promptRef.current.hidden = faceDetected;
      }
      if (statusRef.current) {
        const showFullStatus = faceDetected && variantRef.current === 'full';
        statusRef.current.hidden = !showFullStatus;
        statusRef.current.textContent = showFullStatus ? '얼굴 주요 랜드마크 감지됨' : '';
      }
    });

    return () => {
      unsubscribe();
      ownerWindow.removeEventListener('resize', handleWindowResize);
      resizeObserver?.disconnect();
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      displaySizeRef.current = { width: 0, height: 0 };
    };
  }, [subscribeTrackingFrame, videoRef]);

  return (
    <section className="landmark-camera-window" aria-label={TITLES[variant]}>
      <header className="landmark-camera-window__header">
        <h1>{TITLES[variant]}</h1>
        <button
          type="button"
          className="landmark-camera-window__close"
          onClick={onClose}
          aria-label="랜드마크 카메라 창 닫기"
        >
          ×
        </button>
      </header>

      <div ref={stageRef} className="landmark-camera-window__stage">
        <div ref={viewportRef} className="landmark-camera-window__viewport">
          <canvas ref={canvasRef} className="landmark-camera-window__canvas" aria-hidden="true" />
          <p ref={promptRef} className="landmark-camera-window__prompt" aria-live="polite">
            카메라를 준비하는 중입니다…
          </p>
          <p ref={statusRef} className="landmark-camera-window__status" hidden />
        </div>
      </div>
    </section>
  );
}
