import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../../shared/components/layout/PageHeader';
import StaffHeaderActions from '../../shared/components/layout/StaffHeaderActions';
import StaffEmergencyAlert from '../../features/emergency/components/StaffEmergencyAlert';
import {
  AlertModal,
  ConfirmModal,
  InputModal,
} from '../../shared/components/modal';
import { useStaffPatientStore } from '../../shared/stores/staffPatientStore';
import { ROUTES } from '../../shared/constants/routes';
import type { ManagedPatient } from '../../shared/types/mypage';

import './StaffPatientListPage.css';

type PatientModal = 'none' | 'edit' | 'edited' | 'delete-confirm' | 'deleted';

export default function StaffPatientListPage() {
  const navigate = useNavigate();

  const patients = useStaffPatientStore((state) => state.patients);
  const updatePatientName = useStaffPatientStore(
    (state) => state.updatePatientName,
  );
  const removePatient = useStaffPatientStore((state) => state.removePatient);

  const [modal, setModal] = useState<PatientModal>('none');
  const [selected, setSelected] = useState<ManagedPatient | null>(null);

  const closeModal = () => setModal('none');

  const openEdit = (patient: ManagedPatient) => {
    setSelected(patient);
    setModal('edit');
  };

  const openDelete = (patient: ManagedPatient) => {
    setSelected(patient);
    setModal('delete-confirm');
  };

  return (
    <div className="staff-patient-page">
      <PageHeader
        title="담당 환자 관리"
        logoTo={ROUTES.STAFF_MYPAGE}
        right={<StaffHeaderActions />}
        divider
      />

      <main className="staff-patient-list">
        {patients.length === 0 ? (
          <p className="staff-patient-empty">담당 환자가 없습니다.</p>
        ) : (
          patients.map((patient) => (
            <div className="staff-patient-row" key={patient.id}>
              {/* 호실은 이름에 포함된 정보라 컬럼을 분리하지 않는다 */}
              <button
                type="button"
                className="staff-patient-name"
                onClick={() => navigate(ROUTES.STAFF_CHAT)}
              >
                {patient.name}
              </button>

              <div className="staff-patient-actions">
                <button
                  type="button"
                  className="staff-inline-button"
                  onClick={() => openEdit(patient)}
                >
                  수정
                </button>

                <button
                  type="button"
                  className="staff-inline-button danger"
                  onClick={() => openDelete(patient)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* ---------- 환자 이름 수정 : Frame 190 → 181 ---------- */}
      <InputModal
        isOpen={modal === 'edit'}
        message="변경하실 환자의 이름을 입력하세요."
        confirmLabel="수정하기"
        fields={[
          {
            name: 'name',
            placeholder: selected?.name ?? '',
            initialValue: selected?.name ?? '',
          },
        ]}
        onConfirm={(values) => {
          // TODO : 담당 환자 이름 수정 API 호출
          if (selected) updatePatientName(selected.id, values.name.trim());
          setModal('edited');
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'edited'}
        message="이름이 변경되었습니다."
        onConfirm={closeModal}
      />

      {/* ---------- 환자 삭제 : Frame 178 → 179 ---------- */}
      <ConfirmModal
        isOpen={modal === 'delete-confirm'}
        message="해당 환자를 삭제하시겠습니까?"
        confirmLabel="삭제하기"
        confirmTone="negative"
        onConfirm={() => {
          // TODO : 담당 환자 삭제 API 호출
          if (selected) removePatient(selected.id);
          setModal('deleted');
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'deleted'}
        message="해당 환자가 삭제되었습니다."
        onConfirm={closeModal}
      />

      <StaffEmergencyAlert />
    </div>
  );
}
