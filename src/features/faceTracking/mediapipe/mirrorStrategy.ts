/**
 * Integration Plan §5.3 Mirror 전략 — Front Step 0 PoC 결과로 확정됨.
 *
 * Python Look-Talk은 cv2.flip(frame, 1)을 추론 이전에 적용한다(main.py:876, face_mesh.process
 * 이전). `/dev/face-tracking`에서 전략 A(추론 전 frame mirror)와 전략 B(추론 후 landmark
 * x=1-x)를 실제 카메라로 비교한 결과 iris/EAR/MAR 안정성과 체감 FPS에 유의미한 차이가
 * 없었다. 따라서 Python과 직접 대응되는 **전략 A(PRE_INFERENCE_FRAME_FLIP)를 최종 채택**한다.
 *
 * 전략 B와 두 값을 모두 나열해 두는 타입/배열은 삭제하지 않는다 — A/B 토글은 개발 검증용
 * debug 기능으로 계속 남겨둔다(디버그 페이지 전용, 프로덕션 파이프라인은 A 고정).
 */
export type MirrorStrategy = 'PRE_INFERENCE_FRAME_FLIP' | 'POST_INFERENCE_LANDMARK_FLIP';

export const MIRROR_STRATEGIES: readonly MirrorStrategy[] = [
  'PRE_INFERENCE_FRAME_FLIP',
  'POST_INFERENCE_LANDMARK_FLIP',
];

export const MIRROR_STRATEGY_LABELS: Record<MirrorStrategy, string> = {
  PRE_INFERENCE_FRAME_FLIP: 'A — 추론 전 frame mirror (Python cv2.flip 대응)',
  POST_INFERENCE_LANDMARK_FLIP: 'B — 추론 후 landmark x = 1 - x',
};

/**
 * 확정된 프로덕션 기본값(§5.3 PoC 결과). Raw Calibration(Step 1) 이후 파이프라인은
 * 전부 이 값을 기준으로 동작한다. debug 페이지에서만 다른 값으로 일시 전환할 수 있다.
 */
export const DEFAULT_MIRROR_STRATEGY: MirrorStrategy = 'PRE_INFERENCE_FRAME_FLIP';
