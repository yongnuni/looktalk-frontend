import { describe, expect, it } from 'vitest';
import {
  BLINK_OPEN_MIN_SAMPLES,
  BlinkCalibrationSession,
  MOUTH_ACTIVE_TIMEOUT_MS,
  MOUTH_DEFAULT_CLOSE_THRESHOLD,
  MOUTH_DEFAULT_OPEN_THRESHOLD,
  MouthCalibrationSession,
} from './inputCalibration';

function collectBlinkOpen(
  session: BlinkCalibrationSession,
  startMs: number,
  ear = 0.3,
): number {
  for (let index = 0; index < BLINK_OPEN_MIN_SAMPLES; index += 1) {
    session.update(
      ear,
      startMs + (index * 1_200) / (BLINK_OPEN_MIN_SAMPLES - 1),
    );
  }

  return startMs + 1_200;
}

function completeBlinkTrial(
  session: BlinkCalibrationSession,
  startMs: number,
  openEar = 0.3,
  closedEar = 0.1,
): number {
  const collectedAt = collectBlinkOpen(session, startMs, openEar);
  session.update(closedEar, collectedAt + 20);
  session.update(openEar, collectedAt + 120);
  return collectedAt + 120;
}

function collectMouthBaseline(
  session: MouthCalibrationSession,
  startMs: number,
  baseline = 0.1,
): number {
  session.update(baseline, startMs);
  session.update(baseline, startMs + 2_000);
  session.update(baseline, startMs + 4_000);
  return startMs + 4_000;
}

function completeMouthTrial(
  session: MouthCalibrationSession,
  readyStartedAt: number,
  baseline = 0.1,
  openMar = 0.4,
): number {
  session.update(baseline, readyStartedAt + 2_000);
  session.update(openMar, readyStartedAt + 2_100);
  session.update(openMar, readyStartedAt + 3_300);
  session.update(baseline, readyStartedAt + 3_320);
  session.update(baseline, readyStartedAt + 4_320);
  return readyStartedAt + 4_320;
}

describe('BlinkCalibrationSession', () => {
  it('1.2초와 열린 눈 15개를 모두 채워야 blink 단계로 이동한다', () => {
    const session = new BlinkCalibrationSession();

    for (let index = 0; index < BLINK_OPEN_MIN_SAMPLES - 1; index += 1) {
      session.update(0.3, index * 100);
    }

    expect(session.update(0.3, 1_500).phase).toBe('blink');

    const tooFew = new BlinkCalibrationSession();
    tooFew.update(0.3, 0);
    expect(tooFew.update(0.3, 1_500).phase).toBe('open');
  });

  it('openEstimate의 0.60 아래로 감겼다가 0.80 위로 열릴 때만 성공한다', () => {
    const session = new BlinkCalibrationSession();
    const collectedAt = collectBlinkOpen(session, 0);

    session.update(0.17, collectedAt + 20);
    expect(session.update(0.25, collectedAt + 100).completedTrials).toBe(1);
  });

  it('timeout trial의 minimum은 성공 sample과 최종 threshold에 포함하지 않는다', () => {
    const session = new BlinkCalibrationSession();
    let now = collectBlinkOpen(session, 0);

    session.update(0.05, now + 10);
    const retried = session.update(0.05, now + 2_010);
    expect(retried.completedTrials).toBe(0);
    expect(retried.phase).toBe('open');
    expect(retried.attemptNumber).toBe(2);

    now += 2_020;
    for (let trial = 0; trial < 5; trial += 1) {
      now = completeBlinkTrial(session, now, 0.3, 0.1);
      if (trial < 4) {
        session.update(0.3, now + 600);
        now += 610;
      }
    }

    const result = session.getCurrentSnapshot().result;
    expect(result?.closedMedian).toBe(0.1);
    expect(result?.fallback).toBe(false);
  });

  it('5개 성공 trial 뒤 중앙값 보간 threshold를 계산한다', () => {
    const session = new BlinkCalibrationSession();
    let now = 0;

    for (let trial = 0; trial < 5; trial += 1) {
      now = completeBlinkTrial(session, now, 0.3, 0.1);
      if (trial < 4) {
        session.update(0.3, now + 600);
        now += 610;
      }
    }

    const snapshot = session.getCurrentSnapshot();
    expect(snapshot.done).toBe(true);
    expect(snapshot.completedTrials).toBe(5);
    expect(snapshot.result).toMatchObject({
      closeThreshold: 0.17,
      openThreshold: 0.21,
      fallback: false,
    });
  });

  it('open/closed span이 0.05 미만이면 기존 기본값을 사용한다', () => {
    const session = new BlinkCalibrationSession();
    let now = 0;

    for (let trial = 0; trial < 5; trial += 1) {
      now = completeBlinkTrial(session, now, 0.1, 0.055);
      if (trial < 4) {
        session.update(0.1, now + 600);
        now += 610;
      }
    }

    expect(session.getCurrentSnapshot().result).toMatchObject({
      closeThreshold: 0.18,
      openThreshold: 0.22,
      fallback: true,
    });
  });

  it('얼굴 미감지 구간은 open timer에서 제외하고 3회 실패 후 재측정할 수 있다', () => {
    const paused = new BlinkCalibrationSession();
    paused.update(0.3, 0);
    paused.update(0.3, 600);
    paused.update(null, 700);
    paused.update(null, 5_700);
    paused.update(0.3, 5_800);

    for (let index = 0; index < 13; index += 1) {
      paused.update(0.3, 6_400);
    }

    expect(paused.getCurrentSnapshot().phase).toBe('blink');

    const failed = new BlinkCalibrationSession();
    let now = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      now = collectBlinkOpen(failed, now);
      failed.update(0.3, now + 2_000);
      now += 2_010;
    }

    expect(failed.getCurrentSnapshot().failed).toBe(true);
    expect(failed.restart()).toMatchObject({
      phase: 'open',
      completedTrials: 0,
      attemptNumber: 1,
    });
  });
});

describe('MouthCalibrationSession', () => {
  it('4초 baseline 평균과 임시 activation threshold를 계산한다', () => {
    const session = new MouthCalibrationSession();
    collectMouthBaseline(session, 0, 0.1);

    const snapshot = session.getCurrentSnapshot();
    expect(snapshot.phase).toBe('ready');
    expect(snapshot.activationThreshold).toBeCloseTo(0.18);
  });

  it('1.2초 전에 입을 닫으면 성공이 아니라 같은 trial 재시도가 된다', () => {
    const session = new MouthCalibrationSession();
    const baselineDoneAt = collectMouthBaseline(session, 0);

    session.update(0.1, baselineDoneAt + 2_000);
    session.update(0.4, baselineDoneAt + 2_100);
    const earlyClose = session.update(0.1, baselineDoneAt + 3_000);

    expect(earlyClose.completedTrials).toBe(0);
    expect(earlyClose.phase).toBe('ready');
    expect(earlyClose.attemptNumber).toBe(2);
  });

  it('정상 open hold와 1초 close 확인을 5번 마치면 gap threshold를 계산한다', () => {
    const session = new MouthCalibrationSession();
    let now = collectMouthBaseline(session, 0);

    for (let trial = 0; trial < 5; trial += 1) {
      now = completeMouthTrial(session, now, 0.1, 0.4);
    }

    const snapshot = session.getCurrentSnapshot();
    expect(snapshot.done).toBe(true);
    expect(snapshot.completedTrials).toBe(5);
    expect(snapshot.result).toMatchObject({
      baseline: 0.1,
      openMar: 0.4,
      openThreshold: 0.265,
      closeThreshold: 0.19,
      fallback: false,
    });
  });

  it('입을 계속 벌리면 active 최대 시간에 실패하고 무한 대기하지 않는다', () => {
    const session = new MouthCalibrationSession();
    const baselineDoneAt = collectMouthBaseline(session, 0);
    session.update(0.1, baselineDoneAt + 2_000);
    session.update(0.4, baselineDoneAt + 2_100);
    session.update(0.4, baselineDoneAt + 3_300);

    const failedAttempt = session.update(
      0.4,
      baselineDoneAt + 2_100 + MOUTH_ACTIVE_TIMEOUT_MS,
    );
    expect(failedAttempt.phase).toBe('ready');
    expect(failedAttempt.attemptNumber).toBe(2);
  });

  it('사용자가 기본값으로 계속하면 기존 open/close fallback을 사용한다', () => {
    const session = new MouthCalibrationSession();
    let now = collectMouthBaseline(session, 0, 0.2);

    for (let trial = 0; trial < 5; trial += 1) {
      now = completeMouthTrial(session, now, 0.2, 0.5);
    }

    // 성공 측정 결과를 만든 뒤 fallback API도 기존 기본값을 명시적으로 보장한다.
    const fallback = new MouthCalibrationSession();
    collectMouthBaseline(fallback, 0, 0.2);
    fallback.continueWithDefaults();
    expect(fallback.getCurrentSnapshot().result).toMatchObject({
      openThreshold: MOUTH_DEFAULT_OPEN_THRESHOLD,
      closeThreshold: MOUTH_DEFAULT_CLOSE_THRESHOLD,
      fallback: true,
    });
    expect(session.getCurrentSnapshot().result?.fallback).toBe(false);
  });

  it('실패 trial peak는 성공 통계에서 제외하고 3회 연속 실패 뒤 실패 상태가 된다', () => {
    const statistics = new MouthCalibrationSession();
    let now = collectMouthBaseline(statistics, 0);
    statistics.update(0.1, now + 2_000);
    statistics.update(0.9, now + 2_100);
    statistics.update(0.1, now + 2_500);
    now += 2_500;

    for (let trial = 0; trial < 5; trial += 1) {
      now = completeMouthTrial(statistics, now, 0.1, 0.4);
    }

    expect(statistics.getCurrentSnapshot().result?.openMar).toBe(0.4);

    const failed = new MouthCalibrationSession();
    now = collectMouthBaseline(failed, 0);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      failed.update(0.1, now + 2_000);
      failed.update(0.4, now + 2_100);
      failed.update(0.1, now + 2_500);
      now += 2_500;
    }

    expect(failed.getCurrentSnapshot()).toMatchObject({
      phase: 'failed',
      failed: true,
      completedTrials: 0,
      attemptNumber: 3,
    });
  });

  it('얼굴 미감지 중 baseline timer를 멈추고 다시 측정하면 완전히 초기화한다', () => {
    const session = new MouthCalibrationSession();
    session.update(0.1, 0);
    session.update(0.1, 2_000);
    session.update(null, 2_100);
    session.update(null, 8_100);
    session.update(0.1, 8_200);
    expect(session.update(0.1, 10_200).phase).toBe('ready');

    expect(session.restart()).toMatchObject({
      phase: 'baseline',
      completedTrials: 0,
      attemptNumber: 1,
      activationThreshold: null,
    });
  });
});
