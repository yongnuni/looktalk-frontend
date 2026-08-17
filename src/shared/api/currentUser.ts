import type { ApiResponse, CurrentUserDto } from '../types/backend';
import { apiClient } from './apiClient';

export async function getCurrentUser(): Promise<CurrentUserDto> {
  const response = await apiClient.get<ApiResponse<CurrentUserDto>>('/users/me');
  return response.data.data;
}
