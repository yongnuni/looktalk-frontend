import { decryptMemo } from '../../../shared/utils/e2ee';
import type {
  ChatParticipantDto,
  ChatRoomDto,
  ChatRoomMessageDto,
  FriendshipDto,
  HospitalChatRoomDto,
  MessageDto,
  SmsFriendshipDto,
} from '../../../shared/types/backend';
import type { ChatMessage, ChatRoom, ChatRoomIcon } from '../types/chat';

export function mapMessageDtoToChatMessage(
  message: MessageDto,
  currentParticipantId?: number,
): ChatMessage {
  return {
    id: String(message.message_id),
    text: message.content,
    direction:
      currentParticipantId !== undefined &&
      message.sender_participant_id === currentParticipantId
        ? 'sent'
        : 'received',
    createdAt: message.created_at,
  };
}

export function mapChatRoomDtoToChatRoom(
  room: ChatRoomDto,
  participants: ChatParticipantDto[] = [],
  messages: MessageDto[] = [],
  options: { icon?: ChatRoomIcon; name?: string; currentParticipantId?: number } = {},
): ChatRoom {
  const displayParticipant = participants.find(
    (participant) => participant.external_name || participant.user_id,
  );

  return {
    id: String(room.room_id),
    name:
      options.name ??
      displayParticipant?.external_name ??
      `채팅방 ${room.room_id}`,
    icon: options.icon ?? (room.room_type === 'REQUEST' ? 'request' : 'person'),
    messages: messages.map((message) =>
      mapMessageDtoToChatMessage(message, options.currentParticipantId),
    ),
  };
}

export function mapFriendshipDtoToChatRoom(friendship: FriendshipDto): ChatRoom {
  return {
    id: `friendship-${friendship.friendship_id}`,
    friendshipId: friendship.friendship_id,
    name:
      friendship.friend_name ??
      friendship.friend_phone ??
      `친구 ${friendship.friendship_id}`,
    icon: 'person',
    messages: [],
  };
}

export function mapSmsFriendshipDtoToChatRoom(friendship: SmsFriendshipDto): ChatRoom {
  return {
    id: `friendship-${friendship.friendshipId}`,
    friendshipId: friendship.friendshipId,
    name: friendship.name || friendship.phone || `친구 ${friendship.friendshipId}`,
    icon: 'person',
    messages: [],
  };
}

export function mapHospitalChatRoomDtoToChatRoom(room: HospitalChatRoomDto): ChatRoom {
  return {
    id: String(room.roomId),
    chatRoomId: room.roomId,
    name: room.target.displayName ?? room.target.name ?? `Chat room ${room.roomId}`,
    icon: 'person',
    messages: [],
    targetUserId: room.target.userId ?? undefined,
  };
}

/**
 * Front Step 14 — CHAT-005 history의 `encryptedPayload`는 이미 "현재 조회하는 나"용
 * ciphertext만 담고 있다(Backend ChatMessageService.toResponse가 recipientUserId=현재
 * 사용자로 필터링). HOSPITAL/SMS 둘 다 동일하게 sealed box이므로 `decryptMemo`를 그대로
 * 재사용해 복호화한다(암호화 코드를 중복 작성하지 않는다, Integration Plan §41).
 */
export async function mapChatRoomMessageDtoToChatMessage(
  message: ChatRoomMessageDto,
  currentUserId: string | null,
): Promise<ChatMessage> {
  let text: string;

  try {
    if (!currentUserId) throw new Error('currentUserId가 없어 메시지를 복호화할 수 없습니다.');
    text = await decryptMemo(message.encryptedPayload, currentUserId);
  } catch (error) {
    console.error(`메시지 복호화 실패 messageId=${message.messageId}`, error);
    text = '복호화할 수 없는 메시지입니다.';
  }

  return {
    id: String(message.messageId),
    text,
    direction: currentUserId !== null && message.senderUserId === currentUserId ? 'sent' : 'received',
    createdAt: message.createdAt,
  };
}

export async function mapChatRoomMessagesToChatMessages(
  messages: ChatRoomMessageDto[],
  currentUserId: string | null,
): Promise<ChatMessage[]> {
  // 서버 정렬(messageId DESC)을 그대로 유지하지 않고, 채팅 UI 관례대로 오래된 메시지가
  // 위로 오도록 뒤집는다 — CHAT-005는 최신순으로 내려주지만 화면은 시간순으로 보여준다.
  const decrypted = await Promise.all(messages.map((message) => mapChatRoomMessageDtoToChatMessage(message, currentUserId)));
  return decrypted.slice().reverse();
}
