import type { GazeTargetEntry } from './types';

export interface TargetRegistry {
  register: (entry: GazeTargetEntry) => void;
  unregister: (id: string) => void;
  get: (id: string) => GazeTargetEntry | null;
  values: () => GazeTargetEntry[];
}

/**
 * Front Step 12 — Global Gaze Target Registry의 저장소 자체를 React와 분리한 순수
 * 모듈로 둔다. `GazeInteractionProvider`는 이 registry 인스턴스 하나를 ref로 들고
 * register/unregister만 노출한다 — 등록/해제/중복 처리 자체는 React 렌더링 없이
 * deterministic하게 테스트한다.
 *
 * 같은 id로 다시 register하면 `Map.set`이 자연스럽게 덮어쓴다(중복 항목이 쌓이지 않음).
 */
export function createTargetRegistry(): TargetRegistry {
  const targets = new Map<string, GazeTargetEntry>();

  return {
    register: (entry) => {
      targets.set(entry.id, entry);
    },
    unregister: (id) => {
      targets.delete(id);
    },
    get: (id) => targets.get(id) ?? null,
    values: () => Array.from(targets.values()),
  };
}
