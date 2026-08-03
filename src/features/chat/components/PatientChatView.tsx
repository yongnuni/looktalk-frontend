import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BaseModal } from '../../../shared/components/modal';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EmergencyIcon,
  PersonIcon,
  RequestIcon,
  SearchIcon,
  SettingsIcon,
} from './ChatIcons';
import { hospitalChatRooms } from '../mock/hospitalChatMock';
import type { ChatMessage, HospitalChatRoom } from '../types/chat';
import './PatientChatView.css';

type OpenEmergencyState = 'closed' | 'countdown' | 'complete';

export default function PatientChatView() {
  const navigate = useNavigate();
  const messageListRef = useRef<HTMLDivElement>(null);
  const [selectedRoomId, setSelectedRoomId] = useState(hospitalChatRooms[0].id);
  const [listPage, setListPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickSentence, setQuickSentence] = useState<string | null>(null);
  const [frequentSentences, setFrequentSentences] = useState<string[]>([]);
  const [emergencyState, setEmergencyState] = useState<OpenEmergencyState>('closed');
  const [countdown, setCountdown] = useState(5);

  const selectedRoom =
    hospitalChatRooms.find((room) => room.id === selectedRoomId) ?? hospitalChatRooms[0];

  useEffect(() => {
    if (emergencyState !== 'countdown') return;

    const timeoutId = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(0);
        setEmergencyState('complete');
        return;
      }

      setCountdown(countdown - 1);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [countdown, emergencyState]);

  const handleEmergencyOpen = () => {
    setCountdown(5);
    setEmergencyState('countdown');
  };

  const handleEmergencyClose = () => {
    setEmergencyState('closed');
    setCountdown(5);
  };

  const scrollMessages = (direction: 'up' | 'down') => {
    const messageList = messageListRef.current;
    if (!messageList) return;

    const distance = Math.max(messageList.clientHeight * 0.8, 320);
    messageList.scrollBy({
      behavior: 'smooth',
      top: direction === 'up' ? -distance : distance,
    });
  };

  const handleMessageActivate = (message: ChatMessage) => {
    setQuickSentence(message.text);
  };

  const handleMessageKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    message: ChatMessage,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    handleMessageActivate(message);
  };

  const handleRegisterSentence = () => {
    if (quickSentence) {
      setFrequentSentences((sentences) =>
        sentences.includes(quickSentence) ? sentences : [...sentences, quickSentence],
      );
    }

    setQuickSentence(null);
  };

  const handleRoomSelect = (room: HospitalChatRoom) => {
    setSelectedRoomId(room.id);
  };

  return (
    <main className="patient-chat-page">
      <div className="patient-chat-shell">
        <aside className="patient-chat-sidebar" aria-label="병원 채팅 대상 목록">
          <header className="patient-chat-sidebar-header">
            <div className="patient-chat-brand" aria-label="Look Talk">
              <span>Look</span>
              <span>Talk</span>
            </div>
            <h1 className="patient-chat-sidebar-title">병원 채팅</h1>
            <div className="patient-chat-sidebar-actions">
              <Link className="patient-chat-link-action" to="/chat/friend">
                친구 채팅으로 이동
              </Link>
              <Link className="patient-chat-search-action" to="/patient?source=hospital-search">
                <SearchIcon size={30} />
                검색
              </Link>
            </div>
          </header>

          <div className="patient-chat-room-grid" aria-label="채팅 대상 선택">
            {hospitalChatRooms.map((room) => (
              <button
                key={room.id}
                aria-pressed={room.id === selectedRoom.id}
                className="patient-chat-room-card"
                type="button"
                onClick={() => handleRoomSelect(room)}
              >
                <span className="patient-chat-room-icon">
                  {room.icon === 'request' ? <RequestIcon /> : <PersonIcon />}
                </span>
                <span>{room.name}</span>
              </button>
            ))}
          </div>

          <div className="patient-chat-pagination" aria-label="채팅 대상 목록 페이지 이동">
            <button
              className="patient-chat-pagination-button"
              disabled={listPage === 0}
              type="button"
              onClick={() => setListPage((page) => Math.max(0, page - 1))}
            >
              이전
            </button>
            <button
              className="patient-chat-pagination-button"
              disabled={listPage === 0}
              type="button"
              onClick={() => setListPage((page) => Math.min(0, page + 1))}
            >
              다음
            </button>
          </div>
        </aside>

        <section className="patient-chat-panel" aria-label="병원 채팅">
          <header className="patient-chat-header">
            <h2 className="patient-chat-current-title">{selectedRoom.name}</h2>
            <div className="patient-chat-header-actions">
              <button
                aria-label="비상호출"
                className="patient-chat-emergency-button"
                type="button"
                onClick={handleEmergencyOpen}
              >
                <EmergencyIcon />
              </button>
              <button
                aria-label="채팅 설정 열기"
                className="patient-chat-settings-button"
                type="button"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon />
              </button>
            </div>
          </header>

          <div className="patient-chat-conversation">
            <div
              ref={messageListRef}
              className="patient-chat-message-list"
              aria-live="polite"
              aria-label={`${selectedRoom.name} 메시지`}
            >
              {selectedRoom.messages.length > 0 ? (
                selectedRoom.messages.map((message) => (
                  <button
                    key={message.id}
                    className={`patient-chat-message patient-chat-message--${message.direction}`}
                    type="button"
                    onDoubleClick={() => handleMessageActivate(message)}
                    onKeyDown={(event) => handleMessageKeyDown(event, message)}
                  >
                    {message.text}
                  </button>
                ))
              ) : (
                <div className="patient-chat-message-list-empty">아직 대화가 없습니다.</div>
              )}
            </div>

            <div className="patient-chat-guide" aria-label="메시지 스크롤 안내">
              <button
                aria-label="메시지 위로 안내"
                className="patient-chat-guide-button"
                type="button"
                onClick={() => scrollMessages('up')}
              >
                <ArrowUpIcon />
              </button>
              <button
                aria-label="메시지 아래로 안내"
                className="patient-chat-guide-button"
                type="button"
                onClick={() => scrollMessages('down')}
              >
                <ArrowDownIcon />
              </button>
            </div>
          </div>

          <footer className="patient-chat-composer">
            <button
              aria-label={`메시지 보내기. 자주 쓰는 문장 ${frequentSentences.length}개`}
              className="patient-chat-message-entry"
              type="button"
              onClick={() => navigate('/patient?source=hospital-message')}
            >
              <span>메 시 지&nbsp; 보 내 기</span>
            </button>
            <button
              aria-label="채팅 설정 열기"
              className="patient-chat-settings-button"
              type="button"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon />
            </button>
          </footer>
        </section>
      </div>

      <BaseModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        actions={[
          {
            label: '분석페이지로 이동',
            tone: 'positive',
            onClick: () => {
              setSettingsOpen(false);
              navigate('/analysis');
            },
          },
          { label: '취소', tone: 'neutral', onClick: () => setSettingsOpen(false) },
        ]}
      >
        이동할 화면을 선택해 주세요.
      </BaseModal>

      <BaseModal
        isOpen={quickSentence !== null}
        onClose={() => setQuickSentence(null)}
        actions={[
          { label: '등록', tone: 'positive', onClick: handleRegisterSentence },
          { label: '취소', tone: 'neutral', onClick: () => setQuickSentence(null) },
        ]}
      >
        해당 문장을 자주 쓰는 문장으로 등록하시겠습니까?
      </BaseModal>

      <BaseModal
        isOpen={emergencyState !== 'closed'}
        variant={emergencyState === 'complete' ? 'emergency' : 'default'}
        onClose={handleEmergencyClose}
        actions={
          emergencyState === 'complete'
            ? [{ label: '확인', tone: 'neutral', onClick: handleEmergencyClose }]
            : [{ label: '취소', tone: 'neutral', onClick: handleEmergencyClose }]
        }
      >
        {emergencyState === 'complete' ? (
          '달려오고 있어요! 조금만 기다려주세요!'
        ) : (
          <>
            <p>응답이 없을 경우 5초 후 비상호출이 전송됩니다.</p>
            <strong className="base-modal-countdown" aria-label={`${countdown}초`}>
              {countdown}
            </strong>
          </>
        )}
      </BaseModal>
    </main>
  );
}
