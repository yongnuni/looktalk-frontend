import { useCallback, useRef } from 'react';
import type { SubscribeCalibrationCompletionGaze } from '../completionGaze/types';
import { useCalibrationCompletionGaze } from '../completionGaze/useCalibrationCompletionGaze';
import './SettingCompleteModal.css';

interface SettingCompleteModalProps {
  subscribeCompletionGaze: SubscribeCalibrationCompletionGaze;
  onConfirm: () => void;
}

// Integration Plan §11 — 설정 저장이 실제로 성공한 뒤에만 표시된다(호출부 책임).
// X 버튼 없음. 이 모달을 닫는 행위 자체는 저장 트리거가 아니다 — 저장은 이미 끝난 상태다.
export default function SettingCompleteModal({
  subscribeCompletionGaze,
  onConfirm,
}: SettingCompleteModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmationStartedRef = useRef(false);

  const handleConfirm = useCallback(() => {
    if (confirmationStartedRef.current) {
      return;
    }

    confirmationStartedRef.current = true;
    onConfirm();
  }, [onConfirm]);

  const getCompletionTargets = useCallback(
    () => [
      {
        id: 'calibration-setting-confirm',
        element: confirmButtonRef.current,
        enabled: true,
        onSelect: handleConfirm,
      },
    ],
    [handleConfirm],
  );

  useCalibrationCompletionGaze({
    active: true,
    subscribe: subscribeCompletionGaze,
    getTargets: getCompletionTargets,
  });

  return (
    <div className="setting-complete-modal" role="dialog" aria-modal="true">
      <p>입력 방식이 설정되었습니다.</p>
      <p>자세한 분석 결과는 분석페이지를 참고하세요!</p>
      <button
        ref={confirmButtonRef}
        type="button"
        className="setting-complete-modal__confirm-button"
        onClick={handleConfirm}
      >
        확인
      </button>
    </div>
  );
}
