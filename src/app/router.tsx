import { createBrowserRouter, Navigate } from 'react-router-dom';

import SplashPage from '../pages/auth/SplashPage';
import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';

import PatientHomePage from '../pages/patient/PatientHomePage';
import MemoPage from '../pages/patient/MemoPage';
import MyPage from '../pages/patient/MyPage';

import HospitalChatPage from '../pages/chat/HospitalChatPage';
import FriendChatPage from '../pages/chat/FriendChatPage';

import CalibrationPage from '../pages/calibration/CalibrationPage';
import AnalysisPage from '../pages/analysis/AnalysisPage';
import StaffDashboardPage from '../pages/staff/StaffDashboardPage';
import ModalPreviewPage from '../pages/dev/ModalPreviewPage';

export const router = createBrowserRouter([
  { path: '/', element: <SplashPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },

  { path: '/patient', element: <PatientHomePage /> },
  { path: '/memo', element: <MemoPage /> },
  { path: '/mypage', element: <MyPage /> },

  { path: '/chat/hospital', element: <HospitalChatPage /> },
  { path: '/chat/friend', element: <FriendChatPage /> },

  { path: '/calibration', element: <CalibrationPage /> },
  { path: '/analysis', element: <AnalysisPage /> },

  { path: '/staff', element: <StaffDashboardPage /> },
  { path: '/dev/modal-preview', element: <ModalPreviewPage /> },

  { path: '*', element: <Navigate to="/" replace /> },
]);
