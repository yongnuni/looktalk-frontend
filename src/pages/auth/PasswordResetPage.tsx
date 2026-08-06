import './PasswordResetPage.css';
import Logo from '../../assets/Logo.png';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function PasswordResetPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [inputCode, setInputCode] = useState('');

  const [requestMessage, setRequestMessage] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  // 완료 버튼 활성화 조건
  const isComplete =
    email.trim() !== '' &&
    inputCode.trim() !== '' &&
    password.trim() !== '' &&
    confirmPassword.trim() !== '' &&
    verifySuccess &&
    password === confirmPassword;

  const handleComplete = () => {
    if (!isComplete) return;

    // TODO : 비밀번호 변경 API 호출

    navigate('/login');
  };

  return (
    <div className="password-page">
      <Link to="/login" className="password-logo">
        <img src={Logo} alt="Look Talk Logo" className="password-logo-image" />
      </Link>

      <div className="password-container">
        <div className="password-form">
          {/* 이메일 */}
          <div className="input-group">
            <label>이메일</label>

            <div className="input-with-button">
              <input
                type="email"
                placeholder="이메일을 입력하세요."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <button
                type="button"
                className="sub-button"
                onClick={handleRequestCode}
              >
                인증요청
              </button>
            </div>

            <p className="request-message">{requestMessage}</p>
          </div>

          {/* 인증번호 */}
          <div className="input-group auth-group">
            <label>인증번호</label>

            <div className="input-with-button">
              <input
                type="text"
                placeholder="인증번호를 입력하세요."
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
              />

              <button
                type="button"
                className="sub-button"
                onClick={handleVerifyCode}
              >
                인증확인
              </button>
            </div>

            {verifyMessage && (
              <p className={verifySuccess ? 'verify-success' : 'verify-fail'}>
                {verifyMessage}
              </p>
            )}
          </div>

          {/* 새 비밀번호 */}
          <div className="input-group password-group password-new">
            <label>새 비밀번호</label>

            <div className="input-with-button">
              <input
                type="password"
                placeholder="비밀번호를 입력하세요."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="button-space"></div>
            </div>
          </div>

          {/* 새 비밀번호 확인 */}
          <div className="input-group password-group">
            <label>새 비밀번호 확인</label>

            <div className="input-with-button">
              <input
                type="password"
                placeholder="비밀번호를 입력하세요."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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

          <div className="password-submit">
            <button
              type="button"
              className="password-button"
              disabled={!isComplete}
              onClick={handleComplete}
            >
              완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
