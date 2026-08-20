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

import PreCalibrationPage from '../pages/calibration/PreCalibrationPage';
import CalibrationPage from '../pages/calibration/CalibrationPage';
import AnalysisPage from '../pages/analysis/AnalysisPage';

import PatientCalibrationGate from '../features/calibration/components/PatientCalibrationGate';

import PreAuthGazeRuntimeLayout from '../features/gazeRuntime/PreAuthGazeRuntimeLayout';
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
  // =========================================================
  // 최초 진입
  // =========================================================
  //
  // 웹에 처음 접속하면 로그인 페이지가 아니라
  // 로그인 전 9점 캘리브레이션 페이지로 이동한다.
  //
  {
    path: '/',
    element: <Navigate to="/pre-calibration" replace />,
  },

  // =========================================================
  // 로그인 전 9점 캘리브레이션
  // =========================================================
  //
  // 아직 로그인하지 않은 상태에서 실행되어야 하므로
  // PatientRouteGuard / Gaze Runtime 바깥에 위치한다.
  //
  // 이 페이지 자체가 Camera + FaceLandmarker를 사용하므로
  // PreAuthGazeRuntimeLayout 안에 넣지 않는다.
  //
  {
    path: '/pre-calibration',
    element: <PreCalibrationPage />,
  },

  // =========================================================
  // 환자 인증
  // =========================================================
  //
  // 9점 사전 캘리브레이션을 완료한 뒤
  // PreAuthGazeRuntimeLayout이 mount된다.
  //
  // PreAuthGazeRuntimeLayout
  //   ↓
  // PreAuthGazeRuntimeProvider
  //   ↓
  // GazeInteractionProvider
  //   ↓
  // GazeCursorOverlay
  //   ↓
  // Login / Signup / PasswordReset
  //
  // 따라서 인증 페이지에서도 9점 calibration 결과를 사용해
  // 시선 추적과 dwell selection이 가능하다.
  //
  {
    element: <PreAuthGazeRuntimeLayout />,

    children: [
      {
        path: ROUTES.LOGIN,
        element: <LoginPage />,
      },

      {
        path: ROUTES.SIGNUP,
        element: <SignupPage />,
      },

      {
        path: ROUTES.PASSWORD_RESET,
        element: <PasswordResetPage />,
      },
    ],
  },

  // =========================================================
  // 의료진 인증
  // =========================================================
  //
  // 현재는 기존 구조를 그대로 유지한다.
  //
  {
    path: ROUTES.STAFF_LOGIN,
    element: <StaffLoginPage />,
  },

  {
    path: ROUTES.STAFF_PASSWORD_RESET,
    element: <StaffPasswordResetPage />,
  },

  {
    path: ROUTES.STAFF_SIGNUP,
    element: <StaffSignupPage />,
  },

  // =========================================================
  // 환자 전용 Route
  // =========================================================
  //
  // 로그인 이후 PATIENT route tree 전체를
  // PatientRouteGuard로 감싼다.
  //
  // accessToken / userRole이 실제 PATIENT 세션이 아니면
  // 어떤 하위 route로 직접 진입해도 /login으로 이동한다.
  //
  // 그 안에서 PatientCalibrationGate가 기존 로그인 후
  // 16점 정식 캘리브레이션 존재 여부를 검사한다.
  //
  // active calibration이 없으면 /calibration으로 이동한다.
  //
  // /calibration은 Gate 바깥이지만 PatientRouteGuard 안에
  // 위치하므로 로그인한 PATIENT만 접근할 수 있다.
  //
  // PatientGazeRuntimeLayout은 Gate 통과 이후에만 mount된다.
  //
  {
    element: <PatientRouteGuard />,

    children: [
      {
        element: <PatientCalibrationGate />,

        children: [
          {
            element: <PatientGazeRuntimeLayout />,

            children: [
              {
                path: ROUTES.MAIN,
                element: <MainPage />,
              },

              {
                path: '/patient',
                element: <PatientHomePage />,
              },

              {
                path: ROUTES.MEMO,
                element: <MemoPage />,
              },

              // ---------- 환자 마이페이지 ----------

              {
                path: ROUTES.MYPAGE,
                element: <MyPage />,
              },

              {
                path: ROUTES.MYPAGE_FRIENDS,
                element: <FriendListPage />,
              },

              {
                path: ROUTES.MYPAGE_PHONE_VERIFY,
                element: <PhoneVerifyPage />,
              },

              {
                path: ROUTES.MYPAGE_PHRASES,
                element: <PhrasePage />,
              },

              // ---------- 환자 채팅 ----------

              {
                path: ROUTES.CHAT_HOSPITAL,
                element: <HospitalChatPage />,
              },

              {
                path: ROUTES.CHAT_FRIEND,
                element: <FriendChatPage />,
              },

              // ---------- 분석 ----------

              {
                path: ROUTES.ANALYSIS,
                element: <AnalysisPage />,
              },
            ],
          },
        ],
      },

      // =====================================================
      // 로그인 후 정식 16점 캘리브레이션
      // =====================================================
      //
      // 기존 CalibrationPage는 그대로 유지한다.
      //
      // PatientCalibrationGate 바깥에 두어
      // active calibration이 없는 사용자가
      // 무한 redirect 없이 진입할 수 있게 한다.
      //
      // 이 페이지 자체가 Camera를 사용하므로
      // PatientGazeRuntimeLayout 안에 넣지 않는다.
      //
      {
        path: '/calibration',
        element: <CalibrationPage />,
      },
    ],
  },

  // =========================================================
  // 개발용
  // =========================================================

  {
    path: '/dev/face-tracking',
    element: <FaceTrackingDebugPage />,
  },

  {
    path: '/dev/gaze-dwell',
    element: <GazeDwellDebugPage />,
  },

  // =========================================================
  // 의료진
  // =========================================================

  {
    path: '/staff',
    element: <StaffDashboardPage />,
  },

  // ---------- 의료진 마이페이지 ----------

  {
    path: ROUTES.STAFF_MYPAGE,
    element: <StaffMyPage />,
  },

  {
    path: ROUTES.STAFF_PROFILE,
    element: <StaffProfilePage />,
  },

  {
    path: ROUTES.STAFF_PATIENTS,
    element: <StaffPatientListPage />,
  },

  {
    path: ROUTES.STAFF_EMERGENCY_LOG,
    element: <StaffEmergencyLogPage />,
  },

  // TODO : 의료진 채팅 페이지 미구현 — 연결만 해둠
  {
    path: ROUTES.STAFF_CHAT,
    element: <StaffDashboardPage />,
  },

  // =========================================================
  // 존재하지 않는 경로
  // =========================================================
  //
  // 로그인 전 첫 흐름인 9점 캘리브레이션으로 이동한다.
  //
  {
    path: '*',
    element: <Navigate to="/pre-calibration" replace />,
  },
]);
