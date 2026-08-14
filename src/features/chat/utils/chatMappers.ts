import type {
  ChatParticipantDto,
  ChatRoomDto,
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
    name: room.target.displayName ?? room.target.name ?? `Chat room ${room.roomId}`,
    icon: 'person',
    messages: [],
  };
}
