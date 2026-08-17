import { useEffect } from 'react';
import { useGazeInteraction } from './GazeInteractionContext';
import type { InteractionScope } from './types';

/**
 * Front Step 13 §9/§38/§39 — activeScope는 GazeInteractionProvider가 PATIENT route 전환
 * 동안 계속 살아 있는 단일 인스턴스이므로(§4), 페이지를 이동해도 이전 scope가 저절로
 * 바뀌지 않는다. 각 최상위 페이지가 mount 시 자신의 scope를 명시적으로 선언한다.
 *
 * scope가 바뀌면 이전 페이지의 target은 이미 그 페이지의 useGazeTarget cleanup으로
 * unregister되어 있으므로(§37), 여기서 dwell/mouth controller를 별도로 reset할 필요는
 * 없다 — GazeInteractionProvider의 매 프레임 처리가 registry에 없는 이전 target을 다시
 * hover할 수 없어 자연스럽게 idle로 수렴한다(gazeInteractionSelection.test.ts #15와 동일 원리).
 */
export function usePageScope(scope: InteractionScope): void {
  const { setActiveScope } = useGazeInteraction();

  useEffect(() => {
    setActiveScope(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 이 페이지가 mount된 동안 고정할 scope다
  }, [scope]);
}
