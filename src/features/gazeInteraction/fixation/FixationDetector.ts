import {
  FIXATION_DISPERSION_DEG,
  FIXATION_MAX_GAP_MS,
  FIXATION_MIN_DURATION_MS,
  FIXATION_RELEASE_DEG,
  FIXATION_VELOCITY_DEG_PER_SEC,
  PX_PER_DEG,
} from './fixationConfig';

/**
 * Look-Talk 원본: src/tracking/fixation.py의 `FixationState` / `FixationDetector`.
 *
 * 이 모듈은 시선 추적 파이프라인 **바깥**에 있다. GazeRuntime이 확정한 최종 좌표
 * (GazeFrame.cursorCssPx)를 읽기만 하고, 좌표를 고치거나 되돌려 주지 않는다.
 * GazeFilter 내부의 fixationCount는 커서 표시를 안정화하기 위한 값이라 여기서 쓰지
 * 않고, 판정 전용 상태를 독자적으로 유지한다. 따라서 이 레이어를 꺼도
 * (FIXATION_HITBOX_ENABLED=false) 시선 좌표와 기존 판정은 한 픽셀도 달라지지 않는다.
 */

/**
 * 한 프레임의 고정 판정 결과. 표시·로깅용으로도 그대로 쓴다.
 *
 * fixationId는 고정이 새로 시작될 때마다 증가한다. "같은 고정이 이어지는 중인지,
 * 도약 뒤에 새로 시작된 고정인지"를 호출부가 구분할 때 쓴다.
 */
export interface FixationState {
  active: boolean;
  centerX: number | null;
  centerY: number | null;
  durationMs: number;
  velocityDegPerSec: number | null;
  fixationId: number;
}

export const IDLE_FIXATION_STATE: FixationState = {
  active: false,
  centerX: null,
  centerY: null,
  durationMs: 0,
  velocityDegPerSec: null,
  fixationId: 0,
};

/**
 * 이번 프레임의 좌표를 고정 판정에 쓸 수 있는지.
 *
 * DwellController와 같은 의미의 음수 좌표 규칙을 함께 본다(gazeX < 0 || gazeY < 0).
 */
export function isValidGaze(x: number | null, y: number | null, valid = true): boolean {
  return valid && x !== null && y !== null && x >= 0 && y >= 0;
}

export interface FixationDetectorOptions {
  pxPerDeg?: number;
  velocityDegPerSec?: number;
  dispersionDeg?: number;
  releaseDeg?: number;
  minDurationMs?: number;
  maxGapMs?: number;
}

/**
 * 속도(I-VT)와 분산(I-DT)을 함께 보는 고정 검출기.
 *
 * 두 기준을 모두 쓰는 이유:
 * - I-VT 단독: 웹캠 노이즈로 속도가 순간적으로 튀면 고정이 끊긴다.
 * - I-DT 단독: 아주 느린 표류(drift)를 고정으로 오인한다.
 *
 * 그래서 "속도가 임계값 이하이고(도약이 아니고), 고정 중심에서 일정 반경 안에 최소
 * 지속 시간 이상 머무를 것"을 함께 요구한다.
 *
 * 성립 이후에는 해제 반경(releaseDeg)을 조금 더 크게 잡아, 미세한 흔들림 때문에
 * 확장이 켜졌다 꺼졌다 하지 않게 한다.
 */
export class FixationDetector {
  readonly pxPerDeg: number;
  readonly velocityDegPerSec: number;
  readonly dispersionDeg: number;
  readonly releaseDeg: number;
  readonly minDurationMs: number;
  readonly maxGapMs: number;

  /**
   * 고정이 새로 시작될 때마다 증가. reset()으로 되돌리지 않는다 —
   * 되돌리면 "새 고정"과 "직전 고정"을 구분할 수 없게 된다.
   */
  private fixationId = 0;

  private isActive = false;
  private startMs: number | null = null;
  private lastMs: number | null = null;
  private lastPoint: { x: number; y: number } | null = null;
  private sumX = 0;
  private sumY = 0;
  private count = 0;
  private velocity: number | null = null;

  state: FixationState = IDLE_FIXATION_STATE;

  constructor(options: FixationDetectorOptions = {}) {
    this.pxPerDeg = options.pxPerDeg ?? PX_PER_DEG;
    this.velocityDegPerSec = options.velocityDegPerSec ?? FIXATION_VELOCITY_DEG_PER_SEC;
    this.dispersionDeg = options.dispersionDeg ?? FIXATION_DISPERSION_DEG;
    this.releaseDeg = options.releaseDeg ?? FIXATION_RELEASE_DEG;
    this.minDurationMs = options.minDurationMs ?? FIXATION_MIN_DURATION_MS;
    this.maxGapMs = options.maxGapMs ?? FIXATION_MAX_GAP_MS;
  }

  get dispersionPx(): number {
    return this.dispersionDeg * this.pxPerDeg;
  }

  get releasePx(): number {
    return this.releaseDeg * this.pxPerDeg;
  }

  reset(): void {
    this.isActive = false;
    this.startMs = null;
    this.lastMs = null;
    this.lastPoint = null;
    this.sumX = 0;
    this.sumY = 0;
    this.count = 0;
    this.velocity = null;
    this.state = IDLE_FIXATION_STATE;
  }

  /** 현재 좌표를 시작점으로 새 고정 후보를 연다. */
  private begin(x: number, y: number, nowMs: number): void {
    this.isActive = false;
    this.startMs = nowMs;
    this.sumX = x;
    this.sumY = y;
    this.count = 1;
    this.fixationId += 1;
  }

  get center(): { x: number; y: number } | null {
    if (this.count === 0) {
      return null;
    }

    return { x: this.sumX / this.count, y: this.sumY / this.count };
  }

  /**
   * 시선 좌표 한 점을 받아 고정 상태를 갱신한다.
   *
   * @param nowMs 호출부와 시계를 맞추기 위해 명시적으로 받는다(GazeFrame.now).
   */
  update(x: number, y: number, valid: boolean, nowMs: number): FixationState {
    if (!isValidGaze(x, y, valid)) {
      this.reset();
      return this.state;
    }

    let gap = this.lastMs === null ? null : nowMs - this.lastMs;

    // 프레임 구독이 끊긴 구간(페이지 전환·캘리브레이션 등)은 이어 붙이지 않는다.
    // 큰 dt로 속도를 계산하면 실제로는 튄 시선이 "느린 이동"으로 보인다.
    if (gap !== null && (gap < 0 || gap > this.maxGapMs)) {
      this.reset();
      gap = null;
    }

    let velocity = this.velocity;

    if (gap !== null && gap > 0 && this.lastPoint !== null) {
      const distance = Math.hypot(x - this.lastPoint.x, y - this.lastPoint.y);
      velocity = distance / (gap / 1000) / this.pxPerDeg;
    }

    const saccade = velocity !== null && velocity > this.velocityDegPerSec;

    if (this.count === 0) {
      this.begin(x, y, nowMs);
    } else {
      const center = this.center as { x: number; y: number };

      const limit = this.isActive ? this.releasePx : this.dispersionPx;
      const drifted = Math.hypot(x - center.x, y - center.y) > limit;

      if (saccade || drifted) {
        // 도약이 시작됐거나 응시점이 벗어났다 → 고정 종료 후 재시작
        this.begin(x, y, nowMs);
      } else {
        this.sumX += x;
        this.sumY += y;
        this.count += 1;
      }
    }

    const durationMs = nowMs - (this.startMs as number);

    if (!this.isActive && !saccade && durationMs >= this.minDurationMs) {
      this.isActive = true;
    }

    this.lastMs = nowMs;
    this.lastPoint = { x, y };
    this.velocity = velocity;

    const center = this.center as { x: number; y: number };

    this.state = {
      active: this.isActive,
      centerX: center.x,
      centerY: center.y,
      durationMs,
      velocityDegPerSec: velocity,
      fixationId: this.fixationId,
    };

    return this.state;
  }
}
