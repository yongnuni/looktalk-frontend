import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './MenuCard.css';

interface MenuCardProps {
  /** 버튼 안 텍스트. 줄바꿈은 <br /> 로 넣어 전달 */
  label: ReactNode;
  /** 라우팅 이동용. onClick 과 동시에 쓰지 않음 */
  to?: string;
  onClick?: () => void;
  /**
   * square : MainPage 의 main-button 과 동일 (280x250 계열)
   * wide   : 같은 형식이되 세로 길이를 줄인 상단 줄 버튼 (445x159 계열)
   */
  variant?: 'square' | 'wide';
  /** 시각적으로는 활성이되 클릭 시 안내 팝업을 띄우는 경우를 위해 disabled 대신 locked 사용 */
  locked?: boolean;
  disabled?: boolean;
}

// Front Step 15 §29/§43 — MyPage/FriendListPage 등에서 useGazeTarget()의 ref callback을
// 이 카드에 직접 붙일 수 있도록 forwardRef로 감싼다(기존 forwardRef 없는 함수 컴포넌트는
// ref를 무시해 gaze target 등록이 불가능했다). label/to/onClick 등 기존 동작은 그대로다.
const MenuCard = forwardRef<HTMLAnchorElement | HTMLButtonElement, MenuCardProps>(function MenuCard(
  { label, to, onClick, variant = 'square', locked = false, disabled = false },
  ref,
) {
  const className = `menu-card menu-card-${variant}${locked ? ' is-locked' : ''}`;

  if (to && !locked && !disabled) {
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} to={to} className={className}>
        <span className="menu-card-label">{label}</span>
      </Link>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="menu-card-label">{label}</span>
    </button>
  );
});

export default MenuCard;
