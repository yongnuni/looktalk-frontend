import { create } from 'zustand';

type UserRole = 'PATIENT' | 'STAFF' | null;

export interface AuthenticatedUser {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  profileImage: string | null;
  isEmailVerified: boolean | null;
  isSmsVerified: boolean | null;
  loginId: string | null;
  role: UserRole;
}

interface AuthState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  isLoggedIn: boolean;
  loginAsPatient: () => void;
  loginAsStaff: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('looktalk_access_token'),
  isLoggedIn: Boolean(localStorage.getItem('looktalk_access_token')),

  loginAsPatient: () => {
    const mockToken = 'mock-patient-token';
    localStorage.setItem('looktalk_access_token', mockToken);

    set({
      user: {
        userId: 'patient-test-user',
        userName: '환자 테스트',
        userEmail: 'patient@example.com',
        userPhone: null,
        profileImage: null,
        isEmailVerified: true,
        isSmsVerified: true,
        loginId: 'patient-test',
        role: 'PATIENT',
      },
      accessToken: mockToken,
      isLoggedIn: true,
    });
  },

  loginAsStaff: () => {
    const mockToken = 'mock-staff-token';
    localStorage.setItem('looktalk_access_token', mockToken);

    set({
      user: {
        userId: 'staff-test-user',
        userName: '의료진 테스트',
        userEmail: 'staff@example.com',
        userPhone: null,
        profileImage: null,
        isEmailVerified: true,
        isSmsVerified: true,
        loginId: 'staff-test',
        role: 'STAFF',
      },
      accessToken: mockToken,
      isLoggedIn: true,
    });
  },

  logout: () => {
    // 실제 LoginPage/StaffLoginPage가 쓰는 키('accessToken'/'tokenType'/'userRole' —
    // apiClient 인터셉터와 MemoPage의 401 처리가 참조하는 진짜 세션 키)를 정리한다.
    // 'looktalk_access_token'은 이 store의 mock 로그인 경로가 쓰던 과거 잔여 키라 함께
    // 지운다(Front Step 10 감사: 이전에는 이 mock 키만 지워서 실제 로그아웃이 되지
    // 않았다 — apiClient가 계속 이전 accessToken을 붙여 보내는 버그).
    localStorage.removeItem('accessToken');
    localStorage.removeItem('tokenType');
    localStorage.removeItem('userRole');
    localStorage.removeItem('looktalk_access_token');

    set({
      user: null,
      accessToken: null,
      isLoggedIn: false,
    });
  },
}));
