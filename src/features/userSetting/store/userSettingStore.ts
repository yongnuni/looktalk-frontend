import { create } from 'zustand';
import type { UserSettingDto } from '../../../shared/types/backend';

// calibrationStore와 동일하게 순수 클라이언트 캐시만 담당한다. 실제 GET/PATCH 호출과
// 에러 처리는 useUserSettings 훅(Front Step 4)에서 수행한다.
interface UserSettingState {
  settings: UserSettingDto | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
  setSettings: (settings: UserSettingDto) => void;
  setStatus: (status: UserSettingState['status']) => void;
  setError: (error: string | null) => void;
  /** Front Step 10 §17과 동일한 이유 — 계정 전환 시 이전 사용자의 UserSetting 캐시(키 크기,
   * 입력 방식 등)가 새 사용자에게 그대로 노출되지 않도록 idle로 되돌린다. */
  reset: () => void;
}

export const useUserSettingStore = create<UserSettingState>((set) => ({
  settings: null,
  status: 'idle',
  error: null,
  setSettings: (settings) => set({ settings, status: 'loaded', error: null }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: 'error' }),
  reset: () => set({ settings: null, status: 'idle', error: null }),
}));
