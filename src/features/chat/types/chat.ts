export type ChatMessageDirection = 'received' | 'sent';

export type ChatRoomIcon = 'request' | 'person';

export interface ChatMessage {
  id: string;
  text: string;
  direction: ChatMessageDirection;
  createdAt: string | null;
  senderDisplayName?: string;
}

export interface ChatRoom {
  // 화면에서 사용하는 문자열 식별자이며 chat_room.room_id DTO와 동일하다고 가정하지 않습니다.
  id: string;
  friendshipId?: number;
  chatRoomId?: number;
  name: string;
  icon: ChatRoomIcon;
  messages: ChatMessage[];
  /** HOSPITAL room 상대방의 내부 userId. Front Step 14 — CHAT-006 HOSPITAL 발송 시
   * E2EE-003으로 상대 공개키를 조회하기 위해 필요하다. SMS room/미확정 상태에서는 없다. */
  targetUserId?: string;
}
