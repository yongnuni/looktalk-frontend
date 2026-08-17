import type { ChatRoom } from './types/chat';

// Front Step 17 §31 — PatientChatView의 room 선택/메시지 진입 가능 여부 판정 로직을
// 순수 함수로 분리한다(§8/§9 root cause였던 selectedRoom.chatRoomId 판정을 테스트로
// 직접 검증하기 위함). PatientChatView.tsx는 이 함수들을 그대로 재사용한다.

export function resolveSelectedRoom(
  rooms: ChatRoom[],
  selectedRoomId: string,
): ChatRoom | undefined {
  return rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];
}

export function isMessageEntryEnabled(room: ChatRoom | undefined): boolean {
  return Boolean(room?.chatRoomId);
}

export function needsChatRoomCreation(room: ChatRoom | undefined): boolean {
  return Boolean(room) && !room?.chatRoomId;
}
