import { useEffect, useRef, useState } from 'react';
import BaseModal, { ModalAction } from './BaseModal';

export interface InputModalField {
  /** 결과 객체의 key */
  name: string;
  placeholder: string;
  initialValue?: string;
  type?: 'text' | 'tel';
  maxLength?: number;
}

interface InputModalProps {
  isOpen: boolean;
  message: string;
  fields: InputModalField[];
  confirmLabel: string;
  cancelLabel?: string;
  /** 모든 필드가 채워져야 확정 버튼 활성화 (기본 true) */
  requireAll?: boolean;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}

const buildInitialValues = (fields: InputModalField[]) =>
  fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.name] = field.initialValue ?? '';
    return acc;
  }, {});

/**
 * 입력값을 받는 팝업.
 * Figma: Frame 167(병원 내 이름 설정) / Frame 174(의료진 이름 변경)
 *        Frame 190(담당 환자 이름 수정) / Frame 130(새 친구 등록 - 2필드)
 */
export default function InputModal({
  isOpen,
  message,
  fields,
  confirmLabel,
  cancelLabel = '취소',
  requireAll = true,
  onConfirm,
  onCancel,
}: InputModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(fields),
  );

  // fields 는 부모에서 매 렌더 새 배열로 만들어지므로 ref 에 담아 의존성에서 제외한다
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  // 팝업이 "열리는 순간"에만 초기값으로 리셋
  useEffect(() => {
    if (isOpen) setValues(buildInitialValues(fieldsRef.current));
  }, [isOpen]);

  const canConfirm = requireAll
    ? fields.every((field) => (values[field.name] ?? '').trim() !== '')
    : true;

  const handleChange = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      closeOnBackdrop
      footer={
        <>
          <ModalAction onClick={() => canConfirm && onConfirm(values)}>
            {confirmLabel}
          </ModalAction>
          <ModalAction tone="muted" onClick={onCancel}>
            {cancelLabel}
          </ModalAction>
        </>
      }
    >
      <p>{message}</p>

      {fields.map((field) => (
        <input
          key={field.name}
          className="modal-input"
          type={field.type ?? 'text'}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={values[field.name] ?? ''}
          onChange={(e) => handleChange(field.name, e.target.value)}
        />
      ))}
    </BaseModal>
  );
}
