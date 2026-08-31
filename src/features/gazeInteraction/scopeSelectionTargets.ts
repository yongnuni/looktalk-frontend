import type { KeyTarget } from '../multimodalInput/types';
import { hitTestTargets, toSyntheticSelectionTargets } from './targetHitTest';
import type { GazeTargetEntry, InteractionScope } from './types';

/**
 * Front Step 13/14 §15 — 모든 scope가 실제 DOM rect를 base geometry로 사용한다.
 *
 * MAIN/CHAT/MODAL: 큰 DOM target(메뉴 카드, 채팅 상대, 메시지 보내기 버튼 등)이다.
 * DOMRect 안에 커서가 있는지만 보고(hitTestTargets), 그 hit을 커서 위치를 중심으로 하는
 * 1개짜리 synthetic target으로 감싼다(toSyntheticSelectionTargets, Front Step 12부터
 * 있던 그대로) — DwellController의 nearest-key+반경 판정을 그대로 통과시키기 위함이다.
 *
 * KEYBOARD: 먼저 실제 DOM rect 안에 있는 target 하나로 좁힌 뒤, 그 hit을 현재 커서 위치를
 * 중심으로 하는 synthetic target으로 감싼다. 이로써 보이는 rect가 base target의
 * source of truth가 되고, 기존 DwellController의 35/40/60px 거리 판정에는 항상 거리 0으로
 * 전달된다. 큰 Space/확인/추천 슬롯의 가장자리도 다시 탈락하지 않으며 gap은 후보가 없다.
 */
export function buildSelectionTargets(
  _scope: InteractionScope,
  eligibleTargets: GazeTargetEntry[],
  cursor: { x: number; y: number } | null,
): KeyTarget[] {
  const hit = cursor && eligibleTargets.length > 0 ? hitTestTargets(cursor, eligibleTargets) : null;
  return toSyntheticSelectionTargets(hit, cursor);
}
