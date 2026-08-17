import './StaffSignupPage.css';
import Logo from '../../assets/Logo.png';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

import {
  confirmSignupEmailVerification,
  sendEmailVerification,
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

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

interface StaffSignupResponse {
  [key: string]: unknown;
}

const API_BASE_URL = 'http://localhost:8080';

const NETWORK_ERROR_MESSAGE =
  '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

export default function StaffSignupPage() {
  const navigate = useNavigate();

  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [verification, setVerification] = useState<EmailVerificationState>(
    INITIAL_EMAIL_VERIFICATION_STATE,
  );

  const [codeSentAtMs, setCodeSentAtMs] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const [signupMessage, setSignupMessage] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);

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

    return () => {
      window.clearInterval(intervalId);
    };
  }, [verification.status, verification.expiresInSeconds, codeSentAtMs]);

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

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = event.target.value;

    setEmail(newEmail);
    setSignupMessage('');
    setVerification((prev) => changeVerificationEmail(prev, newEmail));
  };

  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVerification((prev) => changeVerificationCode(prev, event.target.value));
  };

  const isVerified = canSubmitSignup(verification, email);
  const isPasswordValid = isPasswordLengthValid(password);

  const isComplete =
    loginId.trim() !== '' &&
    email.trim() !== '' &&
    password.trim() !== '' &&
    confirmPassword.trim() !== '' &&
    inviteCode.trim() !== '' &&
    isPasswordValid &&
    password === confirmPassword &&
    isVerified;

  const handleComplete = async () => {
    if (!isComplete || isSigningUp) {
      return;
    }

    try {
      setIsSigningUp(true);
      setSignupMessage('');

      const response = await fetch(`${API_BASE_URL}/api/auth/staff/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loginId: loginId.trim(),
          email: email.trim(),
          password,
          inviteCode: inviteCode.trim(),
        }),
      });

      const result: ApiResponse<StaffSignupResponse> = await response.json();

      if (!response.ok || !result.success) {
        setSignupMessage(result.message || '의료진 회원가입에 실패했습니다.');
        return;
      }

      alert('의료진 회원가입이 완료되었습니다.');
      navigate('/staff-login');
    } catch (error) {
      console.error('의료진 회원가입 API 호출 실패:', error);
      setSignupMessage(NETWORK_ERROR_MESSAGE);
    } finally {
      setIsSigningUp(false);
    }
  };

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

  return (
    <div className="staff-signup-page">
      <div className="staff-signup-wrapper">
        <Link to="/staff-login" className="staff-signup-logo">
          <img
            src={Logo}
            alt="Look Talk Logo"
            className="staff-signup-logo-image"
          />

          <p className="staff-signup-logo-subtitle">의료진 전용</p>
        </Link>

        <div className="staff-signup-container">
          <div className="staff-signup-column">
            <div className="staff-input-group">
              <label>아이디</label>

              <div className="staff-input-with-button">
                <input
                  type="text"
                  placeholder="아이디를 입력하세요."
                  value={loginId}
                  maxLength={50}
                  autoComplete="username"
                  onChange={(event) => {
                    setLoginId(event.target.value);
                    setSignupMessage('');
                  }}
                />

                <div className="staff-button-space"></div>
              </div>
            </div>

            <div className="staff-input-group staff-email-group">
              <label>이메일</label>

              <div className="staff-input-with-button">
                <input
                  type="email"
                  placeholder="이메일을 입력하세요."
                  value={email}
                  autoComplete="email"
                  onChange={handleEmailChange}
                />

                <button
                  type="button"
                  className="staff-sub-button"
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
                <p className="staff-request-message">{emailFieldMessage}</p>
              )}
            </div>

            <div className="staff-input-group staff-auth-group">
              <label>인증번호</label>

              <div className="staff-input-with-button">
                <input
                  type="text"
                  placeholder="인증번호 6자리를 입력하세요."
                  value={verification.code}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={!hasRequestedCode || isVerifying}
                  onChange={handleCodeChange}
                />

                <button
                  type="button"
                  className="staff-sub-button"
                  onClick={() => void handleVerifyCode()}
                  disabled={
                    isVerifying || !canConfirmVerification(verification)
                  }
                >
                  {isVerifying ? '확인 중...' : '인증확인'}
                </button>
              </div>

              {codeFieldMessage && (
                <p
                  className={
                    codeFieldIsSuccess
                      ? 'staff-verify-success'
                      : 'staff-verify-fail'
                  }
                >
                  {codeFieldMessage}
                </p>
              )}
            </div>
          </div>

          <div className="staff-signup-column">
            <div className="staff-input-group">
              <label>비밀번호</label>

              <div className="staff-input-with-button">
                <input
                  type="password"
                  placeholder="비밀번호를 입력하세요."
                  value={password}
                  autoComplete="new-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setSignupMessage('');
                  }}
                />

                <div className="staff-button-space"></div>
              </div>

              {password !== '' && !isPasswordValid && (
                <p className="staff-password-fail">
                  {PASSWORD_LENGTH_ERROR_MESSAGE}
                </p>
              )}
            </div>

            <div className="staff-input-group">
              <label>비밀번호 확인</label>

              <div className="staff-input-with-button">
                <input
                  type="password"
                  placeholder="비밀번호를 입력하세요."
                  value={confirmPassword}
                  autoComplete="new-password"
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setSignupMessage('');
                  }}
                />

                <div className="staff-button-space"></div>
              </div>

              {confirmPassword !== '' && (
                <p
                  className={
                    password === confirmPassword
                      ? 'staff-password-success'
                      : 'staff-password-fail'
                  }
                >
                  {password === confirmPassword
                    ? '비밀번호가 일치합니다.'
                    : '비밀번호가 일치하지 않습니다.'}
                </p>
              )}
            </div>

            <div className="staff-input-group">
              <label>초대 코드</label>

              <div className="staff-input-with-button">
                <input
                  type="text"
                  placeholder="초대 코드를 입력하세요."
                  value={inviteCode}
                  maxLength={50}
                  onChange={(event) => {
                    setInviteCode(event.target.value);
                    setSignupMessage('');
                  }}
                />

                <div className="staff-button-space"></div>
              </div>
            </div>

            {signupMessage && (
              <p className="staff-verify-fail">{signupMessage}</p>
            )}

            <div className="staff-signup-submit">
              <button
                type="button"
                className="staff-signup-button"
                disabled={!isComplete || isSigningUp}
                onClick={() => void handleComplete()}
              >
                {isSigningUp ? '회원가입 중...' : '완료'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
