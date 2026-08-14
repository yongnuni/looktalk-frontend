import { apiClient } from '../../../shared/api/apiClient';
import type { ApiResponse, StaffAssignedPatientDto } from '../../../shared/types/backend';

export async function getMyAssignedPatients(): Promise<StaffAssignedPatientDto[]> {
  const response = await apiClient.get<ApiResponse<StaffAssignedPatientDto[]>>('/staff/me/patients');

  return response.data.data;
}
