import { createContext, useContext } from 'react';

export type LandmarkPopupVariant = 'full' | 'looktalk';
export type LandmarkPopupState = LandmarkPopupVariant | null;

export type LandmarkPopupAction =
  | { type: 'open'; variant: LandmarkPopupVariant }
  | { type: 'close' };

export function landmarkPopupReducer(
  _state: LandmarkPopupState,
  action: LandmarkPopupAction,
): LandmarkPopupState {
  if (action.type === 'open') {
    return action.variant;
  }

  return null;
}

export interface LandmarkPopupContextValue {
  variant: LandmarkPopupState;
  open: (variant: LandmarkPopupVariant) => void;
  close: () => void;
  requestAutoOpen: (key: string, variant: LandmarkPopupVariant) => void;
  releaseAutoOpen: (key: string) => void;
}

export const LandmarkPopupContext = createContext<LandmarkPopupContextValue | null>(null);

export function useLandmarkPopup(): LandmarkPopupContextValue {
  const context = useContext(LandmarkPopupContext);

  if (!context) {
    throw new Error('useLandmarkPopup()은 LandmarkPopupProvider 내부에서만 사용할 수 있다.');
  }

  return context;
}

export function useOptionalLandmarkPopup(): LandmarkPopupContextValue | null {
  return useContext(LandmarkPopupContext);
}
