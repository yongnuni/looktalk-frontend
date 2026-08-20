/**
 * Look-Talk 원본: src/tracking/blink.py BlinkDetector의 close/open 히스테리시스만 포팅한다
 * (close_threshold=0.18, open_threshold=0.22 — blink.py:87-88).
 *
 * 여기서는 GazeFilter가 소비할 "지금 눈이 감겨 있는가" 판정과 공통 임계값을 제공한다.
 * NATURAL/INTENTIONAL/LONG_CLOSURE의 시간 상태 전이는 selection target 잠금이 필요한
 * BlinkController에서 같은 임계값을 재사용해 처리한다.
 */
export const EAR_CLOSE_THRESHOLD = 0.18;
export const EAR_OPEN_THRESHOLD = 0.22;

export function nextEyeClosedState(ear: number, wasClosed: boolean): boolean {
  if (wasClosed) {
    return !(ear > EAR_OPEN_THRESHOLD);
  }

  return ear < EAR_CLOSE_THRESHOLD;
}
