import { FIXATION_HITBOX_MAX_OVERLAP_RATIO } from './fixationConfig';

/**
 * Look-Talk 원본: src/tracking/fixation.py의 `expanded_bounds` / `lerp_bounds` /
 * `ease_out` / `bounds_contain`.
 *
 * 원본의 KeyRect(x/y/width/height/right/bottom) 대신 Web의 DOMRect와 같은
 * left/top/right/bottom을 쓴다 — 이 레이어에 들어오는 모든 좌표가
 * `getBoundingClientRect()`에서 나오므로 변환 없이 그대로 쓰기 위함이다.
 */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 확장 계산에 필요한 최소 정보. 실제 target(GazeTargetEntry)은 이걸 감싸서 넘긴다. */
export interface FixationTarget {
  id: string;
  rect: Bounds;
}

export function boundsWidth(bounds: Bounds): number {
  return bounds.right - bounds.left;
}

export function boundsHeight(bounds: Bounds): number {
  return bounds.bottom - bounds.top;
}

export function boundsCenter(bounds: Bounds): { x: number; y: number } {
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
}

/**
 * 사각형 안에 있는지 검사한다.
 *
 * 경계 규칙은 `hitTestTargets`(targetHitTest.ts) 및 원본 KeyRect.contains와 같은
 * 반열린 구간이다 — left/top은 포함하고 right/bottom은 제외한다.
 */
export function boundsContain(bounds: Bounds, pointX: number, pointY: number): boolean {
  return (
    pointX >= bounds.left && pointX < bounds.right && pointY >= bounds.top && pointY < bounds.bottom
  );
}

/**
 * 확장된 판정 사각형을 계산한다.
 *
 * 확장량은 키 한 변 x expandRatio다 — 0.5면 좌우로 각각 폭의 절반이 붙어 판정 폭이
 * "키 폭 + 키 폭"이 된다. 고정 px가 아니라 키 크기에서 뽑기 때문에 해상도나
 * 레이아웃(한/영, Shift, 추천 슬롯)이 달라져도 키캡 UI와 같은 비율을 유지한다.
 * radiusPx(개인별 시선 오차 반경 등)가 주어지면 그보다 작아지지 않게 올린다.
 *
 * 확장은 인접 키를 덮어도 되지만, 어떤 키도 그 키의 maxOverlapRatio(기본 1/3)보다
 * 깊게 침범하지 않는다. 한도는 변마다 따로 계산한다 — 오른쪽에는 좁은 기능키가,
 * 왼쪽에는 스페이스바가 올 수 있어서 하나로 묶으면 좁은 쪽 기준으로 네 변이 전부
 * 깎이기 때문이다.
 *
 * 넘겨받은 rect는 읽기만 한다. 화면에 그려지는 키의 위치와 크기는 이 계산에 전혀
 * 영향받지 않는다 — 키캡 레이아웃은 정적으로 고정되고, 넓어지는 것은 판정 영역뿐이다.
 */
export function expandedBounds(
  target: FixationTarget,
  targets: readonly FixationTarget[],
  expandRatio: number,
  radiusPx: number | null = null,
  maxOverlapRatio: number = FIXATION_HITBOX_MAX_OVERLAP_RATIO,
): Bounds {
  const rect = target.rect;

  let desiredX = boundsWidth(rect) * expandRatio;
  let desiredY = boundsHeight(rect) * expandRatio;

  if (radiusPx !== null) {
    desiredX = Math.max(desiredX, radiusPx);
    desiredY = Math.max(desiredY, radiusPx);
  }

  let left = desiredX;
  let right = desiredX;
  let top = desiredY;
  let bottom = desiredY;

  for (const other of targets) {
    if (other === target) {
      continue;
    }

    const otherRect = other.rect;

    // 가로 방향: 세로 구간이 겹치는 키만 좌우 이웃으로 본다.
    if (otherRect.top < rect.bottom && otherRect.bottom > rect.top) {
      if (otherRect.left >= rect.right) {
        right = Math.min(
          right,
          otherRect.left - rect.right + boundsWidth(otherRect) * maxOverlapRatio,
        );
      } else if (otherRect.right <= rect.left) {
        left = Math.min(
          left,
          rect.left - otherRect.right + boundsWidth(otherRect) * maxOverlapRatio,
        );
      }
    }

    // 세로 방향: 가로 구간이 겹치는 키만 위아래 이웃으로 본다.
    if (otherRect.left < rect.right && otherRect.right > rect.left) {
      if (otherRect.top >= rect.bottom) {
        bottom = Math.min(
          bottom,
          otherRect.top - rect.bottom + boundsHeight(otherRect) * maxOverlapRatio,
        );
      } else if (otherRect.bottom <= rect.top) {
        top = Math.min(
          top,
          rect.top - otherRect.bottom + boundsHeight(otherRect) * maxOverlapRatio,
        );
      }
    }
  }

  return {
    left: rect.left - Math.max(0, left),
    top: rect.top - Math.max(0, top),
    right: rect.right + Math.max(0, right),
    bottom: rect.bottom + Math.max(0, bottom),
  };
}

/** 두 사각형 사이를 t(0~1)로 보간한다. 확대 애니메이션용. */
export function lerpBounds(start: Bounds, end: Bounds, t: number): Bounds {
  return {
    left: start.left + (end.left - start.left) * t,
    top: start.top + (end.top - start.top) * t,
    right: start.right + (end.right - start.right) * t,
    bottom: start.bottom + (end.bottom - start.bottom) * t,
  };
}

/** 짧은 1회성 확대에 쓰는 ease-out 곡선(cubic). */
export function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}
