import './KeyboardKey.css';

interface KeyboardKeyProps {
  value: string;
  onSelect: (value: string) => void;
}

function getLabel(value: string) {
  switch (value) {
    case 'BACKSPACE':
      return '삭제';
    case 'SPACE':
      return '띄어쓰기';
    case 'CLEAR':
      return '전체 삭제';
    case 'ENTER':
      return '전송';
    default:
      return value;
  }
}

export default function KeyboardKey({ value, onSelect }: KeyboardKeyProps) {
  return (
    <button
      type="button"
      className="keyboard-key"
      onClick={() => onSelect(value)}
    >
      {getLabel(value)}
    </button>
  );
}