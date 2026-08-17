import { useCallback, useEffect } from 'react';
import { getActiveCalibration } from '../api/calibrationApi';
import { useCalibrationStore, type ActiveCalibrationStatus } from '../store/calibrationStore';
import type { GazeCalibrationResult } from '../types';
import {
  checkViewportCompatibility,
  getCurrentViewportSnapshot,
  type CalibrationCompatibility,
} from '../viewportCompatibility';

interface UseActiveCalibrationResult {
  active: GazeCalibrationResult | null;
  activeCalibrationId: string | null;
  status: ActiveCalibrationStatus;
  error: string | null;
  /** active가 있을 때만 계산됨(§8.5) — 강제 재측정이 아닌 비침습적 배너 판단용. */
  compatibility: CalibrationCompatibility | null;
  refresh: () => Promise<void>;
}

// Integration Plan §9.2 — 새로고침 시 local memory에 없다는 이유로 재측정을 시작하지 않고
// 항상 Backend active calibration을 먼저 조회한다. 여러 페이지(PatientHomePage, 향후 Gate)가
// 공유하는 calibrationStore의 activeStatus로 중복 조회를 막는다.
export function useActiveCalibration(): UseActiveCalibrationResult {
  const active = useCalibrationStore((state) => state.active);
  const activeCalibrationId = useCalibrationStore((state) => state.activeCalibrationId);
  const status = useCalibrationStore((state) => state.activeStatus);
  const error = useCalibrationStore((state) => state.activeError);
  const setActive = useCalibrationStore((state) => state.setActive);
  const setActiveNotFound = useCalibrationStore((state) => state.setActiveNotFound);
  const setActiveLoading = useCalibrationStore((state) => state.setActiveLoading);
  const setActiveError = useCalibrationStore((state) => state.setActiveError);

  const refresh = useCallback(async () => {
    setActiveLoading();

    try {
      const persisted = await getActiveCalibration();

      if (persisted) {
        setActive(persisted.calibrationId, persisted.result);
      } else {
        setActiveNotFound();
      }
    } catch {
      setActiveError('활성 캘리브레이션을 불러오지 못했습니다.');
    }
  }, [setActive, setActiveNotFound, setActiveLoading, setActiveError]);

  useEffect(() => {
    if (useCalibrationStore.getState().activeStatus !== 'idle') {
      return;
    }

    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만, store status로 중복 방지
  }, []);

  const compatibility = active
    ? checkViewportCompatibility(active.calibratedViewport, getCurrentViewportSnapshot())
    : null;

  return { active, activeCalibrationId, status, error, compatibility, refresh };
}
