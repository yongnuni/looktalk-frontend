import { useMemo } from 'react';

import PageHeader from '../../shared/components/layout/PageHeader';
import StaffHeaderActions from '../../shared/components/layout/StaffHeaderActions';
import { useEmergencyLog } from '../../features/emergency/hooks/useEmergencyLog';
import { useStaffPatients } from '../../features/mypage/hooks/useStaffPatients';
import { ROUTES } from '../../shared/constants/routes';

import './StaffEmergencyLogPage.css';

function formatCalledAt(calledAt: string): string {
  const date = new Date(calledAt);

  if (Number.isNaN(date.getTime())) return calledAt;

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export default function StaffEmergencyLogPage() {
  const { items, isLoading, hasError } = useEmergencyLog();

  const { patients } = useStaffPatients();

  const aliasByPatientUserId = useMemo(
    () => new Map(patients.map((patient) => [patient.userId, patient.alias])),
    [patients],
  );

  const getDisplayName = (call: {
    patientUserId: string;
    patientDisplayName: string;
  }) => aliasByPatientUserId.get(call.patientUserId) || call.patientDisplayName;

  return (
    <div className="staff-emergency-page">
      <PageHeader
        title="비상호출 내역"
        logoTo={ROUTES.STAFF_MYPAGE}
        right={<StaffHeaderActions />}
        divider
      />

      <main className="staff-emergency-list">
        {isLoading ? (
          <p className="staff-emergency-empty">
            비상호출 내역을 불러오는 중입니다.
          </p>
        ) : hasError ? (
          <p className="staff-emergency-empty" role="alert">
            비상호출 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : items.length === 0 ? (
          <p className="staff-emergency-empty">비상호출 내역이 없습니다.</p>
        ) : (
          items.map((call) => (
            <p className="staff-emergency-row" key={call.emergencyCallId}>
              {getDisplayName(call)} 환자가 {formatCalledAt(call.calledAt)}에
              비상호출을 하였습니다.
              <span
                className={`staff-emergency-badge ${
                  call.unread ? 'unread' : 'read'
                }`}
              >
                {call.unread ? '안읽음' : '읽음'}
              </span>
            </p>
          ))
        )}
      </main>
    </div>
  );
}
