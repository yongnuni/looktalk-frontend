import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../../assets/Logo.png';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  /** 로고 클릭 시 이동 경로 */
  logoTo: string;
  /** 제목 오른쪽에 붙는 버튼들 (뒤로가기 / 새 친구 등록하기 등) */
  titleActions?: ReactNode;
  /** 헤더 오른쪽 끝 영역 (비상호출 버튼 / 채팅 버튼 / 설정 아이콘 등) */
  right?: ReactNode;
  /** 헤더 하단 구분선 노출 여부 */
  divider?: boolean;
}

export default function PageHeader({
  title,
  logoTo,
  titleActions,
  right,
  divider = false,
}: PageHeaderProps) {
  return (
    <>
      <header className="page-header-bar">
        <div className="page-header-left">
          <Link to={logoTo} className="page-header-logo-link">
            <img src={Logo} alt="Look Talk" className="page-header-logo" />
          </Link>

          <h1 className="page-header-title">{title}</h1>

          {titleActions && (
            <div className="page-header-title-actions">{titleActions}</div>
          )}
        </div>

        {right && <div className="page-header-right">{right}</div>}
      </header>

      {divider && <div className="page-header-divider" />}
    </>
  );
}
