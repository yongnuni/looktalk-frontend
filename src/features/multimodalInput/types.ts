/** Look-Talk Button(pos/size) 대응 — 실제 렌더링된 key 요소의 viewport CSS px 중심. */
export interface KeyTarget {
  id: string;
  centerX: number;
  centerY: number;
}

/**
 * InputController 공통 계약(Integration Plan §14). EYE_TRACKING(Dwell)/MOUTH/BLINK가
 * 전부 이 shape을 공유한다 — VirtualKeyboard는 어떤 입력 방식인지 몰라도 된다.
 */
export interface InputSelectionState {
  hoveredKeyId: string | null;
  progress: number; // 0..1
  selectedKeyId: string | null;
}
