import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { TrackingFrameListener } from '../gazeRuntime/GazeRuntimeContext';
import LandmarkCameraPip from './LandmarkCameraPip';
import {
  LandmarkPopupContext,
  landmarkPopupReducer,
  type LandmarkPopupContextValue,
  type LandmarkPopupVariant,
} from './LandmarkPopupContext';
import type { PipGeometry } from './pipResize';
import { LandmarkAutoOpenController } from './landmarkAutoOpen';

interface LandmarkPopupProviderProps {
  children: ReactNode;
  videoRef: RefObject<HTMLVideoElement | null>;
  subscribeTrackingFrame: (listener: TrackingFrameListener) => () => void;
}

export function LandmarkPopupProvider({
  children,
  videoRef,
  subscribeTrackingFrame,
}: LandmarkPopupProviderProps) {
  const [variant, dispatch] = useReducer(landmarkPopupReducer, null);
  const [geometry, setGeometry] = useState<PipGeometry | null>(null);
  const autoOpenControllerRef = useRef(new LandmarkAutoOpenController());

  const open = useCallback((nextVariant: LandmarkPopupVariant) => {
    dispatch({ type: 'open', variant: nextVariant });
  }, []);

  const close = useCallback(() => {
    autoOpenControllerRef.current.dismissActive();
    dispatch({ type: 'close' });
  }, []);

  const requestAutoOpen = useCallback(
    (key: string, nextVariant: LandmarkPopupVariant) => {
      const transition = autoOpenControllerRef.current.request({
        key,
        variant: nextVariant,
      });
      dispatch(
        transition.variant
          ? { type: 'open', variant: transition.variant }
          : { type: 'close' },
      );
    },
    [],
  );

  const releaseAutoOpen = useCallback((key: string) => {
    const transition = autoOpenControllerRef.current.release(key);
    if (transition.handled) {
      dispatch({ type: 'close' });
    }
  }, []);

  const value = useMemo<LandmarkPopupContextValue>(
    () => ({ variant, open, close, requestAutoOpen, releaseAutoOpen }),
    [variant, open, close, requestAutoOpen, releaseAutoOpen],
  );

  return (
    <LandmarkPopupContext.Provider value={value}>
      {children}
      {variant && (
        <LandmarkCameraPip
          variant={variant}
          initialGeometry={geometry}
          onGeometryChange={setGeometry}
          onClose={close}
          videoRef={videoRef}
          subscribeTrackingFrame={subscribeTrackingFrame}
        />
      )}
    </LandmarkPopupContext.Provider>
  );
}
