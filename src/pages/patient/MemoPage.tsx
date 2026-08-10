import './MemoPage.css';
import Logo from '../../assets/Logo.png';
import SosIcon from '../../assets/sos.png';
import SettingIcon from '../../assets/setting.png';
import UpArrow from '../../assets/up_arrow.png';
import DownArrow from '../../assets/down_arrow.png';
import TrashIcon from '../../assets/trash.png';

import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function MemoPage() {
  const [memos, setMemos] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  // 삭제 확인 팝업 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 삭제할 메모의 index
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // ===========================
  // 메모 추가
  // ===========================

  const handleAddMemo = () => {
    if (inputValue.trim() === '') return;

    setMemos((prev) => [...prev, inputValue]);
    setInputValue('');
  };

  // ===========================
  // 삭제 버튼 클릭
  // ===========================

  const handleDeleteClick = (index: number) => {
    setDeleteIndex(index);
    setShowDeleteModal(true);
  };

  // ===========================
  // 삭제 확인
  // ===========================

  const handleConfirmDelete = () => {
    if (deleteIndex === null) return;

    setMemos((prev) => prev.filter((_, index) => index !== deleteIndex));

    setDeleteIndex(null);
    setShowDeleteModal(false);
  };

  // ===========================
  // 삭제 취소
  // ===========================

  const handleCancelDelete = () => {
    setDeleteIndex(null);
    setShowDeleteModal(false);
  };

  // ===========================
  // 위로 스크롤
  // ===========================

  const handleScrollUp = () => {
    const container = document.querySelector('.memo-list') as HTMLDivElement;

    if (container) {
      container.scrollBy({
        top: -180,
        behavior: 'smooth',
      });
    }
  };

  // ===========================
  // 아래로 스크롤
  // ===========================

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
      {/* ===========================
          Header
      =========================== */}

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

      {/* ===========================
          Memo
      =========================== */}

      <div className="memo-content">
        <div className="memo-list">
          {memos.map((memo, index) => (
            <div className="memo-item" key={index}>
              {/* 삭제 버튼 */}

              <button
                className="delete-button"
                onClick={() => handleDeleteClick(index)}
                aria-label="메모 삭제"
              >
                <img src={TrashIcon} alt="삭제" className="trash-icon" />
              </button>

              {/* 메모 내용 */}

              <div className="memo-text">{memo}</div>
            </div>
          ))}
        </div>

        {/* ===========================
            오른쪽 스크롤 버튼
        =========================== */}

        <div className="memo-side-buttons">
          <button className="scroll-button" onClick={handleScrollUp}>
            <img src={UpArrow} alt="위로" className="arrow-icon" />
          </button>

          <button className="scroll-button" onClick={handleScrollDown}>
            <img src={DownArrow} alt="아래로" className="arrow-icon" />
          </button>
        </div>
      </div>

      {/* ===========================
          Bottom
      =========================== */}

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

        <button className="setting-button">
          <img src={SettingIcon} alt="설정" className="setting-icon" />
        </button>
      </div>

      {/* ===========================
          삭제 확인 팝업
      =========================== */}

      {showDeleteModal && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            {/* 질문 */}

            <div className="delete-message">해당 메모를 삭제하시겠습니까?</div>

            {/* 버튼 */}

            <div className="delete-modal-buttons">
              <button
                className="delete-confirm-button"
                onClick={handleConfirmDelete}
              >
                삭제하기
              </button>

              <button
                className="delete-cancel-button"
                onClick={handleCancelDelete}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
