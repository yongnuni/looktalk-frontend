import type { InputSelectionState, KeyTarget } from './types';
import { DwellController } from './DwellController';

/**
 * Look-Talk 원본: src/tracking/mouth.py의 MouthClickDetector를 그대로 포팅한다.
 *
 * main.py(1292-1311행)의 실제 mouth_mode 분기를 그대로 따른다:
 *   hovered_key, _, _ = dwell.update(gaze_x, gaze_y, buttonList)  # 시선은 hover 판정에만 사용
 *   dwell.reset()                                                 # dwell 자체 클릭은 발생시키지 않음
 *   mouth_click, mar = mouth.update(lms, hovered_key)
 *
 * 즉 어떤 키를 "보고 있는지"는 DwellController의 nearest-key+반경 히스테리시스를 그대로
 * 재사용하고(별도 hit-test 로직을 새로 만들지 않음), 실제 선택 확정은 입벌림으로만 한다.
 *
 * Threshold(open=0.30/close=0.23)는 MouthClickDetector.__init__ 기본값이다. Look-Talk의
 * 개인별 MAR 캘리브레이션(src/calibrations/mouth_calibration.py, 5회 시행 + baseline.json
 * 분석 지표 산출)은 Python CSV/baseline 연구용 로깅과 강하게 얽혀 있어(Front Step 2-9 지침의
 * 제외 목록 "Python CSV/debug logging") 포팅하지 않는다 — 이 결정과 남은 개인화 격차는
 * Final Audit에 별도 기록한다.
 */

// export: RealtimeMetricsBridge(실시간 분석값 팝업)가 이 값을 그대로 재사용해 threshold를
// 중복 하드코딩하지 않는다(features/realtimeMetrics/buildRealtimeMetricsPayload.ts).
export const OPEN_THRESHOLD = 0.3;
export const CLOSE_THRESHOLD = 0.23;
const HOLD_TIME_SEC = 0.3;
const COOLDOWN_SEC = 0.5;
const LOCK_TIME_SEC = 0.25;

export interface MouthSelectionState extends InputSelectionState {
  mar: number;
  isOpen: boolean;
  /** 입을 벌리기 전 시선으로 잠근 키. hoveredKeyId와 별개로 UI에 "잠김" 표시를 위해 노출. */
  lockedKeyId: string | null;
}

const IDLE_STATE: Omit<MouthSelectionState, 'mar'> = {
  hoveredKeyId: null,
  progress: 0,
  selectedKeyId: null,
  isOpen: false,
  lockedKeyId: null,
};

export class MouthController {
  private readonly hoverDetector = new DwellController();

  private isOpen = false;
  private openStartMs: number | null = null;
  private startKeyId: string | null = null;
  private candidateKeyId: string | null = null;
  private candidateStartMs: number | null = null;
  private lockedKeyId: string | null = null;
  private clicked = false;
  // Python MouthClickDetector.__init__: self.last_click_time = 0.0, reset()에서도 건드리지
  // 않는다 — DwellController의 cooldownEndMs와 동일한 이유로 reset()에서 유지한다.
  private lastClickMs = 0;

  reset(): void {
    this.hoverDetector.reset();
    this.isOpen = false;
    this.openStartMs = null;
    this.startKeyId = null;
    this.candidateKeyId = null;
    this.candidateStartMs = null;
    this.lockedKeyId = null;
    this.clicked = false;
  }

  update(gazeX: number, gazeY: number, targets: KeyTarget[], mar: number, nowMs: number): MouthSelectionState {
    const { hoveredKeyId } = this.hoverDetector.update(gazeX, gazeY, targets, nowMs);
    this.hoverDetector.reset();

    const wasOpen = this.isOpen;

    if (!this.isOpen) {
      this.updateGazeLock(hoveredKeyId, nowMs);
    }

    if (!this.isOpen) {
      if (mar >= OPEN_THRESHOLD) {
        this.isOpen = true;
      }
    } else if (mar <= CLOSE_THRESHOLD) {
      this.isOpen = false;
    }

    // 입을 막 닫은 순간 — 다음 사이클을 위해 전부 초기화하고 이번 프레임은 선택 없음.
    if (wasOpen && !this.isOpen) {
      this.openStartMs = null;
      this.startKeyId = null;
      this.candidateKeyId = null;
      this.candidateStartMs = null;
      this.lockedKeyId = null;
      this.clicked = false;

      return { ...IDLE_STATE, hoveredKeyId, mar, isOpen: this.isOpen };
    }

    let selectedKeyId: string | null = null;

    if (this.isOpen) {
      if (this.openStartMs === null) {
        this.openStartMs = nowMs;
        // 입을 벌리기 전에 잠가 둔 키를 사용 — 입이 열려 있는 동안의 현재 시선 위치는 쓰지 않는다.
        this.startKeyId = this.lockedKeyId;
      } else if (nowMs - this.openStartMs >= HOLD_TIME_SEC * 1000 && !this.clicked) {
        const cooldownReady = nowMs - this.lastClickMs >= COOLDOWN_SEC * 1000;

        if (this.startKeyId !== null && cooldownReady) {
          selectedKeyId = this.startKeyId;
          this.lastClickMs = nowMs;
        }

        this.clicked = true;
      }
    } else {
      this.openStartMs = null;
      this.startKeyId = null;
      this.clicked = false;
    }

    const holdElapsedMs = this.openStartMs !== null ? nowMs - this.openStartMs : 0;
    const progress = this.isOpen ? Math.min(1, holdElapsedMs / (HOLD_TIME_SEC * 1000)) : 0;

    return {
      hoveredKeyId,
      progress,
      selectedKeyId,
      mar,
      isOpen: this.isOpen,
      lockedKeyId: this.lockedKeyId,
    };
  }

  private updateGazeLock(hoveredKeyId: string | null, nowMs: number): void {
    if (hoveredKeyId === null) {
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

    if (this.candidateStartMs !== null && nowMs - this.candidateStartMs >= LOCK_TIME_SEC * 1000) {
      this.lockedKeyId = hoveredKeyId;
    }
  }
}
