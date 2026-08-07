import './MemoPage.css';
import Logo from '../../assets/Logo.png';
import SosIcon from '../../assets/sos.png';
import SettingIcon from '../../assets/setting.png';
import UpArrow from '../../assets/up_arrow.png';
import DownArrow from '../../assets/down_arrow.png';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ROUTES } from '../../shared/constants/routes';

export default function MemoPage() {
  const [memos, setMemos] = useState<string[]>([]);

  const [inputValue, setInputValue] = useState('');

  const handleAddMemo = () => {
    if (inputValue.trim() === '') return;

    setMemos((prev) => [...prev, inputValue]);
    setInputValue('');
  };

  const handleScrollUp = () => {
    const container = document.querySelector('.memo-list') as HTMLDivElement;

    if (container) {
      container.scrollBy({
        top: -180,
        behavior: 'smooth',
      });
    }
  };

  const handleScrollDown = () => {
    const container = document.querySelector('.memo-list') as HTMLDivElement;

    if (container) {
      container.scrollBy({
        top: 180,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="memo-page">
      {/* Header */}

      <header className="memo-header">
        <div className="memo-header-left">
          <Link to="/main" className="memo-logo-link">
            <img src={Logo} alt="Look Talk" className="memo-logo" />
          </Link>

          <h1 className="memo-title">개인 메모장</h1>
        </div>

        <button className="emergency-button">
          <img src={SosIcon} alt="SOS" className="emergency-icon" />
        </button>
      </header>

      <div className="memo-divider"></div>

      {/* Memo */}

      <div className="memo-content">
        <div className="memo-list">
          {memos.map((memo, index) => (
            <div className="memo-item" key={index}>
              {memo}
            </div>
          ))}
        </div>

        {/* 오른쪽 버튼 */}

        <div className="memo-side-buttons">
          <button className="scroll-button" onClick={handleScrollUp}>
            <img src={UpArrow} alt="위로" className="arrow-icon" />
          </button>

          <button className="scroll-button" onClick={handleScrollDown}>
            <img src={DownArrow} alt="아래로" className="arrow-icon" />
          </button>
        </div>
      </div>

      {/* Bottom */}

      <div className="memo-bottom">
        <input
          className="memo-input"
          placeholder="메모를 입력하세요."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />

        <button className="keyboard-button" onClick={handleAddMemo}>
          가상 키보드로 입력하기
        </button>

        <Link
          to={ROUTES.MYPAGE}
          className="setting-button"
          aria-label="마이페이지"
        >
          <img src={SettingIcon} alt="설정" className="setting-icon" />
        </Link>
      </div>
    </div>
  );
}
