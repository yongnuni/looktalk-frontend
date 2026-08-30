import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Logo from '../../../assets/Logo.png';
import DownArrow from '../../../assets/down_arrow.png';
import Setting from '../../../assets/setting.png';
import UpArrow from '../../../assets/up_arrow.png';

import { BaseModal } from '../../../shared/components/modal';
import EmergencyButton from '../../emergency/components/EmergencyButton';
import { ROUTES } from '../../../shared/constants/routes';
import { useGazeInteraction } from '../../gazeInteraction/GazeInteractionContext';
import { usePageScope } from '../../gazeInteraction/usePageScope';
import { useGazeTarget } from '../../gazeInteraction/useGazeTarget';
import FullViewportKeyboardOverlay from '../../keyboard/components/FullViewportKeyboardOverlay';
import { useKeyboardInput } from '../../keyboard/hooks/useKeyboardInput';
import { useUserSettings } from '../../userSetting/hooks/useUserSettings';
import {
  sendHospitalChatMessage,
  sendSmsChatMessage,
} from '../api/chatMessages';
import { isSendableMessage } from '../chatSend';
import { useChatRoomMessages } from '../hooks/useChatRoomMessages';
import type { ChatRoom } from '../types/chat';
import { formatChatTime } from '../utils/formatChatTime';

import { RequestIcon } from './ChatIcons';

import './PatientChatView.css';

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

// Front Step 14 §10/§8 — Chat 목록 한 페이지에 보이는 카드 수는 고정값이다. 카드마다
// useGazeTarget()을 .map() 안에서 호출하면(개수가 페이지마다 0~4개로 달라짐) React
// hooks 규칙을 위반하므로, 항상 정확히 ROOM_SLOT_COUNT번 고정 호출하고 각 slot이 현재
// 몇 번째 room을 가리키는지만 매 렌더 갱신한다(VirtualKeyboard의 key 개수 문제와 달리
// room 카드는 "화면당 몇 개"가 이미 상수라 이 방식이 자연스럽다).
const ROOM_SLOT_COUNT = 4;

export interface PatientChatViewProps {
  mode: 'hospital' | 'friend';

  title: string;

  rooms: ChatRoom[];

  initialRoomId: string;

  switchLabel: string;

  switchPath: string;

  phoneVerified?: boolean;

  phoneVerificationStatus?: PhoneVerificationStatus;

  onRetryPhoneVerification?: () => void;

  onRoomSelect?: (room: ChatRoom) => Promise<ChatRoom | void> | ChatRoom | void;

  onRequirePhoneVerification?: () => void;
  /** Front Step 17 §30 — room 목록 조회 실패를 조용히 무시하지 않고 화면에 알리기 위한
   * 추가 전용 prop(기본값 null이면 기존 동작과 동일). */
  loadError?: string | null;
  roomPagination?: PatientChatRoomPagination;
}

export default function PatientChatView({
  mode,
  title,
  rooms,
  initialRoomId,
  switchLabel,
  switchPath,
  phoneVerified: phoneVerifiedProp = true,
  phoneVerificationStatus,
  onRetryPhoneVerification,
  onRoomSelect,
  onRequirePhoneVerification,
  loadError = null,
  roomPagination,
}: PatientChatViewProps) {
  const navigate = useNavigate();

  /* ===========================
     사용자 인증
  =========================== */

  const resolvedPhoneVerificationStatus =
    phoneVerificationStatus ?? (phoneVerifiedProp ? 'verified' : 'unverified');

  const phoneVerified = resolvedPhoneVerificationStatus === 'verified';
  const messageListRef = useRef<HTMLDivElement>(null);
  const hasShownPhoneVerification = useRef(
    resolvedPhoneVerificationStatus === 'unverified',
  );
  const isSendingRef = useRef(false);

  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
  // Front Step 17 §9 — HospitalChatPage/FriendChatPage는 같은 route element를 유지한 채
  // query string(?roomId=X)만 바꿔 재진입할 수 있다(예: 연락처 검색에서 방을 만든 뒤
  // navigate('/chat/hospital?roomId=123')). React Router는 이때 PatientChatView를 remount
  // 하지 않으므로 selectedRoomId의 초기값(useState(initialRoomId))은 최초 mount 시점에
  // 멈춰 있어 이후 initialRoomId 변화가 반영되지 않았다(새로 생성/조회된 room으로 자동
  // 이동하지 않는 root cause). effect 대신 React가 권장하는 "렌더링 중 state 조정"
  // 패턴으로 동기화한다(effect 안 setState는 react-hooks/set-state-in-effect가 cascading
  // render로 지적한다). syncedInitialRoomId는 "이 렌더에서 이미 반영한 initialRoomId 값"만
  // 추적한다(빈 문자열이면 기존 선택을 건드리지 않는다).
  const [syncedInitialRoomId, setSyncedInitialRoomId] = useState(initialRoomId);
  if (initialRoomId && initialRoomId !== syncedInitialRoomId) {
    setSyncedInitialRoomId(initialRoomId);
    setSelectedRoomId(initialRoomId);
  }
  const [listPage, setListPage] = useState(0);

  /* ===========================
     Modal
  =========================== */

  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(
    resolvedPhoneVerificationStatus === 'unverified',
  );

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

  // Front Step 14 — 메시지 보내기 → VirtualKeyboard 오버레이. Keyboard는 텍스트를 직접
  // 알지 못하고 onConfirm(composedText)만 호출한다(VirtualKeyboard Integration Plan §15.4).
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const { settings } = useUserSettings();
  const { setActiveScope } = useGazeInteraction();

  const roomPageSize = ROOM_SLOT_COUNT;
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
  // Hospital의 "요청" 카드(icon: 'request')는 Backend에 대응하는 room_type이 없는 순수
  // UI 항목이다(4칸 grid의 1번 슬롯 고정 — HospitalChatPage.tsx 참고). selectedRoom
  // fallback이 이 카드로 떨어지면 message-entry가 영구적으로 disabled로 보이므로(Front
  // Step 17 BUG A/B), selectedRoomId가 우연히 그 카드를 가리키더라도 항상 건너뛴다.
  const selectedRoom =
    rooms.find(
      (room) => room.id === selectedRoomId && room.icon !== 'request',
    ) ?? rooms.find((room) => room.icon !== 'request');

  /* ===========================
     실시간 메시지
  =========================== */

  const {
    addMessage,
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

  const selectedRoomRef = useRef(selectedRoom);
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  // Front Step 17 §0/§9 BUG A/B root cause(Friend Chat)는 아래 prepareRoom 이펙트가
  // 해결한다 — selectedRoom이 바뀔 때마다(수동 선택이든 `?? rooms[0]` 자동 기본값이든)
  // chatRoomId가 없고 아직 준비를 시도한 적이 없으면(status==='idle') find-or-create를
  // 시도하고, 결과(loading/ready/error)를 selectedRoomPreparation으로 노출한다.

  // Front Step 14 §9 — Chat 목록/채팅방은 기본 CHAT scope. Keyboard가 열리면 KEYBOARD로
  // 전환해 뒤쪽 room 카드/설정/메시지 보내기 버튼이 실수로 선택되지 않게 한다(§12).
  usePageScope('CHAT');

  useEffect(() => {
    setActiveScope(isKeyboardOpen ? 'KEYBOARD' : 'CHAT');
  }, [isKeyboardOpen, setActiveScope]);

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

  // Front Step 17 — room 생성/선택은 prepareRoom 이펙트가 selectedRoom 변화에 반응해
  // 일괄 처리하므로, 여기서는 selectedRoomId만 갱신한다(명시적 클릭도 자동 기본 선택도
  // 동일 경로를 탄다). "요청" 카드(icon: 'request')는 실제 채팅 대상이 될 수 없는 UI
  // 전용 항목이라 애초에 선택 자체를 막는다(selectedRoom fallback의 request 제외와 짝).
  const handleRoomSelect = (room: ChatRoom) => {
    if (room.icon === 'request') return;

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

  // ── Chat → VirtualKeyboard(§10) ──
  const clearTextRef = useRef<() => void>(() => {});

  // canSendMessage(phoneVerified/e2eeStatus/room 준비 상태를 모두 반영)는 매 렌더 재계산되므로,
  // deps를 최소화한 안정적인 handleMessageSend 콜백 안에서는 ref로 최신값을 읽는다
  // (selectedRoomRef와 동일한 패턴).
  const canSendMessageRef = useRef(canSendMessage);
  useEffect(() => {
    canSendMessageRef.current = canSendMessage;
  }, [canSendMessage]);

  const handleMessageSend = useCallback(() => {
    if (!phoneVerified) {
      requestPhoneVerification();
      return;
    }

    if (!canSendMessageRef.current) return;

    setSendError(null);
    setIsKeyboardOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestPhoneVerification은 안정적이지 않지만 여기서 최신 동작이 필요 없다
  }, [phoneVerified]);

  const handleKeyboardClose = () => {
    clearTextRef.current();
    setSendError(null);
    setIsKeyboardOpen(false);
  };

  // Integration Plan §16.1 — Keyboard의 확인 = 실제 메시지 전송. 전송 성공 시에만
  // draft clear + keyboard close(§17.1), 실패 시 draft/keyboard 상태를 보존한다(§17.2).
  const handleConfirmSend = useCallback(
    async (composedText: string) => {
      if (!isSendableMessage(composedText)) {
        window.alert('전송할 문장이 없습니다.');
        return;
      }

      // §23 — Confirm 재실행으로 인한 중복 전송 방지(React state보다 먼저 반영되는 ref).
      if (isSendingRef.current) return;

      const room = selectedRoomRef.current;
      if (!room?.chatRoomId) return;

      isSendingRef.current = true;
      setIsSending(true);
      setSendError(null);

      try {
        const result =
          mode === 'hospital'
            ? await sendHospitalChatMessage(
                room.chatRoomId,
                room.targetUserId ?? '',
                composedText,
              )
            : await sendSmsChatMessage(room.chatRoomId, composedText);

        // 서버가 MESSAGE_CREATED 웹소켓 이벤트를 발신자에게도 되돌려주지만, 그 왕복을
        // 기다리지 않고 즉시 낙관적으로 반영한다(addMessage는 id 기준으로 중복을
        // 병합하므로 이후 웹소켓 이벤트가 도착해도 같은 메시지가 두 번 보이지 않는다).
        addMessage({
          id: String(result.messageId),
          text: composedText.trim(),
          direction: 'sent',
          createdAt: result.createdAt,
        });

        clearTextRef.current();
        setIsKeyboardOpen(false);
      } catch (error) {
        console.error('메시지 전송 실패:', error);
        setSendError('메시지 전송에 실패했습니다. 다시 시도해 주세요.');
      } finally {
        isSendingRef.current = false;
        setIsSending(false);
      }
    },
    [addMessage, mode],
  );

  const {
    keyboardState,
    text,
    handleKeySelect,
    handleSuggestionSelect,
    pendingWordBoundary,
    clearText,
  } = useKeyboardInput({ onConfirm: handleConfirmSend });

  useEffect(() => {
    clearTextRef.current = clearText;
  }, [clearText]);

  // ── Gaze targets(§13, 실제 존재하는 최소 navigation/action만) ──
  const brandTargetRef = useGazeTarget({
    id: 'chat-brand',
    scope: 'CHAT',
    onSelect: () => navigate(ROUTES.MAIN),
  });
  const switchTargetRef = useGazeTarget({
    id: 'chat-switch',
    scope: 'CHAT',
    onSelect: () => navigate(switchPath),
  });
  const prevPageTargetRef = useGazeTarget({
    id: 'chat-page-prev',
    scope: 'CHAT',
    enabled: phoneVerified && listPage > 0,
    onSelect: () => setListPage((page) => Math.max(0, page - 1)),
  });
  const nextPageTargetRef = useGazeTarget({
    id: 'chat-page-next',
    scope: 'CHAT',
    enabled: phoneVerified && listPage < roomPageCount - 1,
    onSelect: () =>
      setListPage((page) => Math.min(roomPageCount - 1, page + 1)),
  });
  const messageSendTargetRef = useGazeTarget({
    id: 'chat-message-send',
    scope: 'CHAT',
    enabled: canSendMessage,
    onSelect: handleMessageSend,
  });
  const settingsTargetRef = useGazeTarget({
    id: 'chat-settings',
    scope: 'CHAT',
    onSelect: () => navigate(ROUTES.MYPAGE),
  });

  // 4개 고정 slot(§10 주석) — room 개수/순서가 바뀌어도 hook 호출 횟수는 항상 4번이다.
  const roomSlot0Ref = useGazeTarget({
    id: 'chat-room-slot-0',
    scope: 'CHAT',
    enabled: visibleRooms.length > 0,
    onSelect: () => visibleRooms[0] && handleRoomSelect(visibleRooms[0]),
  });
  const roomSlot1Ref = useGazeTarget({
    id: 'chat-room-slot-1',
    scope: 'CHAT',
    enabled: visibleRooms.length > 1,
    onSelect: () => visibleRooms[1] && handleRoomSelect(visibleRooms[1]),
  });
  const roomSlot2Ref = useGazeTarget({
    id: 'chat-room-slot-2',
    scope: 'CHAT',
    enabled: visibleRooms.length > 2,
    onSelect: () => visibleRooms[2] && handleRoomSelect(visibleRooms[2]),
  });
  const roomSlot3Ref = useGazeTarget({
    id: 'chat-room-slot-3',
    scope: 'CHAT',
    enabled: visibleRooms.length > 3,
    onSelect: () => visibleRooms[3] && handleRoomSelect(visibleRooms[3]),
  });
  const roomSlotRefs = [roomSlot0Ref, roomSlot1Ref, roomSlot2Ref, roomSlot3Ref];

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
                ref={brandTargetRef}
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
              <Link
                ref={switchTargetRef}
                className="patient-chat-link-action"
                to={switchPath}
              >
                {switchLabel}
              </Link>
            </div>
          </header>

          {/* ===========================
              채팅 대상
          =========================== */}

          {loadError && (
            <p className="patient-chat-load-error" role="alert">
              {loadError}
            </p>
          )}
          {!loadError && rooms.length === 0 && (
            <p className="patient-chat-empty-state">
              {mode === 'hospital'
                ? '표시할 병원 채팅 상대가 없습니다.'
                : '등록된 친구가 없습니다.'}
            </p>
          )}

          <div className="patient-chat-room-grid" aria-label="채팅 대상 선택">
            {visibleRooms.map((room, index) => (
              <button
                key={room.id}
                ref={roomSlotRefs[index]}
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
              ref={prevPageTargetRef}
              className="patient-chat-pagination-button"
              disabled={
                !phoneVerified ||
                (roomPagination
                  ? Boolean(
                      roomPagination.isLoading || !canGoToPreviousRoomPage,
                    )
                  : listPage === 0)
              }
              type="button"
              onClick={handlePreviousRoomPage}
            >
              이전
            </button>

            <button
              ref={nextPageTargetRef}
              className="patient-chat-pagination-button"
              disabled={
                !phoneVerified ||
                (roomPagination
                  ? Boolean(roomPagination.isLoading || !canGoToNextRoomPage)
                  : listPage >= roomPageCount - 1)
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
              <EmergencyButton />
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
              {/* ===========================
                  기존 메시지
              =========================== */}

              {selectedRoomMessages.map((message) => {
                const formattedTime = formatChatTime(message.createdAt);

                return (
                  <article
                    aria-label={`${message.text}${formattedTime ? `, ${formattedTime}` : ''}`}
                    key={message.id}
                    className={`patient-chat-message patient-chat-message--${message.direction}`}
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
            {/* 메시지 보내기 */}

            <button
              ref={messageSendTargetRef}
              aria-label="메시지 보내기"
              className="patient-chat-message-entry"
              disabled={!canSendMessage || isSending}
              type="button"
              onClick={() => void handleMessageSend()}
            >
              <span>{isSending ? '전송 중...' : messageEntryLabel}</span>
            </button>

            {/* 마이페이지 */}

            <button
              ref={settingsTargetRef}
              aria-label="마이페이지로 이동"
              className="patient-chat-settings-button"
              type="button"
              onClick={() => navigate(ROUTES.MYPAGE)}
            >
              <img src={Setting} alt="" />
            </button>
          </footer>
        </section>
      </div>

      {/* Front Step 14 §11 — 기존 VirtualKeyboard를 그대로 재사용하는 full-page 오버레이.
          채팅 뒤쪽 UI는 이 레이어 아래에 가려져 mouse로도 눌리지 않고, activeScope도
          KEYBOARD로 전환되어 gaze로도 선택되지 않는다(§12). */}
      {isKeyboardOpen && (
        <FullViewportKeyboardOverlay
          ariaLabel="메시지 입력"
          draftText={text}
          draftPlaceholder="문장을 입력하세요."
          errorMessage={sendError}
          statusMessage={isSending ? '전송 중입니다…' : null}
          onClose={handleKeyboardClose}
          closeDisabled={isSending}
          keyboardState={keyboardState}
          onKeySelect={handleKeySelect}
          onSuggestionSelect={handleSuggestionSelect}
          pendingWordBoundary={pendingWordBoundary}
          suggestionsEnabled
          keyEnlarged={settings?.keyEnlarged ?? false}
        />
      )}

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
    </main>
  );
}
