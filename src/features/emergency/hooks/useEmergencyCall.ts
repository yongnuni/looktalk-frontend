import { useCallback, useEffect, useRef, useState } from 'react';
import { createEmergencyCall } from '../api/emergencyCalls';

/** 카운트다운 시작 값 (초). Figma Frame 125 기준 5초 */
export const EMERGENCY_COUNTDOWN_SECONDS = 5;

/** "달려오고 있어요!" / 실패 안내가 떠 있는 시간 (ms) */
const RESULT_MESSAGE_DURATION_MS = 60000;

type EmergencyPhase = 'idle' | 'counting' | 'sent' | 'error';

/**
 * 비상호출 흐름 상태 관리
 *
 * idle
 *   → (버튼 클릭)
 * counting (5초 카운트다운, 취소 가능)
 *   → sent (전송 완료 안내) | error (전송 실패 안내)
 *   → idle
 */
export function useEmergencyCall() {
  const [phase, setPhase] = useState<EmergencyPhase>('idle');
  const [remaining, setRemaining] = useState(EMERGENCY_COUNTDOWN_SECONDS);

  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = useCallback(() => {
    setRemaining(EMERGENCY_COUNTDOWN_SECONDS);
    setPhase('counting');
  }, []);

  const cancel = useCallback(() => {
    clearTimer();
    setPhase('idle');
    setRemaining(EMERGENCY_COUNTDOWN_SECONDS);
  }, []);

  const close = useCallback(() => {
    setPhase('idle');
  }, []);

  // 카운트다운
  useEffect(() => {
    if (phase !== 'counting') return;

    timerRef.current = window.setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return clearTimer;
  }, [phase]);

  // 카운트다운 종료 → 실제 전송 (POST /api/emergency-calls)
  useEffect(() => {
    if (phase !== 'counting' || remaining !== 0) return;

    let isCancelled = false;

    void (async () => {
      try {
        await createEmergencyCall();

        if (!isCancelled) setPhase('sent');
      } catch (error) {
        console.error('비상호출 전송 실패:', error);

        if (!isCancelled) setPhase('error');
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [phase, remaining]);

  // 결과 안내 자동 닫기
  useEffect(() => {
    if (phase !== 'sent' && phase !== 'error') return;

    const timeout = window.setTimeout(close, RESULT_MESSAGE_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [phase, close]);

  return {
    phase,
    remaining,
    start,
    cancel,
    close,
  };
}
