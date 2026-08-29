import type { InputMethod } from '../../shared/types/backend';

export type GazeInputMode = 'DWELL' | 'BLINK' | 'MOUTH';

/**
 * Backend UserSetting.currentInputMethod → 실제 production selection mapping.
 * 시선 좌표는 세 모드가 공유하고 최종 confirm trigger만 DWELL/BLINK/MOUTH로 분리한다.
 */
export function resolveGazeInputMode(currentInputMethod: InputMethod | undefined): GazeInputMode {
  if (currentInputMethod === 'BLINK') {
    return 'BLINK';
  }

  return currentInputMethod === 'MOUTH' ? 'MOUTH' : 'DWELL';
}
