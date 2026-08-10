import PageHeader from '../../shared/components/layout/PageHeader';
import StaffHeaderActions from '../../shared/components/layout/StaffHeaderActions';
import StaffEmergencyAlert from '../../features/emergency/components/StaffEmergencyAlert';
import { useEmergencyStore } from '../../shared/stores/emergencyStore';
import { ROUTES } from '../../shared/constants/routes';

import './StaffEmergencyLogPage.css';

export default function StaffEmergencyLogPage() {
  const history = useEmergencyStore((state) => state.history);

  return (
    <div className="staff-emergency-page">
      <PageHeader
        title="비상호출 내역"
        logoTo={ROUTES.STAFF_MYPAGE}
        right={<StaffHeaderActions />}
        divider
      />

      {/* 호출이 없으면 공백으로 둔다 (Figma Default) */}
      <main className="staff-emergency-list">
        {history.map((call) => (
          <p className="staff-emergency-row" key={call.id}>
            {call.room} - {call.patientName} 환자가 {call.calledAt}에 비상호출을
            하였습니다. ({call.count}회)
          </p>
        ))}
      </main>

      <StaffEmergencyAlert />
    </div>
  );
}
