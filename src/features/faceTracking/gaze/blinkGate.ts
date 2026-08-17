/**
 * Look-Talk 원본: src/tracking/blink.py BlinkDetector의 close/open 히스테리시스만 포팅한다
 * (close_threshold=0.18, open_threshold=0.22 — blink.py:87-88).
 *
 * NATURAL/INTENTIONAL/LONG_CLOSURE 분류(BlinkEvent)는 Look-Talk 자체에서도 계산만 되고
 * main.py 어디에서도 소비되지 않는 죽은 값이었고, Integration Plan §14.3의 BLINK confirm
 * (신규 설계 대상)과도 무관하므로 이번 Step 0에서 포팅하지 않는다.
 *
 * 여기서 만드는 건 Integration Plan §13.2 Eye-Closed Gate가 나중에 소비할 "지금 눈이
 * 감겨 있는가" 순수 판정 함수 하나뿐이다. GazeFilter/Dwell 파이프라인에 실제로 연결해
 * gaze를 무효화하는 배선은 Step 2 범위이며, 이번 Step에서는 debug 표시 용도로만 쓴다.
 */
export const EAR_CLOSE_THRESHOLD = 0.18;
export const EAR_OPEN_THRESHOLD = 0.22;

export function nextEyeClosedState(ear: number, wasClosed: boolean): boolean {
  if (wasClosed) {
    return !(ear > EAR_OPEN_THRESHOLD);
  }

  return ear < EAR_CLOSE_THRESHOLD;
}
