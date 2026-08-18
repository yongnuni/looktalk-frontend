import { apiClient } from '../../../shared/api/apiClient';
import type { ApiResponse, StaffAssignedPatientDto } from '../../../shared/types/backend';

export async function getMyAssignedPatients(): Promise<StaffAssignedPatientDto[]> {
  const response = await apiClient.get<ApiResponse<StaffAssignedPatientDto[]>>('/staff/me/patients');

  return response.data.data;
}

export async function addAssignedPatient(patientLoginId: string): Promise<void> {
  await apiClient.post('/staff/me/patients', { patientLoginId });
}

export async function removeAssignedPatient(patientUserId: string): Promise<void> {
  await apiClient.delete(`/staff/me/patients/${patientUserId}`);
}

export async function updateAssignedPatientAlias(
  patientUserId: string,
  alias: string | null,
): Promise<StaffAssignedPatientDto> {
  const response = await apiClient.patch<ApiResponse<StaffAssignedPatientDto>>(
    `/staff/me/patients/${patientUserId}/alias`,
    { alias },
  );

  return response.data.data;
}
