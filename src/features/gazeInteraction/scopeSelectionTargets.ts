import type { KeyTarget } from '../multimodalInput/types';
import type { GazeHitResolver } from './fixation/KeyboardFixationLayer';
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
 *
 * `resolveHit`은 이 "hit 하나로 좁히는" 단계만 갈아 끼우는 자리다. 기본값은 순수 DOM rect
 * 판정(hitTestTargets)이고, 고정 감지형(fixation/KeyboardFixationLayer)이 켜져 있으면
 * 확장된 히트박스를 반영한 판정이 대신 들어온다 — DWELL/BLINK/MOUTH가 전부 이 결과를
 * 받아 가므로 세 트리거에 동시에 적용된다.
 */
export function buildSelectionTargets(
  _scope: InteractionScope,
  eligibleTargets: GazeTargetEntry[],
  cursor: { x: number; y: number } | null,
  resolveHit: GazeHitResolver = hitTestTargets,
): KeyTarget[] {
  const hit = cursor && eligibleTargets.length > 0 ? resolveHit(cursor, eligibleTargets) : null;
  return toSyntheticSelectionTargets(hit, cursor);
}
