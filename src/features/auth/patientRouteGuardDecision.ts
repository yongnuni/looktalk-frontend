/**
 * Front Step 16 §44 — PatientRouteGuard의 순수 판정 로직. calibrationGate.ts와 동일하게
 * React/router에 의존하지 않는 pure function으로 분리해 deterministic하게 테스트한다.
 */
export type PatientRouteGuardDecision = 'ALLOW' | 'REDIRECT_LOGIN';

export function deriveRouteGuardDecision(accessToken: string | null, userRole: string | null): PatientRouteGuardDecision {
  if (!accessToken || userRole !== 'PATIENT') {
    return 'REDIRECT_LOGIN';
  }

  return 'ALLOW';
}
