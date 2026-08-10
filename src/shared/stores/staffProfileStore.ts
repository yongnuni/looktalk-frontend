import { create } from 'zustand';

interface StaffProfileState {
  name: string;
  email: string;
  hospitalName: string;
  /** 화면 우하단 "권한: 의료진" 표기용 */
  roleLabel: string;

  setName: (name: string) => void;
}

// TODO : 로그인 시 서버 프로필 조회 결과로 초기화
export const useStaffProfileStore = create<StaffProfileState>((set) => ({
  name: '환자관리팀_김철수',
  email: 'cskim32@example.com',
  hospitalName: '사랑이 가득한 병원',
  roleLabel: '의료진',

  setName: (name) => set({ name }),
}));
