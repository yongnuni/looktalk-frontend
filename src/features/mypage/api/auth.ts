import { apiClient } from '../../../shared/api/apiClient';

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}
