import './StaffSignupPage.css';
import Logo from '../../assets/Logo.png';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function StaffSignupPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [inputCode, setInputCode] = useState('');

  const [requestMessage, setRequestMessage] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleRequestCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    setAuthCode(code);

    alert(`임시 인증번호 : ${code}`);

    setRequestMessage('인증번호가 발급되었습니다.');
    setVerifyMessage('');
    setVerifySuccess(false);
  };

  const handleVerifyCode = () => {
    if (inputCode === authCode) {
      setVerifySuccess(true);
      setVerifyMessage('인증이 완료되었습니다.');
    } else {
      setVerifySuccess(false);
      setVerifyMessage('인증번호가 일치하지 않습니다.');
    }
  };

  const isComplete =
    name.trim() !== '' &&
    email.trim() !== '' &&
    inputCode.trim() !== '' &&
    password.trim() !== '' &&
    confirmPassword.trim() !== '' &&
    inviteCode.trim() !== '' &&
    verifySuccess &&
    password === confirmPassword;

  const handleComplete = () => {
    if (!isComplete) return;

    // TODO : 의료진 회원가입 API 호출

    navigate('/staff-login');
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
            {/* 이름 */}
            <div className="staff-input-group">
              <label>이름</label>

              <div className="staff-input-with-button">
                <input
                  type="text"
                  placeholder="이름을 입력하세요."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setEmail(e.target.value)}
                />

                <button
                  type="button"
                  className="staff-sub-button"
                  onClick={handleRequestCode}
                >
                  인증요청
                </button>
              </div>

              <p className="staff-request-message">{requestMessage}</p>
            </div>

            {/* 인증번호 */}
            <div className="staff-input-group staff-auth-group">
              <label>인증번호</label>

              <div className="staff-input-with-button">
                <input
                  type="text"
                  placeholder="인증번호를 입력하세요."
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                />

                <button
                  type="button"
                  className="staff-sub-button"
                  onClick={handleVerifyCode}
                >
                  인증확인
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
                  onChange={(e) => setPassword(e.target.value)}
                />

                <div className="staff-button-space"></div>
              </div>
            </div>

            {/* 비밀번호 확인 */}
            <div className="staff-input-group">
              <label>비밀번호 확인</label>

              <div className="staff-input-with-button">
                <input
                  type="password"
                  placeholder="비밀번호를 입력하세요."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  onChange={(e) => setInviteCode(e.target.value)}
                />

                <div className="staff-button-space"></div>
              </div>
            </div>

            {/* 완료 */}
            <div className="staff-signup-submit">
              <button
                type="button"
                className="staff-signup-button"
                disabled={!isComplete}
                onClick={handleComplete}
              >
                완료
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
