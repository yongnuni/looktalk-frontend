import { apiClient } from '../../../shared/api/apiClient';
import type { ApiResponse, ChatContactsDataDto } from '../../../shared/types/backend';

export interface GetChatContactsParams {
  keyword?: string;
  page?: number;
  size?: number;
}

export async function getChatContacts(
  { keyword, page = 0, size = 20 }: GetChatContactsParams = {},
): Promise<ChatContactsDataDto> {
  const params: GetChatContactsParams = { page, size };
  const trimmedKeyword = keyword?.trim();

  if (trimmedKeyword) {
    params.keyword = trimmedKeyword;
  }

  const response = await apiClient.get<ApiResponse<ChatContactsDataDto>>('/chat-contacts', {
    params,
  });

  return response.data.data;
}
