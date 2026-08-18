import { ROUTES } from '../../shared/constants/routes';
import type { ActiveCalibrationStatus } from './store/calibrationStore';

/**
 * Front Step 10 — Calibration Bootstrap Gate의 순수 판정 로직. React/router에 의존하지
 * 않는 pure function으로 분리해 결정 자체를 deterministic하게 테스트한다.
 *
 * status는 오직 useActiveCalibration()/calibrationStore가 실제 Backend GET 결과로 채운
 * activeStatus에서만 온다 — "Frontend 로컬 active 캐시가 null이었는가"는 이 함수의 입력에
 * 아예 존재하지 않으므로, 로컬 캐시 상태로 오판할 수 있는 경로 자체가 없다(§7/§8-8).
 */
export type CalibrationGateDecision = 'LOADING' | 'READY' | 'CALIBRATION_REQUIRED' | 'ERROR';

export function deriveCalibrationGateDecision(status: ActiveCalibrationStatus): CalibrationGateDecision {
  switch (status) {
    case 'idle':
    case 'loading':
      return 'LOADING';
    case 'loaded':
      return 'READY';
    case 'not_found':
      return 'CALIBRATION_REQUIRED';
    case 'error':
      return 'ERROR';
    default:
      return status satisfies never;
  }
}

/**
 * §10/§11 — Calibration 완료 후 이동 경로.
 *
 * /patient는 VirtualKeyboard가 연결된 PatientHomePage이지만 실제 서비스 Main이 아니라
 * 기존 개발용/고아 route다(어떤 UI에서도 링크되지 않음) — 실제 PATIENT Main은
 * ROUTES.MAIN('/main')이다. 따라서 Bootstrap(최초 진입) 완료는 ROUTES.MAIN으로 보낸다.
 * Analysis 재측정(?mode=retest&source=analysis)은 기존 계약대로 ROUTES.ANALYSIS를 유지한다.
 */
export function resolveCalibrationCompletionPath(
  isRetestFlow: boolean,
): typeof ROUTES.MAIN | typeof ROUTES.ANALYSIS {
  return isRetestFlow ? ROUTES.ANALYSIS : ROUTES.MAIN;
}
