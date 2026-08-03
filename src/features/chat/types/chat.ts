export type ChatMessageDirection = 'received' | 'sent';

export type ChatRoomIcon = 'request' | 'person';

export interface ChatMessage {
  id: string;
  text: string;
  direction: ChatMessageDirection;
}

export interface HospitalChatRoom {
  id: string;
  name: string;
  icon: ChatRoomIcon;
  messages: ChatMessage[];
}
