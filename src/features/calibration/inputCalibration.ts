import {
  EAR_CLOSE_THRESHOLD,
  EAR_OPEN_THRESHOLD,
} from '../faceTracking/gaze/blinkGate';
import {
  MOUTH_CLOSE_THRESHOLD,
  MOUTH_OPEN_THRESHOLD,
} from '../multimodalInput/MouthController';

export const BLINK_TOTAL_TRIALS = 5;
export const BLINK_OPEN_COLLECT_MS = 1_200;
export const BLINK_OPEN_MIN_SAMPLES = 15;
export const BLINK_WINDOW_MS = 2_000;
export const BLINK_REST_MS = 600;
export const BLINK_MAX_ATTEMPTS = 3;

export const MOUTH_BASELINE_COLLECT_MS = 4_000;
export const MOUTH_TOTAL_TRIALS = 5;
export const MOUTH_READY_MS = 2_000;
export const MOUTH_RESPONSE_TIMEOUT_MS = 5_000;
export const MOUTH_MIN_OPEN_HOLD_MS = 1_200;
export const MOUTH_CLOSE_CONFIRM_MS = 1_000;
export const MOUTH_ACTIVE_TIMEOUT_MS = 5_000;
export const MOUTH_MAX_ATTEMPTS = 3;
export const MOUTH_DEFAULT_OPEN_THRESHOLD = MOUTH_OPEN_THRESHOLD;
export const MOUTH_DEFAULT_CLOSE_THRESHOLD = MOUTH_CLOSE_THRESHOLD;

export interface BlinkCalibrationResult {
  closeThreshold: number;
  openThreshold: number;
  openMedian: number;
  closedMedian: number;
  fallback: boolean;
}

export interface MouthCalibrationResult {
  openThreshold: number;
  closeThreshold: number;
  baseline: number;
  openMar: number;
  activationThreshold: number;
  fallback: boolean;
}

export interface InputCalibrationResult {
  blink: BlinkCalibrationResult;
  mouth: MouthCalibrationResult;
}

export interface BlinkCalibrationSnapshot {
  phase: 'open' | 'blink' | 'rest' | 'failed' | 'done';
  completedTrials: number;
  totalTrials: number;
  trialNumber: number;
  attemptNumber: number;
  phaseProgress: number;
  instruction: string;
  faceDetected: boolean;
  currentEar: number | null;
  openSampleCount: number;
  failed: boolean;
  done: boolean;
  result: BlinkCalibrationResult | null;
}

export interface MouthCalibrationSnapshot {
  phase:
    | 'baseline'
    | 'ready'
    | 'wait'
    | 'active'
    | 'close'
    | 'failed'
    | 'done';
  completedTrials: number;
  totalTrials: number;
  trialNumber: number;
  attemptNumber: number;
  phaseProgress: number;
  instruction: string;
  faceDetected: boolean;
  currentMar: number | null;
  activationThreshold: number | null;
  failed: boolean;
  done: boolean;
  result: MouthCalibrationResult | null;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampProgress(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function roundThreshold(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** 얼굴이 없는 구간을 제외한 시간만 누적한다. */
class FaceActiveClock {
  private activeNowMs = 0;
  private lastWallNowMs: number | null = null;
  private hadFace = false;

  advance(wallNowMs: number, hasFace: boolean): number {
    if (
      this.lastWallNowMs !== null &&
      this.hadFace &&
      hasFace &&
      wallNowMs >= this.lastWallNowMs
    ) {
      this.activeNowMs += wallNowMs - this.lastWallNowMs;
    }

    this.lastWallNowMs = wallNowMs;
    this.hadFace = hasFace;
    return this.activeNowMs;
  }
}

export class BlinkCalibrationSession {
  private clock = new FaceActiveClock();
  private phase: BlinkCalibrationSnapshot['phase'] = 'open';
  private phaseStartedAtMs = 0;
  private openSamples: number[] = [];
  private roundOpenSamples: number[] = [];
  private closedMinima: number[] = [];
  private currentMinimum: number | null = null;
  private completedTrials = 0;
  private failedAttempts = 0;
  private faceDetected = false;
  private currentEar: number | null = null;
  private result: BlinkCalibrationResult | null = null;

  update(ear: number | null, wallNowMs: number): BlinkCalibrationSnapshot {
    this.faceDetected = ear !== null;
    this.currentEar = ear;
    const nowMs = this.clock.advance(wallNowMs, this.faceDetected);

    if (ear === null || this.phase === 'failed' || this.phase === 'done') {
      return this.getSnapshot(nowMs);
    }

    if (this.phase === 'open') {
      this.roundOpenSamples.push(ear);
      const elapsedMs = nowMs - this.phaseStartedAtMs;

      if (
        elapsedMs >= BLINK_OPEN_COLLECT_MS &&
        this.roundOpenSamples.length >= BLINK_OPEN_MIN_SAMPLES
      ) {
        this.openSamples.push(...this.roundOpenSamples);
        this.currentMinimum = null;
        this.startPhase('blink', nowMs);
      }
    } else if (this.phase === 'blink') {
      this.currentMinimum =
        this.currentMinimum === null
          ? ear
          : Math.min(this.currentMinimum, ear);

      const openEstimate = median(this.openSamples);
      const blinked =
        this.currentMinimum < openEstimate * 0.6 &&
        ear > openEstimate * 0.8;

      if (blinked) {
        this.closedMinima.push(this.currentMinimum);
        this.completedTrials += 1;
        this.failedAttempts = 0;

        if (this.completedTrials >= BLINK_TOTAL_TRIALS) {
          this.finish();
        } else {
          this.startPhase('rest', nowMs);
        }
      } else if (nowMs - this.phaseStartedAtMs >= BLINK_WINDOW_MS) {
        // timeout에서 관측한 minimum은 성공 통계에 절대 포함하지 않는다.
        this.failAttempt(nowMs);
      }
    } else if (
      this.phase === 'rest' &&
      nowMs - this.phaseStartedAtMs >= BLINK_REST_MS
    ) {
      this.beginOpenCollection(nowMs);
    }

    return this.getSnapshot(nowMs);
  }

  getCurrentSnapshot(): BlinkCalibrationSnapshot {
    return this.getSnapshot(this.phaseStartedAtMs);
  }

  restart(): BlinkCalibrationSnapshot {
    this.clock = new FaceActiveClock();
    this.phase = 'open';
    this.phaseStartedAtMs = 0;
    this.openSamples = [];
    this.roundOpenSamples = [];
    this.closedMinima = [];
    this.currentMinimum = null;
    this.completedTrials = 0;
    this.failedAttempts = 0;
    this.faceDetected = false;
    this.currentEar = null;
    this.result = null;
    return this.getCurrentSnapshot();
  }

  continueWithDefaults(): BlinkCalibrationSnapshot {
    this.result = {
      closeThreshold: EAR_CLOSE_THRESHOLD,
      openThreshold: EAR_OPEN_THRESHOLD,
      openMedian: median(this.openSamples),
      closedMedian: median(this.closedMinima),
      fallback: true,
    };
    this.phase = 'done';
    return this.getCurrentSnapshot();
  }

  private failAttempt(nowMs: number): void {
    this.failedAttempts += 1;

    if (this.failedAttempts >= BLINK_MAX_ATTEMPTS) {
      this.phase = 'failed';
      return;
    }

    this.beginOpenCollection(nowMs);
  }

  private beginOpenCollection(nowMs: number): void {
    this.roundOpenSamples = [];
    this.currentMinimum = null;
    this.startPhase('open', nowMs);
  }

  private startPhase(
    phase: BlinkCalibrationSnapshot['phase'],
    nowMs: number,
  ): void {
    this.phase = phase;
    this.phaseStartedAtMs = nowMs;
  }

  private finish(): void {
    const openMedian = median(this.openSamples);
    const closedMedian = median(this.closedMinima);
    const span = openMedian - closedMedian;
    const fallback = this.closedMinima.length === 0 || span < 0.05;

    this.result = fallback
      ? {
          closeThreshold: EAR_CLOSE_THRESHOLD,
          openThreshold: EAR_OPEN_THRESHOLD,
          openMedian,
          closedMedian,
          fallback: true,
        }
      : {
          closeThreshold: roundThreshold(closedMedian + span * 0.35),
          openThreshold: roundThreshold(closedMedian + span * 0.55),
          openMedian: roundThreshold(openMedian),
          closedMedian: roundThreshold(closedMedian),
          fallback: false,
        };
    this.phase = 'done';
  }

  private getSnapshot(nowMs: number): BlinkCalibrationSnapshot {
    const elapsedMs = Math.max(0, nowMs - this.phaseStartedAtMs);
    let phaseProgress = 0;

    if (this.phase === 'open') {
      phaseProgress = Math.min(
        clampProgress(elapsedMs / BLINK_OPEN_COLLECT_MS),
        clampProgress(this.roundOpenSamples.length / BLINK_OPEN_MIN_SAMPLES),
      );
    } else if (this.phase === 'blink') {
      phaseProgress = clampProgress(elapsedMs / BLINK_WINDOW_MS);
    } else if (this.phase === 'rest') {
      phaseProgress = clampProgress(elapsedMs / BLINK_REST_MS);
    } else if (this.phase === 'done') {
      phaseProgress = 1;
    }

    return {
      phase: this.phase,
      completedTrials: this.completedTrials,
      totalTrials: BLINK_TOTAL_TRIALS,
      trialNumber: Math.min(this.completedTrials + 1, BLINK_TOTAL_TRIALS),
      attemptNumber: Math.min(this.failedAttempts + 1, BLINK_MAX_ATTEMPTS),
      phaseProgress,
      instruction: this.getInstruction(),
      faceDetected: this.faceDetected,
      currentEar: this.currentEar,
      openSampleCount: this.roundOpenSamples.length,
      failed: this.phase === 'failed',
      done: this.phase === 'done',
      result: this.result,
    };
  }

  private getInstruction(): string {
    if (!this.faceDetected && this.phase !== 'failed' && this.phase !== 'done') {
      return '얼굴이 인식되지 않았습니다. 카메라를 정면으로 바라봐 주세요.';
    }

    if (this.phase === 'open') {
      return '눈을 편하게 뜨고 정면을 바라봐 주세요.';
    }

    if (this.phase === 'blink') {
      return '지금 한 번 자연스럽게 깜빡여 주세요.';
    }

    if (this.phase === 'rest') {
      return '좋습니다. 눈을 편하게 뜨고 잠시 기다려 주세요.';
    }

    if (this.phase === 'failed') {
      return '눈 깜빡임을 확인하지 못했습니다. 다시 측정하거나 기본값으로 계속할 수 있습니다.';
    }

    return '눈 깜빡임 측정이 완료되었습니다.';
  }
}

export class MouthCalibrationSession {
  private clock = new FaceActiveClock();
  private phase: MouthCalibrationSnapshot['phase'] = 'baseline';
  private phaseStartedAtMs = 0;
  private baselineSamples: number[] = [];
  private baseline = 0;
  private activationThreshold: number | null = null;
  private successfulPeaks: number[] = [];
  private currentPeak = 0;
  private activationStartedAtMs: number | null = null;
  private closeStartedAtMs: number | null = null;
  private completedTrials = 0;
  private failedAttempts = 0;
  private faceDetected = false;
  private currentMar: number | null = null;
  private result: MouthCalibrationResult | null = null;

  update(mar: number | null, wallNowMs: number): MouthCalibrationSnapshot {
    this.faceDetected = mar !== null;
    this.currentMar = mar;
    const nowMs = this.clock.advance(wallNowMs, this.faceDetected);

    if (mar === null || this.phase === 'failed' || this.phase === 'done') {
      return this.getSnapshot(nowMs);
    }

    if (this.phase === 'baseline') {
      this.baselineSamples.push(mar);

      if (nowMs - this.phaseStartedAtMs >= MOUTH_BASELINE_COLLECT_MS) {
        this.baseline = mean(this.baselineSamples);
        this.activationThreshold = Math.max(
          this.baseline * 1.6,
          this.baseline + 0.08,
        );
        this.startReady(nowMs);
      }
    } else if (
      this.phase === 'ready' &&
      nowMs - this.phaseStartedAtMs >= MOUTH_READY_MS
    ) {
      this.startPhase('wait', nowMs);
    } else if (this.phase === 'wait') {
      if (this.isMouthOpen(mar)) {
        this.currentPeak = mar;
        this.activationStartedAtMs = nowMs;
        this.closeStartedAtMs = null;
        this.startPhase('active', nowMs);
      } else if (nowMs - this.phaseStartedAtMs >= MOUTH_RESPONSE_TIMEOUT_MS) {
        this.failAttempt(nowMs);
      }
    } else if (this.phase === 'active') {
      this.currentPeak = Math.max(this.currentPeak, mar);
      const openElapsedMs = this.activationElapsed(nowMs);

      // 원본과 달리 1.2초 전에 닫히면 그 trial은 즉시 실패한다.
      if (!this.isMouthOpen(mar) && openElapsedMs < MOUTH_MIN_OPEN_HOLD_MS) {
        this.failAttempt(nowMs);
      } else if (openElapsedMs >= MOUTH_MIN_OPEN_HOLD_MS) {
        this.closeStartedAtMs = this.isMouthOpen(mar) ? null : nowMs;
        this.startPhase('close', nowMs);
      }
    } else if (this.phase === 'close') {
      this.currentPeak = Math.max(this.currentPeak, mar);
      const isOpen = this.isMouthOpen(mar);

      // 계속 입을 벌린 채 기다리는 원본의 무한 대기를 제한한다.
      if (
        isOpen &&
        this.activationElapsed(nowMs) >= MOUTH_ACTIVE_TIMEOUT_MS
      ) {
        this.failAttempt(nowMs);
      } else if (isOpen) {
        this.closeStartedAtMs = null;
      } else {
        if (this.closeStartedAtMs === null) {
          this.closeStartedAtMs = nowMs;
        }

        if (nowMs - this.closeStartedAtMs >= MOUTH_CLOSE_CONFIRM_MS) {
          this.successfulPeaks.push(this.currentPeak);
          this.completedTrials += 1;
          this.failedAttempts = 0;

          if (this.completedTrials >= MOUTH_TOTAL_TRIALS) {
            this.finish();
          } else {
            this.startReady(nowMs);
          }
        }
      }
    }

    return this.getSnapshot(nowMs);
  }

  getCurrentSnapshot(): MouthCalibrationSnapshot {
    return this.getSnapshot(this.phaseStartedAtMs);
  }

  restart(): MouthCalibrationSnapshot {
    this.clock = new FaceActiveClock();
    this.phase = 'baseline';
    this.phaseStartedAtMs = 0;
    this.baselineSamples = [];
    this.baseline = 0;
    this.activationThreshold = null;
    this.successfulPeaks = [];
    this.currentPeak = 0;
    this.activationStartedAtMs = null;
    this.closeStartedAtMs = null;
    this.completedTrials = 0;
    this.failedAttempts = 0;
    this.faceDetected = false;
    this.currentMar = null;
    this.result = null;
    return this.getCurrentSnapshot();
  }

  continueWithDefaults(): MouthCalibrationSnapshot {
    this.result = {
      openThreshold: MOUTH_DEFAULT_OPEN_THRESHOLD,
      closeThreshold: MOUTH_DEFAULT_CLOSE_THRESHOLD,
      baseline: this.baseline,
      openMar: mean(this.successfulPeaks) || this.baseline,
      activationThreshold:
        this.activationThreshold ?? Math.max(this.baseline * 1.6, this.baseline + 0.08),
      fallback: true,
    };
    this.phase = 'done';
    return this.getCurrentSnapshot();
  }

  private activationElapsed(nowMs: number): number {
    return this.activationStartedAtMs === null
      ? 0
      : nowMs - this.activationStartedAtMs;
  }

  private isMouthOpen(mar: number): boolean {
    return this.activationThreshold !== null && mar >= this.activationThreshold;
  }

  private failAttempt(nowMs: number): void {
    this.failedAttempts += 1;
    this.currentPeak = 0;
    this.activationStartedAtMs = null;
    this.closeStartedAtMs = null;

    if (this.failedAttempts >= MOUTH_MAX_ATTEMPTS) {
      this.phase = 'failed';
      return;
    }

    this.startReady(nowMs);
  }

  private startReady(nowMs: number): void {
    this.currentPeak = 0;
    this.activationStartedAtMs = null;
    this.closeStartedAtMs = null;
    this.startPhase('ready', nowMs);
  }

  private startPhase(
    phase: MouthCalibrationSnapshot['phase'],
    nowMs: number,
  ): void {
    this.phase = phase;
    this.phaseStartedAtMs = nowMs;
  }

  private finish(): void {
    const openMar = mean(this.successfulPeaks) || this.baseline;
    const gap = openMar - this.baseline;
    const fallback = gap <= 0.03;

    this.result = fallback
      ? {
          openThreshold: MOUTH_DEFAULT_OPEN_THRESHOLD,
          closeThreshold: MOUTH_DEFAULT_CLOSE_THRESHOLD,
          baseline: this.baseline,
          openMar,
          activationThreshold: this.activationThreshold ?? 0,
          fallback: true,
        }
      : {
          openThreshold: roundThreshold(this.baseline + gap * 0.55),
          closeThreshold: roundThreshold(this.baseline + gap * 0.3),
          baseline: roundThreshold(this.baseline),
          openMar: roundThreshold(openMar),
          activationThreshold: roundThreshold(this.activationThreshold ?? 0),
          fallback: false,
        };
    this.phase = 'done';
  }

  private getSnapshot(nowMs: number): MouthCalibrationSnapshot {
    const elapsedMs = Math.max(0, nowMs - this.phaseStartedAtMs);
    let phaseProgress = 0;

    if (this.phase === 'baseline') {
      phaseProgress = clampProgress(elapsedMs / MOUTH_BASELINE_COLLECT_MS);
    } else if (this.phase === 'ready') {
      phaseProgress = clampProgress(elapsedMs / MOUTH_READY_MS);
    } else if (this.phase === 'wait') {
      phaseProgress = clampProgress(elapsedMs / MOUTH_RESPONSE_TIMEOUT_MS);
    } else if (this.phase === 'active') {
      phaseProgress = clampProgress(
        this.activationElapsed(nowMs) / MOUTH_MIN_OPEN_HOLD_MS,
      );
    } else if (this.phase === 'close') {
      phaseProgress = this.closeStartedAtMs === null
        ? 0
        : clampProgress((nowMs - this.closeStartedAtMs) / MOUTH_CLOSE_CONFIRM_MS);
    } else if (this.phase === 'done') {
      phaseProgress = 1;
    }

    return {
      phase: this.phase,
      completedTrials: this.completedTrials,
      totalTrials: MOUTH_TOTAL_TRIALS,
      trialNumber: Math.min(this.completedTrials + 1, MOUTH_TOTAL_TRIALS),
      attemptNumber: Math.min(this.failedAttempts + 1, MOUTH_MAX_ATTEMPTS),
      phaseProgress,
      instruction: this.getInstruction(),
      faceDetected: this.faceDetected,
      currentMar: this.currentMar,
      activationThreshold: this.activationThreshold,
      failed: this.phase === 'failed',
      done: this.phase === 'done',
      result: this.result,
    };
  }

  private getInstruction(): string {
    if (!this.faceDetected && this.phase !== 'failed' && this.phase !== 'done') {
      return '얼굴이 인식되지 않았습니다. 카메라를 정면으로 바라봐 주세요.';
    }

    if (this.phase === 'baseline') {
      return '입을 편하게 다물고 정면을 바라봐 주세요.';
    }

    if (this.phase === 'ready') {
      return '입을 편하게 다문 채 다음 측정을 준비해 주세요.';
    }

    if (this.phase === 'wait') {
      return '지금 입을 크게 벌려 주세요.';
    }

    if (this.phase === 'active') {
      return '입을 벌린 상태를 잠시 유지해 주세요.';
    }

    if (this.phase === 'close') {
      return '이제 입을 편하게 닫아 주세요.';
    }

    if (this.phase === 'failed') {
      return '입 움직임을 확인하지 못했습니다. 다시 측정하거나 기본값으로 계속할 수 있습니다.';
    }

    return '입 움직임 측정이 완료되었습니다.';
  }
}
