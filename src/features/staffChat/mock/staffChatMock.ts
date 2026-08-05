import type { StaffChatMessage, StaffChatMessageDirection, StaffPatientChat, StaffProfile } from '../types/staffChat';

export const staffProfile: StaffProfile = {
  staffId: 1,
  userId: 'staff-kim',
  userName: '김철수',
  teamName: '환자관리팀',
  hospitalId: 1,
  hospitalName: 'Look Talk 병원',
};

function message(
  id: string,
  content: string,
  direction: StaffChatMessageDirection,
  createdAt: string,
): StaffChatMessage {
  return { id, content, direction, createdAt };
}

export const staffPatientChats: StaffPatientChat[] = [
  {
    patientUserId: 'patient-user-101-kim',
    chatRoomId: 101,
    roomLabel: '101호',
    patientName: '김민준',
    hasUnread: true,
    messages: [
      message('101-kim-1', '몸이 불편해요', 'received', '09:42'),
      message('101-kim-2', '네 지금 갈게요', 'sent', '09:44'),
    ],
  },
  {
    patientUserId: 'patient-user-101-kang',
    chatRoomId: 102,
    roomLabel: '101호',
    patientName: '강민재',
    hasUnread: false,
    messages: [
      message('101-kang-1', '잠시 상담이 가능할까요?', 'received', '09:30'),
      message('101-kang-2', '확인 후 찾아가겠습니다.', 'sent', '09:35'),
    ],
  },
  {
    patientUserId: 'patient-user-102-yoon',
    chatRoomId: 103,
    roomLabel: '102호',
    patientName: '윤하리',
    hasUnread: false,
    messages: [
      message('102-yoon-1', '오늘 검사 시간이 궁금해요', 'received', '08:50'),
      message('102-yoon-2', '일정을 확인해드릴게요.', 'sent', '08:54'),
    ],
  },
  {
    patientUserId: 'patient-user-102-choi',
    chatRoomId: 104,
    roomLabel: '102호',
    patientName: '최예린',
    hasUnread: false,
    messages: [message('102-choi-1', '보호자에게 연락 부탁드려요', 'received', '08:20')],
  },
  {
    patientUserId: 'patient-user-102-kim',
    chatRoomId: 105,
    roomLabel: '102호',
    patientName: '김하늘',
    hasUnread: false,
    messages: [
      message('102-kim-1', '약 복용 시간을 알려주세요', 'received', '07:45'),
      message('102-kim-2', '간호팀에 확인하겠습니다.', 'sent', '07:49'),
    ],
  },
  {
    patientUserId: 'patient-user-201-lee',
    chatRoomId: 106,
    roomLabel: '201호',
    patientName: '이도현',
    hasUnread: false,
    messages: [],
  },
];
