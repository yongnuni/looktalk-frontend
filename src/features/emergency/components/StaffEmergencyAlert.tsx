import { AlertModal } from '../../../shared/components/modal';
import { useEmergencyStore } from '../../../shared/stores/emergencyStore';

/**
 * 의료진 화면 어디서든 즉시 뜨는 비상호출 알림 (Figma Frame 182).
 * 의료진 레이아웃(또는 app/providers)에 한 번만 마운트한다.
 */
export default function StaffEmergencyAlert() {
  const alerts = useEmergencyStore((state) => state.incomingAlerts);
  const dismissAlert = useEmergencyStore((state) => state.dismissAlert);

  const current = alerts[0];

  if (!current) return null;

  return (
    <AlertModal
      isOpen
      message={`${current.room} - ${current.patientName} 환자가 비상호출을 하였습니다!`}
      onConfirm={() => dismissAlert(current.id)}
    />
  );
}
