import type { NormalizedPoint } from './constants';

/**
 * iris → H → normalized viewport(0..1, window.innerWidth/innerHeight 기준) 다음 단계:
 * normalized viewport → viewport CSS px. 결과 gaze cursor 렌더링(position:fixed) 등에 쓴다.
 *
 * 이전에 있던 localPointToViewportNormalized()류의 "장식용 컨테이너 로컬 좌표 → viewport
 * 정규화" 변환은 calibration target 렌더링 도메인이 FULL VIEWPORT로 확정되면서(제품 요구
 * 사항 변경) 더 이상 쓰이지 않아 제거했다 — target 자체가 이미 NORMALIZED_VIEWPORT라
 * 변환이 필요 없다.
 */
export function viewportNormalizedToCssPx(normalized: NormalizedPoint): NormalizedPoint {
  return {
    x: normalized.x * window.innerWidth,
    y: normalized.y * window.innerHeight,
  };
}
