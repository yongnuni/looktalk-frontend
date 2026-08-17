import { useCallback, useEffect, useRef, useState } from 'react';
import { getEmergencyCalls, markEmergencyCallRead } from '../api/emergencyCalls';
import type { EmergencyCallListItemDto } from '../../../shared/types/backend';

/** 읽지 않은 비상호출을 주기적으로 확인하는 간격 (ms) */
const POLL_INTERVAL_MS = 15000;

/** 의료진 화면에서 읽지 않은 비상호출 알림을 폴링으로 확인한다 (EMERGENCY-002/003) */
export function useEmergencyAlerts() {
  const [alerts, setAlerts] = useState<EmergencyCallListItemDto[]>([]);
  const dismissedIdsRef = useRef(new Set<number>());

  const refresh = useCallback(async () => {
    try {
      const data = await getEmergencyCalls({ unreadOnly: true, size: 20 });

      setAlerts(
        data.items.filter((item) => !dismissedIdsRef.current.has(item.emergencyCallId)),
      );
    } catch {
      // 폴링 실패는 조용히 무시하고 다음 주기에 재시도한다.
    }
  }, []);

  useEffect(() => {
    void refresh();

    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [refresh]);

  const dismissAlert = useCallback(async (emergencyCallId: number) => {
    dismissedIdsRef.current.add(emergencyCallId);
    setAlerts((current) => current.filter((alert) => alert.emergencyCallId !== emergencyCallId));

    try {
      await markEmergencyCallRead(emergencyCallId);
    } catch (error) {
      console.error('비상호출 읽음 처리 실패:', error);
    }
  }, []);

  return { alerts, dismissAlert };
}
