import type { InputMethod } from '../../shared/types/backend';
import type { InputMethodId } from './types/analysis';

/**
 * Front Step 17 §16 — Analysis 화면의 UI id(`InputMethodId`: 'gaze'/'blink'/'mouth')와
 * 실제 Backend `UserSetting.currentInputMethod` enum('EYE_TRACKING'/'BLINK'/'MOUTH')을
 * 연결하는 단일 지점이다. 이전에는 InputMethodSelectionModal의 선택 결과가 이 매핑을
 * 거치지 않고 로컬 mock 상태(analysisItems)만 바꿔, 실제로는 어떤 문자열도 Backend에
 * 전달되지 않았다(BUG C/D/E root cause) — 이제 이 함수가 실제 저장 경로의 유일한
 * 변환 지점이다.
 */
const INPUT_METHOD_ID_TO_BACKEND: Record<InputMethodId, InputMethod> = {
  gaze: 'EYE_TRACKING',
  blink: 'BLINK',
  mouth: 'MOUTH',
};

export function mapInputMethodIdToBackend(id: InputMethodId): InputMethod {
  return INPUT_METHOD_ID_TO_BACKEND[id];
}
