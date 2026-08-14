import './StaffPasswordResetPage.css';
import Logo from '../../assets/Logo.png';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

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

export default function StaffPasswordResetPage() {
  const navigate = useNavigate();

  // =========================
  // 입력값
  // =========================
  const [email, setEmail] = useState('');
  const [inputCode, setInputCode] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // =========================
  // 이메일 인증 상태
  // =========================
  const [requestMessage, setRequestMessage] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);

  // 인증번호를 요청한 이메일
  const [requestedEmail, setRequestedEmail] = useState('');

  // 인증 성공 후 받은 비밀번호 재설정 토큰
  const [resetToken, setResetToken] = useState('');

  // =========================
  // 요청 상태
  // =========================
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // =========================
  // 비밀번호 재설정 에러 메시지
  // =========================
  const [resetMessage, setResetMessage] = useState('');

  // =========================
  // 이메일 인증번호 요청
  // POST /api/auth/email-verifications
  // =========================
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
      console.error('의료진 비밀번호 재설정 인증번호 요청 실패:', error);

      setRequestMessage(
        '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setIsRequestingCode(false);
    }
  };

  // =========================
  // 인증번호 확인
  // POST /api/auth/email-verifications/confirm
  // =========================
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
      console.error('의료진 비밀번호 재설정 인증번호 확인 실패:', error);

      setVerifySuccess(false);
      setResetToken('');

      setVerifyMessage('서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // =========================
  // 이메일 변경
  // =========================
  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = event.target.value;

    setEmail(newEmail);

    setRequestMessage('');
    setVerifyMessage('');
    setResetMessage('');

    if (requestedEmail && newEmail.trim() !== requestedEmail) {
      setVerifySuccess(false);
      setResetToken('');
    }
  };

  // =========================
  // 완료 버튼 활성화 조건
  // =========================
  const isComplete =
    email.trim() !== '' &&
    inputCode.trim() !== '' &&
    password.trim() !== '' &&
    confirmPassword.trim() !== '' &&
    verifySuccess &&
    resetToken !== '' &&
    email.trim() === requestedEmail &&
    password === confirmPassword;

  // =========================
  // 비밀번호 재설정
  // POST /api/auth/password/reset
  // =========================
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

      navigate('/staff-login');
    } catch (error) {
      console.error('의료진 비밀번호 재설정 API 호출 실패:', error);

      setResetMessage('서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="staff-password-page">
      <div className="staff-password-container">
        <Link to="/staff-login" className="staff-password-logo">
          <img
            src={Logo}
            alt="Look Talk Logo"
            className="staff-password-logo-image"
          />

          <p className="staff-password-logo-subtitle">의료진 전용</p>
        </Link>

        <div className="staff-password-form">
          {/* 이메일 */}
          <div className="staff-input-group">
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
                disabled={isRequestingCode}
              >
                {isRequestingCode ? '요청 중...' : '인증요청'}
              </button>
            </div>

            {requestMessage && (
              <p className="staff-request-message">{requestMessage}</p>
            )}
          </div>

          {/* 인증번호 */}
          <div className="staff-input-group staff-auth-group">
            <label>인증번호</label>

            <div className="staff-input-with-button">
              <input
                type="text"
                placeholder="인증번호를 입력하세요."
                value={inputCode}
                maxLength={6}
                inputMode="numeric"
                onChange={(event) => {
                  setInputCode(event.target.value);
                  setVerifySuccess(false);
                  setResetToken('');
                  setVerifyMessage('');
                }}
              />

              <button
                type="button"
                className="staff-sub-button"
                onClick={() => void handleVerifyCode()}
                disabled={isVerifyingCode}
              >
                {isVerifyingCode ? '확인 중...' : '인증확인'}
              </button>
            </div>

            {verifyMessage && (
              <p
                className={
                  verifySuccess ? 'staff-verify-success' : 'staff-verify-fail'
                }
              >
                {verifyMessage}
              </p>
            )}
          </div>

          {/* 새 비밀번호 */}
          <div className="staff-input-group staff-password-group staff-password-new">
            <label>새 비밀번호</label>

            <div className="staff-input-with-button">
              <input
                type="password"
                placeholder="비밀번호를 입력하세요."
                value={password}
                autoComplete="new-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setResetMessage('');
                }}
              />

              <div className="staff-button-space"></div>
            </div>
          </div>

          {/* 새 비밀번호 확인 */}
          <div className="staff-input-group">
            <label>새 비밀번호 확인</label>

            <div className="staff-input-with-button">
              <input
                type="password"
                placeholder="비밀번호를 입력하세요."
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setResetMessage('');
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

          {/* 비밀번호 재설정 실패 메시지 */}
          {resetMessage && <p className="staff-verify-fail">{resetMessage}</p>}

          {/* 완료 */}
          <div className="staff-password-submit">
            <button
              type="button"
              className="staff-password-button"
              disabled={!isComplete || isResettingPassword}
              onClick={() => void handleComplete()}
            >
              {isResettingPassword ? '변경 중...' : '완료'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
