import KeyboardKey from './KeyboardKey';
import qwertyLayout from '../layouts/qwerty.json';
import './VirtualKeyboard.css';

interface VirtualKeyboardProps {
  onKeySelect: (keyValue: string) => void;
}

export default function VirtualKeyboard({ onKeySelect }: VirtualKeyboardProps) {
  return (
    <div className="virtual-keyboard">
      {qwertyLayout.map((row, rowIndex) => (
        <div className="keyboard-row" key={`row-${rowIndex}`}>
          {row.map((keyValue) => (
            <KeyboardKey
              key={keyValue}
              value={keyValue}
              onSelect={onKeySelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}