import { createBrowserRouter, Navigate } from 'react-router-dom';

import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import PasswordResetPage from '../pages/auth/PasswordResetPage';

import StaffLoginPage from '../pages/auth/StaffLoginPage';
import StaffPasswordResetPage from '../pages/auth/StaffPasswordResetPage';
import StaffSignupPage from '../pages/auth/StaffSignupPage';

import PatientHomePage from '../pages/patient/PatientHomePage';
import MemoPage from '../pages/patient/MemoPage';
import MyPage from '../pages/patient/MyPage';

import HospitalChatPage from '../pages/chat/HospitalChatPage';
import FriendChatPage from '../pages/chat/FriendChatPage';

import CalibrationPage from '../pages/calibration/CalibrationPage';
import AnalysisPage from '../pages/analysis/AnalysisPage';
import StaffDashboardPage from '../pages/staff/StaffDashboardPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/reset-password', element: <PasswordResetPage /> },

  { path: '/staff-login', element: <StaffLoginPage /> },
  { path: '/staff-reset-password', element: <StaffPasswordResetPage /> },
  { path: '/staff-signup', element: <StaffSignupPage /> },

  { path: '/patient', element: <PatientHomePage /> },
  { path: '/memo', element: <MemoPage /> },
  { path: '/mypage', element: <MyPage /> },

  { path: '/chat/hospital', element: <HospitalChatPage /> },
  { path: '/chat/friend', element: <FriendChatPage /> },

  { path: '/calibration', element: <CalibrationPage /> },
  { path: '/analysis', element: <AnalysisPage /> },

  { path: '/staff', element: <StaffDashboardPage /> },

  { path: '*', element: <Navigate to="/login" replace /> },
]);
