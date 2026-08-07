import { Link } from 'react-router-dom';

import PageHeader from '../../shared/components/layout/PageHeader';
import StaffHeaderActions from '../../shared/components/layout/StaffHeaderActions';
import StaffEmergencyAlert from '../../features/emergency/components/StaffEmergencyAlert';
import { AlertModal, ConfirmModal } from '../../shared/components/modal';
import { useAccountModals } from '../../features/mypage/hooks/useAccountModals';
import { ROUTES } from '../../shared/constants/routes';

import './StaffMyPage.css';

export default function StaffMyPage() {
  const account = useAccountModals({ redirectTo: ROUTES.STAFF_LOGIN });

  return (
    <div className="staff-mypage">
      <PageHeader
        title="마이페이지"
        logoTo={ROUTES.STAFF_MYPAGE}
        right={<StaffHeaderActions showSetting={false} />}
      />

      <nav className="staff-menu">
        <Link to={ROUTES.STAFF_PROFILE} className="staff-menu-item">
          내 정보 수정
        </Link>

        <Link to={ROUTES.STAFF_PATIENTS} className="staff-menu-item">
          담당 환자 관리
        </Link>

        <Link to={ROUTES.STAFF_EMERGENCY_LOG} className="staff-menu-item">
          비상호출 내역
        </Link>

        <button
          type="button"
          className="staff-menu-item"
          onClick={account.openLogout}
        >
          로그아웃
        </button>

        <button
          type="button"
          className="staff-menu-item"
          onClick={account.openWithdraw}
        >
          회원탈퇴
        </button>
      </nav>

      {/* ---------- 로그아웃 : Frame 183 → 184 ---------- */}
      <ConfirmModal
        isOpen={account.modal === 'logout-confirm'}
        message="로그아웃을 하시겠습니까?"
        confirmLabel="로그아웃"
        onConfirm={account.confirmLogout}
        onCancel={account.close}
      />

      <AlertModal
        isOpen={account.modal === 'logout-done'}
        message="로그아웃 되었습니다."
        onConfirm={account.finish}
      />

      {/* ---------- 회원탈퇴 : Frame 185 → 186 ---------- */}
      <ConfirmModal
        isOpen={account.modal === 'withdraw-confirm'}
        message="회원탈퇴를 하시겠습니까? 회원탈퇴 시 모든 개인정보 및 이용 기록이 삭제되며 복구할 수 없습니다."
        confirmLabel="회원탈퇴"
        confirmTone="negative"
        onConfirm={account.confirmWithdraw}
        onCancel={account.close}
      />

      <AlertModal
        isOpen={account.modal === 'withdraw-done'}
        message="회원탈퇴 되었습니다."
        onConfirm={account.finish}
      />

      {/* 어느 화면에서든 뜨는 비상호출 알림 : Frame 182 */}
      <StaffEmergencyAlert />
    </div>
  );
}
