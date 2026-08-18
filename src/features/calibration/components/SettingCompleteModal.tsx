import './SettingCompleteModal.css';

interface SettingCompleteModalProps {
  onConfirm: () => void;
}

// Integration Plan §11 — 설정 저장이 실제로 성공한 뒤에만 표시된다(호출부 책임).
// X 버튼 없음. 이 모달을 닫는 행위 자체는 저장 트리거가 아니다 — 저장은 이미 끝난 상태다.
export default function SettingCompleteModal({ onConfirm }: SettingCompleteModalProps) {
  return (
    <div className="setting-complete-modal" role="dialog" aria-modal="true">
      <p>입력 방식이 설정되었습니다.</p>
      <p>자세한 분석 결과는 분석페이지를 참고하세요!</p>
      <button type="button" className="setting-complete-modal__confirm-button" onClick={onConfirm}>
        확인
      </button>
    </div>
  );
}
