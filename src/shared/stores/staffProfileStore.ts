import { create } from 'zustand';

interface StaffProfileState {
  name: string;
  email: string;
  hospitalName: string;
  /** 화면 우하단 "권한: 의료진" 표기용 */
  roleLabel: string;

  setName: (name: string) => void;
  setProfile: (profile: { name: string; email: string; hospitalName: string }) => void;
}

export const useStaffProfileStore = create<StaffProfileState>((set) => ({
  name: '',
  email: '',
  hospitalName: '',
  roleLabel: '의료진',

  setName: (name) => set({ name }),

  setProfile: ({ name, email, hospitalName }) => set({ name, email, hospitalName }),
}));
