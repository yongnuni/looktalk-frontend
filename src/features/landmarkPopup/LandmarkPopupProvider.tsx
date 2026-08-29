import { useCallback, useMemo, useReducer, useState } from 'react';
import type { ReactNode } from 'react';
import LandmarkCameraPip from './LandmarkCameraPip';
import {
  LandmarkPopupContext,
  landmarkPopupReducer,
  type LandmarkPopupContextValue,
  type LandmarkPopupVariant,
} from './LandmarkPopupContext';
import type { PipGeometry } from './pipResize';

interface LandmarkPopupProviderProps {
  children: ReactNode;
}

export function LandmarkPopupProvider({ children }: LandmarkPopupProviderProps) {
  const [variant, dispatch] = useReducer(landmarkPopupReducer, null);
  const [geometry, setGeometry] = useState<PipGeometry | null>(null);

  const open = useCallback((nextVariant: LandmarkPopupVariant) => {
    dispatch({ type: 'open', variant: nextVariant });
  }, []);

  const close = useCallback(() => {
    dispatch({ type: 'close' });
  }, []);

  const value = useMemo<LandmarkPopupContextValue>(
    () => ({ variant, open, close }),
    [variant, open, close],
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
        />
      )}
    </LandmarkPopupContext.Provider>
  );
}
