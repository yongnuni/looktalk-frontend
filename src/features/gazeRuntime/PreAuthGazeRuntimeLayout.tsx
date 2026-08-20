import { Navigate, Outlet } from 'react-router-dom';

import GazeCursorOverlay from '../gazeInteraction/GazeCursorOverlay';

import { GazeInteractionProvider } from '../gazeInteraction/GazeInteractionProvider';

import { PreAuthGazeRuntimeProvider } from './PreAuthGazeRuntimeProvider';

const PRE_CALIBRATION_RESULT_KEY = 'preCalibrationResult';

const PRE_CALIBRATION_COMPLETED_KEY = 'preCalibrationCompleted';

/**
 * 로그인 / 회원가입 / 비밀번호 재설정에서 사용하는
 * 로그인 전 Gaze Runtime Layout.
 *
 * PreCalibrationPage에서 9점 캘리브레이션이 완료된 뒤에만
 * 이 Layout에 진입할 수 있다.
 *
 * 구조:
 *
 * PreAuthGazeRuntimeProvider
 *   ↓
 * GazeInteractionProvider
 *   ↓
 * GazeCursorOverlay
 *   ↓
 * Login / Signup / PasswordReset
 */
export default function PreAuthGazeRuntimeLayout() {
  const calibrationCompleted =
    sessionStorage.getItem(PRE_CALIBRATION_COMPLETED_KEY) === 'true';

  const calibrationResult = sessionStorage.getItem(PRE_CALIBRATION_RESULT_KEY);

  /*
   * 9점 캘리브레이션을 하지 않았거나
   * 결과 데이터가 없다면 로그인 화면에 바로 진입시키지 않는다.
   */
  if (!calibrationCompleted || !calibrationResult) {
    return <Navigate to="/pre-calibration" replace />;
  }

  return (
    <PreAuthGazeRuntimeProvider>
      <GazeInteractionProvider>
        <GazeCursorOverlay />

        <Outlet />
      </GazeInteractionProvider>
    </PreAuthGazeRuntimeProvider>
  );
}
