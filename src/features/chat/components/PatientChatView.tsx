import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Logo from '../../../assets/Logo.png';
import DownArrow from '../../../assets/down_arrow.png';
import Setting from '../../../assets/setting.png';
import Sos from '../../../assets/sos.png';
import UpArrow from '../../../assets/up_arrow.png';

import { BaseModal } from '../../../shared/components/modal';
import { ROUTES } from '../../../shared/constants/routes';

import {
  sendHospitalChatMessage,
  sendSmsChatMessage,
} from '../api/chatMessages';
import { useChatRoomMessages } from '../hooks/useChatRoomMessages';
import type { ChatRoom } from '../types/chat';
import { formatChatTime } from '../utils/formatChatTime';

import { RequestIcon } from './ChatIcons';

import './PatientChatView.css';

type OpenEmergencyState = 'closed' | 'countdown' | 'complete';

type PhoneVerificationStatus = 'loading' | 'verified' | 'unverified' | 'error';

type RoomPreparationStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'unavailable';

interface RoomPreparationState {
  status: RoomPreparationStatus;
  error: string | null;
}

interface PatientChatRoomPagination {
  page: number;
  hasNext: boolean;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

export interface PatientChatViewProps {
  mode: 'hospital' | 'friend';

  title: string;

  rooms: ChatRoom[];

  initialRoomId: string;

  switchLabel: string;

  switchPath: string;

  messagePath: string;

  phoneVerified?: boolean;

  phoneVerificationStatus?: PhoneVerificationStatus;

  onRetryPhoneVerification?: () => void;

  onRoomSelect?: (room: ChatRoom) => Promise<ChatRoom | void> | ChatRoom | void;

  onRequirePhoneVerification?: () => void;

  roomPagination?: PatientChatRoomPagination;
}

export default function PatientChatView({
  mode,
  title,
  rooms,
  initialRoomId,
  switchLabel,
  switchPath,
  messagePath: _messagePath,
  phoneVerified: phoneVerifiedProp = true,
  phoneVerificationStatus,
  onRetryPhoneVerification,
  onRoomSelect,
  onRequirePhoneVerification,
  roomPagination,
}: PatientChatViewProps) {
  const navigate = useNavigate();

  const messageListRef = useRef<HTMLDivElement>(null);

  const hasShownPhoneVerification = useRef(
    (phoneVerificationStatus ??
      (phoneVerifiedProp ? 'verified' : 'unverified')) === 'unverified',
  );

  /* ===========================
     사용자 인증
  =========================== */

  const resolvedPhoneVerificationStatus =
    phoneVerificationStatus ?? (phoneVerifiedProp ? 'verified' : 'unverified');

  const phoneVerified = resolvedPhoneVerificationStatus === 'verified';

  /* ===========================
     채팅방
  =========================== */

  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);

  const [listPage, setListPage] = useState(0);

  /* ===========================
     메시지 입력
  =========================== */

  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  /* ===========================
     Modal
  =========================== */

  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(
    resolvedPhoneVerificationStatus === 'unverified',
  );

  const [emergencyState, setEmergencyState] =
    useState<OpenEmergencyState>('closed');

  const [countdown, setCountdown] = useState(5);

  /* ===========================
     채팅방 표시 이름
  =========================== */

  const [roomDisplayNames, setRoomDisplayNames] = useState<
    Record<string, string>
  >({});

  /* ===========================
     채팅방 준비 상태
  =========================== */

  const [roomPreparations, setRoomPreparations] = useState<
    Record<string, RoomPreparationState>
  >({});

  /* ===========================
     채팅방 페이지네이션
  =========================== */

  const roomPageSize = 4;

  const roomPageCount = Math.max(1, Math.ceil(rooms.length / roomPageSize));

  const visibleRooms = roomPagination
    ? rooms
    : rooms.slice(listPage * roomPageSize, (listPage + 1) * roomPageSize);

  const canGoToPreviousRoomPage = roomPagination
    ? roomPagination.page > 0
    : listPage > 0;

  const canGoToNextRoomPage = roomPagination
    ? roomPagination.hasNext
    : listPage < roomPageCount - 1;

  /* ===========================
     선택된 채팅방
  =========================== */

  const selectedRoom =
    rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];

  /* ===========================
     실시간 메시지
  =========================== */

  const {
    e2eeError,
    e2eeStatus,
    messages: realtimeMessages,
    retryE2ee,
  } = useChatRoomMessages(selectedRoom?.chatRoomId, {
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
  });

  /* ===========================
     채팅방 준비 가능 여부
  =========================== */

  const canPrepareSelectedRoom = Boolean(
    onRoomSelect &&
    selectedRoom &&
    (mode !== 'hospital' || selectedRoom.targetUserId),
  );

  /* ===========================
     선택된 채팅방 준비 상태
  =========================== */

  const selectedRoomPreparation: RoomPreparationState = selectedRoom?.chatRoomId
    ? {
        status: 'ready',
        error: null,
      }
    : selectedRoom
      ? (roomPreparations[selectedRoom.id] ?? {
          status: canPrepareSelectedRoom ? 'idle' : 'unavailable',

          error: null,
        })
      : {
          status: 'unavailable',
          error: null,
        };

  /* ===========================
     채팅방 준비
  =========================== */

  const prepareRoom = useCallback(
    async (room: ChatRoom) => {
      if (room.chatRoomId || !onRoomSelect) {
        return;
      }

      setRoomPreparations((current) => ({
        ...current,

        [room.id]: {
          status: 'loading',
          error: null,
        },
      }));

      try {
        const preparedRoom = await onRoomSelect(room);

        if (preparedRoom) {
          setSelectedRoomId(preparedRoom.id);
        }

        setRoomPreparations((current) => ({
          ...current,

          [room.id]: {
            status: 'ready',
            error: null,
          },
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

  /* ===========================
     현재 채팅방 이름
  =========================== */

  const selectedRoomName = selectedRoom
    ? (roomDisplayNames[selectedRoom.id] ?? selectedRoom.name)
    : '';

  /* ===========================
     기존 메시지
  =========================== */

  const selectedRoomMessages = selectedRoom?.chatRoomId
    ? realtimeMessages
    : (selectedRoom?.messages ?? []);

  /* ===========================
     페이지 클래스
  =========================== */

  const pageClassName =
    `patient-chat-page ` +
    `patient-chat-page--${mode}${
      phoneVerified ? '' : ' patient-chat-page--unverified'
    }`;

  /* ===========================
     채팅방 자동 준비
  =========================== */

  useEffect(() => {
    if (
      selectedRoom &&
      !selectedRoom.chatRoomId &&
      selectedRoomPreparation.status === 'idle'
    ) {
      void prepareRoom(selectedRoom);
    }
  }, [prepareRoom, selectedRoom, selectedRoomPreparation.status]);

  /* ===========================
     전화번호 인증 안내
  =========================== */

  useEffect(() => {
    if (
      resolvedPhoneVerificationStatus !== 'unverified' ||
      hasShownPhoneVerification.current
    ) {
      return;
    }

    hasShownPhoneVerification.current = true;

    const timeoutId = window.setTimeout(() => {
      onRequirePhoneVerification?.();

      setPhoneVerificationOpen(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [onRequirePhoneVerification, resolvedPhoneVerificationStatus]);

  /* ===========================
     비상호출 카운트다운
  =========================== */

  useEffect(() => {
    if (emergencyState !== 'countdown') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(0);

        setEmergencyState('complete');

        return;
      }

      setCountdown((previous) => previous - 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [countdown, emergencyState]);

  /* ===========================
     메시지 추가 후
     자동 아래 스크롤
  =========================== */

  useEffect(() => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    messageList.scrollTo({
      top: messageList.scrollHeight,

      behavior: 'smooth',
    });
  }, [realtimeMessages.length]);

  /* ===========================
     전화번호 인증 요청
  =========================== */

  const requestPhoneVerification = () => {
    onRequirePhoneVerification?.();

    setPhoneVerificationOpen(true);
  };

  /* ===========================
     설정 버튼
     마이페이지로 바로 이동
  =========================== */

  const handleSettingsOpen = () => {
    navigate('/mypage');
  };

  /* ===========================
     실제 메시지 전송
     REST API -> Backend -> DB 저장
  =========================== */

  const handleMessageSend = async () => {
    const trimmedMessage = inputValue.trim();

    if (!trimmedMessage) {
      return;
    }

    if (!phoneVerified) {
      if (resolvedPhoneVerificationStatus === 'unverified') {
        requestPhoneVerification();
      }

      return;
    }

    if (e2eeStatus !== 'ready') {
      return;
    }

    if (!selectedRoom?.chatRoomId || isSending) {
      return;
    }

    try {
      setIsSending(true);

      if (mode === 'hospital') {
        if (!selectedRoom.targetUserId) {
          return;
        }

        await sendHospitalChatMessage(
          selectedRoom.chatRoomId,
          selectedRoom.targetUserId,
          trimmedMessage,
        );
      } else {
        await sendSmsChatMessage(selectedRoom.chatRoomId, trimmedMessage);
      }

      setInputValue('');
    } catch (error) {
      console.error('메시지 전송 실패:', error);

      alert(
        error instanceof Error
          ? error.message
          : '메시지를 전송하지 못했습니다.',
      );
    } finally {
      setIsSending(false);
    }
  };

  /* ===========================
     Enter로 메시지 전송
  =========================== */

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    void handleMessageSend();
  };

  /* ===========================
     채팅방 선택
  =========================== */

  const handleRoomSelect = (room: ChatRoom) => {
    setSelectedRoomId(room.id);
  };

  /* ===========================
     이전 페이지
  =========================== */

  const handlePreviousRoomPage = () => {
    if (roomPagination) {
      roomPagination.onPageChange(Math.max(0, roomPagination.page - 1));

      return;
    }

    setListPage((page) => Math.max(0, page - 1));
  };

  /* ===========================
     다음 페이지
  =========================== */

  const handleNextRoomPage = () => {
    if (roomPagination) {
      roomPagination.onPageChange(roomPagination.page + 1);

      return;
    }

    setListPage((page) => Math.min(roomPageCount - 1, page + 1));
  };

  /* ===========================
     메시지 전송 가능 여부
  =========================== */

  const canSendMessage = Boolean(
    phoneVerified &&
    inputValue.trim() &&
    e2eeStatus === 'ready' &&
    selectedRoom?.chatRoomId &&
    (mode !== 'hospital' || selectedRoom.targetUserId) &&
    !isSending,
  );

  /* ===========================
     메시지 보내기 버튼 문구

     기존 상태 안내는 유지
     "채팅방 선택 필요"만 제거
  =========================== */

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
                (selectedRoomPreparation.status === 'ready' &&
                  !selectedRoom?.chatRoomId)
              ? '채팅방 준비 중'
              : selectedRoomPreparation.status === 'error'
                ? '채팅방 준비 실패'
                : '메 시 지\u00a0 보 내 기';

  /* ===========================
     비상호출 열기
  =========================== */

  const handleEmergencyOpen = () => {
    setCountdown(5);

    setEmergencyState('countdown');
  };

  /* ===========================
     비상호출 닫기
  =========================== */

  const handleEmergencyClose = () => {
    setEmergencyState('closed');

    setCountdown(5);
  };

  /* ===========================
     메시지 스크롤
  =========================== */

  const scrollMessages = (direction: 'up' | 'down') => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    const distance = Math.max(messageList.clientHeight * 0.8, 320);

    messageList.scrollBy({
      behavior: 'smooth',

      top: direction === 'up' ? -distance : distance,
    });
  };

  return (
    <main className={pageClassName}>
      <div className="patient-chat-shell">
        {/* ===========================
            Sidebar
        =========================== */}

        <aside
          className="patient-chat-sidebar"
          aria-label={`${title} 대상 목록`}
        >
          <header className="patient-chat-sidebar-header">
            <div className="patient-chat-sidebar-heading">
              <Link
                className="patient-chat-brand"
                to={ROUTES.MAIN}
                aria-label="Look Talk 메인 페이지로 이동"
              >
                <img
                  className="patient-chat-brand-image"
                  src={Logo}
                  alt="Look Talk 로고"
                />
              </Link>

              <h1 className="patient-chat-sidebar-title">{title}</h1>
            </div>

            <div className="patient-chat-sidebar-actions">
              <Link className="patient-chat-link-action" to={switchPath}>
                {switchLabel}
              </Link>
            </div>
          </header>

          {/* ===========================
              채팅 대상
          =========================== */}

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

          {/* ===========================
              Pagination
          =========================== */}

          <div
            className="patient-chat-pagination"
            aria-label="채팅 대상 목록 페이지 이동"
          >
            <button
              className="patient-chat-pagination-button"
              disabled={
                !phoneVerified ||
                Boolean(
                  roomPagination &&
                  (roomPagination.isLoading || !canGoToPreviousRoomPage),
                )
              }
              type="button"
              onClick={handlePreviousRoomPage}
            >
              이전
            </button>

            <button
              className="patient-chat-pagination-button"
              disabled={
                !phoneVerified ||
                Boolean(
                  roomPagination &&
                  (roomPagination.isLoading || !canGoToNextRoomPage),
                )
              }
              type="button"
              onClick={handleNextRoomPage}
            >
              다음
            </button>
          </div>
        </aside>

        {/* ===========================
            Chat Panel
        =========================== */}

        <section className="patient-chat-panel" aria-label={title}>
          {/* ===========================
              Header
          =========================== */}

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

          {/* ===========================
              Conversation
          =========================== */}

          <div className="patient-chat-conversation">
            <div
              ref={messageListRef}
              className="patient-chat-message-list"
              aria-live="polite"
              aria-label={`${selectedRoomName} 메시지`}
            >
              {/* 사용자 인증 확인 */}

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
                <p role="status">
                  친구 채팅을 사용하려면 전화번호 인증이 필요합니다.
                </p>
              )}

              {/* E2EE */}

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

              {/* 채팅방 준비 */}

              {selectedRoomPreparation.status === 'loading' && (
                <p role="status">채팅방을 준비하고 있습니다.</p>
              )}

              {selectedRoomPreparation.status === 'error' && selectedRoom && (
                <div role="alert">
                  <p>{selectedRoomPreparation.error}</p>

                  <button
                    type="button"
                    onClick={() => void prepareRoom(selectedRoom)}
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {/*
                기존의

                "메시지를 보낼 채팅방을 선택해주세요."

                부분은 제거함.
              */}

              {/* ===========================
                  기존 메시지
              =========================== */}

              {selectedRoomMessages.map((message) => {
                const formattedTime = formatChatTime(message.createdAt);

                return (
                  <article
                    aria-label={`${message.text}${
                      formattedTime ? `, ${formattedTime}` : ''
                    }`}
                    key={message.id}
                    className={
                      `patient-chat-message ` +
                      `patient-chat-message--${message.direction}`
                    }
                  >
                    <span className="patient-chat-message-text">
                      {message.text}
                    </span>

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
              })}
            </div>

            {/* ===========================
                Scroll
            =========================== */}

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

          {/* ===========================
              Bottom
          =========================== */}

          <footer className="patient-chat-composer">
            {/* 메시지 입력 */}

            <input
              className="patient-chat-input"
              type="text"
              placeholder="메시지를 입력하세요."
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleInputKeyDown}
            />

            {/* 메시지 보내기 */}

            <button
              aria-label="메시지 보내기"
              className="patient-chat-message-entry"
              disabled={!canSendMessage || isSending}
              type="button"
              onClick={() => void handleMessageSend()}
            >
              <span>{isSending ? '전송 중...' : messageEntryLabel}</span>
            </button>

            {/* 설정 */}

            <button
              aria-label="마이페이지로 이동"
              className="patient-chat-settings-button"
              type="button"
              onClick={handleSettingsOpen}
            >
              <img src={Setting} alt="" />
            </button>
          </footer>
        </section>
      </div>

      {/* ===========================
          Phone Verification
      =========================== */}

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

          {
            label: '취소',

            tone: 'neutral',

            onClick: () => setPhoneVerificationOpen(false),
          },
        ]}
      >
        해당 페이지는 전화번호 인증 후에 사용할 수 있습니다.
        <br />
        인증하시겠습니까?
      </BaseModal>

      {/* ===========================
          Emergency
      =========================== */}

      <BaseModal
        isOpen={emergencyState !== 'closed'}
        variant={emergencyState === 'complete' ? 'emergency' : 'default'}
        onClose={handleEmergencyClose}
        actions={
          emergencyState === 'complete'
            ? [
                {
                  label: '확인',

                  tone: 'neutral',

                  onClick: handleEmergencyClose,
                },
              ]
            : [
                {
                  label: '취소',

                  tone: 'neutral',

                  onClick: handleEmergencyClose,
                },
              ]
        }
      >
        {emergencyState === 'complete' ? (
          '달려오고 있어요! 조금만 기다려주세요!'
        ) : (
          <>
            <p>응답이 없을 경우 5초 후 비상호출이 전송됩니다.</p>

            <strong
              className="base-modal-countdown"
              aria-label={`${countdown}초`}
            >
              {countdown}
            </strong>
          </>
        )}
      </BaseModal>
    </main>
  );
}
