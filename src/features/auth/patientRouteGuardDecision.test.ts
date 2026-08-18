import { describe, expect, it } from 'vitest';
import { deriveRouteGuardDecision } from './patientRouteGuardDecision';

describe('deriveRouteGuardDecision', () => {
  it('PATIENT accessToken이 있으면 ALLOW', () => {
    expect(deriveRouteGuardDecision('token', 'PATIENT')).toBe('ALLOW');
  });

  it('accessToken이 없으면 REDIRECT_LOGIN', () => {
    expect(deriveRouteGuardDecision(null, 'PATIENT')).toBe('REDIRECT_LOGIN');
  });

  it('role이 STAFF면 REDIRECT_LOGIN', () => {
    expect(deriveRouteGuardDecision('token', 'STAFF')).toBe('REDIRECT_LOGIN');
  });

  it('role이 없으면 REDIRECT_LOGIN', () => {
    expect(deriveRouteGuardDecision('token', null)).toBe('REDIRECT_LOGIN');
  });
});
