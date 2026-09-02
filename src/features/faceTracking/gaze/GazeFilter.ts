import { KalmanFilter2D } from './kalmanFilter2D';

/**
 * Look-Talk 원본: src/tracking/gaze_pipeline.py GazePipeline 클래스를 그대로 포팅한다.
 * 좌표 단위는 Integration Plan §13.1 계약에 따라 **viewport CSS px**다(정규화 좌표 아님).
 *
 * 상수(전부 config.py/gaze_pipeline.py에서 재확인한 값):
 *   GAZE_AVG_WINDOW=3, SMOOTH_ALPHA=0.35, FIXATION_RADIUS=40, FIXATION_FRAMES=6,
 *   dead zone: movement<10→10px, <40→15px, else→25px, max_step_px=50
 *
 * 눈 감음/저신뢰도 처리는 별도 "게이트 모듈"이 아니라 Python처럼 update() 파라미터
 * (blink, conf)로 직접 받아 내부에서 상태를 리셋한다 — Eye-Closed Gate는 이 blink
 * 값을 만들어주는 상류 계산(blinkGate.ts)일 뿐, GazeFilter 앞단에서 프레임을
 * 건너뛰는 별도 단계가 아니다(Python도 매 프레임 gaze.update()를 호출하고, 그
 * 내부에서 blink/conf를 검사한다 — main.py:1108, gaze_pipeline.py:111-135).
 */

const GAZE_AVG_WINDOW = 3;
const SMOOTH_ALPHA = 0.35;
const FIXATION_RADIUS_PX = 40;
const FIXATION_FRAMES = 6;
const MAX_STEP_PX = 50.0;
const MIN_CONFIDENCE = 0.3; // gaze_pipeline.py:129 `conf <= 0.3` (Calibration의 0.4 게이트와는 다른 값 — 재확인됨)

export interface GazeFilterResult {
  x: number; // -1이면 무효(추적 실패/눈 감음/저신뢰도)
  y: number;
  fixationCount: number;
}

export class GazeFilter {
  private readonly kalman = new KalmanFilter2D();
  private buffer: Array<{ x: number; y: number }> = [];
  private initialized = false;
  private lastOutput: { x: number; y: number } | null = null;
  private fixationCenter: { x: number; y: number } | null = null;
  private fixationCount = 0;

  /** 'r' 키 재캘리브레이션 등 전체 리셋(Python reset()) — Kalman statePost도 함께 초기화. */
  reset(): void {
    this.resetTrackingState();
    this.kalman.resetState(0, 0);
  }

  /** 무효 입력 시 내부 상태만 리셋(Python _reset_tracking_state()) — errorCov(P)는 유지. */
  private resetTrackingState(): void {
    this.holdTrackingState();
    this.lastOutput = null;
  }

  /**
   * 눈 감김/저신뢰도로 좌표가 잠시 끊긴 구간용 — `lastOutput`만 남기고 나머지를 비운다.
   *
   * `lastOutput`까지 지우면 눈을 다시 뜬 첫 유효 프레임이 아래 `lastOutput === null` 분기를
   * 타서 dead zone·EMA·MAX_STEP_PX 클램프를 하나도 받지 못한 원시 좌표로 나간다. 눈꺼풀이
   * 아직 홍채를 덮고 있는 프레임이 그대로 반영되면 커서가 아래로 튀고, blink 선택 판정도
   * 그 좌표에 휘둘린다. 감기 직전 좌표를 남겨 두면 재개 이동이 MAX_STEP_PX로 클램프된다.
   *
   * fixation은 함께 비운다 — 깜빡임 뒤의 고정은 새로 판정하는 것이 맞다.
   */
  private holdTrackingState(): void {
    this.fixationCenter = null;
    this.fixationCount = 0;
    this.buffer = [];
    this.initialized = false;
  }

  /**
   * 매 프레임 호출한다(viewport CSS px 입력).
   *
   * @param sx 캘리브레이션된 화면 x(px), 없으면 null
   * @param sy 캘리브레이션된 화면 y(px), 없으면 null
   * @param conf iris confidence(0..1)
   * @param blink 현재 프레임이 눈 감음 상태인지(Eye-Closed Gate 출력)
   */
  update(sx: number | null, sy: number | null, conf: number, blink: boolean): GazeFilterResult {
    if (sx === null || sy === null) {
      // 추적 자체가 끊긴 경우(얼굴 미검출 등) — 이어 붙일 기준점이 없으므로 전부 버린다.
      this.resetTrackingState();
      return { x: -1, y: -1, fixationCount: 0 };
    }

    if (blink || conf <= MIN_CONFIDENCE) {
      // 얼굴은 계속 보이는데 눈만 감긴/전이 구간 — 감기 직전 좌표를 유지해 재개 시 튐을 막는다.
      this.holdTrackingState();
      return { x: -1, y: -1, fixationCount: 0 };
    }

    this.buffer.push({ x: sx, y: sy });
    if (this.buffer.length > GAZE_AVG_WINDOW) {
      this.buffer.shift();
    }

    const avgX = this.buffer.reduce((sum, p) => sum + p.x, 0) / this.buffer.length;
    const avgY = this.buffer.reduce((sum, p) => sum + p.y, 0) / this.buffer.length;

    if (!this.initialized) {
      this.kalman.resetState(avgX, avgY);
      this.initialized = true;
    }

    this.kalman.predict();
    const estimated = this.kalman.correct(avgX, avgY);

    let sxS = estimated.x;
    let syS = estimated.y;

    if (this.lastOutput === null) {
      this.lastOutput = { x: sxS, y: syS };
    } else {
      const prevX = this.lastOutput.x;
      const prevY = this.lastOutput.y;

      const emaX = SMOOTH_ALPHA * sxS + (1 - SMOOTH_ALPHA) * prevX;
      const emaY = SMOOTH_ALPHA * syS + (1 - SMOOTH_ALPHA) * prevY;

      const movement = Math.hypot(emaX - prevX, emaY - prevY);

      let deadZone: number;
      if (movement < 10) {
        deadZone = 10;
      } else if (movement < 40) {
        deadZone = 15;
      } else {
        deadZone = 25;
      }

      if (movement < deadZone) {
        // 작은 흔들림은 무시 — Python과 동일하게 lastOutput은 여기서 갱신하지 않는다
        // (다음 프레임에도 계속 같은 prevX/prevY 기준으로 비교되는 의도적 비대칭).
        sxS = prevX;
        syS = prevY;
      } else {
        const dx = emaX - prevX;
        const dy = emaY - prevY;
        const stepDistance = Math.hypot(dx, dy);

        if (stepDistance > MAX_STEP_PX) {
          const scale = MAX_STEP_PX / stepDistance;
          sxS = prevX + dx * scale;
          syS = prevY + dy * scale;
        } else {
          sxS = emaX;
          syS = emaY;
        }

        this.lastOutput = { x: sxS, y: syS };
      }
    }

    if (this.fixationCenter === null) {
      this.fixationCenter = { x: sxS, y: syS };
      this.fixationCount = 1;
    } else {
      const dist = Math.hypot(sxS - this.fixationCenter.x, syS - this.fixationCenter.y);

      if (dist < FIXATION_RADIUS_PX) {
        this.fixationCount += 1;
        this.fixationCenter.x += 0.05 * (sxS - this.fixationCenter.x);
        this.fixationCenter.y += 0.05 * (syS - this.fixationCenter.y);
      } else {
        this.fixationCenter = { x: sxS, y: syS };
        this.fixationCount = 1;
      }
    }

    const useFixation = this.fixationCount >= FIXATION_FRAMES;
    const gazeX = Math.trunc(useFixation ? this.fixationCenter.x : sxS);
    const gazeY = Math.trunc(useFixation ? this.fixationCenter.y : syS);

    return { x: gazeX, y: gazeY, fixationCount: this.fixationCount };
  }
}
