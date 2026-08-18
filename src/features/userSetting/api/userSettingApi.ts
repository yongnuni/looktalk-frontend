import { apiClient } from '../../../shared/api/apiClient';
import type { ApiResponse, UserSettingDto, UserSettingUpdateRequestDto } from '../../../shared/types/backend';

// 실제 백엔드 계약: GET/PATCH /api/users/me/settings, PATIENT 전용(STAFF는 403).
// apiClient의 baseURL이 이미 '/api'를 포함하므로 여기서는 '/users/...'만 사용한다.
export async function getUserSettings(): Promise<UserSettingDto> {
  const response = await apiClient.get<ApiResponse<UserSettingDto>>('/users/me/settings');
  return response.data.data;
}

export async function updateUserSettings(
  patch: UserSettingUpdateRequestDto,
): Promise<UserSettingDto> {
  const response = await apiClient.patch<ApiResponse<UserSettingDto>>('/users/me/settings', patch);
  return response.data.data;
}
