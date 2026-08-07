import { Link } from 'react-router-dom';
import SettingIcon from '../../../assets/setting.png';
import { ROUTES } from '../../constants/routes';

interface StaffHeaderActionsProps {
  /** 마이페이지 이동용 설정 아이콘 노출 여부 (마이페이지 자신에서는 숨김) */
  showSetting?: boolean;
}

/** 의료진 화면 헤더 우측 공통 영역 : 채팅 버튼 + 설정 아이콘 */
export default function StaffHeaderActions({
  showSetting = true,
}: StaffHeaderActionsProps) {
  return (
    <>
      <Link to={ROUTES.STAFF_CHAT} className="header-pill-button outline">
        채팅
      </Link>

      {showSetting && (
        <Link
          to={ROUTES.STAFF_MYPAGE}
          className="header-icon-button"
          aria-label="마이페이지"
        >
          <img src={SettingIcon} alt="" />
        </Link>
      )}
    </>
  );
}
