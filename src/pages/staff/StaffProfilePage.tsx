import { useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../../shared/components/layout/PageHeader';
import StaffHeaderActions from '../../shared/components/layout/StaffHeaderActions';
import StaffEmergencyAlert from '../../features/emergency/components/StaffEmergencyAlert';
import { AlertModal, InputModal } from '../../shared/components/modal';
import { useStaffProfileStore } from '../../shared/stores/staffProfileStore';
import { ROUTES } from '../../shared/constants/routes';

import './StaffProfilePage.css';

type NameModal = 'none' | 'edit' | 'done';

export default function StaffProfilePage() {
  const name = useStaffProfileStore((state) => state.name);
  const email = useStaffProfileStore((state) => state.email);
  const hospitalName = useStaffProfileStore((state) => state.hospitalName);
  const roleLabel = useStaffProfileStore((state) => state.roleLabel);
  const setName = useStaffProfileStore((state) => state.setName);

  const [modal, setModal] = useState<NameModal>('none');

  return (
    <div className="staff-profile-page">
      <PageHeader
        title="내 정보 수정"
        logoTo={ROUTES.STAFF_MYPAGE}
        right={<StaffHeaderActions />}
        divider
      />

      <main className="staff-profile-list">
        <div className="staff-profile-row">
          <span className="staff-profile-label">이름</span>

          <span className="staff-profile-value">
            {name}

            <button
              type="button"
              className="staff-inline-button"
              onClick={() => setModal('edit')}
            >
              수정
            </button>
          </span>
        </div>

        <div className="staff-profile-row">
          <span className="staff-profile-label">이메일</span>
          <span className="staff-profile-value">{email}</span>
        </div>

        <div className="staff-profile-row">
          <span className="staff-profile-label">병원 정보</span>
          <span className="staff-profile-value">{hospitalName}</span>
        </div>

        <Link
          to={ROUTES.STAFF_PASSWORD_RESET}
          className="staff-profile-row staff-profile-link"
        >
          <span className="staff-profile-label">비밀번호 재설정</span>
        </Link>
      </main>

      <p className="staff-profile-role">권한: {roleLabel}</p>

      {/* ---------- 이름 변경 : Frame 174 → 181 ---------- */}
      <InputModal
        isOpen={modal === 'edit'}
        message="이름을 입력해주세요."
        confirmLabel="변경하기"
        fields={[{ name: 'name', placeholder: name, initialValue: name }]}
        onConfirm={(values) => {
          // TODO : 의료진 이름 변경 API 호출
          setName(values.name.trim());
          setModal('done');
        }}
        onCancel={() => setModal('none')}
      />

      <AlertModal
        isOpen={modal === 'done'}
        message="이름이 변경되었습니다."
        onConfirm={() => setModal('none')}
      />

      <StaffEmergencyAlert />
    </div>
  );
}
