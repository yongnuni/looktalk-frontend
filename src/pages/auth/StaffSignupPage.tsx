import './StaffSignupPage.css';
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

interface EmailVerificationConfirmResponse {
  verified?: boolean;
}

interface StaffSignupResponse {
  [key: string]: unknown;
}

const API_BASE_URL = 'http://localhost:8080';

export default function StaffSignupPage() {
  const navigate = useNavigate();

  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [inputCode, setInputCode] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [requestMessage, setRequestMessage] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);

  const [requestedEmail, setRequestedEmail] = useState('');

  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  const [signupMessage, setSignupMessage] = useState('');

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
      setInputCode('');
      setSignupMessage('');

      const response = await fetch(
        `${API_BASE_URL}/api/auth/email-verifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: trimmedEmail,
            purpose: 'SIGNUP',
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
      console.error('의료진 이메일 인증번호 요청 실패:', error);

      setRequestMessage(
        '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setIsRequestingCode(false);
    }
  };

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
      setSignupMessage('');

      const response = await fetch(
        `${API_BASE_URL}/api/auth/email-verifications/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: requestedEmail,
            purpose: 'SIGNUP',
            code: trimmedCode,
          }),
        },
      );

      const result: ApiResponse<EmailVerificationConfirmResponse> =
        await response.json();

      if (!response.ok || !result.success) {
        setVerifySuccess(false);

        setVerifyMessage(result.message || '인증번호가 일치하지 않습니다.');

        return;
      }

      setVerifySuccess(true);
      setVerifyMessage('인증이 완료되었습니다.');
    } catch (error) {
      console.error('의료진 이메일 인증번호 확인 실패:', error);

      setVerifySuccess(false);

      setVerifyMessage('서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = event.target.value;

    setEmail(newEmail);

    setRequestMessage('');
    setVerifyMessage('');
    setSignupMessage('');

    if (requestedEmail && newEmail.trim() !== requestedEmail) {
      setVerifySuccess(false);
    }
  };

  const isPasswordValid = password.length >= 8 && password.length <= 64;

  const isComplete =
    loginId.trim() !== '' &&
    email.trim() !== '' &&
    inputCode.trim() !== '' &&
    isPasswordValid &&
    confirmPassword.trim() !== '' &&
    inviteCode.trim() !== '' &&
    verifySuccess &&
    email.trim() === requestedEmail &&
    password === confirmPassword;

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

      setSignupMessage('서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSigningUp(false);
    }
  };

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
          {/* ================= 왼쪽 ================= */}
          <div className="staff-signup-column">
            {/* 아이디 */}
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

            {/* 이메일 */}
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
          </div>

          {/* ================= 오른쪽 ================= */}
          <div className="staff-signup-column">
            {/* 비밀번호 */}
            <div className="staff-input-group">
              <label>비밀번호</label>

              <div className="staff-input-with-button">
                <input
                  type="password"
                  placeholder="비밀번호를 입력하세요."
                  value={password}
                  minLength={8}
                  maxLength={64}
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
                  비밀번호는 8자 이상 64자 이하로 입력해주세요.
                </p>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="staff-input-group">
              <label>비밀번호 확인</label>

              <div className="staff-input-with-button">
                <input
                  type="password"
                  placeholder="비밀번호를 입력하세요."
                  value={confirmPassword}
                  minLength={8}
                  maxLength={64}
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

            {/* 초대 코드 */}
            <div className="staff-input-group">
              <label>초대 코드</label>

              <div className="staff-input-with-button">
                <input
                  type="text"
                  placeholder="초대 코드를 입력하세요."
                  value={inviteCode}
                  onChange={(event) => {
                    setInviteCode(event.target.value);
                    setSignupMessage('');
                  }}
                />

                <div className="staff-button-space"></div>
              </div>
            </div>

            {/* 회원가입 실패 메시지 */}
            {signupMessage && (
              <p className="staff-verify-fail">{signupMessage}</p>
            )}

            {/* 완료 */}
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
