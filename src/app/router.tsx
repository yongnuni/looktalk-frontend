import { createBrowserRouter, Navigate } from 'react-router-dom';

import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import PasswordResetPage from '../pages/auth/PasswordResetPage';

import StaffLoginPage from '../pages/auth/StaffLoginPage';
import StaffPasswordResetPage from '../pages/auth/StaffPasswordResetPage';
import StaffSignupPage from '../pages/auth/StaffSignupPage';

import MainPage from '../pages/main/MainPage';

import PatientHomePage from '../pages/patient/PatientHomePage';
import MemoPage from '../pages/patient/MemoPage';
import MyPage from '../pages/patient/MyPage';
import FriendListPage from '../pages/patient/FriendListPage';
import PhoneVerifyPage from '../pages/patient/PhoneVerifyPage';
import PhrasePage from '../pages/patient/PhrasePage';

import HospitalChatPage from '../pages/chat/HospitalChatPage';
import FriendChatPage from '../pages/chat/FriendChatPage';

import CalibrationPage from '../pages/calibration/CalibrationPage';
import AnalysisPage from '../pages/analysis/AnalysisPage';
import PatientCalibrationGate from '../features/calibration/components/PatientCalibrationGate';
import PatientGazeRuntimeLayout from '../features/gazeRuntime/PatientGazeRuntimeLayout';
import PatientRouteGuard from '../features/auth/PatientRouteGuard';

import FaceTrackingDebugPage from '../pages/dev/FaceTrackingDebugPage';
import GazeDwellDebugPage from '../pages/dev/GazeDwellDebugPage';

import StaffDashboardPage from '../pages/staff/StaffDashboardPage';
import StaffMyPage from '../pages/staff/StaffMyPage';
import StaffProfilePage from '../pages/staff/StaffProfilePage';
import StaffPatientListPage from '../pages/staff/StaffPatientListPage';
import StaffEmergencyLogPage from '../pages/staff/StaffEmergencyLogPage';

import { ROUTES } from '../shared/constants/routes';

export const router = createBrowserRouter([
  { path: ROUTES.LOGIN, element: <LoginPage /> },
  { path: ROUTES.SIGNUP, element: <SignupPage /> },
  { path: ROUTES.PASSWORD_RESET, element: <PasswordResetPage /> },

  { path: ROUTES.STAFF_LOGIN, element: <StaffLoginPage /> },
  { path: ROUTES.STAFF_PASSWORD_RESET, element: <StaffPasswordResetPage /> },
  { path: ROUTES.STAFF_SIGNUP, element: <StaffSignupPage /> },

  // Front Step 16 §44 — PATIENT route tree 전체(Calibration 포함)를 PatientRouteGuard로
  // 감싼다. accessToken/userRole이 실제 PATIENT 세션이 아니면 어떤 하위 route로 직접
  // 진입해도(Gate/Runtime을 건드리기 전에) /login으로 보낸다 — STAFF/비인증 사용자에게
  // Camera/FaceLandmarker가 mount되는 경로 자체를 구조적으로 차단한다.
  //
  // Front Step 10 — 그 안에서 PATIENT route tree는 Calibration Bootstrap Gate로 감싼다.
  // active calibration이 없으면 이 안의 어떤 route로 직접 진입해도 /calibration으로
  // 보낸다. /calibration 자체는 Gate 밖(그러나 여전히 PatientRouteGuard 안)의 형제
  // route로 남겨 무한 redirect를 방지한다.
  //
  // Front Step 11 — Gate가 READY를 판정한 뒤에만 PatientGazeRuntimeLayout이 mount되고,
  // 그 안에서 Global Gaze Runtime(Camera/FaceLandmarker/GazeFilter)이 하나만 살아
  // PATIENT route 전환 동안 유지된다. /calibration은 이 layout 밖이라 절대 겹치지 않는다.
  {
    element: <PatientRouteGuard />,
    children: [
      {
        element: <PatientCalibrationGate />,
        children: [
          {
            element: <PatientGazeRuntimeLayout />,
            children: [
              { path: ROUTES.MAIN, element: <MainPage /> },
              { path: '/patient', element: <PatientHomePage /> },
              { path: ROUTES.MEMO, element: <MemoPage /> },

              // ---------- 환자 마이페이지 ----------
              { path: ROUTES.MYPAGE, element: <MyPage /> },
              { path: ROUTES.MYPAGE_FRIENDS, element: <FriendListPage /> },
              { path: ROUTES.MYPAGE_PHONE_VERIFY, element: <PhoneVerifyPage /> },
              { path: ROUTES.MYPAGE_PHRASES, element: <PhrasePage /> },

              { path: ROUTES.CHAT_HOSPITAL, element: <HospitalChatPage /> },
              { path: ROUTES.CHAT_FRIEND, element: <FriendChatPage /> },

              { path: ROUTES.ANALYSIS, element: <AnalysisPage /> },
            ],
          },
        ],
      },

      { path: '/calibration', element: <CalibrationPage /> },
    ],
  },

  // ---------- 개발용 (Front Step 0 debug) ----------
  { path: '/dev/face-tracking', element: <FaceTrackingDebugPage /> },
  { path: '/dev/gaze-dwell', element: <GazeDwellDebugPage /> },

  { path: '/staff', element: <StaffDashboardPage /> },

  // ---------- 의료진 마이페이지 ----------
  { path: ROUTES.STAFF_MYPAGE, element: <StaffMyPage /> },
  { path: ROUTES.STAFF_PROFILE, element: <StaffProfilePage /> },
  { path: ROUTES.STAFF_PATIENTS, element: <StaffPatientListPage /> },
  { path: ROUTES.STAFF_EMERGENCY_LOG, element: <StaffEmergencyLogPage /> },

  // TODO : 의료진 채팅 페이지 미구현 — 연결만 해둠
  { path: ROUTES.STAFF_CHAT, element: <StaffDashboardPage /> },

  { path: '*', element: <Navigate to={ROUTES.LOGIN} replace /> },
]);
