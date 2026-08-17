import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../../assets/Logo.png';
import DownArrow from '../../../assets/down_arrow.png';
import Setting from '../../../assets/setting.png';
import Sos from '../../../assets/sos.png';
import UpArrow from '../../../assets/up_arrow.png';
import { BaseModal } from '../../../shared/components/modal';
import { ROUTES } from '../../../shared/constants/routes';
import { useGazeInteraction } from '../../gazeInteraction/GazeInteractionContext';
import { usePageScope } from '../../gazeInteraction/usePageScope';
import { useGazeTarget } from '../../gazeInteraction/useGazeTarget';
import VirtualKeyboard from '../../keyboard/components/VirtualKeyboard';
import { useKeyboardInput } from '../../keyboard/hooks/useKeyboardInput';
import { useKeyboardGazeTargets } from '../../keyboard/useKeyboardGazeTargets';
import { useUserSettings } from '../../userSetting/hooks/useUserSettings';
import { getCurrentUserId } from '../../../shared/utils/jwt';
import { getChatRoomMessages } from '../api/chatRooms';
import { isSendableMessage, sendFriendChatMessage, sendHospitalChatMessage } from '../chatSend';
import { isMessageEntryEnabled, needsChatRoomCreation, resolveSelectedRoom } from '../roomSelection';
import type { ChatMessage, ChatRoom } from '../types/chat';
import { formatChatTime } from '../utils/formatChatTime';
import { mapChatRoomMessagesToChatMessages } from '../utils/chatMappers';
import {
  RequestIcon,
  SearchIcon,
} from './ChatIcons';
import './PatientChatView.css';

type OpenEmergencyState = 'closed' | 'countdown' | 'complete';

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
  searchPath: string;
  phoneVerified?: boolean;
  onRoomSelect?: (room: ChatRoom) => void;
  onRequirePhoneVerification?: () => void;
  /** Front Step 17 §30 — room 목록 조회 실패를 조용히 무시하지 않고 화면에 알리기 위한
   * 추가 전용 prop(기본값 null이면 기존 동작과 동일). */
  loadError?: string | null;
}

export default function PatientChatView({
  mode,
  title,
  rooms,
  initialRoomId,
  switchLabel,
  switchPath,
  searchPath,
  phoneVerified = true,
  onRoomSelect,
  onRequirePhoneVerification,
  loadError = null,
}: PatientChatViewProps) {
  const navigate = useNavigate();
  const messageListRef = useRef<HTMLDivElement>(null);
  const keyboardContainerRef = useRef<HTMLDivElement | null>(null);
  const hasShownPhoneVerification = useRef(phoneVerified === false);
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(!phoneVerified);
  const [emergencyState, setEmergencyState] = useState<OpenEmergencyState>('closed');
  const [countdown, setCountdown] = useState(5);

  // Front Step 14 — 메시지 보내기 → VirtualKeyboard 오버레이. Keyboard는 텍스트를 직접
  // 알지 못하고 onConfirm(composedText)만 호출한다(VirtualKeyboard Integration Plan §15.4).
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);

  const { settings } = useUserSettings();
  const { setActiveScope } = useGazeInteraction();

  const roomPageSize = ROOM_SLOT_COUNT;
  const roomPageCount = Math.max(1, Math.ceil(rooms.length / roomPageSize));
  const visibleRooms = rooms.slice(listPage * roomPageSize, (listPage + 1) * roomPageSize);
  const selectedRoom = resolveSelectedRoom(rooms, selectedRoomId);
  const pageClassName = `patient-chat-page patient-chat-page--${mode}${
    phoneVerified ? '' : ' patient-chat-page--unverified'
  }`;

  const selectedRoomRef = useRef(selectedRoom);
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  // Front Step 17 §0/§9 BUG A/B root cause(Friend Chat) — 기존에는 room 선택 시 사용자가
  // 직접 카드를 클릭(handleRoomSelect)해야만 onRoomSelect(→ ensureSmsChatRoom)가 호출됐다.
  // 초기/기본으로 선택된 room(예: 유일한 친구 1명이 `?? rooms[0]`로 자동 선택된 경우)은
  // 한 번도 명시적으로 "선택"되지 않으므로 SMS chatRoomId가 영원히 만들어지지 않아
  // "메시지 보내기"가 계속 disabled로 보였다. selectedRoom이 바뀔 때마다(수동 선택이든
  // 자동 기본값이든) chatRoomId가 아직 없으면 항상 find-or-create를 시도한다.
  // ensureSmsChatRoom 자체가 friendshipId 단위로 중복 호출을 막으므로 안전하다.
  useEffect(() => {
    if (needsChatRoomCreation(selectedRoom)) {
      onRoomSelect?.(selectedRoom as ChatRoom);
    }
  }, [selectedRoom, onRoomSelect]);

  // Front Step 14 §9 — Chat 목록/채팅방은 기본 CHAT scope. Keyboard가 열리면 KEYBOARD로
  // 전환해 뒤쪽 room 카드/설정/메시지 보내기 버튼이 실수로 선택되지 않게 한다(§12).
  usePageScope('CHAT');

  useEffect(() => {
    setActiveScope(isKeyboardOpen ? 'KEYBOARD' : 'CHAT');
  }, [isKeyboardOpen, setActiveScope]);

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

  // Front Step 14 §7/§20 — 실제 CHAT-005 history를 room 선택마다 조회해 복호화한다.
  // WebSocket 실시간 수신은 이번 범위에 없다(최종 보고에 KNOWN_LIMITATION으로 기록) —
  // 전송 성공 시에는 아래 handleConfirmSend가 직접 historyMessages에 추가한다.
  useEffect(() => {
    let isMounted = true;
    const chatRoomId = selectedRoom?.chatRoomId;

    // react-hooks/set-state-in-effect — setState는 항상 이 async 함수(콜백) 안에서만
    // 호출한다. chatRoomId가 없는 경우도 동일하게 이 함수를 거쳐 비운다.
    const loadHistory = async () => {
      if (!chatRoomId) {
        if (isMounted) {
          setHistoryMessages([]);
        }
        return;
      }

      try {
        const data = await getChatRoomMessages(chatRoomId);
        const currentUserId = getCurrentUserId();
        const mapped = await mapChatRoomMessagesToChatMessages(data.messages, currentUserId);

        if (isMounted) {
          setHistoryMessages(mapped);
        }
      } catch {
        if (isMounted) {
          setHistoryMessages([]);
        }
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [selectedRoom?.chatRoomId]);

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

  const handleRoomSelect = useCallback(
    (room: ChatRoom) => {
      setSelectedRoomId(room.id);
      onRoomSelect?.(room);
    },
    [onRoomSelect],
  );

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

  // ── Chat → VirtualKeyboard(§10) ──
  const clearTextRef = useRef<() => void>(() => {});

  const handleMessageSend = useCallback(() => {
    if (!phoneVerified) {
      requestPhoneVerification();
      return;
    }

    if (!isMessageEntryEnabled(selectedRoomRef.current)) return;

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
            ? await sendHospitalChatMessage(room.chatRoomId, room.targetUserId ?? '', composedText)
            : await sendFriendChatMessage(room.chatRoomId, composedText);

        setHistoryMessages((prev) => [
          ...prev,
          {
            id: String(result.messageId),
            text: composedText.trim(),
            direction: 'sent',
            createdAt: result.createdAt,
          },
        ]);

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
    [mode],
  );

  const { keyboardState, text, handleKeySelect, clearText } = useKeyboardInput({ onConfirm: handleConfirmSend });

  useEffect(() => {
    clearTextRef.current = clearText;
  }, [clearText]);

  const layoutSignature = `${keyboardState.isKorean}-${keyboardState.isShift}`;
  useKeyboardGazeTargets(keyboardContainerRef, handleKeySelect, layoutSignature, isKeyboardOpen);

  // ── Gaze targets(§13, 실제 존재하는 최소 navigation/action만) ──
  const brandTargetRef = useGazeTarget({ id: 'chat-brand', scope: 'CHAT', onSelect: () => navigate(ROUTES.MAIN) });
  const switchTargetRef = useGazeTarget({ id: 'chat-switch', scope: 'CHAT', onSelect: () => navigate(switchPath) });
  const searchTargetRef = useGazeTarget({
    id: 'chat-search',
    scope: 'CHAT',
    enabled: phoneVerified,
    onSelect: () => navigate(searchPath),
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
    onSelect: () => setListPage((page) => Math.min(roomPageCount - 1, page + 1)),
  });
  const messageSendTargetRef = useGazeTarget({
    id: 'chat-message-send',
    scope: 'CHAT',
    enabled: isMessageEntryEnabled(selectedRoom),
    onSelect: handleMessageSend,
  });
  const settingsTargetRef = useGazeTarget({ id: 'chat-settings', scope: 'CHAT', onSelect: handleSettingsOpen });
  const emergencyTargetRef = useGazeTarget({ id: 'chat-emergency', scope: 'CHAT', onSelect: handleEmergencyOpen });

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
        <aside className="patient-chat-sidebar" aria-label={`${title} 대상 목록`}>
          <header className="patient-chat-sidebar-header">
            <div className="patient-chat-sidebar-heading">
              <Link
                ref={brandTargetRef}
                className="patient-chat-brand"
                to={ROUTES.MAIN}
                aria-label="Look Talk 메인 페이지로 이동"
              >
                <img className="patient-chat-brand-image" src={Logo} alt="Look Talk 로고" />
              </Link>
              <h1 className="patient-chat-sidebar-title">{title}</h1>
            </div>
            <div className="patient-chat-sidebar-actions">
              <Link ref={switchTargetRef} className="patient-chat-link-action" to={switchPath}>
                {switchLabel}
              </Link>
              {phoneVerified ? (
                <Link ref={searchTargetRef} className="patient-chat-search-action" to={searchPath}>
                  <SearchIcon size={30} />
                  검색
                </Link>
              ) : (
                <button className="patient-chat-search-action" disabled type="button">
                  <SearchIcon size={30} />
                  검색
                </button>
              )}
            </div>
          </header>

          {loadError && (
            <p className="patient-chat-load-error" role="alert">
              {loadError}
            </p>
          )}
          {!loadError && rooms.length === 0 && (
            <p className="patient-chat-empty-state">
              {mode === 'hospital' ? '표시할 병원 채팅 상대가 없습니다.' : '등록된 친구가 없습니다.'}
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

          <div className="patient-chat-pagination" aria-label="채팅 대상 목록 페이지 이동">
            <button
              ref={prevPageTargetRef}
              className="patient-chat-pagination-button"
              disabled={!phoneVerified || listPage === 0}
              type="button"
              onClick={() => setListPage((page) => Math.max(0, page - 1))}
            >
              이전
            </button>
            <button
              ref={nextPageTargetRef}
              className="patient-chat-pagination-button"
              disabled={!phoneVerified || listPage >= roomPageCount - 1}
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
                ref={emergencyTargetRef}
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
              {historyMessages.map((message) => {
                const formattedTime = formatChatTime(message.createdAt);

                return (
                  <article
                    aria-label={`${message.text}${formattedTime ? `, ${formattedTime}` : ''}`}
                    key={message.id}
                    className={`patient-chat-message patient-chat-message--${message.direction}`}
                  >
                    <span className="patient-chat-message-text">{message.text}</span>
                    {formattedTime && (
                      <time className="patient-chat-message-time" dateTime={message.createdAt ?? undefined}>
                        {formattedTime}
                      </time>
                    )}
                  </article>
                );
              })}
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
              ref={messageSendTargetRef}
              aria-label="메시지 보내기"
              className="patient-chat-message-entry"
              disabled={!isMessageEntryEnabled(selectedRoom)}
              type="button"
              onClick={handleMessageSend}
            >
              <span>메 시 지&nbsp; 보 내 기</span>
            </button>
            <button
              ref={settingsTargetRef}
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

      {/* Front Step 14 §11 — 기존 VirtualKeyboard를 그대로 재사용하는 full-page 오버레이.
          채팅 뒤쪽 UI는 이 레이어 아래에 가려져 mouse로도 눌리지 않고, activeScope도
          KEYBOARD로 전환되어 gaze로도 선택되지 않는다(§12). */}
      {isKeyboardOpen && (
        <div className="patient-chat-keyboard-overlay" role="dialog" aria-modal="true" aria-label="메시지 입력">
          <div className="patient-chat-keyboard-panel">
            <header className="patient-chat-keyboard-header">
              <p className="patient-chat-keyboard-draft">{text || '문장을 입력하세요.'}</p>
              <button
                type="button"
                className="patient-chat-keyboard-close"
                onClick={handleKeyboardClose}
                disabled={isSending}
              >
                닫기
              </button>
            </header>

            {sendError && (
              <p className="patient-chat-keyboard-error" role="alert">
                {sendError}
              </p>
            )}
            {isSending && <p className="patient-chat-keyboard-status">전송 중입니다…</p>}

            <div ref={keyboardContainerRef}>
              <VirtualKeyboard
                keyboardState={keyboardState}
                onKeySelect={handleKeySelect}
                keyEnlarged={settings?.keyEnlarged ?? false}
              />
            </div>
          </div>
        </div>
      )}

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
