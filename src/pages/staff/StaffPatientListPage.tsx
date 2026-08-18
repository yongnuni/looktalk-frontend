import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import PageHeader from '../../shared/components/layout/PageHeader';
import StaffHeaderActions from '../../shared/components/layout/StaffHeaderActions';
import StaffEmergencyAlert from '../../features/emergency/components/StaffEmergencyAlert';
import {
  AlertModal,
  ConfirmModal,
  InputModal,
} from '../../shared/components/modal';
import { useStaffPatients } from '../../features/mypage/hooks/useStaffPatients';
import { ROUTES } from '../../shared/constants/routes';
import type { ManagedPatient } from '../../shared/types/mypage';

import './StaffPatientListPage.css';

type PatientModal =
  | 'none'
  | 'add'
  | 'added'
  | 'edit'
  | 'edited'
  | 'delete-confirm'
  | 'deleted'
  | 'error';

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (typeof message === 'string' && message) return message;
  }

  return fallback;
}

export default function StaffPatientListPage() {
  const navigate = useNavigate();

  const { patients, isLoading, hasError, addPatient, updateAlias, removePatient } =
    useStaffPatients();

  const [modal, setModal] = useState<PatientModal>('none');
  const [selected, setSelected] = useState<ManagedPatient | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const closeModal = () => setModal('none');

  const openEdit = (patient: ManagedPatient) => {
    setSelected(patient);
    setModal('edit');
  };

  const openDelete = (patient: ManagedPatient) => {
    setSelected(patient);
    setModal('delete-confirm');
  };

  const showError = (error: unknown, fallback: string) => {
    setErrorMessage(getErrorMessage(error, fallback));
    setModal('error');
  };

  return (
    <div className="staff-patient-page">
      <PageHeader
        title="담당 환자 관리"
        logoTo={ROUTES.STAFF_MYPAGE}
        titleActions={
          <button
            type="button"
            className="header-pill-button accent"
            onClick={() => setModal('add')}
          >
            담당 환자
            <br />
            추가하기
          </button>
        }
        right={<StaffHeaderActions />}
        divider
      />

      <main className="staff-patient-list">
        {isLoading ? (
          <p className="staff-patient-empty">담당 환자 목록을 불러오는 중입니다.</p>
        ) : hasError ? (
          <p className="staff-patient-empty" role="alert">
            담당 환자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : patients.length === 0 ? (
          <p className="staff-patient-empty">담당 환자가 없습니다.</p>
        ) : (
          patients.map((patient) => (
            <div className="staff-patient-row" key={patient.userId}>
              <button
                type="button"
                className="staff-patient-name"
                onClick={() => navigate(ROUTES.STAFF_CHAT)}
              >
                {patient.alias ?? patient.displayName}
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

      {/* ---------- 담당 환자 추가 ---------- */}
      <InputModal
        isOpen={modal === 'add'}
        message="추가할 환자의 로그인 아이디를 입력하세요."
        confirmLabel="추가하기"
        fields={[{ name: 'patientLoginId', placeholder: '로그인 아이디를 입력하세요.' }]}
        onConfirm={(values) => {
          void (async () => {
            try {
              await addPatient(values.patientLoginId.trim());
              setModal('added');
            } catch (error) {
              showError(error, '담당 환자 추가에 실패했습니다.');
            }
          })();
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'added'}
        message="담당 환자가 추가되었습니다."
        onConfirm={closeModal}
      />

      {/* ---------- 담당 환자 별칭 수정 (STAFF-005) : Frame 190 → 181 ----------
          나만 보는 개인 별칭이며, 비워서 제출하면 별칭이 삭제되고 환자 본인 이름으로 표시된다. */}
      <InputModal
        isOpen={modal === 'edit'}
        message="이 환자에게만 표시할 별칭을 입력하세요. (비워두면 별칭이 삭제됩니다)"
        confirmLabel="수정하기"
        requireAll={false}
        fields={[
          {
            name: 'alias',
            placeholder: selected?.displayName ?? '',
            initialValue: selected?.alias ?? '',
          },
        ]}
        onConfirm={(values) => {
          void (async () => {
            if (!selected) return;

            try {
              await updateAlias(selected.userId, values.alias.trim());
              setModal('edited');
            } catch (error) {
              showError(error, '별칭 수정에 실패했습니다.');
            }
          })();
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'edited'}
        message="별칭이 변경되었습니다."
        onConfirm={closeModal}
      />

      {/* ---------- 환자 삭제 : Frame 178 → 179 ---------- */}
      <ConfirmModal
        isOpen={modal === 'delete-confirm'}
        message="해당 환자를 삭제하시겠습니까?"
        confirmLabel="삭제하기"
        confirmTone="negative"
        onConfirm={() => {
          void (async () => {
            if (!selected) return;

            try {
              await removePatient(selected.userId);
              setModal('deleted');
            } catch (error) {
              showError(error, '담당 환자 삭제에 실패했습니다.');
            }
          })();
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'deleted'}
        message="해당 환자가 삭제되었습니다."
        onConfirm={closeModal}
      />

      <AlertModal
        isOpen={modal === 'error'}
        message={errorMessage}
        onConfirm={closeModal}
      />

      <StaffEmergencyAlert />
    </div>
  );
}
