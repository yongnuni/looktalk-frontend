import { suggestionKeyId, type SuggestionSlots } from './inputState';
import './KeyboardSuggestionRow.css';

interface KeyboardSuggestionRowProps {
  slots: SuggestionSlots;
  mode: 'favorites' | 'autocomplete';
  onTargetSelect: (keyValue: string) => void;
}

export default function KeyboardSuggestionRow({
  slots,
  mode,
  onTargetSelect,
}: KeyboardSuggestionRowProps) {
  return (
    <div
      className="fv-keyboard-recommend-row"
      aria-label={mode === 'favorites' ? '자주 쓰는 문장' : '자동완성'}
    >
      {slots.map((suggestion, index) => suggestion ? (
        <button
          key={`suggestion-${index + 1}`}
          type="button"
          className={`fv-keyboard-recommend-button${suggestion.length > 14 ? ' fv-keyboard-recommend-button--long' : ''}`}
          data-key-id={suggestionKeyId(index)}
          onClick={() => onTargetSelect(suggestionKeyId(index))}
        >
          <span className="fv-keyboard-recommend-label">{suggestion}</span>
        </button>
      ) : (
        <span
          key={`empty-suggestion-${index + 1}`}
          className="fv-keyboard-recommend-button fv-keyboard-recommend-button--empty"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
