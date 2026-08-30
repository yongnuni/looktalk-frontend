import { createContext, useContext } from 'react';
import type { GazeInputMode } from '../multimodalInput/gazeInputMode';
import type { GazeTargetEntry, InteractionScope } from './types';

/**
 * Front Step 12 — Global Gaze Target Registry + selection state의 context 계약.
 * Provider 구현은 별도 파일(`GazeInteractionProvider.tsx`)에 있다 — Fast Refresh 규칙
 * (`react-refresh/only-export-components`) 때문에 컴포넌트가 아닌 context/훅은 분리한다
 * (Front Step 11의 GazeRuntimeContext.ts와 동일한 이유).
 */
export interface GazeInteractionContextValue {
  registerTarget: (entry: GazeTargetEntry) => void;
  unregisterTarget: (id: string) => void;

  /** UI 표시용(진행률 링 등)으로만 쓰는 throttled 상태 — selection 판정 자체는 이 값에
   * 의존하지 않는다(매 프레임 subscribeFrame 안에서 직접 계산). */
  hoveredTargetId: string | null;
  progress: number;
  activeScope: InteractionScope;
  setActiveScope: (scope: InteractionScope) => void;
  inputMode: GazeInputMode;
}

export const GazeInteractionContext = createContext<GazeInteractionContextValue | null>(null);

export function useGazeInteraction(): GazeInteractionContextValue {
  const context = useContext(GazeInteractionContext);

  if (!context) {
    throw new Error('useGazeInteraction()은 GazeInteractionProvider 내부에서만 사용할 수 있다.');
  }

  return context;
}

export function useOptionalGazeInteraction(): GazeInteractionContextValue | null {
  return useContext(GazeInteractionContext);
}
