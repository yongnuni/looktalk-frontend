import { describe, expect, it } from 'vitest';
import { mapInputMethodIdToBackend } from './inputMethodMapping';

describe('mapInputMethodIdToBackend', () => {
  it('gaze → EYE_TRACKING', () => {
    expect(mapInputMethodIdToBackend('gaze')).toBe('EYE_TRACKING');
  });

  it('blink → BLINK', () => {
    expect(mapInputMethodIdToBackend('blink')).toBe('BLINK');
  });

  it('mouth → MOUTH', () => {
    expect(mapInputMethodIdToBackend('mouth')).toBe('MOUTH');
  });
});
