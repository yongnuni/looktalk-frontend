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
  /** MOUTH 모드에서만 채워지는 MouthController.isOpen 판정 결과(§realtimeMetrics 재사용용).
   * DWELL 모드/hasSignal=false 분기에서는 이 키 자체를 반환 객체에 포함시키지 않는다 —
   * 기존 IDLE_SELECTION/DwellController 반환값과의 toEqual 비교(테스트)를 그대로 유지하기 위함. */
  mouthOpen?: boolean;
}
