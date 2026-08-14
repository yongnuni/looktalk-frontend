export type StaffChatMessageDirection = 'received' | 'sent';

export interface StaffProfile {
  staffId: number;
  userId: string;
  userName: string;
  teamName: string;
  hospitalId: number;
  hospitalName: string;
}

export interface StaffChatMessage {
  id: string;
  content: string;
  direction: StaffChatMessageDirection;
  createdAt: string;
}

export interface StaffPatientChat {
  // users.user_id와 대응하는 환자 계정 식별자입니다. patient 테이블은 사용하지 않습니다.
  patientUserId: string;
  // chat_room.room_id와 대응하며 병실 번호와는 별개의 값입니다.
  chatRoomId?: number;
  // 현재 DB 저장 위치가 확정되지 않은 화면 표시용 mock 값입니다.
  roomLabel?: string;
  patientName: string;
  // 백엔드 읽음 상태 구조가 아직 없어 프론트 mock에서만 사용하는 필드입니다.
  hasUnread: boolean;
  messages: StaffChatMessage[];
}
