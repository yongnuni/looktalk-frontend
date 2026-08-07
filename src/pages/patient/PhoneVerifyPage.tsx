import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Logo from '../../assets/Logo.png';
import { AlertModal } from '../../shared/components/modal';
import EmergencyButton from '../../features/emergency/components/EmergencyButton';
import { usePatientProfileStore } from '../../shared/stores/patientProfileStore';
import { ROUTES } from '../../shared/constants/routes';

import './PhoneVerifyPage.css';

export default function PhoneVerifyPage() {
  const navigate = useNavigate();
  const verifyPhone = usePatientProfileStore((state) => state.verifyPhone);

  const [phone, setPhone] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [inputCode, setInputCode] = useState('');

  const [requestMessage, setRequestMessage] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);

  const [showDone, setShowDone] = useState(false);

  const handleRequestCode = () => {
    // TODO : 전화번호 인증번호 발송 API 호출
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    setAuthCode(code);
    alert(`임시 인증번호 : ${code}`);

    setRequestMessage('인증번호가 발급되었습니다.');
    setVerifyMessage('');
    setVerifySuccess(false);
  };

  const handleVerifyCode = () => {
    if (inputCode !== '' && inputCode === authCode) {
      setVerifySuccess(true);
      setVerifyMessage('인증이 완료되었습니다.');
    } else {
      setVerifySuccess(false);
      setVerifyMessage('인증번호가 일치하지 않습니다.');
    }
  };

  const isComplete =
    phone.trim() !== '' && inputCode.trim() !== '' && verifySuccess;

  const handleComplete = () => {
    if (!isComplete) return;

    // TODO : 전화번호 연동 완료 API 호출
    verifyPhone(phone.trim());
    setShowDone(true);
  };

  return (
    <div className="phone-page">
      <div className="phone-emergency">
        <EmergencyButton />
      </div>

      <div className="phone-container">
        <Link to={ROUTES.MYPAGE} className="phone-logo">
          <img src={Logo} alt="Look Talk" className="phone-logo-image" />
        </Link>

        <div className="phone-form">
          {/* 전화번호 */}
          <div className="input-group">
            <label htmlFor="phone">전화번호</label>

            <div className="input-with-button">
              <input
                id="phone"
                type="tel"
                placeholder="전화번호를 입력하세요."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
            <label htmlFor="phone-code">인증번호</label>

            <div className="input-with-button">
              <input
                id="phone-code"
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

          <div className="phone-submit">
            <button
              type="button"
              className="phone-button"
              disabled={!isComplete}
              onClick={handleComplete}
            >
              완료
            </button>

            <button
              type="button"
              className="phone-button cancel"
              onClick={() => navigate(ROUTES.MYPAGE)}
            >
              취소
            </button>
          </div>
        </div>
      </div>

      {/* Frame 155 */}
      <AlertModal
        isOpen={showDone}
        message="전화번호가 인증되었습니다."
        onConfirm={() => {
          setShowDone(false);
          navigate(ROUTES.MYPAGE);
        }}
      />
    </div>
  );
}
