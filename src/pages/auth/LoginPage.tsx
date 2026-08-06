import './LoginPage.css';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../assets/Logo.png';

export default function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = () => {
    // TODO : 로그인 API 호출

    navigate('/main');
  };

  return (
    <div className="login-page">
      <div className="login-content">
        <div className="login-logo">
          <img src={Logo} alt="Look Talk Logo" className="login-logo-image" />
        </div>

        <div className="login-container">
          <input
            type="text"
            placeholder="아이디를 입력하세요."
            className="login-input"
          />

          <input
            type="password"
            placeholder="비밀번호를 입력하세요."
            className="login-input"
          />

          <button className="login-button" onClick={handleLogin}>
            완료
          </button>

          <div className="login-links">
            <Link to="/reset-password" className="login-link-button">
              비밀번호 재설정
            </Link>

            <Link to="/signup" className="login-link-button">
              회원가입
            </Link>
          </div>
        </div>
      </div>

      <Link to="/staff-login" className="staff-button">
        의료진 전용
      </Link>
    </div>
  );
}
