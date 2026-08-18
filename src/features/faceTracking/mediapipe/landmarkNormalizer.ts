import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { MirrorStrategy } from './mirrorStrategy';

/**
 * FaceLandmarker 원시 출력을 "canonical(mirrored) 좌표"로 변환한다(Integration Plan §5.3).
 *
 * - PRE_INFERENCE_FRAME_FLIP: 추론 전 프레임을 이미 좌우 반전했으므로 landmark는 이미 canonical.
 * - POST_INFERENCE_LANDMARK_FLIP: 원본(비반전) 프레임으로 추론했으므로 x만 사후 반전한다.
 *
 * 한 파이프라인에서 반전이 두 번 겹치지 않도록, 이 함수가 유일한 canonicalize 지점이다.
 */
export function toCanonicalLandmarks(
  rawLandmarks: NormalizedLandmark[],
  strategy: MirrorStrategy,
): NormalizedLandmark[] {
  if (strategy === 'PRE_INFERENCE_FRAME_FLIP') {
    return rawLandmarks;
  }

  return rawLandmarks.map((point) => ({
    ...point,
    x: 1 - point.x,
  }));
}
