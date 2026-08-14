import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  HospitalChatRoomDto,
  ChatRoomMessagesDataDto,
} from '../../../shared/types/backend';

export async function getHospitalChatRooms(): Promise<HospitalChatRoomDto[]> {
  const response = await apiClient.get<ApiResponse<HospitalChatRoomDto[]>>('/chat-rooms', {
    params: { type: 'HOSPITAL' },
  });

  return response.data.data;
}

export interface GetChatRoomMessagesParams {
  beforeMessageId?: number;
  size?: number;
}

export async function getChatRoomMessages(
  roomId: number,
  { beforeMessageId, size }: GetChatRoomMessagesParams = {},
): Promise<ChatRoomMessagesDataDto> {
  const params: GetChatRoomMessagesParams = {};

  if (beforeMessageId !== undefined) {
    params.beforeMessageId = beforeMessageId;
  }

  if (size !== undefined) {
    params.size = size;
  }

  const response = await apiClient.get<ApiResponse<ChatRoomMessagesDataDto>>(
    `/chat-rooms/${roomId}/messages`,
    { params },
  );

  return response.data.data;
}
