import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  CreateEmergencyCallResponseDto,
  EmergencyCallPageDto,
  MarkEmergencyCallReadResponseDto,
} from '../../../shared/types/backend';

export async function createEmergencyCall(): Promise<CreateEmergencyCallResponseDto> {
  const response =
    await apiClient.post<ApiResponse<CreateEmergencyCallResponseDto>>('/emergency-calls');

  return response.data.data;
}

export interface GetEmergencyCallsParams {
  page?: number;
  size?: number;
  unreadOnly?: boolean;
}

export async function getEmergencyCalls({
  page = 0,
  size = 20,
  unreadOnly = false,
}: GetEmergencyCallsParams = {}): Promise<EmergencyCallPageDto> {
  const response = await apiClient.get<ApiResponse<EmergencyCallPageDto>>('/emergency-calls', {
    params: { page, size, unreadOnly },
  });

  return response.data.data;
}

export async function markEmergencyCallRead(
  emergencyCallId: number,
): Promise<MarkEmergencyCallReadResponseDto> {
  const response = await apiClient.patch<ApiResponse<MarkEmergencyCallReadResponseDto>>(
    `/emergency-calls/${emergencyCallId}/read`,
  );

  return response.data.data;
}
