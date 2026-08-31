import { hitTestTargets } from '../targetHitTest';
import type { GazeTargetEntry, InteractionScope } from '../types';
import { FixationHitbox, type FixationHitboxOptions } from './FixationHitbox';
import type { FixationState } from './FixationDetector';
import { boundsCenter, boundsHeight, boundsWidth, type Bounds, type FixationTarget } from './fixationGeometry';

/**
 * Look-Talk 원본의 `DwellController`가 `fixation_hitbox`를 물고 있던 자리(dwell.py)에
 * 대응하는 Web 어댑터.
 *
 * 원본에서 세 트리거(시선 지속 시간 / 깜빡임 / 입 개폐)가 전부 DwellController.update()
 * 에서 hover 키를 받아 갔기 때문에 그 한 곳에만 확장을 물리면 셋 다 적용됐다. Web에서
 * 그에 대응하는 단일 지점은 `buildSelectionTargets()`가 쓰는 hit-test다 —
 * DWELL/BLINK/MOUTH가 모두 그 결과를 synthetic target으로 받아 판정하므로, 여기서
 * 확장을 걸면 세 트리거에 동시에 적용된다. DwellController/BlinkController/
 * MouthController는 전혀 수정하지 않는다.
 *
 * 확장은 KEYBOARD scope에서만 건다. 원본이 키보드 buttonList에만 적용한 것과 같고,
 * MAIN/CHAT/MODAL의 큰 카드형 target은 이미 rect 전체가 판정 영역이라 확장이 필요 없다.
 */

/** hitTestTargets와 같은 형태 — buildSelectionTargets에 그대로 주입할 수 있다. */
export type GazeHitResolver = (
  cursor: { x: number; y: number },
  targets: GazeTargetEntry[],
) => GazeTargetEntry | null;

interface MeasuredKeyTarget extends FixationTarget {
  entry: GazeTargetEntry;
}

/** 시각 확대된 키캡을 표시하기 위한 data attribute. CSS는 KeyboardKey.css에 있다. */
const VISUAL_ANCHOR_ATTRIBUTE = 'data-fixation-anchor';

export class KeyboardFixationLayer {
  private readonly hitbox: FixationHitbox<MeasuredKeyTarget>;
  private measured: MeasuredKeyTarget[] = [];
  private styledElement: HTMLElement | null = null;

  constructor(options: FixationHitboxOptions = {}) {
    this.hitbox = new FixationHitbox<MeasuredKeyTarget>(options);
  }

  get state(): FixationState {
    return this.hitbox.state;
  }

  get active(): boolean {
    return this.hitbox.active;
  }

  /** 확장이 걸린 target의 registry id. 없으면 null. */
  get anchorId(): string | null {
    return this.hitbox.anchorId;
  }

  /** 디버그 오버레이용 확장 사각형(viewport CSS px). 없으면 null. */
  anchorDebugRect(): Bounds | null {
    return this.hitbox.anchorDebugRect();
  }

  reset(): void {
    this.hitbox.reset();
    this.measured = [];
    this.clearVisual();
  }

  /**
   * 한 프레임의 고정 상태를 갱신한다.
   *
   * 고정 판정은 dwell 상태·cooldown과 무관한 독립 레이어다 — cooldown 중에도 시선은
   * 계속 흐르므로 selection 판정보다 **먼저** 매 프레임 갱신한다(원본 dwell.py가
   * cooldown early-return 앞에서 fixation_hitbox.update()를 호출하는 것과 같다).
   */
  update(
    scope: InteractionScope,
    eligibleTargets: GazeTargetEntry[],
    cursor: { x: number; y: number } | null,
    nowMs: number,
  ): void {
    if (scope !== 'KEYBOARD' || !this.hitbox.enabled) {
      this.reset();
      return;
    }

    this.measured = this.measure(eligibleTargets);

    const valid = cursor !== null;

    this.hitbox.update(cursor?.x ?? -1, cursor?.y ?? -1, this.measured, valid, nowMs);

    this.applyVisual();
  }

  /**
   * 확장을 반영한 hit-test. `hitTestTargets`와 같은 시그니처라 buildSelectionTargets에
   * 그대로 넘길 수 있다.
   *
   * 이번 프레임에 측정한 rect를 재사용하므로 레이아웃을 다시 읽지 않는다. KEYBOARD scope가
   * 아니거나 기능이 꺼져 있으면 측정 목록이 비어 있고, 그때는 기존 판정을 그대로 쓴다.
   */
  resolveHit: GazeHitResolver = (cursor, targets) => {
    if (this.measured.length === 0) {
      return hitTestTargets(cursor, targets);
    }

    return this.hitbox.hitTest(this.measured, cursor.x, cursor.y)?.entry ?? null;
  };

  /**
   * 이번 프레임의 target rect를 한 번에 읽는다.
   *
   * 시각 확대는 CSS transform으로 그리는데 `getBoundingClientRect()`는 transform이
   * **적용된** 사각형을 돌려준다. 그대로 두면 확대된 키가 다음 프레임에 더 큰 키로
   * 측정돼 확장이 스스로 부풀어 오른다. 그래서 측정 직전에 transform을 지우고
   * (style 쓰기만 — 레이아웃을 읽지 않으므로 flush가 일어나지 않는다) 측정을 한 번에
   * 몰아서 한 뒤, 계산이 끝나면 다시 적용한다. 강제 레이아웃 횟수는 기존과 같은
   * 프레임당 1회다.
   */
  private measure(eligibleTargets: GazeTargetEntry[]): MeasuredKeyTarget[] {
    if (this.styledElement) {
      this.styledElement.style.removeProperty('transform');
    }

    return eligibleTargets.map((entry) => {
      const rect = entry.element.getBoundingClientRect();

      return {
        id: entry.id,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        entry,
      };
    });
  }

  /**
   * 고정된 키캡을 화면에서도 키운다. 판정 영역(hitbox)은 이보다 조금 더 넓어서 "보이는
   * 것보다 판정이 너그러운" 암묵 확장이 된다.
   *
   * 레이아웃을 건드리지 않는 transform으로만 그린다 — 주변 키가 밀리거나 줄어들지 않고,
   * 확대 애니메이션은 FixationHitbox가 프레임 단위로 계산한 ease-out 결과를 그대로 따른다
   * (CSS transition을 쓰면 판정 영역과 표시가 어긋난다).
   */
  private applyVisual(): void {
    const anchor = this.hitbox.anchorTarget;
    const visual = this.hitbox.anchorVisualRect();

    if (anchor === null || visual === null) {
      this.clearVisual();
      return;
    }

    const element = anchor.entry.element;

    if (this.styledElement !== null && this.styledElement !== element) {
      this.clearVisual();
    }

    const width = boundsWidth(anchor.rect);
    const height = boundsHeight(anchor.rect);

    if (width <= 0 || height <= 0) {
      this.clearVisual();
      return;
    }

    const rectCenter = boundsCenter(anchor.rect);
    const visualCenter = boundsCenter(visual);

    const scaleX = boundsWidth(visual) / width;
    const scaleY = boundsHeight(visual) / height;
    const shiftX = visualCenter.x - rectCenter.x;
    const shiftY = visualCenter.y - rectCenter.y;

    element.setAttribute(VISUAL_ANCHOR_ATTRIBUTE, 'true');
    element.style.setProperty(
      'transform',
      `translate(${shiftX}px, ${shiftY}px) scale(${scaleX}, ${scaleY})`,
    );

    this.styledElement = element;
  }

  private clearVisual(): void {
    if (this.styledElement === null) {
      return;
    }

    this.styledElement.removeAttribute(VISUAL_ANCHOR_ATTRIBUTE);
    this.styledElement.style.removeProperty('transform');
    this.styledElement = null;
  }
}
