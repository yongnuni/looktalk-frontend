import { describe, expect, it } from 'vitest';
import { resolveGazeInputMode } from './gazeInputMode';

describe('resolveGazeInputMode', () => {
  it('EYE_TRACKING → DWELL', () => {
    expect(resolveGazeInputMode('EYE_TRACKING')).toBe('DWELL');
  });

  it('MOUTH → MOUTH', () => {
    expect(resolveGazeInputMode('MOUTH')).toBe('MOUTH');
  });

  it('7. BLINK → 새 confirm으로 연결되지 않고 DWELL로 안전하게 대체된다(BLINK라는 selection mode 자체가 결과 타입에 존재하지 않음)', () => {
    expect(resolveGazeInputMode('BLINK')).toBe('DWELL');
  });

  it('undefined(UserSetting 미로딩) → DWELL', () => {
    expect(resolveGazeInputMode(undefined)).toBe('DWELL');
  });
});
