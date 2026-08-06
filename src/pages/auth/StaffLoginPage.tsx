import './StaffLoginPage.css';
import { Link } from 'react-router-dom';
import Logo from '../../assets/Logo.png';

export default function StaffLoginPage() {
  return (
    <div className="staff-login-page">
      <div className="staff-login-content">
        <div className="staff-login-logo">
          <img
            src={Logo}
            alt="Look Talk Logo"
            className="staff-login-logo-image"
          />

          <p className="staff-login-logo-subtitle">의료진 전용</p>
        </div>

        <div className="staff-login-container">
          <input
            type="text"
            placeholder="아이디를 입력하세요."
            className="staff-login-input"
          />

          <input
            type="password"
            placeholder="비밀번호를 입력하세요."
            className="staff-login-input"
          />

          <button className="staff-login-button">완료</button>

          <div className="staff-login-links">
            <Link
              to="/staff-reset-password"
              className="staff-login-link-button"
            >
              비밀번호 재설정
            </Link>

            <span className="staff-login-divider">|</span>

            <Link to="/staff-signup" className="staff-login-link-button">
              회원가입
            </Link>
          </div>
        </div>
      </div>

      <Link to="/login" className="staff-switch-button">
        환자 전용
      </Link>
    </div>
  );
}
