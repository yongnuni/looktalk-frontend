import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  CreatePhraseResponseDto,
  PhraseDto,
  UpsertPhraseRequestDto,
} from '../../../shared/types/backend';

export async function getPhrases(): Promise<PhraseDto[]> {
  const response = await apiClient.get<ApiResponse<PhraseDto[]>>('/phrases');

  return response.data.data;
}

export async function createPhrase(
  payload: UpsertPhraseRequestDto,
): Promise<CreatePhraseResponseDto> {
  const response = await apiClient.post<ApiResponse<CreatePhraseResponseDto>>(
    '/phrases',
    payload,
  );

  return response.data.data;
}

export async function updatePhrase(
  phraseId: number,
  payload: UpsertPhraseRequestDto,
): Promise<PhraseDto> {
  const response = await apiClient.patch<ApiResponse<PhraseDto>>(
    `/phrases/${phraseId}`,
    payload,
  );

  return response.data.data;
}

export async function deletePhrase(phraseId: number): Promise<void> {
  await apiClient.delete(`/phrases/${phraseId}`);
}
