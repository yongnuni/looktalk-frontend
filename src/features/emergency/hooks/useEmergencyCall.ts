import { useCallback, useEffect, useRef, useState } from 'react';
import { useEmergencyStore } from '../../../shared/stores/emergencyStore';
import { usePatientProfileStore } from '../../../shared/stores/patientProfileStore';

/** 카운트다운 시작 값 (초). Figma Frame 125 기준 5초 */
export const EMERGENCY_COUNTDOWN_SECONDS = 5;
/** "달려오고 있어요!" 안내가 떠 있는 시간 (ms) */
const SENT_MESSAGE_DURATION_MS = 3000;

type EmergencyPhase = 'idle' | 'counting' | 'sent';

/**
 * 비상호출 흐름 상태 관리
 * idle → (버튼 클릭) → counting(5초 카운트다운, 취소 가능) → sent(전송 완료 안내) → idle
 */
export function useEmergencyCall() {
  const [phase, setPhase] = useState<EmergencyPhase>('idle');
  const [remaining, setRemaining] = useState(EMERGENCY_COUNTDOWN_SECONDS);

  const timerRef = useRef<number | null>(null);

  const pushCall = useEmergencyStore((state) => state.pushCall);
  const hospitalNickname = usePatientProfileStore(
    (state) => state.hospitalNickname,
  );

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

  const closeSentMessage = useCallback(() => setPhase('idle'), []);

  // 카운트다운
  useEffect(() => {
    if (phase !== 'counting') return;

    timerRef.current = window.setInterval(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);

    return clearTimer;
  }, [phase]);

  // 0초 도달 → 전송
  useEffect(() => {
    if (phase !== 'counting' || remaining > 0) return;

    clearTimer();

    // TODO : 비상호출 전송 API 호출
    // 호실/이름은 "202호 - 김민준 환자" 형태의 병원 내 이름에서 분리
    const [room = '', patientName = ''] = hospitalNickname.split(' - ');
    pushCall({
      room: room.trim(),
      patientName: patientName.replace('환자', '').trim(),
    });

    setPhase('sent');
  }, [phase, remaining, hospitalNickname, pushCall]);

  // 전송 안내 자동 닫기
  useEffect(() => {
    if (phase !== 'sent') return;

    const timeout = window.setTimeout(
      closeSentMessage,
      SENT_MESSAGE_DURATION_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [phase, closeSentMessage]);

  return {
    phase,
    remaining,
    start,
    cancel,
    closeSentMessage,
  };
}
