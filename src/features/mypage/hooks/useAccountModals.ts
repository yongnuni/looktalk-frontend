import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../shared/stores/authStore';

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

  return {
    modal,

    openLogout: () => setModal('logout-confirm'),
    openWithdraw: () => setModal('withdraw-confirm'),
    close,

    confirmLogout: () => {
      // TODO : 로그아웃 API 호출
      logout();
      setModal('logout-done');
    },

    confirmWithdraw: () => {
      // TODO : 회원탈퇴 API 호출
      logout();
      setModal('withdraw-done');
    },

    finish: () => {
      close();
      navigate(redirectTo, { replace: true });
    },
  };
}
