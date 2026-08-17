import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../shared/stores/authStore';
import { useCalibrationStore } from '../../calibration/store/calibrationStore';
import { useUserSettingStore } from '../../userSetting/store/userSettingStore';

type AccountModal =
  | 'none'
  | 'logout-confirm'
  | 'logout-done'
  | 'withdraw-confirm'
  | 'withdraw-done';

interface UseAccountModalsOptions {
  /** 로그아웃/회원탈퇴 완료 후 이동할 경로 */
  redirectTo: string;
}

/**
 * 로그아웃 / 회원탈퇴 팝업 흐름.
 * 환자(Desktop-75)와 의료진(Desktop-102) 양쪽에서 동일하게 사용한다.
 * Figma: Frame 183 → 184, Frame 185 → 186
 */
export function useAccountModals({ redirectTo }: UseAccountModalsOptions) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [modal, setModal] = useState<AccountModal>('none');

  const close = () => setModal('none');

  // Front Step 10 §17 — 계정 전환 시 이전 사용자의 active calibration/UserSetting 캐시가
  // 새로 로그인하는 사용자에게 재사용되지 않도록 account boundary(로그아웃/탈퇴)에서
  // 명시적으로 초기화한다. Backend의 calibration 데이터 자체를 지우는 것이 아니라
  // Front 캐시만 분리한다.
  const resetSessionCaches = () => {
    useCalibrationStore.getState().reset();
    useUserSettingStore.getState().reset();
  };

  return {
    modal,

    openLogout: () => setModal('logout-confirm'),
    openWithdraw: () => setModal('withdraw-confirm'),
    close,

    confirmLogout: () => {
      // TODO : 로그아웃 API 호출
      logout();
      resetSessionCaches();
      setModal('logout-done');
    },

    confirmWithdraw: () => {
      // TODO : 회원탈퇴 API 호출
      logout();
      resetSessionCaches();
      setModal('withdraw-done');
    },

    finish: () => {
      close();
      navigate(redirectTo, { replace: true });
    },
  };
}
