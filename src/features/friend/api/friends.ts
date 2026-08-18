import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  CreateSmsFriendRequestDto,
  SmsFriendshipDto,
  UpdateSmsFriendRequestDto,
} from '../../../shared/types/backend';

export async function getSmsFriends(): Promise<SmsFriendshipDto[]> {
  const response = await apiClient.get<ApiResponse<SmsFriendshipDto[]>>('/friends');

  return response.data.data;
}

export async function createSmsFriend(
  payload: CreateSmsFriendRequestDto,
): Promise<SmsFriendshipDto> {
  const response = await apiClient.post<ApiResponse<SmsFriendshipDto>>('/friends', payload);

  return response.data.data;
}

export async function updateSmsFriend(
  friendshipId: number,
  payload: UpdateSmsFriendRequestDto,
): Promise<SmsFriendshipDto> {
  const response = await apiClient.patch<ApiResponse<SmsFriendshipDto>>(
    `/friends/${friendshipId}`,
    payload,
  );

  return response.data.data;
}

export async function deleteSmsFriend(friendshipId: number): Promise<void> {
  await apiClient.delete(`/friends/${friendshipId}`);
}
