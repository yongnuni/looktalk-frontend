import './MainPage.css';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../assets/Logo.png';
import { usePageScope } from '../../features/gazeInteraction/usePageScope';
import { useGazeTarget } from '../../features/gazeInteraction/useGazeTarget';
import { ROUTES } from '../../shared/constants/routes';

export default function MainPage() {
  const navigate = useNavigate();

  // Front Step 13 §9 — Chat/Keyboard 등 다른 scope에서 돌아와도 MainPage는 항상 MAIN scope다.
  usePageScope('MAIN');

  // Front Step 12 §25/§27 — 실제 존재하는 메뉴 4개만 Global Gaze Target(MAIN scope)으로
  // 등록한다. onSelect는 각 Link가 이미 쓰는 것과 동일한 목적지로 navigate() — Mouse
  // click(Link 자체 동작)과 Gaze select가 같은 business action(같은 route 이동)을
  // 공유한다(§24). Link는 그대로 두어 기존 키보드/스크린리더 접근성을 보존한다(§37).
  const memoTargetRef = useGazeTarget({
    id: 'main-memo',
    scope: 'MAIN',
    onSelect: () => navigate(ROUTES.MEMO),
  });
  const hospitalChatTargetRef = useGazeTarget({
    id: 'main-chat-hospital',
    scope: 'MAIN',
    onSelect: () => navigate(ROUTES.CHAT_HOSPITAL),
  });
  const friendChatTargetRef = useGazeTarget({
    id: 'main-chat-friend',
    scope: 'MAIN',
    onSelect: () => navigate(ROUTES.CHAT_FRIEND),
  });
  const analysisTargetRef = useGazeTarget({
    id: 'main-analysis',
    scope: 'MAIN',
    onSelect: () => navigate(ROUTES.ANALYSIS),
  });

  return (
    <div className="main-page">
      {/* 로고 */}
      <div className="main-logo">
        <img src={Logo} alt="Look Talk Logo" className="main-logo-image" />
      </div>

      {/* 메뉴 */}
      <div className="main-menu">
        <div className="main-card">
          <Link to="/memo" className="main-button" ref={memoTargetRef}>
            개인 메모장
          </Link>

          <p className="main-description">
            글로 의사를 전달하거나
            <br />
            메모를 작성할 수 있어요!
          </p>
        </div>

        <div className="main-card">
          <Link to="/chat/hospital" className="main-button" ref={hospitalChatTargetRef}>
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
          <Link to="/chat/friend" className="main-button" ref={friendChatTargetRef}>
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
          <Link to="/analysis" className="main-button" ref={analysisTargetRef}>
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
