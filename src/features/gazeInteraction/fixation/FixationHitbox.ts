import {
  FixationDetector,
  IDLE_FIXATION_STATE,
  isValidGaze,
  type FixationState,
} from './FixationDetector';
import {
  FIXATION_HITBOX_ENABLED,
  FIXATION_HITBOX_EXPAND_RATIO,
  FIXATION_HITBOX_MAX_OVERLAP_RATIO,
  FIXATION_VISUAL_ANIM_MS,
  FIXATION_VISUAL_EXPAND_ENABLED,
  FIXATION_VISUAL_EXPAND_RATIO,
} from './fixationConfig';
import {
  boundsCenter,
  boundsContain,
  easeOut,
  expandedBounds,
  lerpBounds,
  type Bounds,
  type FixationTarget,
} from './fixationGeometry';

/**
 * Look-Talk 원본: src/tracking/fixation.py의 `FixationHitbox`.
 *
 * 고정이 시작된 키 하나의 히트박스만 넓혀 주는 판정 보조 레이어.
 *
 * 동작 순서
 * 1. 매 프레임 FixationDetector로 고정 여부를 독자 판정한다.
 * 2. 고정이 성립하면 그 시점의 고정 중심에 해당하는 키를 확장 대상(앵커)으로 잡는다.
 *    탐색(도약) 중에는 어떤 확장도 걸지 않는다 — 탐색 단계에서 판정 영역이 흔들리면
 *    전체 배치 파악을 방해한다는 선행 연구 결과를 그대로 따른 것이다.
 * 3. 확장 영역은 인접 키를 최대 1/3까지 덮으며, 겹치는 구간에서는 확장된 쪽이 이긴다.
 *    확장은 "이미 목표를 찾아 응시 중인 키"에만 걸리므로 그 구간에 떨어진 좌표는 그
 *    키를 노린 것으로 본다. 인접 키의 나머지 2/3는 그대로 자기 영역이라 완전히 가려지는
 *    키는 없다.
 * 4. 걸린 확장은 시선이 확장 영역 안에 머무는 동안 유지된다. 겹침 구간에 잠깐 들어가는
 *    것만으로는 확장이 넘어가지 않고, 다른 키에 새 고정이 성립해야 그쪽으로 옮겨 간다.
 *
 * 레이아웃은 이 레이어를 참조하지 않는다 — 키캡의 위치와 크기는 정적으로 고정되고,
 * 판정 영역만 넓어진다(시각 확대는 transform으로만 그리므로 주변 키가 밀리지 않는다).
 *
 * 앵커를 객체가 아니라 **좌표**로 기억하는 이유: Shift/한영 전환이나 추천 갱신 때
 * target 목록이 통째로 새로 만들어지므로, 객체를 들고 있으면 화면에 없는 대상을
 * 가리키게 된다. 좌표로 들고 있다가 매 프레임 현재 목록에서 다시 찾으면 그 문제가 없다.
 */
export interface FixationHitboxOptions {
  enabled?: boolean;
  detector?: FixationDetector;
  expandRatio?: number;
  /**
   * 개인별 시선 오차 반경(px). 캘리브레이션에서 산출한 95퍼센타일 같은 값을 넣으면 그
   * 반경 이상으로 확장이 보장된다. null이면 키 크기 비율만 사용한다.
   */
  personalRadiusPx?: number | null;
  maxOverlapRatio?: number;
  visualEnabled?: boolean;
  visualExpandRatio?: number;
  visualAnimMs?: number;
}

export class FixationHitbox<T extends FixationTarget = FixationTarget> {
  readonly enabled: boolean;
  readonly detector: FixationDetector;
  readonly expandRatio: number;
  readonly maxOverlapRatio: number;

  /** 시각 확대 — 판정과 분리된 표시 전용 값이다. 꺼도 히트박스 확장은 그대로 동작한다. */
  readonly visualEnabled: boolean;
  readonly visualExpandRatio: number;
  readonly visualAnimMs: number;

  personalRadiusPx: number | null;

  private anchorCenter: { x: number; y: number } | null = null;
  private anchorBounds: Bounds | null = null;
  private anchorVisualBounds: Bounds | null = null;
  private anchorStartedAtMs: number | null = null;
  private anchoredFixationId: number | null = null;

  anchorTarget: T | null = null;
  state: FixationState = IDLE_FIXATION_STATE;

  constructor(options: FixationHitboxOptions = {}) {
    this.enabled = options.enabled ?? FIXATION_HITBOX_ENABLED;
    this.detector = options.detector ?? new FixationDetector();
    this.expandRatio = options.expandRatio ?? FIXATION_HITBOX_EXPAND_RATIO;
    this.maxOverlapRatio = options.maxOverlapRatio ?? FIXATION_HITBOX_MAX_OVERLAP_RATIO;
    this.visualEnabled = options.visualEnabled ?? FIXATION_VISUAL_EXPAND_ENABLED;
    this.visualExpandRatio = options.visualExpandRatio ?? FIXATION_VISUAL_EXPAND_RATIO;
    this.visualAnimMs = options.visualAnimMs ?? FIXATION_VISUAL_ANIM_MS;
    this.personalRadiusPx = options.personalRadiusPx ?? null;
  }

  reset(): void {
    this.detector.reset();
    this.clearAnchor();
    this.anchoredFixationId = null;
    this.state = IDLE_FIXATION_STATE;
  }

  private clearAnchor(): void {
    this.anchorCenter = null;
    this.anchorBounds = null;
    this.anchorVisualBounds = null;
    this.anchorStartedAtMs = null;
    this.anchorTarget = null;
  }

  /** 지금 확장이 실제로 걸려 있는지. */
  get active(): boolean {
    return this.anchorTarget !== null;
  }

  get anchorId(): string | null {
    return this.anchorTarget?.id ?? null;
  }

  /** 이 레이어의 설정으로 계산한 대상의 확장 사각형. */
  boundsOf(target: T, targets: readonly T[]): Bounds {
    return expandedBounds(
      target,
      targets,
      this.expandRatio,
      this.personalRadiusPx,
      this.maxOverlapRatio,
    );
  }

  /** 고정 여부를 갱신하고 확장 대상 키를 정한다. */
  update(
    gazeX: number,
    gazeY: number,
    targets: readonly T[],
    valid: boolean,
    nowMs: number,
  ): FixationState {
    if (!this.enabled) {
      this.clearAnchor();
      this.anchoredFixationId = null;
      this.state = IDLE_FIXATION_STATE;
      return this.state;
    }

    this.state = this.detector.update(gazeX, gazeY, valid, nowMs);

    if (!isValidGaze(gazeX, gazeY, valid)) {
      this.clearAnchor();
      this.anchoredFixationId = null;
      return this.state;
    }

    let anchorTarget: T | null = null;

    // 새 고정이 성립하면 확장 대상을 그쪽으로 옮긴다.
    // 도약이 끝난 시점 = 사용자가 목표를 이미 찾은 시점.
    if (this.state.active && this.anchoredFixationId !== this.state.fixationId) {
      anchorTarget = this.findAnchorTarget(
        targets,
        this.state.centerX as number,
        this.state.centerY as number,
      );

      if (anchorTarget !== null) {
        this.anchorCenter = { x: this.state.centerX as number, y: this.state.centerY as number };
        this.anchoredFixationId = this.state.fixationId;
      }
    }

    // 새 고정이 없으면 걸려 있던 확장을 이어 간다.
    // 시선이 확장 영역을 벗어날 때 내린다. 각도 기준 고정 반경만으로 판단하면
    // (1.5도가 키 반폭보다 작을 수 있다) 시선이 키 가장자리로 흐르는 순간 —
    // 확장이 가장 필요한 순간 — 풀려 버린다.
    if (anchorTarget === null && this.anchorCenter !== null) {
      const heldTarget = this.findAnchorTarget(targets, this.anchorCenter.x, this.anchorCenter.y);

      if (heldTarget !== null && boundsContain(this.boundsOf(heldTarget, targets), gazeX, gazeY)) {
        anchorTarget = heldTarget;
      } else {
        this.anchorCenter = null;
      }
    }

    const previousTarget = this.anchorTarget;
    this.anchorTarget = anchorTarget;

    this.anchorBounds = anchorTarget === null ? null : this.boundsOf(anchorTarget, targets);

    this.updateVisualBounds(previousTarget, anchorTarget, targets, nowMs);

    return this.state;
  }

  /**
   * 확대 애니메이션을 한 프레임 진행시킨다.
   *
   * 판정과 분리된 표시 전용 계산이다. 확대는 키가 바뀔 때마다 한 번만 재생되고
   * 되돌아가지 않는다(반복 pulsing은 시각 유발성 멀미 리스크).
   *
   * 원본은 Button 객체 동일성으로 "앵커가 바뀌었는지"를 봤지만, 여기서는 매 프레임
   * 새로 측정한 target 객체를 받으므로 id로 비교한다 — 객체 동일성으로 보면 애니메이션이
   * 매 프레임 처음부터 다시 시작해 영영 자라지 않는다.
   */
  private updateVisualBounds(
    previousTarget: T | null,
    anchorTarget: T | null,
    targets: readonly T[],
    nowMs: number,
  ): void {
    if (anchorTarget === null || !this.visualEnabled) {
      this.anchorVisualBounds = null;
      this.anchorStartedAtMs = null;
      return;
    }

    const anchorChanged = previousTarget === null || previousTarget.id !== anchorTarget.id;

    if (anchorChanged || this.anchorStartedAtMs === null) {
      this.anchorStartedAtMs = nowMs;
    }

    const rect = anchorTarget.rect;

    const target = expandedBounds(
      anchorTarget,
      targets,
      this.visualExpandRatio,
      this.personalRadiusPx,
      this.maxOverlapRatio,
    );

    const progress =
      this.visualAnimMs <= 0 ? 1 : easeOut((nowMs - this.anchorStartedAtMs) / this.visualAnimMs);

    this.anchorVisualBounds = lerpBounds(rect, target, progress);
  }

  /**
   * 확대해서 그릴 키캡 사각형. 없으면 null.
   *
   * 렌더링에서만 쓴다 — 판정은 언제나 anchorDebugRect()/hitTest()가 쓰는 히트박스
   * 쪽이며, 그쪽이 이 사각형보다 넓다(암묵 확장).
   */
  anchorVisualRect(): Bounds | null {
    return this.anchorVisualBounds;
  }

  /** 디버그 오버레이용 확장 사각형. 없으면 null. */
  anchorDebugRect(): Bounds | null {
    return this.anchorBounds;
  }

  /**
   * 고정 중심에 해당하는 대상을 현재 목록에서 찾는다.
   *
   * 중심이 대상 사이 여백에 떨어진 경우가 이 기능이 실제로 필요한 상황이다. 그때는
   * 확장 영역이 중심을 포함하는 대상 중 중심에서 가장 가까운 것을 고른다. 확장 영역
   * 밖이면 아무것도 고르지 않는다(무리한 보정 금지).
   */
  private findAnchorTarget(targets: readonly T[], centerX: number, centerY: number): T | null {
    for (const target of targets) {
      if (boundsContain(target.rect, centerX, centerY)) {
        return target;
      }
    }

    let nearestTarget: T | null = null;
    let nearestDistance: number | null = null;

    for (const target of targets) {
      if (!boundsContain(this.boundsOf(target, targets), centerX, centerY)) {
        continue;
      }

      const center = boundsCenter(target.rect);
      const distance = Math.hypot(centerX - center.x, centerY - center.y);

      if (nearestDistance === null || distance < nearestDistance) {
        nearestTarget = target;
        nearestDistance = distance;
      }
    }

    return nearestTarget;
  }

  /**
   * 확장 영역이 최우선, 그 밖에서는 기존 판정 그대로.
   *
   * 겹치는 구간에서는 확장된 대상이 이긴다. 확장 중이 아니면 목록 순서대로 실제
   * 사각형을 검사하는 기존 판정(hitTestTargets)과 결과가 완전히 같다 — 그래서 호출부는
   * 우선순위가 높은 대상을 목록 앞에 둔다.
   */
  hitTest(targets: readonly T[], pointX: number, pointY: number): T | null {
    if (
      this.anchorTarget !== null &&
      this.anchorBounds !== null &&
      boundsContain(this.anchorBounds, pointX, pointY)
    ) {
      return this.anchorTarget;
    }

    for (const target of targets) {
      if (boundsContain(target.rect, pointX, pointY)) {
        return target;
      }
    }

    return null;
  }
}
