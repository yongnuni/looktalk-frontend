import { useMemo, useState } from 'react';
import BaseModal from './BaseModal';
import './InputModal.css';

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
 *
 * Figma:
 * Frame 167(병원 내 이름 설정)
 * Frame 174(의료진 이름 변경)
 * Frame 190(담당 환자 이름 수정)
 * Frame 130(새 친구 등록 - 2필드)
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
  /**
   * fields의 내용이 변경되었는지를 확인하기 위한 key
   *
   * 부모에서 fields 배열을 매 렌더링마다 새로 만들어도
   * 실제 내용이 같으면 동일한 key를 유지한다.
   */
  const fieldsKey = useMemo(
    () =>
      JSON.stringify(
        fields.map((field) => ({
          name: field.name,
          initialValue: field.initialValue ?? '',
        })),
      ),
    [fields],
  );

  const [formState, setFormState] = useState<{
    key: string;
    values: Record<string, string>;
  }>(() => ({
    key: fieldsKey,
    values: buildInitialValues(fields),
  }));

  /**
   * fields가 변경되었거나 팝업이 새 fields로 열렸을 경우
   * 새로운 초기값을 사용한다.
   *
   * setState를 render/effect에서 직접 호출하지 않고
   * 현재 사용할 값을 계산해서 처리한다.
   */
  const values =
    formState.key === fieldsKey ? formState.values : buildInitialValues(fields);

  const canConfirm = requireAll
    ? fields.every((field) => (values[field.name] ?? '').trim() !== '')
    : true;

  const handleChange = (name: string, value: string) => {
    setFormState({
      key: fieldsKey,
      values: {
        ...values,
        [name]: value,
      },
    });
  };

  const handleConfirm = () => {
    onConfirm(values);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      closeOnBackdrop
      closeOnEscape
      actions={[
        {
          label: confirmLabel,
          tone: 'positive',
          disabled: !canConfirm,
          onClick: handleConfirm,
        },
        {
          label: cancelLabel,
          tone: 'neutral',
          onClick: onCancel,
        },
      ]}
    >
      {message}

      {fields.map((field) => (
        <input
          key={field.name}
          className="input-modal-field"
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
