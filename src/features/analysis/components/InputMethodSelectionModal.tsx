import { createPortal } from 'react-dom';
import type { InputMethodId } from '../types/analysis';
import './InputMethodSelectionModal.css';

interface InputMethodSelectionModalProps {
  isOpen: boolean;
  onRetest: () => void;
  onSelect: (inputMethodId: InputMethodId) => void;
  recommendedInputMethod?: InputMethodId;
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
          <button
            className="analysis-selection-retest"
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
