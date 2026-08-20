import { describe, expect, it } from 'vitest';
import { resolveGazeInputMode } from './gazeInputMode';

describe('resolveGazeInputMode', () => {
  it('EYE_TRACKING → DWELL', () => {
    expect(resolveGazeInputMode('EYE_TRACKING')).toBe('DWELL');
  });

  it('MOUTH → MOUTH', () => {
    expect(resolveGazeInputMode('MOUTH')).toBe('MOUTH');
  });

  it('BLINK → BLINK', () => {
    expect(resolveGazeInputMode('BLINK')).toBe('BLINK');
  });

  it('undefined(UserSetting 미로딩) → DWELL', () => {
    expect(resolveGazeInputMode(undefined)).toBe('DWELL');
  });
});
