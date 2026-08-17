import { useCallback, useEffect, useRef } from 'react';
import type { RefCallback } from 'react';
import { useGazeInteraction } from './GazeInteractionContext';
import type { InteractionScope } from './types';

export interface UseGazeTargetOptions {
  id: string;
  scope: InteractionScope;
  enabled?: boolean;
  /** dwell/mouth 완료 시 호출된다 — 기존 Mouse onClick과 동일한 action을 그대로 넘길 것
   * (§24, 새 navigate/business 로직을 따로 만들지 않는다). */
  onSelect: () => void;
}

/**
 * Front Step 12 — DOM element 하나를 Global Gaze Target으로 등록/해제하는 hook.
 * ref callback을 반환한다: element가 mount되면 registerTarget, unmount(또는 id/scope가
 * 바뀌어 재호출)되면 unregisterTarget — React StrictMode의 mount→unmount→mount 시뮬레이션에도
 * `Map.set/delete`는 멱등이라 duplicate registration/cleanup 오류가 없다(§14).
 *
 * `enabled`/`onSelect`는 ref-mirroring으로만 갱신한다 — 매 렌더마다 재등록하지 않는다.
 */
export function useGazeTarget({ id, scope, enabled = true, onSelect }: UseGazeTargetOptions): RefCallback<HTMLElement> {
  const { registerTarget, unregisterTarget } = useGazeInteraction();

  const enabledRef = useRef(enabled);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const mountedIdRef = useRef<string | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      if (mountedIdRef.current) {
        unregisterTarget(mountedIdRef.current);
        mountedIdRef.current = null;
      }

      if (node) {
        registerTarget({ id, scope, element: node, enabledRef, onSelectRef });
        mountedIdRef.current = id;
      }
    },
    [id, scope, registerTarget, unregisterTarget],
  );
}
