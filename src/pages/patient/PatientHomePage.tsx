import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createOrGetHospitalChatRoom } from '../../features/chat/api/chatRooms';
import HospitalChatContactSearch from '../../features/chat/components/HospitalChatContactSearch';
import VirtualKeyboard from '../../features/keyboard/components/VirtualKeyboard';
import { useInputStore } from '../../shared/stores/inputStore';

export default function PatientHomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const text = useInputStore((state) => state.text);
  const pressKey = useInputStore((state) => state.pressKey);
  const clearText = useInputStore((state) => state.clearText);
  const [hospitalSearchKeyword, setHospitalSearchKeyword] = useState<string | null>(null);
  const [hospitalSearchPage, setHospitalSearchPage] = useState(0);
  const [hospitalSearchRequestId, setHospitalSearchRequestId] = useState(0);
  const isHospitalSearch = searchParams.get('source') === 'hospital-search';

  const handleSend = () => {
    if (!text.trim()) {
      alert('전송할 문장이 없습니다.');
      return;
    }

    alert(`전송할 문장: ${text}`);
    clearText();
  };

  const handleHospitalContactSearch = () => {
    const keyword = text.trim();

    if (!keyword) return;

    setHospitalSearchKeyword(keyword);
    setHospitalSearchPage(0);
    setHospitalSearchRequestId((current) => current + 1);
  };

  const handleHospitalContactSelect = async (targetUserId: string) => {
    const { roomId } = await createOrGetHospitalChatRoom(targetUserId);
    navigate(`/chat/hospital?roomId=${roomId}`);
  };

  const handleKeySelect = (keyValue: string) => {
    if (keyValue === 'ENTER') {
      if (isHospitalSearch) {
        handleHospitalContactSearch();
        return;
      }

      handleSend();
      return;
    }

    pressKey(keyValue);
  };

  return (
    <main className="page">
      <section className="card wide">
        <header className="page-header">
          <div>
            <h1>환자 메인</h1>
            <p>가상키보드 입력 테스트 화면입니다.</p>
          </div>

          <nav className="nav-links">
            <Link to="/memo">개인 메모장</Link>
            <Link to="/chat/hospital">병원 채팅</Link>
            <Link to="/chat/friend">친구 채팅</Link>
            <Link to="/analysis">분석</Link>
            <Link to="/mypage">마이페이지</Link>
            <Link to="/calibration">캘리브레이션</Link>
          </nav>
        </header>

        <textarea
          className="message-box"
          value={text}
          readOnly
          placeholder="가상키보드로 문장을 입력하세요."
        />

        <VirtualKeyboard onKeySelect={handleKeySelect} />

        {isHospitalSearch && hospitalSearchKeyword ? (
          <HospitalChatContactSearch
            keyword={hospitalSearchKeyword}
            page={hospitalSearchPage}
            requestId={hospitalSearchRequestId}
            onContactSelect={handleHospitalContactSelect}
            onPageChange={setHospitalSearchPage}
          />
        ) : null}
      </section>
    </main>
  );
}
