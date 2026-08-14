import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  ChatRoomMessagesDataDto,
  CreateOrGetHospitalChatRoomDataDto,
  CreateOrGetHospitalChatRoomRequestDto,
  CreateOrGetSmsChatRoomRequestDto,
  HospitalChatRoomDto,
  SendChatRoomMessageDataDto,
  SendChatRoomMessageRequestDto,
  SmsChatRoomDto,
} from '../../../shared/types/backend';

export async function getHospitalChatRooms(): Promise<HospitalChatRoomDto[]> {
  const response = await apiClient.get<ApiResponse<HospitalChatRoomDto[]>>('/chat-rooms', {
    params: { type: 'HOSPITAL' },
  });

  return response.data.data;
}

export async function createOrGetHospitalChatRoom(
  targetUserId: string,
): Promise<CreateOrGetHospitalChatRoomDataDto> {
  const payload: CreateOrGetHospitalChatRoomRequestDto = { targetUserId };
  const response = await apiClient.post<ApiResponse<CreateOrGetHospitalChatRoomDataDto>>(
    '/chat-rooms/hospital',
    payload,
  );

  return response.data.data;
}

export async function createOrGetSmsChatRoom(
  friendshipId: number,
): Promise<SmsChatRoomDto> {
  const payload: CreateOrGetSmsChatRoomRequestDto = { friendshipId };
  const response = await apiClient.post<ApiResponse<SmsChatRoomDto>>('/chat-rooms/sms', payload);

  return response.data.data;
}

export async function sendChatRoomMessage(
  roomId: number,
  payload: SendChatRoomMessageRequestDto,
): Promise<SendChatRoomMessageDataDto> {
  const response = await apiClient.post<ApiResponse<SendChatRoomMessageDataDto>>(
    `/chat-rooms/${roomId}/messages`,
    payload,
  );

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
