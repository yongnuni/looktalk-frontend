import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { TrackingFrameListener } from '../gazeRuntime/GazeRuntimeContext';
import LandmarkCameraWindow from './LandmarkCameraWindow';
import landmarkWindowStyles from './LandmarkCameraWindow.css?inline';
import {
  LandmarkPopupContext,
  landmarkPopupReducer,
  type LandmarkPopupContextValue,
  type LandmarkPopupVariant,
} from './LandmarkPopupContext';
import LandmarkPopupLauncher from './LandmarkPopupLauncher';
import { LandmarkAutoOpenController } from './landmarkAutoOpen';
import {
  initializeLandmarkWindowDocument,
  openLandmarkWindow,
} from './landmarkWindow';

interface LandmarkPopupProviderProps {
  children: ReactNode;
  videoRef: RefObject<HTMLVideoElement | null>;
  subscribeTrackingFrame: (listener: TrackingFrameListener) => () => void;
}

export interface LandmarkPopupProviderHandle {
  /** 사용자 click handler 안에서 popup을 먼저 확보해 브라우저 차단을 피한다. */
  prepareWindow: () => boolean;
}

export const LandmarkPopupProvider = forwardRef<
  LandmarkPopupProviderHandle,
  LandmarkPopupProviderProps
>(function LandmarkPopupProvider(
  { children, videoRef, subscribeTrackingFrame },
  ref,
) {
  const [variant, dispatch] = useReducer(landmarkPopupReducer, null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [needsUserOpen, setNeedsUserOpen] = useState(false);
  const autoOpenControllerRef = useRef(new LandmarkAutoOpenController());
  const externalWindowRef = useRef<Window | null>(null);
  const externalPageHideListenerRef = useRef<(() => void) | null>(null);
  const closingExternalWindowRef = useRef(false);
  const mountedRef = useRef(true);
  const variantRef = useRef(variant);
  const pendingReleaseRef = useRef(0);

  const detachExternalWindow = useCallback((closeWindow: boolean) => {
    const externalWindow = externalWindowRef.current;
    const pageHideListener = externalPageHideListenerRef.current;

    if (externalWindow && pageHideListener) {
      externalWindow.removeEventListener('pagehide', pageHideListener);
      externalWindow.removeEventListener('beforeunload', pageHideListener);
    }

    externalPageHideListenerRef.current = null;
    externalWindowRef.current = null;

    if (mountedRef.current) {
      setPortalHost(null);
    }

    if (closeWindow && externalWindow && !externalWindow.closed) {
      closingExternalWindowRef.current = true;
      externalWindow.close();
      closingExternalWindowRef.current = false;
    }
  }, []);

  const prepareWindow = useCallback((focusWindow = true): boolean => {
    const existingWindow = externalWindowRef.current;
    if (existingWindow && !existingWindow.closed) {
      if (focusWindow) {
        existingWindow.focus();
      }
      setNeedsUserOpen(false);
      return true;
    }

    if (typeof window === 'undefined') {
      setNeedsUserOpen(true);
      return false;
    }

    const externalWindow = openLandmarkWindow(window);
    if (!externalWindow) {
      setNeedsUserOpen(true);
      return false;
    }

    try {
      const nextPortalHost = initializeLandmarkWindowDocument(
        externalWindow,
        landmarkWindowStyles,
      );
      const handlePageHide = () => {
        if (
          closingExternalWindowRef.current
          || externalWindowRef.current !== externalWindow
        ) {
          return;
        }

        externalWindowRef.current = null;
        externalPageHideListenerRef.current = null;
        autoOpenControllerRef.current.dismissActive();
        if (mountedRef.current) {
          setPortalHost(null);
          setNeedsUserOpen(variantRef.current !== null);
        }
      };

      externalWindowRef.current = externalWindow;
      externalPageHideListenerRef.current = handlePageHide;
      externalWindow.addEventListener('pagehide', handlePageHide);
      externalWindow.addEventListener('beforeunload', handlePageHide);
      setPortalHost(nextPortalHost);
      setNeedsUserOpen(false);
      if (focusWindow) {
        externalWindow.focus();
      }
      return true;
    } catch {
      externalWindow.close();
      setNeedsUserOpen(true);
      return false;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      prepareWindow: () => prepareWindow(true),
    }),
    [prepareWindow],
  );

  const open = useCallback((nextVariant: LandmarkPopupVariant) => {
    pendingReleaseRef.current += 1;
    variantRef.current = nextVariant;
    dispatch({ type: 'open', variant: nextVariant });
    prepareWindow(true);
  }, [prepareWindow]);

  const close = useCallback(() => {
    autoOpenControllerRef.current.dismissActive();
    detachExternalWindow(true);
    setNeedsUserOpen(variantRef.current !== null);
  }, [detachExternalWindow]);

  const reopen = useCallback(() => {
    prepareWindow(true);
  }, [prepareWindow]);

  const requestAutoOpen = useCallback(
    (key: string, nextVariant: LandmarkPopupVariant) => {
      pendingReleaseRef.current += 1;
      const transition = autoOpenControllerRef.current.request({
        key,
        variant: nextVariant,
      });

      if (!transition.variant) {
        variantRef.current = null;
        dispatch({ type: 'close' });
        return;
      }

      variantRef.current = transition.variant;
      dispatch({ type: 'open', variant: transition.variant });
      prepareWindow(false);
    },
    [prepareWindow],
  );

  const releaseAutoOpen = useCallback((key: string) => {
    const transition = autoOpenControllerRef.current.release(key);
    if (!transition.handled) {
      return;
    }

    const releaseToken = ++pendingReleaseRef.current;
    variantRef.current = null;
    dispatch({ type: 'close' });

    // stage 교체 시 old effect cleanup 직후 new effect가 같은 창을 재요청한다.
    // microtask까지 새 요청이 없을 때만 실제 창을 닫아 full↔looktalk 전환에서 재사용한다.
    queueMicrotask(() => {
      if (releaseToken !== pendingReleaseRef.current) {
        return;
      }
      detachExternalWindow(true);
      if (mountedRef.current) {
        setNeedsUserOpen(false);
      }
    });
  }, [detachExternalWindow]);

  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      pendingReleaseRef.current += 1;

      const externalWindow = externalWindowRef.current;
      const pageHideListener = externalPageHideListenerRef.current;
      if (externalWindow && pageHideListener) {
        externalWindow.removeEventListener('pagehide', pageHideListener);
        externalWindow.removeEventListener('beforeunload', pageHideListener);
      }
      externalPageHideListenerRef.current = null;
      externalWindowRef.current = null;
      if (externalWindow && !externalWindow.closed) {
        externalWindow.close();
      }
    };
  }, []);

  const value = useMemo<LandmarkPopupContextValue>(
    () => ({
      variant,
      open,
      close,
      reopen,
      needsUserOpen,
      requestAutoOpen,
      releaseAutoOpen,
    }),
    [
      variant,
      open,
      close,
      reopen,
      needsUserOpen,
      requestAutoOpen,
      releaseAutoOpen,
    ],
  );

  return (
    <LandmarkPopupContext.Provider value={value}>
      {children}
      {variant && portalHost && createPortal(
        <LandmarkCameraWindow
          variant={variant}
          onClose={close}
          videoRef={videoRef}
          subscribeTrackingFrame={subscribeTrackingFrame}
        />,
        portalHost,
      )}
      <LandmarkPopupLauncher />
    </LandmarkPopupContext.Provider>
  );
});
