import { EAR_CLOSE_THRESHOLD, EAR_OPEN_THRESHOLD } from '../faceTracking/gaze/blinkGate';
import { DwellController } from './DwellController';
import type { InputSelectionState, KeyTarget } from './types';

/**
 * Look-Talk 원본: src/tracking/blink.py의 BlinkDetector를 selection controller로 포팅한다.
 *
 * 눈 감김/뜸 히스테리시스와 시간 분류는 Python 기본값을 그대로 사용한다. Python main.py는
 * BlinkEvent를 gaze filter 게이트에만 사용했지만, 브라우저에서는 사용자가 눈을 감는 동안
 * 필터가 커서를 무효화하므로 눈을 감기 직전의 공통 gaze target을 잠가 두었다가 의도적
 * 깜빡임이 눈을 뜨며 완결될 때 같은 target을 다시 보고 있는 경우에만 한 번 선택한다.
 */

const NATURAL_MAX_MS = 250;
const INTENT_MIN_MS = 300;
const INTENT_MAX_MS = 800;
const REFRACTORY_MS = 100;

export interface BlinkSelectionState extends InputSelectionState {
  ear: number;
  isClosed: boolean;
  lockedKeyId: string | null;
}

export interface BlinkControllerThresholds {
  closeThreshold: number;
  openThreshold: number;
}

export class BlinkController {
  private readonly hoverDetector = new DwellController();
  private readonly closeThreshold: number;
  private readonly openThreshold: number;

  private isClosed = false;
  private closedAtMs = 0;
  private lastEventMs = Number.NEGATIVE_INFINITY;
  private longFired = false;
  private armed = false;
  private lastHoveredKeyId: string | null = null;
  private lockedKeyId: string | null = null;

  constructor(thresholds?: BlinkControllerThresholds) {
    this.closeThreshold = thresholds?.closeThreshold ?? EAR_CLOSE_THRESHOLD;
    this.openThreshold = thresholds?.openThreshold ?? EAR_OPEN_THRESHOLD;
  }

  /**
   * 모드 변경/추적 실패 뒤에는 눈이 열린 프레임을 먼저 확인해야 다시 입력을 받는다.
   * 이미 감은 눈을 새 blink의 시작으로 오인하지 않기 위한 브라우저 lifecycle 안전장치다.
   */
  reset(): void {
    this.hoverDetector.reset();
    this.isClosed = false;
    this.closedAtMs = 0;
    this.longFired = false;
    this.armed = false;
    this.lastHoveredKeyId = null;
    this.lockedKeyId = null;
  }

  update(gazeX: number, gazeY: number, targets: KeyTarget[], ear: number, nowMs: number): BlinkSelectionState {
    const hasValidGaze = gazeX >= 0 && gazeY >= 0;
    const hoverState = hasValidGaze
      ? this.hoverDetector.update(gazeX, gazeY, targets, nowMs)
      : { hoveredKeyId: null };
    this.hoverDetector.reset();

    const hoveredKeyId = hoverState.hoveredKeyId;
    let selectedKeyId: string | null = null;

    if (!this.isClosed) {
      // 명확히 열린 프레임에서만 현재 선택 후보를 갱신한다. 눈 감김 프레임에서는
      // GazeFilter가 좌표를 -1로 만들기 때문에 직전 유효 target을 보존해야 한다.
      if (ear >= this.closeThreshold) {
        this.lastHoveredKeyId = hoveredKeyId;
      }

      if (!this.armed) {
        if (ear > this.openThreshold) {
          this.armed = true;
          this.lastHoveredKeyId = hoveredKeyId;
        }

        return this.state(hoveredKeyId, selectedKeyId, ear);
      }

      if (ear < this.closeThreshold && nowMs - this.lastEventMs >= REFRACTORY_MS) {
        this.isClosed = true;
        this.closedAtMs = nowMs;
        this.longFired = false;
        this.lockedKeyId = this.lastHoveredKeyId;
      }

      return this.state(hoveredKeyId, selectedKeyId, ear);
    }

    const closedDurationMs = nowMs - this.closedAtMs;

    if (ear > this.openThreshold) {
      this.isClosed = false;
      this.armed = true;

      const isIntentional =
        !this.longFired && closedDurationMs >= INTENT_MIN_MS && closedDurationMs <= INTENT_MAX_MS;

      // 감기 직전 target과 다시 뜬 직후 target이 같아야 한다. target이 사라졌거나 시선이
      // 무효/변경된 경우에는 의도적 blink 자체는 소비하되 선택은 발생시키지 않는다.
      if (isIntentional && this.lockedKeyId !== null && hoveredKeyId === this.lockedKeyId) {
        selectedKeyId = this.lockedKeyId;
      }

      if (this.longFired || closedDurationMs <= NATURAL_MAX_MS || isIntentional) {
        this.lastEventMs = nowMs;
      }

      this.lastHoveredKeyId = hoveredKeyId;
      this.lockedKeyId = null;
      this.longFired = false;

      return this.state(hoveredKeyId, selectedKeyId, ear);
    }

    // Python BlinkDetector처럼 너무 긴 눈 감김은 한 번만 소비하고, 눈을 뜨는 순간의
    // intentional 이벤트가 중복 발화하지 않게 한다.
    if (closedDurationMs > INTENT_MAX_MS && !this.longFired) {
      this.longFired = true;
      this.lastEventMs = nowMs;
      this.lockedKeyId = null;
    }

    return this.state(this.lockedKeyId, selectedKeyId, ear);
  }

  private state(hoveredKeyId: string | null, selectedKeyId: string | null, ear: number): BlinkSelectionState {
    return {
      hoveredKeyId,
      progress: 0,
      selectedKeyId,
      ear,
      isClosed: this.isClosed,
      lockedKeyId: this.lockedKeyId,
    };
  }
}
