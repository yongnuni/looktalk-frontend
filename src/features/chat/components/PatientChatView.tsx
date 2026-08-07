import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../../assets/Logo.png';
import DownArrow from '../../../assets/down_arrow.png';
import Setting from '../../../assets/setting.png';
import Sos from '../../../assets/sos.png';
import UpArrow from '../../../assets/up_arrow.png';
import { BaseModal } from '../../../shared/components/modal';
import { ROUTES } from '../../../shared/constants/routes';
import type { ChatRoom } from '../types/chat';
import { formatChatTime } from '../utils/formatChatTime';
import {
  RequestIcon,
  SearchIcon,
} from './ChatIcons';
import './PatientChatView.css';

type OpenEmergencyState = 'closed' | 'countdown' | 'complete';

export interface PatientChatViewProps {
  mode: 'hospital' | 'friend';
  title: string;
  rooms: ChatRoom[];
  initialRoomId: string;
  switchLabel: string;
  switchPath: string;
  searchPath: string;
  messagePath: string;
  phoneVerified?: boolean;
  onRequirePhoneVerification?: () => void;
}

export default function PatientChatView({
  mode,
  title,
  rooms,
  initialRoomId,
  switchLabel,
  switchPath,
  searchPath,
  messagePath,
  phoneVerified = true,
  onRequirePhoneVerification,
}: PatientChatViewProps) {
  const navigate = useNavigate();
  const messageListRef = useRef<HTMLDivElement>(null);
  const hasShownPhoneVerification = useRef(phoneVerified === false);
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
  const [listPage, setListPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(!phoneVerified);
  const [emergencyState, setEmergencyState] = useState<OpenEmergencyState>('closed');
  const [countdown, setCountdown] = useState(5);

  const roomPageSize = 4;
  const roomPageCount = Math.max(1, Math.ceil(rooms.length / roomPageSize));
  const visibleRooms = rooms.slice(listPage * roomPageSize, (listPage + 1) * roomPageSize);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];
  const pageClassName = `patient-chat-page patient-chat-page--${mode}${
    phoneVerified ? '' : ' patient-chat-page--unverified'
  }`;

  useEffect(() => {
    if (phoneVerified || hasShownPhoneVerification.current) return;

    hasShownPhoneVerification.current = true;
    const timeoutId = window.setTimeout(() => {
      onRequirePhoneVerification?.();
      setPhoneVerificationOpen(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [onRequirePhoneVerification, phoneVerified]);

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

    return () => window.clearTimeout(timeoutId);
  }, [countdown, emergencyState]);

  const requestPhoneVerification = () => {
    onRequirePhoneVerification?.();
    setPhoneVerificationOpen(true);
  };

  const handleSettingsOpen = () => {
    if (!phoneVerified) {
      requestPhoneVerification();
      return;
    }

    setSettingsOpen(true);
  };

  const handleMessageSend = () => {
    if (!phoneVerified) {
      requestPhoneVerification();
      return;
    }

    navigate(messagePath);
  };

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

  return (
    <main className={pageClassName}>
      <div className="patient-chat-shell">
        <aside className="patient-chat-sidebar" aria-label={`${title} 대상 목록`}>
          <header className="patient-chat-sidebar-header">
            <div className="patient-chat-sidebar-heading">
              <Link className="patient-chat-brand" to={ROUTES.MAIN} aria-label="Look Talk 메인 페이지로 이동">
                <img className="patient-chat-brand-image" src={Logo} alt="Look Talk 로고" />
              </Link>
              <h1 className="patient-chat-sidebar-title">{title}</h1>
            </div>
            <div className="patient-chat-sidebar-actions">
              <Link className="patient-chat-link-action" to={switchPath}>
                {switchLabel}
              </Link>
              {phoneVerified ? (
                <Link className="patient-chat-search-action" to={searchPath}>
                  <SearchIcon size={30} />
                  검색
                </Link>
              ) : (
                <button
                  className="patient-chat-search-action"
                  disabled
                  type="button"
                >
                  <SearchIcon size={30} />
                  검색
                </button>
              )}
            </div>
          </header>

          <div className="patient-chat-room-grid" aria-label="채팅 대상 선택">
            {visibleRooms.map((room) => (
              <button
                key={room.id}
                aria-pressed={room.id === selectedRoom?.id}
                className="patient-chat-room-card"
                type="button"
                onClick={() => setSelectedRoomId(room.id)}
              >
                {room.icon === 'request' ? (
                  <span className="patient-chat-room-icon">
                    <RequestIcon />
                  </span>
                ) : null}
                <span>{room.name}</span>
              </button>
            ))}
          </div>

          <div className="patient-chat-pagination" aria-label="채팅 대상 목록 페이지 이동">
            <button
              className="patient-chat-pagination-button"
              disabled={!phoneVerified}
              type="button"
              onClick={() => setListPage((page) => Math.max(0, page - 1))}
            >
              이전
            </button>
            <button
              className="patient-chat-pagination-button"
              disabled={!phoneVerified}
              type="button"
              onClick={() => setListPage((page) => Math.min(roomPageCount - 1, page + 1))}
            >
              다음
            </button>
          </div>
        </aside>

        <section className="patient-chat-panel" aria-label={title}>
          <header className="patient-chat-header">
            <h2 className="patient-chat-current-title">{selectedRoom?.name ?? ''}</h2>
            <div className="patient-chat-header-actions">
              <button
                aria-label="비상호출"
                className="patient-chat-emergency-button"
                type="button"
                onClick={handleEmergencyOpen}
              >
                <img src={Sos} alt="" />
              </button>
            </div>
          </header>

          <div className="patient-chat-conversation">
            <div
              ref={messageListRef}
              className="patient-chat-message-list"
              aria-live="polite"
              aria-label={`${selectedRoom?.name ?? ''} 메시지`}
            >
              {selectedRoom?.messages.map((message) => (
                (() => {
                  const formattedTime = formatChatTime(message.createdAt);

                  return (
                    <article
                      aria-label={`${message.text}${formattedTime ? `, ${formattedTime}` : ''}`}
                      key={message.id}
                      className={`patient-chat-message patient-chat-message--${message.direction}`}
                    >
                      <span className="patient-chat-message-text">{message.text}</span>
                      {formattedTime && (
                        <time
                          className="patient-chat-message-time"
                          dateTime={message.createdAt ?? undefined}
                        >
                          {formattedTime}
                        </time>
                      )}
                    </article>
                  );
                })()
              ))}
            </div>

            <div className="patient-chat-guide" aria-label="메시지 스크롤 안내">
              <button
                aria-label="메시지 위로 안내"
                className="patient-chat-guide-button"
                type="button"
                onClick={() => scrollMessages('up')}
              >
                <img src={UpArrow} alt="" />
              </button>
              <button
                aria-label="메시지 아래로 안내"
                className="patient-chat-guide-button"
                type="button"
                onClick={() => scrollMessages('down')}
              >
                <img src={DownArrow} alt="" />
              </button>
            </div>
          </div>

          <footer className="patient-chat-composer">
            <button
              aria-label="메시지 보내기"
              className="patient-chat-message-entry"
              type="button"
              onClick={handleMessageSend}
            >
              <span>메 시 지&nbsp; 보 내 기</span>
            </button>
            <button
              aria-label="채팅 설정 열기"
              className="patient-chat-settings-button"
              type="button"
              onClick={handleSettingsOpen}
            >
              <img src={Setting} alt="" />
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
        isOpen={phoneVerificationOpen}
        onClose={() => setPhoneVerificationOpen(false)}
        actions={[
          {
            label: '인증하기',
            tone: 'positive',
            onClick: () => {
              setPhoneVerificationOpen(false);
              navigate('/mypage?section=phone-verification');
            },
          },
          { label: '취소', tone: 'neutral', onClick: () => setPhoneVerificationOpen(false) },
        ]}
      >
        해당 페이지는 전화번호 인증 후에 사용할 수 있습니다.
        <br />
        인증하시겠습니까?
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
