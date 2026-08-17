import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../shared/constants/routes';
import { deriveRouteGuardDecision } from './patientRouteGuardDecision';

/**
 * Front Step 16 §44 — Final Integration Audit에서 확인된 gap: PatientCalibrationGate는
 * active calibration 여부만 판정하고 role/인증 자체는 검사하지 않는다. Backend는 이미
 * Calibration API를 PATIENT 전용으로 보호하지만(SecurityConfig hasRole(PATIENT)), 이
 * Front route guard가 없으면 STAFF/비인증 사용자가 `/main` 등으로 직접 진입했을 때도
 * PatientCalibrationGate → GET /api/calibrations/active 요청이 나가고, 그 결과가
 * 401/403이면 Gate가 "활성 캘리브레이션 정보를 불러오지 못했습니다"라는 재시도 화면을
 * 영원히 보여준다(로그인 페이지로 안내되지 않음) — Camera/FaceLandmarker 자체는 시작되지
 * 않지만(그 이전에 Gate가 ERROR로 멈추므로) 사용자 경험상 막다른 화면이다.
 *
 * 인증 시스템을 새로 만들지 않고, 실제 로그인 흐름(LoginPage.tsx)이 저장하는 키만 그대로
 * 읽어 최소 범위로 판정한다. STAFF는 이미 자기 영역(`/staff/**`)이 따로 있으므로 여기서는
 * "PATIENT 세션이 아니면 로그인 페이지로" 하나만 처리한다 — role별 목적지 분기 같은 복잡한
 * 라우팅을 새로 설계하지 않는다.
 */
export default function PatientRouteGuard() {
  const accessToken = localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');
  const decision = deriveRouteGuardDecision(accessToken, userRole);

  if (decision === 'REDIRECT_LOGIN') {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
}
