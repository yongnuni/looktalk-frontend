import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  RequestPhoneVerificationResponseDto,
  UpdateUserNameResponseDto,
  UserMeDto,
} from '../../../shared/types/backend';

export async function getMe(): Promise<UserMeDto> {
  const response = await apiClient.get<ApiResponse<UserMeDto>>('/users/me');

  return response.data.data;
}

export async function updateMyName(
  name: string | null,
): Promise<UpdateUserNameResponseDto> {
  const response = await apiClient.patch<ApiResponse<UpdateUserNameResponseDto>>(
    '/users/me',
    { name },
  );

  return response.data.data;
}

export async function deleteMyAccount(): Promise<void> {
  await apiClient.delete('/users/me');
}

export async function requestPhoneVerification(
  phone: string,
): Promise<RequestPhoneVerificationResponseDto> {
  const response = await apiClient.post<
    ApiResponse<RequestPhoneVerificationResponseDto>
  >('/users/me/phone-verifications', { phone });

  return response.data.data;
}

export async function confirmPhoneVerification(
  phone: string,
  code: string,
): Promise<void> {
  await apiClient.post('/users/me/phone-verifications/confirm', {
    phone,
    code,
  });
}
