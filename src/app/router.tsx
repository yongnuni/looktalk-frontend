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

  { path: '/calibration', element: <CalibrationPage /> },
  { path: ROUTES.ANALYSIS, element: <AnalysisPage /> },

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
