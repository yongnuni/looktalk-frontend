import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  ChatMessageCreatedEventDataDto,
  ChatRoomMessageDto,
  E2eeUserPublicKeyDto,
  EncryptedPayloadDto,
  SendChatRoomMessageDataDto,
} from '../../../shared/types/backend';
import { prepareCurrentUserE2eeKey } from '../../../shared/api/e2eeKeys';
import {
  decryptChatMessage,
  encryptChatMessage,
} from '../../../shared/utils/e2ee';
import type { ChatMessage } from '../types/chat';
import { sendChatRoomMessage } from './chatRooms';

const UNREADABLE_MESSAGE_TEXT = '메시지를 복호화할 수 없습니다.';

async function getUserPublicKey(userId: string): Promise<E2eeUserPublicKeyDto> {
  const response = await apiClient.get<ApiResponse<E2eeUserPublicKeyDto>>(
    `/e2ee/users/${encodeURIComponent(userId)}/public-key`,
  );
  return response.data.data;
}

export async function sendHospitalChatMessage(
  roomId: number,
  targetUserId: string,
  content: string,
): Promise<SendChatRoomMessageDataDto> {
  const currentKey = await prepareCurrentUserE2eeKey();
  const recipientUserIds = [...new Set([currentKey.userId, targetUserId])];
  const recipientKeys = await Promise.all(recipientUserIds.map(getUserPublicKey));
  const ciphertexts = await Promise.all(
    recipientKeys.map(async ({ userId, keyVersion, publicKey }) => {
      const encryptedPayload = await encryptChatMessage(content, publicKey, keyVersion);

      return {
        recipientUserId: userId,
        ...encryptedPayload,
      };
    }),
  );

  return sendChatRoomMessage(roomId, {
    messageType: 'TEXT',
    ciphertexts,
  });
}

export async function sendSmsChatMessage(
  roomId: number,
  content: string,
): Promise<SendChatRoomMessageDataDto> {
  await prepareCurrentUserE2eeKey();

  return sendChatRoomMessage(roomId, {
    messageType: 'TEXT',
    content,
  });
}

async function decryptPayload(
  payload: EncryptedPayloadDto,
  currentUserId: string,
): Promise<string> {
  try {
    return await decryptChatMessage(payload, currentUserId);
  } catch {
    return UNREADABLE_MESSAGE_TEXT;
  }
}

export async function mapChatMessageDto(
  message: ChatRoomMessageDto,
  currentUserId: string,
): Promise<ChatMessage> {
  return {
    id: String(message.messageId),
    text: await decryptPayload(message.encryptedPayload, currentUserId),
    direction: message.senderUserId === currentUserId ? 'sent' : 'received',
    createdAt: message.createdAt,
    senderDisplayName: message.senderDisplayName,
  };
}

export async function mapChatEventData(
  message: ChatMessageCreatedEventDataDto,
  currentUserId: string,
): Promise<ChatMessage> {
  return {
    id: String(message.messageId),
    text: await decryptPayload(message.encryptedPayload, currentUserId),
    direction: message.senderUserId === currentUserId ? 'sent' : 'received',
    createdAt: message.createdAt,
    senderDisplayName: message.senderDisplayName,
  };
}
