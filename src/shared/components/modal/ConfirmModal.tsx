import BaseModal from './BaseModal';

interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** 삭제/탈퇴 등 되돌릴 수 없는 동작은 'negative' */
  confirmTone?: 'positive' | 'negative';
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
  confirmTone = 'positive',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      closeOnBackdrop
      closeOnEscape
      actions={[
        { label: confirmLabel, tone: confirmTone, onClick: onConfirm },
        { label: cancelLabel, tone: 'neutral', onClick: onCancel },
      ]}
    >
      <p>{message}</p>
    </BaseModal>
  );
}
