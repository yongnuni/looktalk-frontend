import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout as logoutApi } from '../api/auth';
import { deleteMyAccount } from '../api/user';
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

    confirmLogout: async () => {
      try {
        await logoutApi();
      } catch (error) {
        // Refresh Token 만료 등으로 로그아웃 API가 실패해도 클라이언트 세션은 정리한다.
        console.error('로그아웃 실패:', error);
      }

      logout();
      setModal('logout-done');
    },

    confirmWithdraw: async () => {
      try {
        await deleteMyAccount();
        logout();
        setModal('withdraw-done');
      } catch (error) {
        console.error('회원탈퇴 실패:', error);
        alert('회원탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.');
        close();
      }
    },

    finish: () => {
      close();
      navigate(redirectTo, { replace: true });
    },
  };
}
