import { create } from 'zustand';
import type { ManagedPatient } from '../types/mypage';

interface StaffPatientState {
  patients: ManagedPatient[];
  updatePatientName: (id: number, name: string) => void;
  removePatient: (id: number) => void;
}

// TODO : 담당 환자 목록 API 연동 시 초기값 제거
const MOCK_PATIENTS: ManagedPatient[] = [
  { id: 1, name: '101호 - 김민준' },
  { id: 2, name: '102호 - 윤하리' },
  { id: 3, name: '102호 - 김하늘' },
  { id: 4, name: '201호 - 이도현' },
  { id: 5, name: '201호 - 권상철' },
  { id: 6, name: '202호 - 박서준' },
  { id: 7, name: '203호 - 최유나' },
];

export const useStaffPatientStore = create<StaffPatientState>((set) => ({
  patients: MOCK_PATIENTS,

  updatePatientName: (id, name) =>
    set((state) => ({
      patients: state.patients.map((patient) =>
        patient.id === id ? { ...patient, name } : patient,
      ),
    })),

  removePatient: (id) =>
    set((state) => ({
      patients: state.patients.filter((patient) => patient.id !== id),
    })),
}));
