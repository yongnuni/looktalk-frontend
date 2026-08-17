import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  sendHospitalChatMessage,
  sendSmsChatMessage,
} from '../../features/chat/api/chatMessages';
import VirtualKeyboard from '../../features/keyboard/components/VirtualKeyboard';
import { useInputStore } from '../../shared/stores/inputStore';

export default function PatientHomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const text = useInputStore((state) => state.text);
  const pressKey = useInputStore((state) => state.pressKey);
  const clearText = useInputStore((state) => state.clearText);
  const sendingRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const messageSource = searchParams.get('source');
  const isHospitalMessage = messageSource === 'hospital-message';
  const isFriendMessage = messageSource === 'friend-message';

  const handleSend = async () => {
    if (sendingRef.current) return;

    if (!text.trim()) {
      alert('전송할 문장이 없습니다.');
      return;
    }

    if (!isHospitalMessage && !isFriendMessage) {
      alert(`전송할 문장: ${text}`);
      clearText();
      return;
    }

    const roomId = Number(searchParams.get('roomId'));
    if (!Number.isInteger(roomId) || roomId <= 0) {
      alert('메시지를 보낼 채팅방을 확인할 수 없습니다.');
      return;
    }

    const targetUserId = isHospitalMessage ? searchParams.get('targetUserId') : null;
    if (isHospitalMessage && !targetUserId) {
      alert('메시지를 받을 사용자를 확인할 수 없습니다.');
      return;
    }

    sendingRef.current = true;
    setIsSending(true);

    try {
      if (isHospitalMessage) {
        await sendHospitalChatMessage(roomId, targetUserId!, text.trim());
      } else {
        await sendSmsChatMessage(roomId, text.trim());
      }

      clearText();

      const returnPath = searchParams.get('returnPath');
      if (returnPath?.startsWith('/chat/')) {
        navigate(returnPath, { replace: true });
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : '메시지를 전송하지 못했습니다. 로그인 상태와 네트워크 연결을 확인해주세요.',
      );
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleKeySelect = (keyValue: string) => {
    if (keyValue === 'ENTER') {
      if (isSending) return;

      void handleSend();
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

        {isSending && <p role="status">메시지를 전송하고 있습니다.</p>}

      </section>
    </main>
  );
}
