import type { KeyTarget } from '../multimodalInput/types';
import { hitTestTargets, toSyntheticSelectionTargets } from './targetHitTest';
import type { GazeTargetEntry, InteractionScope } from './types';

/**
 * Front Step 13/14 §15 — scope별로 다른 geometry 판정 정책을 적용한다.
 *
 * MAIN/CHAT/MODAL: 큰 DOM target(메뉴 카드, 채팅 상대, 메시지 보내기 버튼 등)이다.
 * DOMRect 안에 커서가 있는지만 보고(hitTestTargets), 그 hit을 커서 위치를 중심으로 하는
 * 1개짜리 synthetic target으로 감싼다(toSyntheticSelectionTargets, Front Step 12부터
 * 있던 그대로) — DwellController의 nearest-key+반경 판정을 그대로 통과시키기 위함이다.
 *
 * KEYBOARD: VirtualKeyboard의 key는 촘촘하게 붙어 있는 작은 버튼들이라 "그 rect 안에
 * 정확히 있어야 hit"으로 판정하면 기존 Look-Talk의 nearest-key + assist_radius(35px) +
 * lock_radius(40px→60px) 히스테리시스 느낌이 사라진다(VirtualKeyboard Integration Plan
 * §14.1). 그래서 이 scope에서는 hit-test로 후보를 1개로 좁히지 않고, 화면에 보이는 모든
 * KEYBOARD target의 실제 렌더링된 중심(rect center)을 그대로 DwellController/
 * MouthController에 넘긴다 — DwellController 자체는 전혀 수정하지 않는다.
 */
export function buildSelectionTargets(
  scope: InteractionScope,
  eligibleTargets: GazeTargetEntry[],
  cursor: { x: number; y: number } | null,
): KeyTarget[] {
  if (scope === 'KEYBOARD') {
    return eligibleTargets.map((target) => {
      const rect = target.element.getBoundingClientRect();
      return {
        id: target.id,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
    });
  }

  const hit = cursor && eligibleTargets.length > 0 ? hitTestTargets(cursor, eligibleTargets) : null;
  return toSyntheticSelectionTargets(hit, cursor);
}
