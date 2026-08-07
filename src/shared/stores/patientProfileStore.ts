import { create } from 'zustand';

interface PatientProfileState {
  /** 병원 채팅에서 사용할 이름 */
  hospitalNickname: string;
  phone: string;
  /** 전화번호(메시지) 연동 여부. 친구 목록 관리 진입 조건 */
  isPhoneVerified: boolean;

  setHospitalNickname: (name: string) => void;
  verifyPhone: (phone: string) => void;
  resetPhoneVerification: () => void;
}

// TODO : 로그인 시 서버 프로필 조회 결과로 초기화
export const usePatientProfileStore = create<PatientProfileState>((set) => ({
  hospitalNickname: '202호 - 김민준 환자',
  phone: '',
  isPhoneVerified: false,

  setHospitalNickname: (hospitalNickname) => set({ hospitalNickname }),

  verifyPhone: (phone) => set({ phone, isPhoneVerified: true }),

  resetPhoneVerification: () => set({ phone: '', isPhoneVerified: false }),
}));