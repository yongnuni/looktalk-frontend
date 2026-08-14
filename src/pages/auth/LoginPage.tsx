import './LoginPage.css';
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

export default function LoginPage() {
  const navigate = useNavigate();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  const [loginIdError, setLoginIdError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    // =========================
    // 입력값 확인
    // =========================
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

      // =========================
      // 로그인 API 호출
      // =========================
      const response = await fetch('http://localhost:8080/api/auth/login', {
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

      // =========================
      // 로그인 실패
      // =========================
      if (!response.ok || !result.success || !result.data) {
        setErrorMessage(
          result.message || '아이디 또는 비밀번호를 확인해주세요.',
        );
        return;
      }

      // =========================
      // Access Token 저장
      // =========================
      localStorage.setItem('accessToken', result.data.accessToken);

      // =========================
      // Token Type 저장
      // =========================
      localStorage.setItem('tokenType', result.data.tokenType);

      // =========================
      // 사용자 Role 저장
      // =========================
      localStorage.setItem('userRole', result.data.role);

      // =========================
      // 로그인 성공
      // =========================
      navigate('/main');
    } catch (error) {
      console.error('로그인 API 호출 실패:', error);

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
    <div className="login-page">
      <div className="login-content">
        <div className="login-logo">
          <img src={Logo} alt="Look Talk Logo" className="login-logo-image" />
        </div>

        <div className="login-container">
          <input
            type="text"
            placeholder="아이디를 입력하세요."
            className="login-input"
            value={loginId}
            onChange={(event) => {
              setLoginId(event.target.value);
              setLoginIdError('');
              setErrorMessage('');
            }}
            onKeyDown={handleKeyDown}
            autoComplete="username"
            maxLength={50}
          />

          {loginIdError && (
            <p className="input-error-message">{loginIdError}</p>
          )}

          <input
            type="password"
            placeholder="비밀번호를 입력하세요."
            className="login-input"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError('');
              setErrorMessage('');
            }}
            onKeyDown={handleKeyDown}
            autoComplete="current-password"
          />

          {passwordError && (
            <p className="input-error-message">{passwordError}</p>
          )}

          {errorMessage && (
            <p className="login-error-message">{errorMessage}</p>
          )}

          <button
            type="button"
            className="login-button"
            onClick={() => void handleLogin()}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '완료'}
          </button>

          <div className="login-links">
            <Link to="/reset-password" className="login-link-button">
              비밀번호 재설정
            </Link>

            <Link to="/signup" className="login-link-button">
              회원가입
            </Link>
          </div>
        </div>
      </div>

      <Link to="/staff-login" className="staff-button">
        의료진 전용
      </Link>
    </div>
  );
}
