import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../../assets/Logo.png';
import DownArrow from '../../../assets/down_arrow.png';
import Setting from '../../../assets/setting.png';
import Sos from '../../../assets/sos.png';
import UpArrow from '../../../assets/up_arrow.png';
import { BaseModal } from '../../../shared/components/modal';
import { ROUTES } from '../../../shared/constants/routes';
import { useChatRoomMessages } from '../hooks/useChatRoomMessages';
import type { ChatRoom } from '../types/chat';
import { formatChatTime } from '../utils/formatChatTime';
import {
  RequestIcon,
  SearchIcon,
} from './ChatIcons';
import './PatientChatView.css';

type OpenEmergencyState = 'closed' | 'countdown' | 'complete';
type PhoneVerificationStatus = 'loading' | 'verified' | 'unverified' | 'error';
type RoomPreparationStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

interface RoomPreparationState {
  status: RoomPreparationStatus;
  error: string | null;
}

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
  phoneVerificationStatus?: PhoneVerificationStatus;
  onRetryPhoneVerification?: () => void;
  onRoomSelect?: (room: ChatRoom) => Promise<unknown> | void;
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
  phoneVerified: phoneVerifiedProp = true,
  phoneVerificationStatus,
  onRetryPhoneVerification,
  onRoomSelect,
  onRequirePhoneVerification,
}: PatientChatViewProps) {
  const navigate = useNavigate();
  const resolvedPhoneVerificationStatus =
    phoneVerificationStatus ?? (phoneVerifiedProp ? 'verified' : 'unverified');
  const phoneVerified = resolvedPhoneVerificationStatus === 'verified';
  const messageListRef = useRef<HTMLDivElement>(null);
  const hasShownPhoneVerification = useRef(
    resolvedPhoneVerificationStatus === 'unverified',
  );
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
  const [listPage, setListPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(
    resolvedPhoneVerificationStatus === 'unverified',
  );
  const [emergencyState, setEmergencyState] = useState<OpenEmergencyState>('closed');
  const [countdown, setCountdown] = useState(5);
  const [roomDisplayNames, setRoomDisplayNames] = useState<Record<string, string>>({});
  const [roomPreparations, setRoomPreparations] = useState<
    Record<string, RoomPreparationState>
  >({});

  const roomPageSize = 4;
  const roomPageCount = Math.max(1, Math.ceil(rooms.length / roomPageSize));
  const visibleRooms = rooms.slice(listPage * roomPageSize, (listPage + 1) * roomPageSize);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];
  const {
    e2eeError,
    e2eeStatus,
    messages: realtimeMessages,
    retryE2ee,
  } = useChatRoomMessages(
    selectedRoom?.chatRoomId,
    {
      onMessageEvent: (_event, message) => {
        if (
          message.direction === 'received' &&
          message.senderDisplayName?.trim() &&
          selectedRoom
        ) {
          setRoomDisplayNames((current) => ({
            ...current,
            [selectedRoom.id]: message.senderDisplayName!,
          }));
        }
      },
    },
  );
  const selectedRoomPreparation: RoomPreparationState = selectedRoom?.chatRoomId
    ? { status: 'ready', error: null }
    : selectedRoom
      ? (roomPreparations[selectedRoom.id] ?? {
          status: onRoomSelect ? 'idle' : 'unavailable',
          error: null,
        })
      : { status: 'unavailable', error: null };
  const prepareRoom = useCallback(
    async (room: ChatRoom) => {
      if (room.chatRoomId || !onRoomSelect) return;

      setRoomPreparations((current) => ({
        ...current,
        [room.id]: { status: 'loading', error: null },
      }));

      try {
        await onRoomSelect(room);
        setRoomPreparations((current) => ({
          ...current,
          [room.id]: { status: 'ready', error: null },
        }));
      } catch (error) {
        setRoomPreparations((current) => ({
          ...current,
          [room.id]: {
            status: 'error',
            error:
              error instanceof Error
                ? error.message
                : '채팅방을 준비하지 못했습니다.',
          },
        }));
      }
    },
    [onRoomSelect],
  );
  const selectedRoomName = selectedRoom
    ? (roomDisplayNames[selectedRoom.id] ?? selectedRoom.name)
    : '';
  const selectedRoomMessages = selectedRoom?.chatRoomId
    ? realtimeMessages
    : (selectedRoom?.messages ?? []);
  const pageClassName = `patient-chat-page patient-chat-page--${mode}${
    phoneVerified ? '' : ' patient-chat-page--unverified'
  }`;

  useEffect(() => {
    if (
      selectedRoom &&
      !selectedRoom.chatRoomId &&
      selectedRoomPreparation.status === 'idle'
    ) {
      void prepareRoom(selectedRoom);
    }
  }, [prepareRoom, selectedRoom, selectedRoomPreparation.status]);

  useEffect(() => {
    if (
      resolvedPhoneVerificationStatus !== 'unverified' ||
      hasShownPhoneVerification.current
    ) return;

    hasShownPhoneVerification.current = true;
    const timeoutId = window.setTimeout(() => {
      onRequirePhoneVerification?.();
      setPhoneVerificationOpen(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [onRequirePhoneVerification, resolvedPhoneVerificationStatus]);

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
      if (resolvedPhoneVerificationStatus === 'unverified') {
        requestPhoneVerification();
      }
      return;
    }

    setSettingsOpen(true);
  };

  const handleMessageSend = () => {
    if (!phoneVerified) {
      if (resolvedPhoneVerificationStatus === 'unverified') {
        requestPhoneVerification();
      }
      return;
    }

    if (e2eeStatus !== 'ready') return;
    if (!selectedRoom?.chatRoomId) return;
    if (mode === 'hospital' && !selectedRoom.targetUserId) return;

    const [inputPath, existingQuery = ''] = messagePath.split('?');
    const params = new URLSearchParams(existingQuery);
    params.set('roomId', String(selectedRoom.chatRoomId));

    if (selectedRoom.targetUserId) {
      params.set('targetUserId', selectedRoom.targetUserId);
    }

    const returnPath =
      mode === 'hospital'
        ? `/chat/hospital?roomId=${selectedRoom.chatRoomId}`
        : `/chat/friend?friendshipId=${selectedRoom.friendshipId ?? ''}`;
    params.set('returnPath', returnPath);
    navigate(`${inputPath}?${params.toString()}`);
  };

  const handleRoomSelect = (room: ChatRoom) => {
    setSelectedRoomId(room.id);
  };

  const canSendMessage = Boolean(
    phoneVerified &&
      e2eeStatus === 'ready' &&
      selectedRoom?.chatRoomId &&
      (mode !== 'hospital' || selectedRoom.targetUserId),
  );
  const messageEntryLabel =
    resolvedPhoneVerificationStatus === 'loading'
      ? '사용자 정보 확인 중'
      : resolvedPhoneVerificationStatus === 'error'
        ? '사용자 정보 확인 실패'
        : e2eeStatus === 'loading'
          ? '암호화 키 준비 중'
          : e2eeStatus === 'error'
            ? '암호화 키 확인 필요'
            : selectedRoomPreparation.status === 'loading' ||
                (selectedRoomPreparation.status === 'ready' && !selectedRoom?.chatRoomId)
              ? '채팅방 준비 중'
              : selectedRoomPreparation.status === 'error'
                ? '채팅방 준비 실패'
                : selectedRoomPreparation.status === 'unavailable' || !selectedRoom?.chatRoomId
                  ? '채팅방 선택 필요'
                  : '메 시 지\u00a0 보 내 기';

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
                onClick={() => handleRoomSelect(room)}
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
            <h2 className="patient-chat-current-title">{selectedRoomName}</h2>
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
              aria-label={`${selectedRoomName} 메시지`}
            >
              {resolvedPhoneVerificationStatus === 'loading' && (
                <p role="status">사용자 인증 정보를 확인하고 있습니다.</p>
              )}
              {resolvedPhoneVerificationStatus === 'error' && (
                <div role="alert">
                  <p>사용자 인증 정보를 불러오지 못했습니다.</p>
                  {onRetryPhoneVerification && (
                    <button type="button" onClick={onRetryPhoneVerification}>
                      다시 시도
                    </button>
                  )}
                </div>
              )}
              {resolvedPhoneVerificationStatus === 'unverified' && (
                <p role="status">친구 채팅을 사용하려면 전화번호 인증이 필요합니다.</p>
              )}
              {e2eeStatus === 'loading' && (
                <p role="status">암호화 키를 준비하고 있습니다.</p>
              )}
              {e2eeStatus === 'error' && (
                <div role="alert">
                  <p>{e2eeError}</p>
                  <button type="button" onClick={retryE2ee}>
                    다시 시도
                  </button>
                </div>
              )}
              {selectedRoomPreparation.status === 'loading' && (
                <p role="status">채팅방을 준비하고 있습니다.</p>
              )}
              {selectedRoomPreparation.status === 'error' && selectedRoom && (
                <div role="alert">
                  <p>{selectedRoomPreparation.error}</p>
                  <button type="button" onClick={() => void prepareRoom(selectedRoom)}>
                    다시 시도
                  </button>
                </div>
              )}
              {selectedRoomPreparation.status === 'unavailable' && (
                <p role="status">메시지를 보낼 채팅방을 선택해주세요.</p>
              )}
              {selectedRoomMessages.map((message) => (
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
              disabled={!canSendMessage}
              type="button"
              onClick={handleMessageSend}
            >
              <span>{messageEntryLabel}</span>
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
