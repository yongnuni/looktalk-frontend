import type { InputMethod } from '../../shared/types/backend';

export type GazeInputMode = 'DWELL' | 'MOUTH';

/**
 * Front Step 8/9/11 — Backend UserSetting.currentInputMethod → 실제 production selection
 * mapping. BLINK confirm은 Look-Talk에 참조 구현이 없고 Web UX 계약도 없어(Front Step 9)
 * 아직 어떤 확정 방식으로도 연결되지 않는다 — 새로운 Blink 동작을 만들지 않고, 안전하게
 * DWELL로 대체한다(선택 자체는 MeasurementResultModal에서 BLINK가 비활성화되어 있어
 * 실제로는 거의 발생하지 않는 경로다).
 */
export function resolveGazeInputMode(currentInputMethod: InputMethod | undefined): GazeInputMode {
  return currentInputMethod === 'MOUTH' ? 'MOUTH' : 'DWELL';
}
