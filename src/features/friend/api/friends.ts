import { apiClient } from '../../../shared/api/apiClient';
import type { ApiResponse, SmsFriendshipDto } from '../../../shared/types/backend';

export async function getSmsFriends(): Promise<SmsFriendshipDto[]> {
  const response = await apiClient.get<ApiResponse<SmsFriendshipDto[]>>('/friends');

  return response.data.data;
}
