import { create } from 'zustand';

type UserRole = 'PATIENT' | 'STAFF' | 'ADMIN';

interface AuthUser {
  id: number;
  name: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
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
        id: 1,
        name: '환자 테스트',
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
        id: 2,
        name: '의료진 테스트',
        role: 'STAFF',
      },
      accessToken: mockToken,
      isLoggedIn: true,
    });
  },

  logout: () => {
    localStorage.removeItem('looktalk_access_token');

    set({
      user: null,
      accessToken: null,
      isLoggedIn: false,
    });
  },
}));