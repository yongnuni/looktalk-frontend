import { apiClient } from '../../../shared/api/apiClient';
import type { ApiResponse, StaffMeDto } from '../../../shared/types/backend';

export async function getStaffMe(): Promise<StaffMeDto> {
  const response = await apiClient.get<ApiResponse<StaffMeDto>>('/staff/me');

  return response.data.data;
}
