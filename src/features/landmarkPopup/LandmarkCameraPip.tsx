import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useGazeRuntime } from '../gazeRuntime/GazeRuntimeContext';
import type { LandmarkPopupVariant } from './LandmarkPopupContext';
import { drawLandmarkFrame } from './landmarkDrawing';
import {
  clampPipWidth,
  getDefaultPipWidth,
  getPointerResizedWidth,
} from './pipResize';
import './LandmarkCameraPip.css';

interface LandmarkCameraPipProps {
  variant: LandmarkPopupVariant;
  onClose: () => void;
}

interface ResizeDragState {
  pointerId: number;
  startPointerX: number;
  startWidth: number;
}

const TITLES: Record<LandmarkPopupVariant, string> = {
  full: '전체 얼굴 랜드마크',
  looktalk: '눈 · 홍채 · 입 랜드마크',
};

export default function LandmarkCameraPip({
  variant,
  onClose,
}: LandmarkCameraPipProps) {
  const { videoRef, subscribeTrackingFrame } = useGazeRuntime();
  const pipRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const promptRef = useRef<HTMLParagraphElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const resizeHandleRef = useRef<HTMLButtonElement | null>(null);
  const variantRef = useRef(variant);
  const displaySizeRef = useRef({ width: 0, height: 0 });
  const currentWidthRef = useRef<number | null>(null);
  const resizeDragRef = useRef<ResizeDragState | null>(null);

  useEffect(() => {
    variantRef.current = variant;

    if (variant === 'looktalk' && statusRef.current) {
      statusRef.current.hidden = true;
    }
  }, [variant]);

  useEffect(() => {
    const pip = pipRef.current;
    const resizeHandle = resizeHandleRef.current;
    if (!pip) {
      return;
    }

    const applyWidth = (width: number) => {
      currentWidthRef.current = width;
      pip.style.width = `${width}px`;
    };

    applyWidth(getDefaultPipWidth(window.innerWidth, window.innerHeight));

    const handleViewportResize = () => {
      const requestedWidth = currentWidthRef.current
        ?? getDefaultPipWidth(window.innerWidth, window.innerHeight);
      applyWidth(clampPipWidth(requestedWidth, window.innerWidth, window.innerHeight));
    };

    window.addEventListener('resize', handleViewportResize);

    return () => {
      window.removeEventListener('resize', handleViewportResize);
      const activePointerId = resizeDragRef.current?.pointerId;
      resizeDragRef.current = null;

      if (
        resizeHandle &&
        activePointerId !== undefined &&
        resizeHandle.hasPointerCapture(activePointerId)
      ) {
        resizeHandle.releasePointerCapture(activePointerId);
      }
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;

    if (!viewport || !canvas) {
      return;
    }

    const updateDisplaySize = () => {
      const rect = viewport.getBoundingClientRect();
      displaySizeRef.current = {
        width: rect.width,
        height: rect.height,
      };
    };

    updateDisplaySize();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateDisplaySize);
    resizeObserver?.observe(viewport);

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
        devicePixelRatio: window.devicePixelRatio,
      });

      const faceDetected = (frame.canonicalLandmarks?.length ?? 0) > 0;

      if (promptRef.current) {
        promptRef.current.hidden = faceDetected;
      }

      if (statusRef.current) {
        const showFullStatus = faceDetected && variantRef.current === 'full';
        statusRef.current.hidden = !showFullStatus;
        statusRef.current.textContent = showFullStatus
          ? '얼굴 주요 랜드마크 감지됨'
          : '';
      }
    });

    return () => {
      unsubscribe();
      resizeObserver?.disconnect();

      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      displaySizeRef.current = { width: 0, height: 0 };
    };
  }, [subscribeTrackingFrame, videoRef]);

  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const startWidth = currentWidthRef.current
      ?? pipRef.current?.getBoundingClientRect().width
      ?? getDefaultPipWidth(window.innerWidth, window.innerHeight);

    resizeDragRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizePointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const drag = resizeDragRef.current;
    const pip = pipRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !pip) {
      return;
    }

    event.preventDefault();
    const nextWidth = getPointerResizedWidth(
      drag.startWidth,
      drag.startPointerX,
      event.clientX,
      window.innerWidth,
      window.innerHeight,
    );
    currentWidthRef.current = nextWidth;
    pip.style.width = `${nextWidth}px`;
  };

  const finishResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (resizeDragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    resizeDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return createPortal(
    <div className="landmark-camera-pip-portal">
      <section
        ref={pipRef}
        className="landmark-camera-pip"
        aria-label={TITLES[variant]}
      >
        <header className="landmark-camera-pip__header">
          <h2>{TITLES[variant]}</h2>
          <button
            type="button"
            className="landmark-camera-pip__close"
            onClick={onClose}
            aria-label="랜드마크 카메라 닫기"
          >
            ×
          </button>
        </header>

        <div ref={viewportRef} className="landmark-camera-pip__viewport">
          <canvas ref={canvasRef} className="landmark-camera-pip__canvas" aria-hidden="true" />
          <p ref={promptRef} className="landmark-camera-pip__prompt" aria-live="polite">
            카메라를 정면으로 바라봐 주세요
          </p>
          <p ref={statusRef} className="landmark-camera-pip__status" hidden />
          <button
            ref={resizeHandleRef}
            type="button"
            className="landmark-camera-pip__resize-handle"
            aria-label="랜드마크 카메라 크기 조절"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
            onLostPointerCapture={() => {
              resizeDragRef.current = null;
            }}
          />
        </div>
      </section>
    </div>,
    document.body,
  );
}
