import './MainPage.css';
import { Link } from 'react-router-dom';
import Logo from '../../assets/Logo.png';

export default function MainPage() {
  return (
    <div className="main-page">
      {/* 로고 */}
      <div className="main-logo">
        <img src={Logo} alt="Look Talk Logo" className="main-logo-image" />
      </div>

      {/* 메뉴 */}
      <div className="main-menu">
        <div className="main-card">
          <Link to="/memo" className="main-button">
            개인 메모장
          </Link>

          <p className="main-description">
            글로 의사를 전달하거나
            <br />
            메모를 작성할 수 있어요!
          </p>
        </div>

        <div className="main-card">
          <Link to="/chat/hospital" className="main-button">
            병원 채팅으로
            <br />
            이동하기
          </Link>

          <p className="main-description">
            병원 커뮤니티에서
            <br />
            소통해보세요!
          </p>
        </div>

        <div className="main-card">
          <Link to="/chat/friend" className="main-button">
            친구 채팅으로
            <br />
            이동하기
          </Link>

          <p className="main-description">
            전화번호 인증 후
            <br />
            지인과 대화해보세요!
          </p>
        </div>

        <div className="main-card">
          <Link to="/analysis" className="main-button">
            분석페이지로
            <br />
            이동하기
          </Link>

          <p className="main-description">
            사용 결과 및 분석 정보를
            <br />
            확인할 수 있어요!
          </p>
        </div>
      </div>
    </div>
  );
}
