import './StaffLoginPage.css';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../assets/Logo.png';

interface LoginData {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  role: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  data: LoginData | null;
}

const API_BASE_URL = 'http://localhost:8080';

export default function StaffLoginPage() {
  const navigate = useNavigate();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  const [loginIdError, setLoginIdError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // =========================
  // 의료진 로그인
  // POST /api/auth/login
  // =========================
  const handleLogin = async () => {
    setLoginIdError('');
    setPasswordError('');
    setErrorMessage('');

    if (!loginId.trim()) {
      setLoginIdError('아이디를 입력해주세요.');
      return;
    }

    if (!password.trim()) {
      setPasswordError('비밀번호를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },

        // Refresh Token HttpOnly Cookie 수신
        credentials: 'include',

        body: JSON.stringify({
          loginId: loginId.trim(),
          password,
        }),
      });

      const result: LoginResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        setErrorMessage(
          result.message || '아이디 또는 비밀번호를 확인해주세요.',
        );
        return;
      }

      // =========================
      // STAFF 계정인지 확인
      // =========================
      if (result.data.role !== 'STAFF') {
        setErrorMessage('의료진 계정으로 로그인해주세요.');
        return;
      }

      // =========================
      // Access Token 저장
      // =========================
      localStorage.setItem('accessToken', result.data.accessToken);

      localStorage.setItem('tokenType', result.data.tokenType);

      localStorage.setItem('userRole', result.data.role);

      // =========================
      // 의료진 메인 페이지 이동
      // =========================
      navigate('/staff');
    } catch (error) {
      console.error('의료진 로그인 API 호출 실패:', error);

      setErrorMessage('서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // =========================
  // Enter 키 로그인
  // =========================
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      void handleLogin();
    }
  };

  return (
    <div className="staff-login-page">
      <div className="staff-login-content">
        <div className="staff-login-logo">
          <img
            src={Logo}
            alt="Look Talk Logo"
            className="staff-login-logo-image"
          />

          <p className="staff-login-logo-subtitle">의료진 전용</p>
        </div>

        <div className="staff-login-container">
          <input
            type="text"
            placeholder="아이디를 입력하세요."
            className="staff-login-input"
            value={loginId}
            maxLength={50}
            autoComplete="username"
            onChange={(event) => {
              setLoginId(event.target.value);
              setLoginIdError('');
              setErrorMessage('');
            }}
            onKeyDown={handleKeyDown}
          />

          {loginIdError && (
            <p className="staff-input-error-message">{loginIdError}</p>
          )}

          <input
            type="password"
            placeholder="비밀번호를 입력하세요."
            className="staff-login-input"
            value={password}
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError('');
              setErrorMessage('');
            }}
            onKeyDown={handleKeyDown}
          />

          {passwordError && (
            <p className="staff-input-error-message">{passwordError}</p>
          )}

          {errorMessage && (
            <p className="staff-login-error-message">{errorMessage}</p>
          )}

          <button
            type="button"
            className="staff-login-button"
            onClick={() => void handleLogin()}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '완료'}
          </button>

          <div className="staff-login-links">
            <Link
              to="/staff-reset-password"
              className="staff-login-link-button"
            >
              비밀번호 재설정
            </Link>

            <span className="staff-login-divider">|</span>

            <Link to="/staff-signup" className="staff-login-link-button">
              회원가입
            </Link>
          </div>
        </div>
      </div>

      <Link to="/login" className="staff-switch-button">
        환자 전용
      </Link>
    </div>
  );
}
