import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import Logo from '../../../assets/Logo.png';
import SendImage from '../../../assets/send.png';
import SettingImage from '../../../assets/setting.png';

import { clearStoredAuthTokens } from '../../../shared/api/authToken';
import { disconnectAllChatWebSockets } from '../../../shared/api/websocketClient';
import { ROUTES } from '../../../shared/constants/routes';
import { useEmergencyStore } from '../../../shared/stores/emergencyStore';
import type { StaffAssignedPatientDto } from '../../../shared/types/backend';

import { sendHospitalChatMessage } from '../../chat/api/chatMessages';
import { createOrGetHospitalChatRoom } from '../../chat/api/chatRooms';
import { useChatRoomMessages } from '../../chat/hooks/useChatRoomMessages';
import { formatChatTime } from '../../chat/utils/formatChatTime';

import StaffEmergencyAlert from '../../emergency/components/StaffEmergencyAlert';

import { useStaffProfile } from '../../mypage/hooks/useStaffProfile';

import { getMyAssignedPatients } from '../api/staffPatients';
import type { StaffPatientChat } from '../types/staffChat';

import './StaffChatDashboard.css';

interface RoomPreparationState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

function getPatientDisplayName(patient: StaffAssignedPatientDto): string {
  return (
    patient.patientAlias ||
    patient.displayName ||
    patient.name ||
    patient.loginId ||
    patient.userId
  );
}

function toStaffPatientChat(
  patient: StaffAssignedPatientDto,
): StaffPatientChat {
  return {
    patientUserId: patient.userId,
    patientName: getPatientDisplayName(patient),
    hasUnread: false,
    messages: [],
  };
}

export default function StaffChatDashboard() {
  const navigate = useNavigate();

  const { name: staffName } = useStaffProfile();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roomRequestsRef = useRef(new Map<string, Promise<number>>());

  const [patients, setPatients] = useState<StaffPatientChat[]>([]);

  const [selectedPatientUserId, setSelectedPatientUserId] = useState<
    string | null
  >(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [draft, setDraft] = useState('');

  const [isSending, setIsSending] = useState(false);

  const [roomPreparations, setRoomPreparations] = useState<
    Record<string, RoomPreparationState>
  >({});

  const emergencyHistory = useEmergencyStore((state) => state.history);

  const selectedPatient = patients.find(
    (patient) => patient.patientUserId === selectedPatientUserId,
  );

  const selectedPatientChatRoomId = selectedPatient?.chatRoomId;

  const {
    addMessage,
    e2eeError,
    e2eeStatus,
    messages: selectedPatientMessages,
    retryE2ee,
  } = useChatRoomMessages(selectedPatientChatRoomId, {
    onMessageEvent: (_event, message) => {
      if (
        message.direction !== 'received' ||
        !message.senderDisplayName?.trim()
      ) {
        return;
      }

      setPatients((currentPatients) =>
        currentPatients.map((patient) =>
          patient.patientUserId === selectedPatientUserId
            ? {
                ...patient,
                patientName: message.senderDisplayName!,
              }
            : patient,
        ),
      );
    },
  });

  const selectedEmergencyCall =
    selectedPatient && selectedPatient.roomLabel
      ? emergencyHistory.find(
          (call) =>
            call.room === selectedPatient.roomLabel &&
            call.patientName === selectedPatient.patientName,
        )
      : undefined;

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredPatients = patients.filter((patient) => {
    if (!normalizedSearchQuery) {
      return true;
    }

    return [patient.patientName].some((value) =>
      value.toLowerCase().includes(normalizedSearchQuery),
    );
  });

  const selectedRoomPreparation: RoomPreparationState | null =
    selectedPatientUserId
      ? selectedPatientChatRoomId
        ? {
            status: 'ready',
            error: null,
          }
        : (roomPreparations[selectedPatientUserId] ?? {
            status: 'idle',
            error: null,
          })
      : null;

  /* =========================================================
     채팅방 생성 / 조회
  ========================================================= */

  const ensurePatientRoom = useCallback(
    (targetUserId: string): Promise<number> => {
      const existingRequest = roomRequestsRef.current.get(targetUserId);

      if (existingRequest) {
        return existingRequest;
      }

      setRoomPreparations((current) => ({
        ...current,

        [targetUserId]: {
          status: 'loading',
          error: null,
        },
      }));

      const request = createOrGetHospitalChatRoom(targetUserId)
        .then(({ roomId }) => {
          setPatients((currentPatients) =>
            currentPatients.map((patient) =>
              patient.patientUserId === targetUserId &&
              patient.chatRoomId === undefined
                ? {
                    ...patient,
                    chatRoomId: roomId,
                  }
                : patient,
            ),
          );

          setRoomPreparations((current) => ({
            ...current,

            [targetUserId]: {
              status: 'ready',
              error: null,
            },
          }));

          return roomId;
        })

        .catch((error: unknown) => {
          setRoomPreparations((current) => ({
            ...current,

            [targetUserId]: {
              status: 'error',

              error:
                error instanceof Error
                  ? error.message
                  : '채팅방을 준비하지 못했습니다.',
            },
          }));

          throw error;
        })

        .finally(() => {
          roomRequestsRef.current.delete(targetUserId);
        });

      roomRequestsRef.current.set(targetUserId, request);

      return request;
    },
    [],
  );

  /* =========================================================
     담당 환자 목록 조회
  ========================================================= */

  useEffect(() => {
    let isMounted = true;

    const loadAssignedPatients = async () => {
      try {
        const assignedPatients = await getMyAssignedPatients();

        const nextPatients = assignedPatients.map(toStaffPatientChat);

        if (isMounted) {
          setPatients(nextPatients);

          setSelectedPatientUserId(nextPatients[0]?.patientUserId ?? null);
        }
      } catch {
        if (isMounted) {
          setPatients([]);

          setSelectedPatientUserId(null);
        }
      }
    };

    void loadAssignedPatients();

    return () => {
      isMounted = false;
    };
  }, []);

  /* =========================================================
     선택 환자 채팅방 준비
  ========================================================= */

  useEffect(() => {
    if (
      !selectedPatientUserId ||
      selectedPatientChatRoomId !== undefined ||
      selectedRoomPreparation?.status !== 'idle'
    ) {
      return;
    }

    void ensurePatientRoom(selectedPatientUserId).catch(() => undefined);
  }, [
    ensurePatientRoom,
    selectedPatientChatRoomId,
    selectedPatientUserId,
    selectedRoomPreparation?.status,
  ]);

  /* =========================================================
     메시지 자동 스크롤
  ========================================================= */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [selectedPatientMessages.length, selectedPatientUserId]);

  /* =========================================================
     환자 선택
  ========================================================= */

  const selectPatient = (patientUserId: string) => {
    setSelectedPatientUserId(patientUserId);

    setDraft('');

    setPatients((currentPatients) =>
      currentPatients.map((patient) =>
        patient.patientUserId === patientUserId
          ? {
              ...patient,
              hasUnread: false,
            }
          : patient,
      ),
    );
  };

  /* =========================================================
     메시지 전송
  ========================================================= */

  const sendMessage = async () => {
    const content = draft.trim();

    if (!content || !selectedPatient?.chatRoomId || isSending) {
      return;
    }

    setIsSending(true);

    try {
      const sentMessage = await sendHospitalChatMessage(
        selectedPatient.chatRoomId,
        selectedPatient.patientUserId,
        content,
      );

      addMessage({
        id: String(sentMessage.messageId),

        text: content,

        direction: 'sent',

        createdAt: sentMessage.createdAt,
      });

      setDraft('');
    } catch {
      alert(
        '메시지를 전송하지 못했습니다. 로그인 상태와 네트워크 연결을 확인해주세요.',
      );
    } finally {
      setIsSending(false);
    }
  };

  const canSendMessage = Boolean(
    selectedPatient?.chatRoomId &&
    selectedRoomPreparation?.status === 'ready' &&
    e2eeStatus === 'ready' &&
    !isSending,
  );

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      void sendMessage();
    }
  };

  /* =========================================================
     로그아웃
  ========================================================= */

  const logout = () => {
    disconnectAllChatWebSockets();

    clearStoredAuthTokens();

    navigate('/login');
  };

  return (
    <main className="staff-chat-page">
      <div className="staff-chat-shell">
        {/* ===================================================
            Sidebar
        =================================================== */}

        <aside className="staff-chat-sidebar" aria-label="환자 목록">
          <header className="staff-chat-sidebar-header">
            <div className="staff-chat-brand" aria-label="Look Talk">
              <img src={Logo} alt="Look Talk 로고" />
            </div>

            <div className="staff-chat-profile">
              <p>{staffName}</p>

              <button
                className="staff-chat-logout"
                onClick={logout}
                type="button"
              >
                로그아웃
              </button>
            </div>
          </header>

          {/* 검색 */}

          <div className="staff-chat-search-wrap">
            <label
              className="staff-chat-visually-hidden"
              htmlFor="staff-patient-search"
            >
              환자 검색
            </label>

            <input
              aria-label="환자 검색"
              className="staff-chat-search"
              id="staff-patient-search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="검색"
              type="search"
              value={searchQuery}
            />
          </div>

          {/* 담당 환자 */}

          <div className="staff-chat-patient-list" aria-label="담당 환자 목록">
            {filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <button
                  aria-label={`${patient.patientName} 환자${
                    patient.hasUnread ? ' 읽지 않은 메시지 있음' : ''
                  }`}
                  aria-pressed={patient.patientUserId === selectedPatientUserId}
                  className={`staff-chat-patient-row${
                    patient.patientUserId === selectedPatientUserId
                      ? ' staff-chat-patient-row--selected'
                      : ''
                  }`}
                  key={patient.patientUserId}
                  onClick={() => selectPatient(patient.patientUserId)}
                  type="button"
                >
                  <span>{patient.patientName} 환자</span>

                  {patient.hasUnread && (
                    <span
                      aria-label="읽지 않은 메시지가 있습니다"
                      className="staff-chat-unread-dot"
                      role="img"
                    />
                  )}
                </button>
              ))
            ) : (
              <p className="staff-chat-no-results">검색 결과가 없습니다.</p>
            )}
          </div>
        </aside>

        {/* ===================================================
            Conversation
        =================================================== */}

        <section className="staff-chat-conversation" aria-label="환자 채팅">
          <header className="staff-chat-conversation-header">
            <p className="staff-chat-room-label">
              {selectedPatient?.patientName ?? ''}
            </p>

            <button
              aria-label="의료진 마이페이지로 이동"
              className="staff-chat-settings-button"
              onClick={() => navigate(ROUTES.STAFF_MYPAGE)}
              type="button"
            >
              <img src={SettingImage} alt="" />
            </button>
          </header>

          {/* =================================================
              Messages
          ================================================= */}

          <div className="staff-chat-messages" aria-live="polite">
            {/* E2EE */}

            {e2eeStatus === 'loading' && (
              <p className="staff-chat-empty" role="status">
                암호화 키를 준비하고 있습니다.
              </p>
            )}

            {e2eeStatus === 'error' && (
              <div role="alert">
                <p className="staff-chat-empty">{e2eeError}</p>

                <button type="button" onClick={retryE2ee}>
                  다시 시도
                </button>
              </div>
            )}

            {/* 채팅방 준비 */}

            {selectedRoomPreparation?.status === 'loading' && (
              <p className="staff-chat-empty" role="status">
                채팅방을 준비하고 있습니다.
              </p>
            )}

            {selectedRoomPreparation?.status === 'error' &&
              selectedPatientUserId && (
                <div role="alert">
                  <p className="staff-chat-empty">
                    {selectedRoomPreparation.error}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      void ensurePatientRoom(selectedPatientUserId).catch(
                        () => undefined,
                      );
                    }}
                  >
                    다시 시도
                  </button>
                </div>
              )}

            {/* =================================================
                기존 비상호출 표시
            ================================================= */}

            {selectedEmergencyCall && (
              <div className="staff-chat-emergency-notice" role="status">
                <strong>비상호출</strong>

                <time dateTime={selectedEmergencyCall.calledAt}>
                  {selectedEmergencyCall.calledAt}
                </time>
              </div>
            )}

            {/* =================================================
                채팅 메시지
            ================================================= */}

            {selectedPatientMessages.length > 0 ? (
              selectedPatientMessages.map((message) => (
                <div
                  className={`staff-chat-message staff-chat-message--${message.direction}`}
                  key={message.id}
                >
                  <div className="staff-chat-message-bubble">
                    <p>{message.text}</p>

                    <time dateTime={message.createdAt ?? undefined}>
                      {formatChatTime(message.createdAt)}
                    </time>
                  </div>
                </div>
              ))
            ) : (
              <p className="staff-chat-empty">아직 대화가 없습니다.</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* =================================================
              Composer
          ================================================= */}

          <form
            className="staff-chat-composer"
            onSubmit={(event) => {
              event.preventDefault();

              void sendMessage();
            }}
          >
            <label
              className="staff-chat-visually-hidden"
              htmlFor="staff-message-input"
            >
              메시지 입력
            </label>

            <textarea
              aria-label="메시지 입력"
              className="staff-chat-message-input"
              disabled={!canSendMessage}
              id="staff-message-input"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="메시지를 입력하세요."
              rows={2}
              value={draft}
            />

            <button
              aria-label="메시지 전송"
              className="staff-chat-send-button"
              disabled={!canSendMessage}
              type="submit"
            >
              <img alt="" src={SendImage} />
            </button>
          </form>
        </section>
      </div>

      {/* =====================================================
          담당 환자 비상호출 실시간 팝업
      ===================================================== */}

      <StaffEmergencyAlert />
    </main>
  );
}
