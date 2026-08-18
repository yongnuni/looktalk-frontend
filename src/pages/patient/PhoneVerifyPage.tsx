import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

import Logo from '../../assets/Logo.png';
import { AlertModal } from '../../shared/components/modal';
import EmergencyButton from '../../features/emergency/components/EmergencyButton';
import {
  confirmPhoneVerification,
  requestPhoneVerification,
} from '../../features/mypage/api/user';
import { usePatientProfileStore } from '../../shared/stores/patientProfileStore';
import { ROUTES } from '../../shared/constants/routes';

import './PhoneVerifyPage.css';

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (typeof message === 'string' && message) return message;
  }

  return fallback;
}

export default function PhoneVerifyPage() {
  const navigate = useNavigate();
  const verifyPhone = usePatientProfileStore((state) => state.verifyPhone);

  const [phone, setPhone] = useState('');
  const [inputCode, setInputCode] = useState('');

  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [requestMessage, setRequestMessage] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);

  const [showDone, setShowDone] = useState(false);

  const handleRequestCode = async () => {
    const trimmedPhone = phone.trim();

    if (!trimmedPhone || isRequesting) return;

    setIsRequesting(true);
    setVerifyMessage('');
    setVerifySuccess(false);

    try {
      await requestPhoneVerification(trimmedPhone);
      setRequestMessage('인증번호가 발송되었습니다.');
    } catch (error) {
      setRequestMessage(
        getErrorMessage(error, '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmedPhone = phone.trim();
    const trimmedCode = inputCode.trim();

    if (!trimmedPhone || !trimmedCode || isVerifying) return;

    setIsVerifying(true);

    try {
      await confirmPhoneVerification(trimmedPhone, trimmedCode);
      setVerifySuccess(true);
      setVerifyMessage('인증이 완료되었습니다.');
    } catch (error) {
      setVerifySuccess(false);
      setVerifyMessage(getErrorMessage(error, '인증번호가 일치하지 않습니다.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const isComplete =
    phone.trim() !== '' && inputCode.trim() !== '' && verifySuccess;

  const handleComplete = () => {
    if (!isComplete) return;

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
                disabled={isRequesting}
                onClick={() => void handleRequestCode()}
              >
                {isRequesting ? '요청 중...' : '인증요청'}
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
                disabled={isVerifying}
                onClick={() => void handleVerifyCode()}
              >
                {isVerifying ? '확인 중...' : '인증확인'}
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
