import BaseModal, { ModalAction } from './BaseModal';

interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** 확정 버튼 색. 삭제/탈퇴 등 파괴적 동작은 'danger' */
  confirmTone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 확인/취소 2지선다 팝업.
 * Figma: Frame 158 / 170 / 178 / 183 / 185
 */
export default function ConfirmModal({
  isOpen,
  message,
  confirmLabel,
  cancelLabel = '취소',
  confirmTone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      closeOnBackdrop
      footer={
        <>
          <ModalAction tone={confirmTone} onClick={onConfirm}>
            {confirmLabel}
          </ModalAction>
          <ModalAction tone="muted" onClick={onCancel}>
            {cancelLabel}
          </ModalAction>
        </>
      }
    >
      <p>{message}</p>
    </BaseModal>
  );
}
