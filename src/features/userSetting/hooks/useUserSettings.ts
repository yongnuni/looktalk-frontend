import { useCallback, useEffect } from 'react';
import type { UserSettingDto, UserSettingUpdateRequestDto } from '../../../shared/types/backend';
import { getUserSettings, updateUserSettings } from '../api/userSettingApi';
import { useUserSettingStore } from '../store/userSettingStore';

interface UseUserSettingsResult {
  settings: UserSettingDto | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
  /** 필요 시 강제 재조회(예: Step 5/6에서 Calibration 완료 후 등). */
  refresh: () => Promise<void>;
  /** 실제 설정 변경 시에만 호출한다 — 로그인/페이지 진입마다 자동 PATCH하지 않는다. */
  updateSettings: (patch: UserSettingUpdateRequestDto) => Promise<UserSettingDto>;
}

// GET은 "로그인 후/필요 페이지 진입 시" 한 번만 수행하도록 zustand store의 status를
// 여러 소비자(PatientHomePage, 이후 Step 6 Gate 등)가 공유해 중복 조회를 막는다.
// 401/403/5xx를 임의로 기본값 성공으로 치환하지 않고 status:'error'로 그대로 노출한다.
export function useUserSettings(): UseUserSettingsResult {
  const settings = useUserSettingStore((state) => state.settings);
  const status = useUserSettingStore((state) => state.status);
  const error = useUserSettingStore((state) => state.error);
  const setSettings = useUserSettingStore((state) => state.setSettings);
  const setStatus = useUserSettingStore((state) => state.setStatus);
  const setError = useUserSettingStore((state) => state.setError);

  const refresh = useCallback(async () => {
    setStatus('loading');

    try {
      const result = await getUserSettings();
      setSettings(result);
    } catch {
      setError('설정을 불러오지 못했습니다.');
    }
  }, [setSettings, setStatus, setError]);

  useEffect(() => {
    if (useUserSettingStore.getState().status !== 'idle') {
      return;
    }

    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만, store status로 중복 방지
  }, []);

  const updateSettings = useCallback(
    async (patch: UserSettingUpdateRequestDto) => {
      const result = await updateUserSettings(patch);
      setSettings(result);
      return result;
    },
    [setSettings],
  );

  return { settings, status, error, refresh, updateSettings };
}
