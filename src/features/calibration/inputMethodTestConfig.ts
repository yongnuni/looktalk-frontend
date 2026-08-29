import type { GazeInputMode } from '../multimodalInput/gazeInputMode';
import type { InputTestMethod } from './inputMethodTest';

export interface InputMethodTestConfig {
  title: string;
  inputMode: GazeInputMode;
  guide: string;
}

export const INPUT_METHOD_TEST_CONFIG: Record<InputTestMethod, InputMethodTestConfig> = {
  GAZE: {
    title: '시선(gaze)',
    inputMode: 'DWELL',
    guide: '입력할 키를 바라보고 시선을 유지해 선택하세요.',
  },
  BLINK: {
    title: '눈 깜빡임(blink)',
    inputMode: 'BLINK',
    guide: '입력할 키를 바라본 뒤 의도적으로 눈을 깜빡여 선택하세요.',
  },
  MOUTH: {
    title: '입 움직임(mouth)',
    inputMode: 'MOUTH',
    guide: '입력할 키를 바라본 뒤 입을 움직여 선택하세요.',
  },
};
