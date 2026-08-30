import './LoginPage.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Logo from '../../assets/Logo.png';

import { useGazeInteraction } from '../../features/gazeInteraction/GazeInteractionContext';
import { usePageScope } from '../../features/gazeInteraction/usePageScope';
import { useGazeTarget } from '../../features/gazeInteraction/useGazeTarget';

import FullViewportKeyboardOverlay from '../../features/keyboard/components/FullViewportKeyboardOverlay';
import { useKeyboardInput } from '../../features/keyboard/hooks/useKeyboardInput';

import { useUserSettings } from '../../features/userSetting/hooks/useUserSettings';

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

// ============================================================
// 가상키보드 입력 대상
// ============================================================

type LoginInputField = 'loginId' | 'password' | null;

export default function LoginPage() {
  const navigate = useNavigate();

  // ==========================================================
  // Gaze / Keyboard
  // ==========================================================

  // 로그인 전 환자 인증 페이지에서는 MAIN scope를 사용하고,
  // 가상키보드가 열렸을 때만 KEYBOARD scope로 전환한다.
  usePageScope('MAIN');

  const { setActiveScope } = useGazeInteraction();
  const { settings } = useUserSettings();

  const [activeField, setActiveField] = useState<LoginInputField>(null);

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const clearTextRef = useRef<() => void>(() => {});

  // ==========================================================
  // 로그인 입력값
  // ==========================================================

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  const [loginIdError, setLoginIdError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ==========================================================
  // Gaze Scope
  // ==========================================================
  //
  // 평상시:
  // MAIN
  //
  // 가상키보드 실행 중:
  // KEYBOARD
  //
  // 이렇게 해야 키보드를 사용하는 동안 뒤에 있는 로그인 input이나
  // 로그인 버튼이 시선으로 동시에 선택되지 않는다.
  // ==========================================================

  useEffect(() => {
    setActiveScope(isKeyboardOpen ? 'KEYBOARD' : 'MAIN');
  }, [isKeyboardOpen, setActiveScope]);

  // ==========================================================
  // 가상키보드 열기
  // ==========================================================

  const openKeyboardFor = useCallback(
    (field: Exclude<LoginInputField, null>) => {
      if (isLoading) {
        return;
      }

      // 기존 키보드 draft가 남지 않도록 초기화
      clearTextRef.current();

      setLoginIdError('');
      setPasswordError('');
      setErrorMessage('');

      setActiveField(field);
      setIsKeyboardOpen(true);
    },
    [isLoading],
  );

  // ==========================================================
  // 가상키보드 닫기
  // ==========================================================

  const handleKeyboardClose = () => {
    clearTextRef.current();

    setActiveField(null);
    setIsKeyboardOpen(false);
  };

  // ==========================================================
  // 가상키보드 입력 완료
  // ==========================================================

  const handleKeyboardConfirm = useCallback(
    (composedText: string) => {
      if (!activeField) {
        return;
      }

      if (activeField === 'loginId') {
        setLoginId(composedText.slice(0, 50));

        setLoginIdError('');
      }

      if (activeField === 'password') {
        setPassword(composedText);

        setPasswordError('');
      }

      setErrorMessage('');

      clearTextRef.current();

      setActiveField(null);
      setIsKeyboardOpen(false);
    },
    [activeField],
  );

  // ==========================================================
  // Virtual Keyboard
  // ==========================================================

  const { keyboardState, text, handleKeySelect, clearText } = useKeyboardInput({
    onConfirm: handleKeyboardConfirm,
  });

  useEffect(() => {
    clearTextRef.current = clearText;
  }, [clearText]);

  // ==========================================================
  // 로그인
  // ==========================================================

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

  // ==========================================================
  // Gaze Targets
  // ==========================================================
  //
  // 입력창:
  // dwell → 가상키보드 실행
  //
  // 완료:
  // dwell → 로그인
  //
  // 회원가입 / 비밀번호 재설정:
  // dwell → 해당 페이지 이동
  //
  // 의료진 전용은 기존 일반 입력 흐름이므로
  // 이번 환자 전용 gaze target 범위에서는 제외한다.
  // ==========================================================

  const loginIdTargetRef = useGazeTarget({
    id: 'auth-login-id',
    scope: 'MAIN',
    enabled: !isKeyboardOpen && !isLoading,

    onSelect: () => {
      openKeyboardFor('loginId');
    },
  });

  const passwordTargetRef = useGazeTarget({
    id: 'auth-login-password',
    scope: 'MAIN',
    enabled: !isKeyboardOpen && !isLoading,

    onSelect: () => {
      openKeyboardFor('password');
    },
  });

  const loginButtonTargetRef = useGazeTarget({
    id: 'auth-login-submit',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isLoading,

    onSelect: () => {
      void handleLogin();
    },
  });

  const passwordResetTargetRef = useGazeTarget({
    id: 'auth-password-reset',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isLoading,

    onSelect: () => {
      navigate('/reset-password');
    },
  });

  const signupTargetRef = useGazeTarget({
    id: 'auth-signup',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isLoading,

    onSelect: () => {
      navigate('/signup');
    },
  });

  // ==========================================================
  // Keyboard Label
  // ==========================================================

  const keyboardLabel =
    activeField === 'password' ? '비밀번호 입력' : '아이디 입력';

  const keyboardPlaceholder =
    activeField === 'password'
      ? '비밀번호를 입력하세요.'
      : '아이디를 입력하세요.';

  return (
    <div className="login-page">
      <div className="login-content">
        <div className="login-logo">
          <img src={Logo} alt="Look Talk Logo" className="login-logo-image" />
        </div>

        <div className="login-container">
          {/* ===============================================
              아이디

              직접 타이핑하는 input이 아니라
              클릭 또는 시선 dwell 시 가상키보드를 연다.
          =============================================== */}

          <input
            ref={loginIdTargetRef}
            type="text"
            placeholder="아이디를 입력하세요."
            className="login-input"
            value={loginId}
            readOnly
            onClick={() => {
              openKeyboardFor('loginId');
            }}
            autoComplete="username"
            maxLength={50}
            aria-label="아이디 입력"
          />

          {loginIdError && (
            <p className="input-error-message">{loginIdError}</p>
          )}

          {/* ===============================================
              비밀번호
          =============================================== */}

          <input
            ref={passwordTargetRef}
            type="password"
            placeholder="비밀번호를 입력하세요."
            className="login-input"
            value={password}
            readOnly
            onClick={() => {
              openKeyboardFor('password');
            }}
            autoComplete="current-password"
            aria-label="비밀번호 입력"
          />

          {passwordError && (
            <p className="input-error-message">{passwordError}</p>
          )}

          {/* ===============================================
              로그인 오류
          =============================================== */}

          {errorMessage && (
            <p className="login-error-message">{errorMessage}</p>
          )}

          {/* ===============================================
              완료
          =============================================== */}

          <button
            ref={loginButtonTargetRef}
            type="button"
            className="login-button"
            onClick={() => {
              void handleLogin();
            }}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '완료'}
          </button>

          {/* ===============================================
              환자 인증 관련 페이지
          =============================================== */}

          <div className="login-links">
            <Link
              ref={passwordResetTargetRef}
              to="/reset-password"
              className="login-link-button"
            >
              비밀번호 재설정
            </Link>

            <Link
              ref={signupTargetRef}
              to="/signup"
              className="login-link-button"
            >
              회원가입
            </Link>
          </div>
        </div>
      </div>

      {/* ===================================================
          의료진 전용

          의료진 인증 페이지는 환자용 가상키보드/Gaze 입력
          대상이 아니므로 기존 링크 그대로 유지한다.
      =================================================== */}

      <Link to="/staff-login" className="staff-button">
        의료진 전용
      </Link>

      {/* ===================================================
          환자용 전체화면 가상키보드
      =================================================== */}

      {isKeyboardOpen && (
        <FullViewportKeyboardOverlay
          ariaLabel={keyboardLabel}
          draftText={text}
          draftPlaceholder={keyboardPlaceholder}
          errorMessage={null}
          statusMessage={null}
          onClose={handleKeyboardClose}
          closeDisabled={false}
          keyboardState={keyboardState}
          onKeySelect={handleKeySelect}
          keyEnlarged={settings?.keyEnlarged ?? false}
        />
      )}
    </div>
  );
}
