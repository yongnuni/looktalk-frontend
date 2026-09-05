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
   * 중요:
   * 이 함수는 이제 일반적인 stage 전환이나
   * 키보드 표시/숨김에서는 호출하지 않는다.
   *
   * 사용자가 명시적으로 닫거나
   * Provider 자체가 unmount될 때만 사용한다.
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
   * 이미 창이 존재하면:
   * - 절대 새로 생성하지 않음
   * - focus 하지 않음
   * - 최소화 상태라면 그대로 유지
   */
  const prepareWindow = useCallback((): boolean => {
    const existingWindow = externalWindowRef.current;

    if (existingWindow && !existingWindow.closed) {
      setNeedsUserOpen(false);

      // 중요:
      // 기존 창에 focus() 절대 호출하지 않음
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

        /*
         * 사용자가 X 버튼으로 직접 닫은 경우
         */
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
       *
       * 실제 Windows 최소화는 브라우저 API에서
       * 강제로 할 수 없지만 새 팝업이 계속 앞으로
       * 튀어나오는 현상을 줄인다.
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

      /*
       * 기존 창이 있으면 그대로 사용.
       *
       * 최소화되어 있다면 절대 다시 앞으로
       * 가져오지 않는다.
       */
      prepareWindow();
    },
    [prepareWindow],
  );

  /*
   * 사용자가 명시적으로 랜드마크 창을 닫는 경우.
   *
   * 이 경우에만 실제 팝업을 닫는다.
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
   * 현재는 Launcher 버튼을 제거했기 때문에
   * 일반적으로 사용되지 않지만 Context 호환성을 위해 유지.
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

      /*
       * ★ 핵심
       *
       * 팝업이 이미 있다면 절대로 새로 만들지 않는다.
       *
       * 따라서 사용자가 랜드마크 창을 최소화해놨다면
       * 키보드가 열리거나 화면 상태가 바뀌어도
       * 최소화 상태 그대로 유지된다.
       */
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

    /*
     * ★ 가장 중요한 수정
     *
     * 기존 코드에서는 여기서
     *
     * detachExternalWindow(true)
     *
     * 를 호출하여 실제 팝업을 닫았다.
     *
     * 그러면 키보드가 켜질 때
     *
     * 기존 창 닫힘
     *      ↓
     * requestAutoOpen
     *      ↓
     * 새로운 window.open()
     *      ↓
     * 팝업 다시 화면에 등장
     *
     * 문제가 발생한다.
     *
     * 이제 실제 Window는 닫지 않고 유지한다.
     */

    if (transition.variant) {
      variantRef.current = transition.variant;

      dispatch({
        type: 'open',
        variant: transition.variant,
      });

      return;
    }

    /*
     * 현재 stage에서 랜드마크 UI가 필요 없는 경우에도
     * 외부 window 자체는 유지한다.
     *
     * 따라서 최소화해놓은 창 역시 그대로 존재한다.
     */
    variantRef.current = null;

    dispatch({
      type: 'close',
    });

    // 절대 아래 코드 호출하지 않음.
    //
    // detachExternalWindow(true);
  }, []);

  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);

  /*
   * Provider 자체가 사라질 때만
   * 랜드마크 외부 창을 완전히 정리한다.
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
