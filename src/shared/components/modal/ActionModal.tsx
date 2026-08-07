import BaseModal, { ModalAction } from './BaseModal';

export interface ModalActionItem {
  label: string;
  tone?: 'primary' | 'muted' | 'danger';
  onClick: () => void;
}

interface ActionModalProps {
  isOpen: boolean;
  /** 상단에 표시할 대상 이름 (예: "엄마") */
  message: string;
  actions: ModalActionItem[];
  onClose: () => void;
}

/**
 * 3개 이상 액션이 가로로 나열되는 팝업.
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
      className="action-modal"
      footer={actions.map((action) => (
        <ModalAction
          key={action.label}
          tone={action.tone}
          onClick={action.onClick}
        >
          {action.label}
        </ModalAction>
      ))}
    >
      <p>{message}</p>
    </BaseModal>
  );
}
