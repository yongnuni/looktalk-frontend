import { create } from 'zustand';
import type { ManagedPatient } from '../types/mypage';

interface StaffPatientState {
  patients: ManagedPatient[];
  setPatients: (patients: ManagedPatient[]) => void;
  /** 담당 환자 별칭 수정 (STAFF-005 응답 반영) */
  updatePatientAlias: (userId: string, alias: string | null) => void;
  removePatient: (userId: string) => void;
}

export const useStaffPatientStore = create<StaffPatientState>((set) => ({
  patients: [],

  setPatients: (patients) => set({ patients }),

  updatePatientAlias: (userId, alias) =>
    set((state) => ({
      patients: state.patients.map((patient) =>
        patient.userId === userId ? { ...patient, alias } : patient,
      ),
    })),

  removePatient: (userId) =>
    set((state) => ({
      patients: state.patients.filter((patient) => patient.userId !== userId),
    })),
}));
