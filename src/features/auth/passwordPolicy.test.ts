import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, isPasswordLengthValid } from './passwordPolicy';

describe('isPasswordLengthValid', () => {
  it('8자 미만이면 invalid', () => {
    expect(isPasswordLengthValid('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false);
  });

  it('8자면 valid(경계값)', () => {
    expect(isPasswordLengthValid('a'.repeat(PASSWORD_MIN_LENGTH))).toBe(true);
  });

  it('64자면 valid(경계값)', () => {
    expect(isPasswordLengthValid('a'.repeat(PASSWORD_MAX_LENGTH))).toBe(true);
  });

  it('64자 초과면 invalid', () => {
    expect(isPasswordLengthValid('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });

  it('빈 문자열은 invalid', () => {
    expect(isPasswordLengthValid('')).toBe(false);
  });
});
