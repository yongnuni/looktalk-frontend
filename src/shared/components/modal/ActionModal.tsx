import BaseModal from './BaseModal';
import type { ModalAction } from './BaseModal';

interface ActionModalProps {
  isOpen: boolean;
  /** 상단에 표시할 대상 이름 (예: "엄마") */
  message: string;
  /** 최대 3개까지 표시됨 (BaseModal 제한) */
  actions: ModalAction[];
  onClose: () => void;
}

/**
 * 액션이 가로로 나열되는 팝업.
 * Figma: Frame 171 (수정하기 / 삭제하기 / 취소)
 */
export default function ActionModal({
  isOpen,
  message,
  actions,
  onClose,
}: ActionModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop
      closeOnEscape
      actions={actions}
    >
      <p>{message}</p>
    </BaseModal>
  );
}
