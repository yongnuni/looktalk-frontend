import { useEffect, useRef } from 'react';
import SosIcon from '../../../assets/sos.png';
import { AlertModal, BaseModal } from '../../../shared/components/modal';
import { useGazeInteraction } from '../../gazeInteraction/GazeInteractionContext';
import { useGazeTarget } from '../../gazeInteraction/useGazeTarget';
import type { InteractionScope } from '../../gazeInteraction/types';
import {
  EMERGENCY_COUNTDOWN_SECONDS,
  useEmergencyCall,
} from '../hooks/useEmergencyCall';
import './EmergencyButton.css';

/**
 * 환자 화면 어디서든 노출되는 비상호출 버튼.
 * 클릭 → Frame 125(카운트다운/취소) → Frame 152(전송 안내)
 *
 * Front Step 15/16 §33 — Emergency actual trigger를 gaze dwell 한 번으로 바로 실행하지
 * 않는다. 이미 있는 2단계 구조(버튼 선택 → 5초 카운트다운/취소 모달 → 응답 없으면 자동
 * 발송)를 그대로 재사용해, 트리거 버튼과 취소 버튼만 gaze target으로 만든다 — 실제 발송은
 * 여전히 카운트다운 타이머가 만료될 때만 일어나므로(§33 "confirm modal → confirm gaze →
 * 기존 Emergency action" 구조와 동일한 안전장치), 단순 dwell 한 번으로 즉시 실행되지 않는다.
 * IMPLEMENTED_WITH_CONFIRM으로 분류한다(최종 보고 §25).
 */
export default function EmergencyButton() {
  const { phase, remaining, start, cancel, closeSentMessage } =
    useEmergencyCall();
  const { setActiveScope, activeScope } = useGazeInteraction();

  // 이 버튼은 항상 MAIN scope 화면(MyPage/PhrasePage/FriendListPage/PhoneVerifyPage)의
  // PageHeader에서만 쓰인다 — Chat은 자신만의 별도 Emergency UI를 쓴다(§25 최종 보고
  // 참고). 트리거 자체는 지금 활성 scope 그대로 둔다(카운트다운을 여는 것 뿐이라
  // 안전하다, §33).
  const triggerTargetRef = useGazeTarget({
    id: 'emergency-trigger',
    scope: activeScope === 'MODAL' ? 'MAIN' : activeScope,
    enabled: phase === 'idle',
    onSelect: start,
  });

  // 카운트다운이 열려 있는 동안만 MODAL scope로 전환해 뒤쪽 화면이 gaze로 선택되지 않게
  // 한다(§34). scope를 되돌릴 때는 무조건 MAIN이 아니라 카운트다운 진입 직전 scope로
  // 복원한다 — ref로 기억해 둔다.
  const previousScopeRef = useRef<InteractionScope>(activeScope);

  useEffect(() => {
    if (phase === 'counting') {
      if (activeScope !== 'MODAL') {
        previousScopeRef.current = activeScope;
      }
      setActiveScope('MODAL');
    } else if (phase === 'idle' && activeScope === 'MODAL') {
      setActiveScope(previousScopeRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phase 전환 시점에만 반응한다
  }, [phase]);

  const cancelTargetRef = useGazeTarget({
    id: 'emergency-cancel',
    scope: 'MODAL',
    enabled: phase === 'counting',
    onSelect: cancel,
  });

  return (
    <>
      <button
        ref={triggerTargetRef}
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
        actions={[{ label: '취소', tone: 'neutral', onClick: cancel, gazeTargetRef: cancelTargetRef }]}
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
