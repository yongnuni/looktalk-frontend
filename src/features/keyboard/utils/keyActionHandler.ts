export const KEY_ACTIONS = {
  BACKSPACE: 'BACKSPACE',
  SPACE: 'SPACE',
  ENTER: 'ENTER',
  CLEAR: 'CLEAR',
} as const;

export function handleKeyAction(currentText: string, keyValue: string): string {
  switch (keyValue) {
    case KEY_ACTIONS.BACKSPACE:
      return currentText.slice(0, -1);

    case KEY_ACTIONS.SPACE:
      return `${currentText} `;

    case KEY_ACTIONS.CLEAR:
      return '';

    case KEY_ACTIONS.ENTER:
      return currentText;

    default:
      return `${currentText}${keyValue}`;
  }
}