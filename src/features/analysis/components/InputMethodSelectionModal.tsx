import { createPortal } from 'react-dom';
import type { InputMethodId } from '../types/analysis';
import './InputMethodSelectionModal.css';

interface InputMethodSelectionModalProps {
  isOpen: boolean;
  onRetest: () => void;
  onSelect: (inputMethodId: InputMethodId) => void;
  recommendedInputMethod?: InputMethodId;
  /** Front Step 17 §14/§30 — 실제 Backend 저장 진행/실패 상태(추가 전용 확장, 기본값은
   * 기존 동작과 동일). 저장 중에는 버튼을 막아 중복 요청을 방지하고, 실패하면 에러를
   * 보여주고 모달에 그대로 머무른다(MeasurementResultModal의 SAVING/ERROR와 동일한 정책). */
  isSaving?: boolean;
  errorMessage?: string | null;
}

const inputMethodOptions: Array<{ id: InputMethodId; label: string }> = [
  { id: 'gaze', label: '시선(gaze)' },
  { id: 'blink', label: '눈 깜빡임(blink)' },
  { id: 'mouth', label: '입 움직임(mouth)' },
];

export default function InputMethodSelectionModal({
  isOpen,
  onRetest,
  onSelect,
  recommendedInputMethod = 'gaze',
  isSaving = false,
  errorMessage = null,
}: InputMethodSelectionModalProps) {
  if (!isOpen) return null;

  const recommendedLabel = inputMethodOptions.find(
    (option) => option.id === recommendedInputMethod,
  )?.label;

  return createPortal(
    <div className="analysis-selection-backdrop">
      <section
        aria-describedby="analysis-selection-description"
        aria-modal="true"
        className="analysis-selection-modal"
        role="dialog"
      >
        <div className="analysis-selection-modal__body">
          <p className="analysis-selection-modal__eyebrow">&lt;측정 결과&gt;</p>
          <p id="analysis-selection-description" className="analysis-selection-modal__description">
            AI가 추천한 입력 방식은 “{recommendedLabel}”입니다!
            <br />
            사용하고 싶은 입력 방식을 선택해주세요.
          </p>
          <div className="analysis-selection-modal__options">
            {inputMethodOptions.map((option) => (
              <button
                className={`analysis-selection-option${option.id === recommendedInputMethod ? ' analysis-selection-option--recommended' : ''}`}
                disabled={isSaving}
                key={option.id}
                onClick={() => onSelect(option.id)}
                type="button"
              >
                {option.label}
                {option.id === recommendedInputMethod && (
                  <span className="analysis-selection-option__badge">추천</span>
                )}
              </button>
            ))}
          </div>

          {isSaving && (
            <p className="analysis-selection-modal__status" aria-live="polite">
              저장 중입니다…
            </p>
          )}
          {errorMessage && (
            <p className="analysis-selection-modal__error" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="analysis-selection-retest"
            disabled={isSaving}
            onClick={onRetest}
            type="button"
          >
            재측정
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
