import { EAR_CLOSE_THRESHOLD, EAR_OPEN_THRESHOLD } from '../faceTracking/gaze/blinkGate';
import { DwellController } from './DwellController';
import type { InputSelectionState, KeyTarget } from './types';

/**
 * Look-Talk 원본: src/tracking/blink.py의 BlinkDetector를 selection controller로 포팅한다.
 *
 * 눈 감김/뜸 히스테리시스와 시간 분류는 Python 기본값을 그대로 사용한다. Python main.py는
 * BlinkEvent를 gaze filter 게이트에만 사용했지만, 브라우저에서는 사용자가 눈을 감는 동안
 * 필터가 커서를 무효화하므로 시선으로 target을 미리 "잠가" 두어야 한다.
 *
 * 잠금 모델은 MouthController(mouth.py MouthClickDetector 포팅)와 동일하다:
 *   1) 눈이 확실히 떠 있는 프레임에서만 같은 키를 LOCK_TIME_MS 이상 응시하면 lockedKeyId 확정
 *   2) 눈을 감는 순간 startKeyId = lockedKeyId로 제스처를 시작하고
 *   3) 눈을 뜰 때 그 startKeyId를 그대로 선택한다 — **눈 뜬 직후 좌표로 재검증하지 않는다**.
 *
 * (3)이 중요하다. 눈을 다시 뜬 첫 프레임은 GazeFilter가 눈 감김 동안 버퍼를 비웠다가 막
 * 재개한 좌표이고 눈꺼풀이 아직 홍채를 일부 덮고 있어, 그 프레임의 hover로 선택을 재검증하면
 * 의도적 깜빡임이 조용히 폐기된다. MouthController가 startKeyId를 제스처 시작 시점에 확정하고
 * 끝에서 재검증하지 않는 것과 같은 이유다.
 */

const NATURAL_MAX_MS = 250;
const INTENT_MIN_MS = 300;
const INTENT_MAX_MS = 1200;
const REFRACTORY_MS = 100;
/** MouthController의 LOCK_TIME_SEC(0.25초)와 같은 값 — 두 모드의 잠금 타이밍을 일치시킨다. */
const LOCK_TIME_MS = 250;

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
  private candidateKeyId: string | null = null;
  private candidateStartMs: number | null = null;
  private lockedKeyId: string | null = null;
  /** 눈을 감는 순간 확정되는 제스처 대상. 눈을 뜰 때 이 값을 그대로 선택한다. */
  private startKeyId: string | null = null;

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
    this.candidateKeyId = null;
    this.candidateStartMs = null;
    this.lockedKeyId = null;
    this.startKeyId = null;
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
      // 명확히 열린 프레임에서만 잠금을 갱신한다. 눈 감김/전이 프레임에서는 GazeFilter가
      // 좌표를 무효화하므로 hover를 믿을 수 없다.
      if (ear >= this.closeThreshold) {
        this.updateGazeLock(hoveredKeyId, nowMs);
      }

      if (!this.armed) {
        if (ear > this.openThreshold) {
          this.armed = true;
        }

        return this.state(hoveredKeyId, selectedKeyId, ear);
      }

      if (ear < this.closeThreshold && nowMs - this.lastEventMs >= REFRACTORY_MS) {
        this.isClosed = true;
        this.closedAtMs = nowMs;
        this.longFired = false;
        // 여기서 대상을 확정한다 — 눈을 뜬 뒤에는 다시 검증하지 않는다.
        this.startKeyId = this.lockedKeyId;

        // 감기 시작 프레임부터 잠근 키를 hover로 돌려줘야 파란 테두리가 한 프레임도
        // 깜빡이지 않는다(이 프레임의 hover는 이미 무효 좌표라 null이다).
        return this.state(this.startKeyId ?? hoveredKeyId, selectedKeyId, ear);
      }

      return this.state(hoveredKeyId, selectedKeyId, ear);
    }

    const closedDurationMs = nowMs - this.closedAtMs;

    if (ear > this.openThreshold) {
      this.isClosed = false;
      this.armed = true;

      const isIntentional =
        !this.longFired && closedDurationMs >= INTENT_MIN_MS && closedDurationMs <= INTENT_MAX_MS;

      if (isIntentional && this.startKeyId !== null) {
        selectedKeyId = this.startKeyId;
      }

      if (this.longFired || closedDurationMs <= NATURAL_MAX_MS || isIntentional) {
        this.lastEventMs = nowMs;
      }

      // MouthController가 입을 닫는 순간 잠금을 전부 초기화하는 것과 대칭이다. 다음 입력에는
      // 다시 LOCK_TIME_MS만큼 응시해야 하며, 시선을 옮긴 뒤의 자연 깜빡임이 남아 있던 잠금을
      // 눌러버리는 사고를 구조적으로 막는다.
      this.clearLock();
      this.longFired = false;

      return this.state(hoveredKeyId, selectedKeyId, ear);
    }

    // Python BlinkDetector처럼 너무 긴 눈 감김은 한 번만 소비하고, 눈을 뜨는 순간의
    // intentional 이벤트가 중복 발화하지 않게 한다.
    if (closedDurationMs > INTENT_MAX_MS && !this.longFired) {
      this.longFired = true;
      this.lastEventMs = nowMs;
      this.clearLock();
    }

    // 눈을 감고 있는 동안에도 잠긴 키의 hover 시각 표시(파란 테두리)를 유지한다.
    return this.state(this.startKeyId ?? this.lockedKeyId, selectedKeyId, ear);
  }

  /** MouthController.updateGazeLock()과 동일한 규칙 — 같은 키를 LOCK_TIME_MS 이상 응시하면 잠근다. */
  private updateGazeLock(hoveredKeyId: string | null, nowMs: number): void {
    if (hoveredKeyId === null) {
      // 후보만 무효화하고 이미 성립한 잠금은 유지한다(시선이 잠깐 키 사이를 지나가는 경우).
      this.candidateKeyId = null;
      this.candidateStartMs = null;
      return;
    }

    if (hoveredKeyId === this.lockedKeyId) {
      this.candidateKeyId = hoveredKeyId;
      this.candidateStartMs = nowMs;
      return;
    }

    if (hoveredKeyId !== this.candidateKeyId) {
      this.candidateKeyId = hoveredKeyId;
      this.candidateStartMs = nowMs;
      return;
    }

    if (this.candidateStartMs !== null && nowMs - this.candidateStartMs >= LOCK_TIME_MS) {
      this.lockedKeyId = hoveredKeyId;
    }
  }

  private clearLock(): void {
    this.candidateKeyId = null;
    this.candidateStartMs = null;
    this.lockedKeyId = null;
    this.startKeyId = null;
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
