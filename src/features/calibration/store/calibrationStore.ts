import { create } from 'zustand';
import type { GazeCalibrationResult } from '../types';

// Front Step 5/6 — Integration Plan §12.2 active/candidate 이중 트랙.
// active: Backend에 영속화된, 실제 입력에 쓰이는 gaze calibration(GET /api/calibrations/active).
// candidate: 방금 측정했지만 아직 사용자가 입력 방식을 선택해 저장하지 않은 결과(메모리 전용).
// 재측정 중에도 candidate가 갱신될 뿐 active는 그대로 유지된다(§8.2/§12.2).
export type ActiveCalibrationStatus = 'idle' | 'loading' | 'loaded' | 'not_found' | 'error';

interface CalibrationState {
  candidate: GazeCalibrationResult | null;
  setCandidate: (result: GazeCalibrationResult) => void;
  clearCandidate: () => void;

  active: GazeCalibrationResult | null;
  activeCalibrationId: string | null;
  activeStatus: ActiveCalibrationStatus;
  activeError: string | null;
  setActive: (calibrationId: string, result: GazeCalibrationResult) => void;
  setActiveNotFound: () => void;
  setActiveLoading: () => void;
  setActiveError: (error: string) => void;
  /** Front Step 10 §17 — account boundary(logout/withdraw/계정 전환) 전용 전체 초기화.
   * candidate도 사용자별 세션성 Calibration 데이터이므로 active와 함께 지워, 이전
   * 사용자의 측정 결과가 다음 사용자에게 전혀 남지 않게 한다. 다음 useActiveCalibration()이
   * 다시 Backend GET을 수행하도록 activeStatus도 idle로 되돌린다.
   *
   * 일반 재측정(Analysis retest 등) 흐름과는 무관하다 — 그쪽은 기존 restart()/
   * clearCandidate()(useCalibrationRunner)를 그대로 쓰고, active는 재측정 중에도 유지해야
   * 하므로 이 reset()을 호출하지 않는다. */
  reset: () => void;
}

export const useCalibrationStore = create<CalibrationState>((set) => ({
  candidate: null,
  setCandidate: (result) => set({ candidate: result }),
  clearCandidate: () => set({ candidate: null }),

  active: null,
  activeCalibrationId: null,
  activeStatus: 'idle',
  activeError: null,
  setActive: (calibrationId, result) =>
    set({ active: result, activeCalibrationId: calibrationId, activeStatus: 'loaded', activeError: null }),
  setActiveNotFound: () =>
    set({ active: null, activeCalibrationId: null, activeStatus: 'not_found', activeError: null }),
  setActiveLoading: () => set({ activeStatus: 'loading' }),
  setActiveError: (error) => set({ activeStatus: 'error', activeError: error }),
  reset: () =>
    set({ candidate: null, active: null, activeCalibrationId: null, activeStatus: 'idle', activeError: null }),
}));
