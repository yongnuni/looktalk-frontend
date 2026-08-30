import './SignupPage.css';

import Logo from '../../assets/Logo.png';

import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  confirmSignupEmailVerification,
  sendEmailVerification,
  signupPatient,
} from '../../features/auth/api/authApi';

import { mapAuthErrorToMessage } from '../../features/auth/authErrorMessages';

import {
  PASSWORD_LENGTH_ERROR_MESSAGE,
  isPasswordLengthValid,
} from '../../features/auth/passwordPolicy';

import {
  INITIAL_EMAIL_VERIFICATION_STATE,
  canConfirmVerification,
  canSubmitSignup,
  changeVerificationCode,
  changeVerificationEmail,
  confirmVerificationFailed,
  confirmVerificationSucceeded,
  sendVerificationFailed,
  sendVerificationSucceeded,
  startSendingVerification,
  startVerifyingCode,
  verificationExpired,
  type EmailVerificationState,
} from '../../features/auth/emailVerification';

import { useGazeInteraction } from '../../features/gazeInteraction/GazeInteractionContext';
import { usePageScope } from '../../features/gazeInteraction/usePageScope';
import { useGazeTarget } from '../../features/gazeInteraction/useGazeTarget';

import FullViewportKeyboardOverlay from '../../features/keyboard/components/FullViewportKeyboardOverlay';
import { useKeyboardInput } from '../../features/keyboard/hooks/useKeyboardInput';

import { useUserSettings } from '../../features/userSetting/hooks/useUserSettings';

const NETWORK_ERROR_MESSAGE =
  '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// 가상키보드 입력 대상
// ============================================================

type SignupInputField =
  | 'loginId'
  | 'email'
  | 'verificationCode'
  | 'password'
  | 'confirmPassword'
  | null;

export default function SignupPage() {
  const navigate = useNavigate();

  // ==========================================================
  // Gaze / Keyboard
  // ==========================================================

  usePageScope('MAIN');

  const { setActiveScope } = useGazeInteraction();
  const { settings } = useUserSettings();

  const [activeField, setActiveField] = useState<SignupInputField>(null);

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const clearTextRef = useRef<() => void>(() => {});

  // ==========================================================
  // 회원가입 입력값
  // ==========================================================

  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ==========================================================
  // 이메일 인증 상태
  // ==========================================================

  const [verification, setVerification] = useState<EmailVerificationState>(
    INITIAL_EMAIL_VERIFICATION_STATE,
  );

  // 인증번호 만료 카운트다운.
  // Backend가 내려준 expiresInSeconds를 기준으로 계산한다.
  const [codeSentAtMs, setCodeSentAtMs] = useState<number | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // ==========================================================
  // 회원가입 메시지
  // ==========================================================

  const [signupMessage, setSignupMessage] = useState('');

  const [isSigningUp, setIsSigningUp] = useState(false);

  // ==========================================================
  // 인증번호 타이머
  // ==========================================================

  useEffect(() => {
    if (
      verification.status !== 'CODE_SENT' ||
      verification.expiresInSeconds === null ||
      codeSentAtMs === null
    ) {
      setRemainingSeconds(null);
      return;
    }

    const expiresInSeconds = verification.expiresInSeconds;

    const tick = () => {
      const elapsedSeconds = (Date.now() - codeSentAtMs) / 1000;

      const remaining = Math.max(
        0,
        Math.ceil(expiresInSeconds - elapsedSeconds),
      );

      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        setVerification((prev) =>
          prev.status === 'CODE_SENT' ? verificationExpired(prev) : prev,
        );
      }
    };

    tick();

    const intervalId = window.setInterval(tick, 1000);

    return () => window.clearInterval(intervalId);
  }, [verification.status, verification.expiresInSeconds, codeSentAtMs]);

  // ==========================================================
  // Gaze Scope
  // ==========================================================
  //
  // 회원가입 화면:
  // MAIN
  //
  // 가상키보드:
  // KEYBOARD
  //
  // 키보드가 떠 있을 때 뒤쪽 회원가입 버튼/입력창이
  // 시선으로 동시에 선택되지 않도록 scope를 분리한다.
  // ==========================================================

  useEffect(() => {
    setActiveScope(isKeyboardOpen ? 'KEYBOARD' : 'MAIN');
  }, [isKeyboardOpen, setActiveScope]);

  // ==========================================================
  // 이메일 값 적용
  // ==========================================================
  //
  // 기존 handleEmailChange가 하던 동작을 그대로 유지한다.
  //
  // 마지막으로 인증번호를 발송한 이메일과 값이 달라지면
  // 이메일 인증 상태가 초기화된다.
  // ==========================================================

  const applyEmailValue = useCallback((newEmail: string) => {
    setEmail(newEmail);

    setSignupMessage('');

    setVerification((prev) => changeVerificationEmail(prev, newEmail));
  }, []);

  // ==========================================================
  // 인증번호 값 적용
  // ==========================================================

  const applyVerificationCode = useCallback((newCode: string) => {
    const limitedCode = newCode.slice(0, 6);

    setVerification((prev) => changeVerificationCode(prev, limitedCode));

    setSignupMessage('');
  }, []);

  // ==========================================================
  // 가상키보드 열기
  // ==========================================================

  const openKeyboardFor = useCallback(
    (field: Exclude<SignupInputField, null>) => {
      if (isSigningUp) {
        return;
      }

      if (
        field === 'verificationCode' &&
        (!verification.requestedEmail || verification.status === 'VERIFYING')
      ) {
        return;
      }

      clearTextRef.current();

      setSignupMessage('');

      setActiveField(field);

      setIsKeyboardOpen(true);
    },
    [isSigningUp, verification.requestedEmail, verification.status],
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

        setSignupMessage('');
      }

      if (activeField === 'email') {
        applyEmailValue(composedText);
      }

      if (activeField === 'verificationCode') {
        applyVerificationCode(composedText);
      }

      if (activeField === 'password') {
        setPassword(composedText);

        setSignupMessage('');
      }

      if (activeField === 'confirmPassword') {
        setConfirmPassword(composedText);

        setSignupMessage('');
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
  // 이메일 인증번호 요청
  // POST /api/auth/email-verifications
  // ==========================================================

  const handleRequestCode = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setVerification((prev) =>
        sendVerificationFailed(prev, '이메일을 입력해주세요.'),
      );

      return;
    }

    if (verification.status === 'SENDING') {
      return;
    }

    setVerification((prev) => startSendingVerification(prev));

    setSignupMessage('');

    try {
      const result = await sendEmailVerification(trimmedEmail, 'SIGNUP');

      setCodeSentAtMs(Date.now());

      setVerification((prev) =>
        sendVerificationSucceeded(prev, trimmedEmail, result.expiresInSeconds),
      );
    } catch (error) {
      setVerification((prev) =>
        sendVerificationFailed(
          prev,
          mapAuthErrorToMessage(error, NETWORK_ERROR_MESSAGE),
        ),
      );
    }
  };

  // ==========================================================
  // 이메일 인증번호 확인
  // POST /api/auth/email-verifications/confirm
  // ==========================================================

  const handleVerifyCode = async () => {
    if (
      verification.status === 'VERIFYING' ||
      !canConfirmVerification(verification) ||
      !verification.requestedEmail
    ) {
      return;
    }

    const requestedEmail = verification.requestedEmail;

    const code = verification.code;

    setVerification((prev) => startVerifyingCode(prev));

    setSignupMessage('');

    try {
      const result = await confirmSignupEmailVerification(requestedEmail, code);

      // HTTP 200이어도 verified=false면
      // 성공으로 취급하지 않는다.
      if (result.verified) {
        setVerification((prev) =>
          confirmVerificationSucceeded(prev, requestedEmail),
        );
      } else {
        setVerification((prev) =>
          confirmVerificationFailed(prev, '인증번호가 올바르지 않습니다.'),
        );
      }
    } catch (error) {
      setVerification((prev) =>
        confirmVerificationFailed(
          prev,
          mapAuthErrorToMessage(error, NETWORK_ERROR_MESSAGE),
        ),
      );
    }
  };

  // ==========================================================
  // 회원가입 가능 여부
  // ==========================================================

  const isVerified = canSubmitSignup(verification, email);

  const isPasswordValid = isPasswordLengthValid(password);

  const isComplete =
    loginId.trim() !== '' &&
    email.trim() !== '' &&
    password.trim() !== '' &&
    confirmPassword.trim() !== '' &&
    isPasswordValid &&
    password === confirmPassword &&
    isVerified;

  // ==========================================================
  // 환자 회원가입
  // POST /api/auth/patients/signup
  // ==========================================================

  const handleComplete = async () => {
    if (!isComplete || isSigningUp) {
      return;
    }

    try {
      setIsSigningUp(true);

      setSignupMessage('');

      await signupPatient({
        loginId: loginId.trim(),
        email: email.trim(),
        password,
      });

      alert('회원가입이 완료되었습니다.');

      navigate('/login');
    } catch (error) {
      setSignupMessage(mapAuthErrorToMessage(error, NETWORK_ERROR_MESSAGE));
    } finally {
      setIsSigningUp(false);
    }
  };

  // ==========================================================
  // 화면 표시용 파생 텍스트
  // ==========================================================

  const isSending = verification.status === 'SENDING';

  const isVerifying = verification.status === 'VERIFYING';

  const hasRequestedCode = verification.requestedEmail !== null;

  let emailFieldMessage = '';

  if (isSending) {
    emailFieldMessage = '인증번호를 발송하는 중입니다...';
  } else if (
    verification.status === 'ERROR' &&
    verification.requestedEmail === null
  ) {
    emailFieldMessage = verification.errorMessage ?? '';
  } else if (hasRequestedCode) {
    emailFieldMessage =
      remainingSeconds !== null && remainingSeconds > 0
        ? `인증번호가 발송되었습니다. (남은 시간 ${formatTimer(
            remainingSeconds,
          )})`
        : '인증번호가 발송되었습니다.';
  }

  const codeFieldIsSuccess = verification.status === 'VERIFIED';

  let codeFieldMessage = '';

  if (codeFieldIsSuccess) {
    codeFieldMessage = '인증이 완료되었습니다.';
  } else if (
    verification.status === 'ERROR' &&
    verification.requestedEmail !== null
  ) {
    codeFieldMessage = verification.errorMessage ?? '';
  }

  // ==========================================================
  // Gaze Targets
  // ==========================================================
  //
  // 입력창:
  // 시선 dwell → 가상키보드
  //
  // 버튼:
  // 시선 dwell → 기존 action 실행
  // ==========================================================

  const logoTargetRef = useGazeTarget({
    id: 'signup-logo',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isSigningUp,

    onSelect: () => {
      navigate('/login');
    },
  });

  const loginIdTargetRef = useGazeTarget({
    id: 'signup-login-id',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isSigningUp,

    onSelect: () => {
      openKeyboardFor('loginId');
    },
  });

  const emailTargetRef = useGazeTarget({
    id: 'signup-email',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isSigningUp,

    onSelect: () => {
      openKeyboardFor('email');
    },
  });

  const requestCodeTargetRef = useGazeTarget({
    id: 'signup-email-request',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isSigningUp && !isSending,

    onSelect: () => {
      void handleRequestCode();
    },
  });

  const verificationCodeTargetRef = useGazeTarget({
    id: 'signup-verification-code',
    scope: 'MAIN',

    enabled:
      !isKeyboardOpen && !isSigningUp && hasRequestedCode && !isVerifying,

    onSelect: () => {
      openKeyboardFor('verificationCode');
    },
  });

  const verifyCodeTargetRef = useGazeTarget({
    id: 'signup-verification-confirm',
    scope: 'MAIN',

    enabled:
      !isKeyboardOpen &&
      !isSigningUp &&
      !isVerifying &&
      canConfirmVerification(verification),

    onSelect: () => {
      void handleVerifyCode();
    },
  });

  const passwordTargetRef = useGazeTarget({
    id: 'signup-password',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isSigningUp,

    onSelect: () => {
      openKeyboardFor('password');
    },
  });

  const confirmPasswordTargetRef = useGazeTarget({
    id: 'signup-confirm-password',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isSigningUp,

    onSelect: () => {
      openKeyboardFor('confirmPassword');
    },
  });

  const completeTargetRef = useGazeTarget({
    id: 'signup-complete',
    scope: 'MAIN',

    enabled: !isKeyboardOpen && !isSigningUp && isComplete,

    onSelect: () => {
      void handleComplete();
    },
  });

  // ==========================================================
  // Keyboard 표시 문구
  // ==========================================================

  let keyboardLabel = '회원가입 정보 입력';

  let keyboardPlaceholder = '내용을 입력하세요.';

  if (activeField === 'loginId') {
    keyboardLabel = '아이디 입력';

    keyboardPlaceholder = '아이디를 입력하세요.';
  }

  if (activeField === 'email') {
    keyboardLabel = '이메일 입력';

    keyboardPlaceholder = '이메일을 입력하세요.';
  }

  if (activeField === 'verificationCode') {
    keyboardLabel = '인증번호 입력';

    keyboardPlaceholder = '인증번호 6자리를 입력하세요.';
  }

  if (activeField === 'password') {
    keyboardLabel = '비밀번호 입력';

    keyboardPlaceholder = '비밀번호를 입력하세요.';
  }

  if (activeField === 'confirmPassword') {
    keyboardLabel = '비밀번호 확인';

    keyboardPlaceholder = '비밀번호를 다시 입력하세요.';
  }

  return (
    <div className="signup-page">
      {/* ===================================================
          Logo
      =================================================== */}

      <Link ref={logoTargetRef} to="/login" className="signup-logo">
        <img src={Logo} alt="Look Talk Logo" className="signup-logo-image" />
      </Link>

      <div className="signup-container">
        {/* =================================================
            왼쪽
        ================================================= */}

        <div className="signup-column">
          {/* ================= 아이디 ================= */}

          <div className="input-group">
            <label>아이디</label>

            <div className="input-with-button">
              <input
                ref={loginIdTargetRef}
                type="text"
                placeholder="아이디를 입력하세요."
                value={loginId}
                maxLength={50}
                autoComplete="username"
                readOnly
                aria-label="아이디 입력"
                onClick={() => {
                  openKeyboardFor('loginId');
                }}
              />

              <div className="button-space"></div>
            </div>
          </div>

          {/* ================= 이메일 ================= */}

          <div className="input-group email-group">
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
                disabled={isSending}
              >
                {isSending
                  ? '발송 중...'
                  : hasRequestedCode
                    ? '재전송'
                    : '인증요청'}
              </button>
            </div>

            {emailFieldMessage && (
              <p className="request-message">{emailFieldMessage}</p>
            )}
          </div>

          {/* ================= 인증번호 ================= */}

          <div className="input-group auth-group">
            <label>인증번호</label>

            <div className="input-with-button">
              <input
                ref={verificationCodeTargetRef}
                type="text"
                placeholder="인증번호 6자리를 입력하세요."
                value={verification.code}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={!hasRequestedCode || isVerifying}
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
                disabled={isVerifying || !canConfirmVerification(verification)}
              >
                {isVerifying ? '확인 중...' : '인증확인'}
              </button>
            </div>

            {codeFieldMessage && (
              <p
                className={
                  codeFieldIsSuccess ? 'verify-success' : 'verify-fail'
                }
              >
                {codeFieldMessage}
              </p>
            )}
          </div>
        </div>

        {/* =================================================
            오른쪽
        ================================================= */}

        <div className="signup-column">
          {/* ================= 비밀번호 ================= */}

          <div className="input-group">
            <label>비밀번호</label>

            <div className="input-with-button">
              <input
                ref={passwordTargetRef}
                type="password"
                placeholder="비밀번호를 입력하세요."
                value={password}
                autoComplete="new-password"
                readOnly
                aria-label="비밀번호 입력"
                onClick={() => {
                  openKeyboardFor('password');
                }}
              />

              <div className="button-space"></div>
            </div>

            {password !== '' && !isPasswordValid && (
              <p className="password-fail">{PASSWORD_LENGTH_ERROR_MESSAGE}</p>
            )}
          </div>

          {/* ================= 비밀번호 확인 ================= */}

          <div className="input-group">
            <label>비밀번호 확인</label>

            <div className="input-with-button">
              <input
                ref={confirmPasswordTargetRef}
                type="password"
                placeholder="비밀번호를 입력하세요."
                value={confirmPassword}
                autoComplete="new-password"
                readOnly
                aria-label="비밀번호 확인 입력"
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

          {/* ================= 회원가입 실패 메시지 ================= */}

          {signupMessage && <p className="verify-fail">{signupMessage}</p>}

          {/* ================= 완료 ================= */}

          <div className="signup-submit">
            <button
              ref={completeTargetRef}
              type="button"
              className="signup-button"
              disabled={!isComplete || isSigningUp}
              onClick={() => void handleComplete()}
            >
              {isSigningUp ? '회원가입 중...' : '완료'}
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
