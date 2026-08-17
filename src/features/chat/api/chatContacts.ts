import { apiClient } from '../../../shared/api/apiClient';
import type { ApiResponse, ChatContactsDataDto } from '../../../shared/types/backend';

export interface GetChatContactsParams {
  page?: number;
  size?: number;
}

export async function getChatContacts(
  { page = 0, size = 20 }: GetChatContactsParams = {},
): Promise<ChatContactsDataDto> {
  const response = await apiClient.get<ApiResponse<ChatContactsDataDto>>('/chat-contacts', {
    params: { page, size },
  });

  return response.data.data;
}
