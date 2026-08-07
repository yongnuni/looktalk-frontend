import BaseModal from './BaseModal';

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  /** 기본 "확인" */
  confirmLabel?: string;
  onConfirm: () => void;
}

/**
 * 안내 전용 팝업 (버튼 1개).
 * Figma: Frame 152 / 155 / 156 / 159 / 166 / 169 / 179 / 181 / 182 / 184 / 186
 */
export default function AlertModal({
  isOpen,
  message,
  confirmLabel = '확인',
  onConfirm,
}: AlertModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onConfirm}
      actions={[{ label: confirmLabel, tone: 'positive', onClick: onConfirm }]}
    >
      <p>{message}</p>
    </BaseModal>
  );
}
