import { create } from 'zustand';
import { clearStoredAuthTokens, getAccessToken } from '../api/authToken';
import { disconnectAllChatWebSockets } from '../api/websocketClient';

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
  accessToken: getAccessToken(),
  isLoggedIn: Boolean(getAccessToken()),

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
    disconnectAllChatWebSockets();
    clearStoredAuthTokens();

    set({
      user: null,
      accessToken: null,
      isLoggedIn: false,
    });
  },
}));
