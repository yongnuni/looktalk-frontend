import type { KeyTarget } from '../multimodalInput/types';
import type { GazeTargetEntry, InteractionScope } from './types';

/**
 * Front Step 12 §12 — 큰 DOM target(예: MainPage 메뉴 카드)은 VirtualKeyboard key처럼
 * "중심점 + 작은 반경"으로 판정하면 안 된다(카드 안에 있어도 중심에서 멀면 선택 안 되는
 * 문제). 대신 실제 `getBoundingClientRect()` 안에 커서가 있는지를 직접 판정한다 —
 * Figma 좌표나 추정 center를 쓰지 않는다(§10).
 */
export function hitTestTargets(
  cursor: { x: number; y: number },
  targets: GazeTargetEntry[],
): GazeTargetEntry | null {
  for (const target of targets) {
    const rect = target.element.getBoundingClientRect();

    if (cursor.x >= rect.left && cursor.x <= rect.right && cursor.y >= rect.top && cursor.y <= rect.bottom) {
      return target;
    }
  }

  return null;
}

/** §16 — 현재 activeScope에 속하고 disabled가 아닌 target만 hit-test 후보로 남긴다. */
export function filterEligibleTargets(
  targets: Iterable<GazeTargetEntry>,
  scope: InteractionScope,
): GazeTargetEntry[] {
  return Array.from(targets).filter((target) => target.scope === scope && target.enabledRef.current);
}

/**
 * §13 — Geometry(DOM rect hit-test)와 Dwell/Mouth timing(기존 DwellController/
 * MouthController, gazeFrameSelection.processGazeFrameForSelection)의 책임을 분리한다.
 * hit된 target을 "중심점이 현재 커서 위치인" 1개짜리 KeyTarget으로 감싸면, 기존
 * DwellController의 nearest-center+반경 판정이 대상 거리를 사실상 0으로 보게 되어
 * center-only 문제 없이 그대로 재사용할 수 있다 — DwellController 자체는 전혀 수정하지
 * 않는다(DOM을 모른 채로 유지).
 */
export function toSyntheticSelectionTargets(
  hit: GazeTargetEntry | null,
  cursor: { x: number; y: number } | null,
): KeyTarget[] {
  if (!hit || !cursor) {
    return [];
  }

  return [{ id: hit.id, centerX: cursor.x, centerY: cursor.y }];
}
