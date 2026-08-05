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
  patientId: string;
  roomId: number;
  roomLabel: string;
  patientName: string;
  // 백엔드에 읽음 관련 컬럼이 없어 현재는 프론트 mock 상태로만 관리합니다.
  hasUnread: boolean;
  messages: StaffChatMessage[];
}
