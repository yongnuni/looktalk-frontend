import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../../assets/Logo.png';
import SendImage from '../../../assets/send.png';
import SettingImage from '../../../assets/setting.png';
import { ROUTES } from '../../../shared/constants/routes';
import { useEmergencyStore } from '../../../shared/stores/emergencyStore';
import { staffPatientChats, staffProfile } from '../mock/staffChatMock';
import type { StaffChatMessage, StaffPatientChat } from '../types/staffChat';
import './StaffChatDashboard.css';

export default function StaffChatDashboard() {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [patients, setPatients] = useState<StaffPatientChat[]>(staffPatientChats);
  const [selectedPatientUserId, setSelectedPatientUserId] = useState(staffPatientChats[0].patientUserId);
  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState('');
  const emergencyHistory = useEmergencyStore((state) => state.history);

  const selectedPatient = patients.find((patient) => patient.patientUserId === selectedPatientUserId);
  const selectedEmergencyCall = emergencyHistory.find(
    (call) =>
      call.room === selectedPatient?.roomLabel &&
      call.patientName === selectedPatient?.patientName,
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredPatients = patients.filter((patient) => {
    if (!normalizedSearchQuery) return true;

    return [patient.roomLabel, patient.patientName].some((value) =>
      value.toLowerCase().includes(normalizedSearchQuery),
    );
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedPatientUserId, selectedPatient?.messages.length]);

  if (!selectedPatient) return null;

  const selectPatient = (patientUserId: string) => {
    setSelectedPatientUserId(patientUserId);
    setDraft('');
    setPatients((currentPatients) =>
      currentPatients.map((patient) =>
        patient.patientUserId === patientUserId ? { ...patient, hasUnread: false } : patient,
      ),
    );
  };

  const sendMessage = () => {
    const content = draft.trim();
    if (!content) return;

    const newMessage: StaffChatMessage = {
      id: `staff-message-${Date.now()}`,
      content,
      direction: 'sent',
      createdAt: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    };

    setPatients((currentPatients) =>
      currentPatients.map((patient) =>
        patient.patientUserId === selectedPatientUserId
          ? { ...patient, messages: [...patient.messages, newMessage] }
          : patient,
      ),
    );
    setDraft('');
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const logout = () => {
    localStorage.removeItem('looktalk_access_token');
    navigate('/login');
  };

  return (
    <main className="staff-chat-page">
      <div className="staff-chat-shell">
        <aside className="staff-chat-sidebar" aria-label="환자 목록">
          <header className="staff-chat-sidebar-header">
            <div className="staff-chat-brand" aria-label="Look Talk">
              <img src={Logo} alt="Look Talk 로고" />
            </div>
            <div className="staff-chat-profile">
              <p>{staffProfile.teamName}_{staffProfile.userName}</p>
              <button className="staff-chat-logout" onClick={logout} type="button">
                로그아웃
              </button>
            </div>
          </header>

          <div className="staff-chat-search-wrap">
            <label className="staff-chat-visually-hidden" htmlFor="staff-patient-search">
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

          <div className="staff-chat-patient-list" aria-label="담당 환자 목록">
            {filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <button
                  aria-label={`${patient.roomLabel} ${patient.patientName} 환자${patient.hasUnread ? ' 읽지 않은 메시지 있음' : ''}`}
                  aria-pressed={patient.patientUserId === selectedPatientUserId}
                  className={`staff-chat-patient-row${patient.patientUserId === selectedPatientUserId ? ' staff-chat-patient-row--selected' : ''}`}
                  key={patient.patientUserId}
                  onClick={() => selectPatient(patient.patientUserId)}
                  type="button"
                >
                  <span>{patient.roomLabel} - {patient.patientName} 환자</span>
                  {patient.hasUnread && (
                    <span aria-label="읽지 않은 메시지가 있습니다" className="staff-chat-unread-dot" role="img" />
                  )}
                </button>
              ))
            ) : (
              <p className="staff-chat-no-results">검색 결과가 없습니다.</p>
            )}
          </div>
        </aside>

        <section className="staff-chat-conversation" aria-label="환자 채팅">
          <header className="staff-chat-conversation-header">
            <p className="staff-chat-room-label">{selectedPatient.roomLabel}</p>
            <button
              aria-label="의료진 마이페이지로 이동"
              className="staff-chat-settings-button"
              onClick={() => navigate(ROUTES.STAFF_MYPAGE)}
              type="button"
            >
              <img src={SettingImage} alt="" />
            </button>
          </header>

          <div className="staff-chat-messages" aria-live="polite">
            {selectedEmergencyCall && (
              <div className="staff-chat-emergency-notice" role="status">
                <strong>비상호출</strong>
                <time dateTime={selectedEmergencyCall.calledAt}>
                  {selectedEmergencyCall.calledAt}
                </time>
              </div>
            )}
            {selectedPatient.messages.length > 0 ? (
              selectedPatient.messages.map((message) => (
                <div
                  className={`staff-chat-message staff-chat-message--${message.direction}`}
                  key={message.id}
                >
                  <div className="staff-chat-message-bubble">
                    <p>{message.content}</p>
                    <time dateTime={message.createdAt}>{message.createdAt}</time>
                  </div>
                </div>
              ))
            ) : (
              <p className="staff-chat-empty">아직 대화가 없습니다.</p>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="staff-chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <label className="staff-chat-visually-hidden" htmlFor="staff-message-input">
              메시지 입력
            </label>
            <textarea
              aria-label="메시지 입력"
              className="staff-chat-message-input"
              id="staff-message-input"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="메시지를 입력하세요."
              rows={2}
              value={draft}
            />
            <button aria-label="메시지 전송" className="staff-chat-send-button" type="submit">
              <img alt="" src={SendImage} />
            </button>
          </form>
        </section>
      </div>

    </main>
  );
}
