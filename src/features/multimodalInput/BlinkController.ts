/**
 * Front Step 9 — BLINK confirm.
 *
 * Look-Talk 원본(src/tracking/blink.py)에는 BlinkDetector가 존재하지만, main.py 전체를
 * 재확인한 결과 실제로 사용되는 것은 `blink_detector.is_closed`(Eye-Closed Gate, §13.2 —
 * GazeFilter.update()의 blink 파라미터로만 쓰인다) 뿐이다. `blink_detector.update(lms)`가
 * 반환하는 BlinkEvent(NATURAL/INTENTIONAL/LONG_CLOSURE 분류)는 계산만 되고 main.py
 * 어디에서도 소비되지 않는다(재확인: `grep blink_event main.py` → 대입 2곳뿐, 사용처 없음).
 * 즉 "blink 동작으로 key를 확정"하는 입력 방식은 Look-Talk에 참고할 실제 구현이 없다.
 *
 * Integration Plan §14.3 / Front Step 9 지침: 최종 UX/threshold가 확정되기 전에는
 * production에서 선택 가능한 상태로 두지 않는다("EYE_TRACKING 코드를 복사해 이름만
 * BLINK로 바꾸지 않는다"). 그래서 이 파일은 실제 로직이 없는 stub이며 useGazeInput에
 * 연결하지 않는다 — BLINK는 MeasurementResultModal에서 disabled로만 노출된다
 * (features/calibration/components/MeasurementResultModal.tsx).
 *
 * 이 상태는 사용자 지침에서 사전에 승인된 결과다(Python에 confirm 참고 구현이 없고,
 * 이 저장소에도 확정된 UX 계약이 없는 경우의 non-blocking 결론).
 */
export class BlinkController {
  update(): never {
    throw new Error(
      'BlinkController는 아직 구현되지 않았다(Integration Plan §14.3). ' +
        'BLINK는 UI에서 선택 불가능하게 막혀 있어야 하며, 이 메서드가 호출되면 안 된다.',
    );
  }
}
