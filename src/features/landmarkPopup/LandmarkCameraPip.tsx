import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { TrackingFrameListener } from '../gazeRuntime/GazeRuntimeContext';
import type { LandmarkPopupVariant } from './LandmarkPopupContext';
import { drawLandmarkFrame } from './landmarkDrawing';
import {
  clampPipGeometry,
  getDefaultPipGeometry,
  getDraggedPipGeometry,
  getPointerResizedGeometry,
  shouldStartPipDrag,
  type PipGeometry,
  type PipResizeCorner,
} from './pipResize';
import './LandmarkCameraPip.css';
import {
  EMPTY_LANDMARK_SIGNAL_HUD,
  formatLandmarkSignalHud,
} from './landmarkSignalHud';

interface LandmarkCameraPipProps {
  variant: LandmarkPopupVariant;
  initialGeometry: PipGeometry | null;
  onGeometryChange: (geometry: PipGeometry) => void;
  onClose: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  subscribeTrackingFrame: (listener: TrackingFrameListener) => () => void;
}

interface PointerInteraction {
  kind: 'drag' | 'resize';
  pointerId: number;
  startPointer: { x: number; y: number };
  startGeometry: PipGeometry;
  corner?: PipResizeCorner;
  captureTarget: HTMLElement;
}

const TITLES: Record<LandmarkPopupVariant, string> = {
  full: '전체 얼굴 랜드마크',
  looktalk: '눈 · 홍채 · 입 랜드마크',
};

const RESIZE_CORNERS: ReadonlyArray<PipResizeCorner> = ['sw', 'se'];

export default function LandmarkCameraPip({
  variant,
  initialGeometry,
  onGeometryChange,
  onClose,
  videoRef,
  subscribeTrackingFrame,
}: LandmarkCameraPipProps) {
  const pipRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const promptRef = useRef<HTMLParagraphElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const signalHudRef = useRef<HTMLParagraphElement | null>(null);
  const variantRef = useRef(variant);
  const displaySizeRef = useRef({ width: 0, height: 0 });
  const geometryRef = useRef<PipGeometry | null>(initialGeometry);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const onGeometryChangeRef = useRef(onGeometryChange);

  useEffect(() => {
    variantRef.current = variant;

    if (variant === 'looktalk' && statusRef.current) {
      statusRef.current.hidden = true;
    }
  }, [variant]);

  useEffect(() => {
    onGeometryChangeRef.current = onGeometryChange;
  }, [onGeometryChange]);

  const applyGeometry = useCallback((geometry: PipGeometry) => {
    const pip = pipRef.current;
    if (!pip) {
      return;
    }

    geometryRef.current = geometry;
    pip.style.left = `${geometry.x}px`;
    pip.style.top = `${geometry.y}px`;
    pip.style.width = `${geometry.width}px`;
  }, []);

  const finishInteraction = useCallback((pointerId: number) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== pointerId) {
      return;
    }

    interactionRef.current = null;
    pipRef.current?.removeAttribute('data-interacting');
    if (geometryRef.current) {
      onGeometryChangeRef.current(geometryRef.current);
    }
    if (interaction.captureTarget.hasPointerCapture(pointerId)) {
      interaction.captureTarget.releasePointerCapture(pointerId);
    }
  }, []);

  useEffect(() => {
    const firstGeometry = initialGeometry
      ? clampPipGeometry(initialGeometry, window.innerWidth, window.innerHeight)
      : getDefaultPipGeometry(window.innerWidth, window.innerHeight);
    applyGeometry(firstGeometry);
    onGeometryChangeRef.current(firstGeometry);

    const handleViewportResize = () => {
      const current = geometryRef.current ?? getDefaultPipGeometry(
        window.innerWidth,
        window.innerHeight,
      );
      const clamped = clampPipGeometry(current, window.innerWidth, window.innerHeight);
      applyGeometry(clamped);
      onGeometryChangeRef.current(clamped);
    };

    window.addEventListener('resize', handleViewportResize);

    return () => {
      window.removeEventListener('resize', handleViewportResize);
      const interaction = interactionRef.current;
      interactionRef.current = null;
      if (interaction?.captureTarget.hasPointerCapture(interaction.pointerId)) {
        interaction.captureTarget.releasePointerCapture(interaction.pointerId);
      }
    };
    // initialGeometry은 mount 시 Provider session snapshot으로만 사용한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyGeometry]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;

    if (!viewport || !canvas) {
      return;
    }

    const updateDisplaySize = () => {
      const rect = viewport.getBoundingClientRect();
      displaySizeRef.current = { width: rect.width, height: rect.height };
    };

    updateDisplaySize();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateDisplaySize);
    resizeObserver?.observe(viewport);

    const unsubscribe = subscribeTrackingFrame((frame) => {
      const video = videoRef.current;
      const { width, height } = displaySizeRef.current;

      if (signalHudRef.current) {
        signalHudRef.current.textContent = formatLandmarkSignalHud(frame.signal);
      }

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
        statusRef.current.textContent = showFullStatus ? '얼굴 주요 랜드마크 감지됨' : '';
      }
    });

    return () => {
      unsubscribe();
      resizeObserver?.disconnect();
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      displaySizeRef.current = { width: 0, height: 0 };
    };
  }, [subscribeTrackingFrame, videoRef]);

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const closeButtonHit = event.target instanceof Element
      && event.target.closest('.landmark-camera-pip__close') !== null;
    if (!shouldStartPipDrag(event.button, closeButtonHit)) {
      return;
    }

    const geometry = geometryRef.current;
    if (!geometry) {
      return;
    }

    event.preventDefault();
    interactionRef.current = {
      kind: 'drag',
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startGeometry: geometry,
      captureTarget: event.currentTarget,
    };
    pipRef.current?.setAttribute('data-interacting', 'drag');
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const currentPointer = { x: event.clientX, y: event.clientY };
    const geometry = interaction.kind === 'drag'
      ? getDraggedPipGeometry(
          interaction.startGeometry,
          interaction.startPointer,
          currentPointer,
          window.innerWidth,
          window.innerHeight,
        )
      : getPointerResizedGeometry(
          interaction.startGeometry,
          interaction.corner ?? 'se',
          interaction.startPointer,
          currentPointer,
          window.innerWidth,
          window.innerHeight,
        );
    applyGeometry(geometry);
  };

  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    corner: PipResizeCorner,
  ) => {
    const geometry = geometryRef.current;
    if (event.button !== 0 || !geometry) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      kind: 'resize',
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startGeometry: geometry,
      corner,
      captureTarget: event.currentTarget,
    };
    pipRef.current?.setAttribute('data-interacting', 'resize');
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return createPortal(
    <div className="landmark-camera-pip-portal">
      <section ref={pipRef} className="landmark-camera-pip" aria-label={TITLES[variant]}>
        <header
          className="landmark-camera-pip__header"
          onPointerDown={handleHeaderPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishInteraction(event.pointerId)}
          onPointerCancel={(event) => finishInteraction(event.pointerId)}
          onLostPointerCapture={(event) => finishInteraction(event.pointerId)}
        >
          <h2>{TITLES[variant]}</h2>
          <button
            type="button"
            className="landmark-camera-pip__close"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            aria-label="랜드마크 카메라 닫기"
          >
            ×
          </button>
        </header>

        <div ref={viewportRef} className="landmark-camera-pip__viewport">
          <canvas ref={canvasRef} className="landmark-camera-pip__canvas" aria-hidden="true" />
          <p ref={signalHudRef} className="landmark-camera-pip__signal-hud">
            {EMPTY_LANDMARK_SIGNAL_HUD}
          </p>
          <p ref={promptRef} className="landmark-camera-pip__prompt" aria-live="polite">
            카메라를 정면으로 바라봐 주세요
          </p>
          <p ref={statusRef} className="landmark-camera-pip__status" hidden />
        </div>

        {RESIZE_CORNERS.map((corner) => (
          <button
            key={corner}
            type="button"
            className={`landmark-camera-pip__resize-handle landmark-camera-pip__resize-handle--${corner}`}
            aria-label={`${corner} 모서리에서 랜드마크 카메라 크기 조절`}
            onPointerDown={(event) => handleResizePointerDown(event, corner)}
            onPointerMove={handlePointerMove}
            onPointerUp={(event) => finishInteraction(event.pointerId)}
            onPointerCancel={(event) => finishInteraction(event.pointerId)}
            onLostPointerCapture={(event) => finishInteraction(event.pointerId)}
          />
        ))}
      </section>
    </div>,
    document.body,
  );
}
