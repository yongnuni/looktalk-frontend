import { describe, expect, it } from 'vitest';
import { INPUT_METHOD_TEST_CONFIG } from './inputMethodTestConfig';

describe('INPUT_METHOD_TEST_CONFIG', () => {
  it('각 stage는 지정된 최종 선택 controller 하나만 사용한다', () => {
    expect(INPUT_METHOD_TEST_CONFIG.GAZE.inputMode).toBe('DWELL');
    expect(INPUT_METHOD_TEST_CONFIG.BLINK.inputMode).toBe('BLINK');
    expect(INPUT_METHOD_TEST_CONFIG.MOUTH.inputMode).toBe('MOUTH');
  });
});
