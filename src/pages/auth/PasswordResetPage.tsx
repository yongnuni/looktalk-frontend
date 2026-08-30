import './PasswordResetPage.css';

import Logo from '../../assets/Logo.png';

import { Link, useNavigate } from 'react-router-dom';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useGazeInteraction } from '../../features/gazeInteraction/GazeInteractionContext';
import { usePageScope } from '../../features/gazeInteraction/usePageScope';
import { useGazeTarget } from '../../features/gazeInteraction/useGazeTarget';

import FullViewportKeyboardOverlay from '../../features/keyboard/components/FullViewportKeyboardOverlay';
import { useKeyboardInput } from '../../features/keyboard/hooks/useKeyboardInput';

import { useUserSettings } from '../../features/userSetting/hooks/useUserSettings';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

interface EmailVerificationResponse {
  [key: string]: unknown;
}

interface PasswordResetVerificationResponse {
  resetToken?: string;
}

const API_BASE_URL = 'http://localhost:8080';

// ============================================================
// 가상키보드 입력 대상
// ============================================================

type PasswordResetInputField =
  | 'email'
  | 'verificationCode'
  | 'password'
  | 'confirmPassword'
  | null;

export default function PasswordResetPage() {
  const navigate = useNavigate();

  // ==========================================================
  // Gaze / Keyboard
  // ==========================================================

  usePageScope('MAIN');

  const { setActiveScope } = useGazeInteraction();
  const { settings } = useUserSettings();

  const [activeField, setActiveField] = useState<PasswordResetInputField>(null);

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const clearTextRef = useRef<() => void>(() => {});

  // ==========================================================
  // 입력값
  // ==========================================================

  const [email, setEmail] = useState('');
  const [inputCode, setInputCode] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ==========================================================
  // 이메일 인증 상태
  // ==========================================================

  const [requestMessage, setRequestMessage] = useState('');

  const [verifyMessage, setVerifyMessage] = useState('');

  const [verifySuccess, setVerifySuccess] = useState(false);

  // 인증번호 요청한 이메일
  const [requestedEmail, setRequestedEmail] = useState('');

  // 인증 성공 후 백엔드에서 받은 resetToken
  const [resetToken, setResetToken] = useState('');

  // ==========================================================
  // Loading 상태
  // ==========================================================

  const [isRequestingCode, setIsRequestingCode] = useState(false);

  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // ==========================================================
  // 비밀번호 변경 메시지
  // ==========================================================

  const [resetMessage, setResetMessage] = useState('');

  // ==========================================================
  // Gaze Scope
  // ==========================================================

  useEffect(() => {
    setActiveScope(isKeyboardOpen ? 'KEYBOARD' : 'MAIN');
  }, [isKeyboardOpen, setActiveScope]);

  // ==========================================================
  // 이메일 값 적용
  // ==========================================================

  const applyEmailValue = useCallback(
    (newEmail: string) => {
      setEmail(newEmail);

      setRequestMessage('');
      setVerifyMessage('');
      setResetMessage('');

      if (requestedEmail && newEmail.trim() !== requestedEmail) {
        setVerifySuccess(false);
        setResetToken('');
      }
    },
    [requestedEmail],
  );

  // ==========================================================
  // 인증번호 값 적용
  // ==========================================================

  const applyVerificationCode = useCallback((newCode: string) => {
    setInputCode(newCode.slice(0, 6));

    setVerifySuccess(false);
    setResetToken('');
    setVerifyMessage('');
    setResetMessage('');
  }, []);

  // ==========================================================
  // 가상키보드 열기
  // ==========================================================

  const openKeyboardFor = useCallback(
    (field: Exclude<PasswordResetInputField, null>) => {
      if (isResettingPassword || isRequestingCode || isVerifyingCode) {
        return;
      }

      if (field === 'verificationCode' && !requestedEmail) {
        return;
      }

      clearTextRef.current();

      setRequestMessage('');
      setVerifyMessage('');
      setResetMessage('');

      setActiveField(field);
      setIsKeyboardOpen(true);
    },
    [isResettingPassword, isRequestingCode, isVerifyingCode, requestedEmail],
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

      if (activeField === 'email') {
        applyEmailValue(composedText);
      }

      if (activeField === 'verificationCode') {
        applyVerificationCode(composedText);
      }

      if (activeField === 'password') {
        setPassword(composedText);

        setResetMessage('');
      }

      if (activeField === 'confirmPassword') {
        setConfirmPassword(composedText);

        setResetMessage('');
      }

      clearTextRef.current();

      setActiveField(null);
      setIsKeyboardOpen(false);
    },
    [activeField, applyEmailValue, applyVerificationCode],
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
  // 인증번호 요청
  // POST /api/auth/email-verifications
  // ==========================================================

  const handleRequestCode = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setRequestMessage('이메일을 입력해주세요.');

      return;
    }

    try {
      setIsRequestingCode(true);

      setRequestMessage('');
      setVerifyMessage('');
      setVerifySuccess(false);
      setRequestedEmail('');
      setResetToken('');
      setInputCode('');
      setResetMessage('');

      const response = await fetch(
        `${API_BASE_URL}/api/auth/email-verifications`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email: trimmedEmail,
            purpose: 'PASSWORD_RESET',
          }),
        },
      );

      const result: ApiResponse<EmailVerificationResponse> =
        await response.json();

      if (!response.ok || !result.success) {
        setRequestMessage(
          result.message || '인증번호 발송 요청에 실패했습니다.',
        );

        return;
      }

      setRequestedEmail(trimmedEmail);

      setRequestMessage('인증번호 발송 요청이 완료되었습니다.');
    } catch (error) {
      console.error('비밀번호 재설정 인증번호 요청 실패:', error);

      setRequestMessage(
        '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setIsRequestingCode(false);
    }
  };

  // ==========================================================
  // 인증번호 확인
  // POST /api/auth/email-verifications/confirm
  // ==========================================================

  const handleVerifyCode = async () => {
    const trimmedCode = inputCode.trim();

    if (!requestedEmail) {
      setVerifySuccess(false);

      setVerifyMessage('먼저 인증번호를 요청해주세요.');

      return;
    }

    if (!trimmedCode) {
      setVerifySuccess(false);

      setVerifyMessage('인증번호를 입력해주세요.');

      return;
    }

    if (email.trim() !== requestedEmail) {
      setVerifySuccess(false);

      setVerifyMessage(
        '이메일이 변경되었습니다. 인증번호를 다시 요청해주세요.',
      );

      return;
    }

    try {
      setIsVerifyingCode(true);

      setVerifyMessage('');
      setResetMessage('');

      const response = await fetch(
        `${API_BASE_URL}/api/auth/email-verifications/confirm`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email: requestedEmail,

            purpose: 'PASSWORD_RESET',

            code: trimmedCode,
          }),
        },
      );

      const result: ApiResponse<PasswordResetVerificationResponse> =
        await response.json();

      if (!response.ok || !result.success || !result.data?.resetToken) {
        setVerifySuccess(false);

        setResetToken('');

        setVerifyMessage(result.message || '인증번호가 일치하지 않습니다.');

        return;
      }

      setResetToken(result.data.resetToken);

      setVerifySuccess(true);

      setVerifyMessage('인증이 완료되었습니다.');
    } catch (error) {
      console.error('비밀번호 재설정 인증번호 확인 실패:', error);

      setVerifySuccess(false);

      setResetToken('');

      setVerifyMessage('서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // ==========================================================
  // 완료 버튼 활성화 조건
  // ==========================================================

  const isComplete =
    email.trim() !== '' &&
    inputCode.trim() !== '' &&
    password.trim() !== '' &&
    confirmPassword.trim() !== '' &&
    verifySuccess &&
    resetToken !== '' &&
    email.trim() === requestedEmail &&
    password === confirmPassword;

  // ==========================================================
  // 비밀번호 재설정
  // POST /api/auth/password/reset
  // ==========================================================

  const handleComplete = async () => {
    if (!isComplete || isResettingPassword) {
      return;
    }

    try {
      setIsResettingPassword(true);

      setResetMessage('');

      const response = await fetch(`${API_BASE_URL}/api/auth/password/reset`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          resetToken,

          newPassword: password,
        }),
      });

      const result: ApiResponse<null> = await response.json();

      if (!response.ok || !result.success) {
        setResetMessage(result.message || '비밀번호 재설정에 실패했습니다.');

        return;
      }

      alert('비밀번호가 재설정되었습니다.');

      navigate('/login');
    } catch (error) {
      console.error('비밀번호 재설정 API 호출 실패:', error);

      setResetMessage('서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // ==========================================================
  // Gaze Targets
  // ==========================================================

  const logoTargetRef = useGazeTarget({
    id: 'password-reset-logo',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isResettingPassword,

    onSelect: () => {
      navigate('/login');
    },
  });

  const emailTargetRef = useGazeTarget({
    id: 'password-reset-email',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isResettingPassword,

    onSelect: () => {
      openKeyboardFor('email');
    },
  });

  const requestCodeTargetRef = useGazeTarget({
    id: 'password-reset-request-code',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isResettingPassword && !isRequestingCode,

    onSelect: () => {
      void handleRequestCode();
    },
  });

  const codeTargetRef = useGazeTarget({
    id: 'password-reset-code',
    scope: 'MAIN',

    enabled:
      !isKeyboardOpen &&
      !isResettingPassword &&
      !isVerifyingCode &&
      Boolean(requestedEmail),

    onSelect: () => {
      openKeyboardFor('verificationCode');
    },
  });

  const verifyCodeTargetRef = useGazeTarget({
    id: 'password-reset-verify-code',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isResettingPassword && !isVerifyingCode,

    onSelect: () => {
      void handleVerifyCode();
    },
  });

  const passwordTargetRef = useGazeTarget({
    id: 'password-reset-new-password',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isResettingPassword,

    onSelect: () => {
      openKeyboardFor('password');
    },
  });

  const confirmPasswordTargetRef = useGazeTarget({
    id: 'password-reset-confirm-password',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isResettingPassword,

    onSelect: () => {
      openKeyboardFor('confirmPassword');
    },
  });

  const completeTargetRef = useGazeTarget({
    id: 'password-reset-complete',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isResettingPassword && isComplete,

    onSelect: () => {
      void handleComplete();
    },
  });

  // ==========================================================
  // Keyboard 표시 문구
  // ==========================================================

  let keyboardLabel = '비밀번호 재설정 입력';

  let keyboardPlaceholder = '내용을 입력하세요.';

  if (activeField === 'email') {
    keyboardLabel = '이메일 입력';

    keyboardPlaceholder = '이메일을 입력하세요.';
  }

  if (activeField === 'verificationCode') {
    keyboardLabel = '인증번호 입력';

    keyboardPlaceholder = '인증번호를 입력하세요.';
  }

  if (activeField === 'password') {
    keyboardLabel = '새 비밀번호 입력';

    keyboardPlaceholder = '새 비밀번호를 입력하세요.';
  }

  if (activeField === 'confirmPassword') {
    keyboardLabel = '새 비밀번호 확인';

    keyboardPlaceholder = '새 비밀번호를 다시 입력하세요.';
  }

  return (
    <div className="password-page">
      {/* ===================================================
          Logo
      =================================================== */}

      <Link ref={logoTargetRef} to="/login" className="password-logo">
        <img src={Logo} alt="Look Talk Logo" className="password-logo-image" />
      </Link>

      <div className="password-container">
        <div className="password-form">
          {/* ================= 이메일 ================= */}

          <div className="input-group">
            <label>이메일</label>

            <div className="input-with-button">
              <input
                ref={emailTargetRef}
                type="email"
                placeholder="이메일을 입력하세요."
                value={email}
                autoComplete="email"
                readOnly
                aria-label="이메일 입력"
                onClick={() => {
                  openKeyboardFor('email');
                }}
              />

              <button
                ref={requestCodeTargetRef}
                type="button"
                className="sub-button"
                onClick={() => void handleRequestCode()}
                disabled={isRequestingCode}
              >
                {isRequestingCode ? '요청 중...' : '인증요청'}
              </button>
            </div>

            {requestMessage && (
              <p className="request-message">{requestMessage}</p>
            )}
          </div>

          {/* ================= 인증번호 ================= */}

          <div className="input-group auth-group">
            <label>인증번호</label>

            <div className="input-with-button">
              <input
                ref={codeTargetRef}
                type="text"
                placeholder="인증번호를 입력하세요."
                value={inputCode}
                maxLength={6}
                inputMode="numeric"
                readOnly
                aria-label="인증번호 입력"
                onClick={() => {
                  openKeyboardFor('verificationCode');
                }}
              />

              <button
                ref={verifyCodeTargetRef}
                type="button"
                className="sub-button"
                onClick={() => void handleVerifyCode()}
                disabled={isVerifyingCode}
              >
                {isVerifyingCode ? '확인 중...' : '인증확인'}
              </button>
            </div>

            {verifyMessage && (
              <p className={verifySuccess ? 'verify-success' : 'verify-fail'}>
                {verifyMessage}
              </p>
            )}
          </div>

          {/* ================= 새 비밀번호 ================= */}

          <div className="input-group password-group password-new">
            <label>새 비밀번호</label>

            <div className="input-with-button">
              <input
                ref={passwordTargetRef}
                type="password"
                placeholder="비밀번호를 입력하세요."
                value={password}
                autoComplete="new-password"
                readOnly
                aria-label="새 비밀번호 입력"
                onClick={() => {
                  openKeyboardFor('password');
                }}
              />

              <div className="button-space"></div>
            </div>
          </div>

          {/* ================= 새 비밀번호 확인 ================= */}

          <div className="input-group password-group">
            <label>새 비밀번호 확인</label>

            <div className="input-with-button">
              <input
                ref={confirmPasswordTargetRef}
                type="password"
                placeholder="비밀번호를 입력하세요."
                value={confirmPassword}
                autoComplete="new-password"
                readOnly
                aria-label="새 비밀번호 확인 입력"
                onClick={() => {
                  openKeyboardFor('confirmPassword');
                }}
              />

              <div className="button-space"></div>
            </div>

            {confirmPassword !== '' && (
              <p
                className={
                  password === confirmPassword
                    ? 'password-success'
                    : 'password-fail'
                }
              >
                {password === confirmPassword
                  ? '비밀번호가 일치합니다.'
                  : '비밀번호가 일치하지 않습니다.'}
              </p>
            )}
          </div>

          {/* ================= 비밀번호 재설정 실패 메시지 ================= */}

          {resetMessage && <p className="verify-fail">{resetMessage}</p>}

          {/* ================= 완료 ================= */}

          <div className="password-submit">
            <button
              ref={completeTargetRef}
              type="button"
              className="password-button"
              disabled={!isComplete || isResettingPassword}
              onClick={() => void handleComplete()}
            >
              {isResettingPassword ? '변경 중...' : '완료'}
            </button>
          </div>
        </div>
      </div>

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
