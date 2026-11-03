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
import { LandmarkAutoOpenController } from './landmarkAutoOpen';
import {
  initializeLandmarkWindowDocument,
  openLandmarkWindow,
} from './landmarkWindow';

// 랜드마크 카메라 별도 팝업 사용 여부
// false: 팝업 실행 안 함
// true: 팝업 실행
const ENABLE_LANDMARK_POPUP = false;

interface LandmarkPopupProviderProps {
  children: ReactNode;
  videoRef: RefObject<HTMLVideoElement | null>;
  subscribeTrackingFrame: (listener: TrackingFrameListener) => () => void;
}

export interface LandmarkPopupProviderHandle {
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

  // 실제 외부 랜드마크 창
  const externalWindowRef = useRef<Window | null>(null);

  const externalPageHideListenerRef = useRef<(() => void) | null>(null);
  const closingExternalWindowRef = useRef(false);

  const mountedRef = useRef(true);
  const variantRef = useRef(variant);

  /*
   * 외부 랜드마크 창을 실제로 제거하는 함수.
   *
   * 기존 기능 유지를 위해 그대로 보존한다.
   */
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

  /*
   * 랜드마크 창 준비
   *
   * ENABLE_LANDMARK_POPUP이 false이면
   * 새 브라우저 창을 생성하지 않는다.
   *
   * true로 변경하면 기존 팝업 기능이 다시 활성화된다.
   */
  const prepareWindow = useCallback((): boolean => {
    if (!ENABLE_LANDMARK_POPUP) {
      setNeedsUserOpen(false);
      return false;
    }

    const existingWindow = externalWindowRef.current;

    if (existingWindow && !existingWindow.closed) {
      setNeedsUserOpen(false);

      // 기존 창에 focus() 호출하지 않음
      return true;
    }

    if (typeof window === 'undefined') {
      setNeedsUserOpen(true);
      return false;
    }

    /*
     * 현재 랜드마크 창이 실제로 존재하지 않을 때만
     * 새로운 창을 생성한다.
     */
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
          closingExternalWindowRef.current ||
          externalWindowRef.current !== externalWindow
        ) {
          return;
        }

        // 사용자가 X 버튼으로 직접 닫은 경우
        externalWindowRef.current = null;
        externalPageHideListenerRef.current = null;

        autoOpenControllerRef.current.dismissActive();

        if (mountedRef.current) {
          setPortalHost(null);
          setNeedsUserOpen(false);
        }
      };

      externalWindowRef.current = externalWindow;
      externalPageHideListenerRef.current = handlePageHide;

      externalWindow.addEventListener('pagehide', handlePageHide);
      externalWindow.addEventListener('beforeunload', handlePageHide);

      setPortalHost(nextPortalHost);
      setNeedsUserOpen(false);

      /*
       * 팝업 생성 후 메인 Look Talk 창을 다시 앞으로.
       */
      try {
        externalWindow.blur();
        window.focus();
      } catch {
        // 브라우저에서 focus 제어를 제한하면 무시
      }

      return true;
    } catch {
      externalWindow.close();

      setNeedsUserOpen(false);

      return false;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      prepareWindow,
    }),
    [prepareWindow],
  );

  /*
   * 일반 open
   */
  const open = useCallback(
    (nextVariant: LandmarkPopupVariant) => {
      variantRef.current = nextVariant;

      dispatch({
        type: 'open',
        variant: nextVariant,
      });

      prepareWindow();
    },
    [prepareWindow],
  );

  /*
   * 사용자가 명시적으로 랜드마크 창을 닫는 경우.
   */
  const close = useCallback(() => {
    autoOpenControllerRef.current.dismissActive();

    variantRef.current = null;

    dispatch({
      type: 'close',
    });

    detachExternalWindow(true);

    setNeedsUserOpen(false);
  }, [detachExternalWindow]);

  /*
   * Context 호환성을 위해 유지.
   */
  const reopen = useCallback(() => {
    prepareWindow();
  }, [prepareWindow]);

  /*
   * 각 페이지 / stage에서 랜드마크 사용 요청
   */
  const requestAutoOpen = useCallback(
    (key: string, nextVariant: LandmarkPopupVariant) => {
      const transition = autoOpenControllerRef.current.request({
        key,
        variant: nextVariant,
      });

      if (!transition.variant) {
        variantRef.current = null;

        dispatch({
          type: 'close',
        });

        return;
      }

      variantRef.current = transition.variant;

      dispatch({
        type: 'open',
        variant: transition.variant,
      });

      prepareWindow();
    },
    [prepareWindow],
  );

  /*
   * 자동 랜드마크 사용 해제
   */
  const releaseAutoOpen = useCallback((key: string) => {
    const transition = autoOpenControllerRef.current.release(key);

    if (!transition.handled) {
      return;
    }

    if (transition.variant) {
      variantRef.current = transition.variant;

      dispatch({
        type: 'open',
        variant: transition.variant,
      });

      return;
    }

    variantRef.current = null;

    dispatch({
      type: 'close',
    });

    // 기존 외부 창 관리 코드는 유지한다.
  }, []);

  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);

  /*
   * Provider 자체가 사라질 때 외부 창 정리
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

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

      {variant &&
        portalHost &&
        createPortal(
          <LandmarkCameraWindow
            variant={variant}
            videoRef={videoRef}
            subscribeTrackingFrame={subscribeTrackingFrame}
          />,
          portalHost,
        )}
    </LandmarkPopupContext.Provider>
  );
});
