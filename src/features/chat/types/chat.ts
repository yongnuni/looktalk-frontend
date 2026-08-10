export type ChatMessageDirection = 'received' | 'sent';

export type ChatRoomIcon = 'request' | 'person';

export interface ChatMessage {
  id: string;
  text: string;
  direction: ChatMessageDirection;
  createdAt: string | null;
}

export interface ChatRoom {
  // 화면에서 사용하는 문자열 식별자이며 chat_room.room_id DTO와 동일하다고 가정하지 않습니다.
  id: string;
  name: string;
  icon: ChatRoomIcon;
  messages: ChatMessage[];
}
