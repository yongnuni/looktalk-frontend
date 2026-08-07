import { create } from 'zustand';
import type { EmergencyCall } from '../types/mypage';

/** 연속 호출로 묶는 시간 간격 (ms). 이 시간을 넘기면 횟수가 1로 리셋 */
export const EMERGENCY_STREAK_WINDOW_MS = 5 * 60 * 1000;

interface EmergencyState {
  /** 의료진 화면 어디서든 뜨는 알림 큐 (Figma Frame 182) */
  incomingAlerts: EmergencyCall[];
  /** 비상호출 내역 페이지 목록 (Desktop - 104) */
  history: EmergencyCall[];

  /** 환자가 비상호출을 실제로 전송했을 때 호출 */
  pushCall: (payload: {
    room: string;
    patientName: string;
    calledAt?: string;
  }) => void;
  /** 의료진이 알림 팝업의 "확인"을 눌렀을 때 */
  dismissAlert: (id: number) => void;
  clearHistory: () => void;
}

const formatNow = () => {
  const now = new Date();

  return `${String(now.getHours()).padStart(2, '0')}시 ${String(now.getMinutes()).padStart(2, '0')}분`;
};

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  incomingAlerts: [],
  history: [],

  pushCall: ({ room, patientName, calledAt }) => {
    const previous = get().history[0];

    // 같은 환자가 짧은 간격으로 다시 호출하면 연속 횟수 증가, 아니면 1로 리셋
    const isStreak =
      previous !== undefined &&
      previous.room === room &&
      previous.patientName === patientName &&
      Date.now() - previous.id < EMERGENCY_STREAK_WINDOW_MS;

    const call: EmergencyCall = {
      id: Date.now(),
      room,
      patientName,
      calledAt: calledAt ?? formatNow(),
      count: isStreak ? previous.count + 1 : 1,
    };

    set((state) => ({
      history: [call, ...state.history],
      incomingAlerts: [...state.incomingAlerts, call],
    }));
  },

  dismissAlert: (id) =>
    set((state) => ({
      incomingAlerts: state.incomingAlerts.filter((alert) => alert.id !== id),
    })),

  clearHistory: () => set({ history: [] }),
}));
