import SosIcon from '../../../assets/sos.png';
import { AlertModal, BaseModal } from '../../../shared/components/modal';
import {
  EMERGENCY_COUNTDOWN_SECONDS,
  useEmergencyCall,
} from '../hooks/useEmergencyCall';
import './EmergencyButton.css';

/**
 * 환자 화면 어디서든 노출되는 비상호출 버튼.
 * 클릭 → Frame 125(카운트다운/취소) → Frame 152(전송 안내)
 */
export default function EmergencyButton() {
  const { phase, remaining, start, cancel, closeSentMessage } =
    useEmergencyCall();

  return (
    <>
      <button
        type="button"
        className="emergency-call-button"
        onClick={start}
        aria-label="비상호출"
      >
        <img src={SosIcon} alt="" className="emergency-call-icon" />
      </button>

      {/* Frame 125 : 카운트다운 */}
      <BaseModal
        isOpen={phase === 'counting'}
        variant="emergency"
        onClose={cancel}
        closeOnEscape
        actions={[{ label: '취소', tone: 'neutral', onClick: cancel }]}
      >
        <p>
          응답이 없을 경우 {EMERGENCY_COUNTDOWN_SECONDS}초 후 비상호출이
          전송됩니다.
        </p>
        <p className="emergency-countdown">{Math.max(remaining, 0)}</p>
      </BaseModal>

      {/* Frame 152 : 전송 완료 안내 */}
      <AlertModal
        isOpen={phase === 'sent'}
        message="달려오고 있어요! 조금만 기다려주세요!"
        onConfirm={closeSentMessage}
      />
    </>
  );
}
