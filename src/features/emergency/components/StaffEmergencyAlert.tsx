import { AlertModal } from '../../../shared/components/modal';
import { useStaffPatients } from '../../mypage/hooks/useStaffPatients';
import { useEmergencyAlerts } from '../hooks/useEmergencyAlerts';

/**
 * 의료진 화면 어디서든 즉시 뜨는 비상호출 알림 (Figma Frame 182).
 * 담당 환자의 읽지 않은 호출을 폴링으로 확인해 하나씩 띄운다 (EMERGENCY-002/003).
 */
export default function StaffEmergencyAlert() {
  const { alerts, dismissAlert } = useEmergencyAlerts();
  const { patients } = useStaffPatients();

  const current = alerts[0];

  if (!current) return null;

  const alias = patients.find((patient) => patient.userId === current.patientUserId)?.alias;
  const displayName = alias || current.patientDisplayName;

  return (
    <AlertModal
      isOpen
      message={`${displayName} 환자가 비상호출을 하였습니다!`}
      onConfirm={() => void dismissAlert(current.emergencyCallId)}
    />
  );
}
