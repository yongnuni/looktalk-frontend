import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  InputSessionLogDto,
  InputMethod,
} from '../../../shared/types/backend';

export type InputSessionType = 'CALIBRATION_TEST' | 'NORMAL_USE';

export interface CreateInputSessionRequest {
  sessionType: InputSessionType;
  inputMethod: InputMethod;
  calibrationId: string;
  keyboardLayout?: string;
  typoRate: number;
  inputSpeed: number;
  recognitionAccuracy: number | null;
  inputStability: number | null;
}

// 측정 결과 저장
export async function createInputSession(
  payload: CreateInputSessionRequest,
): Promise<InputSessionLogDto> {
  const response = await apiClient.post<ApiResponse<InputSessionLogDto>>(
    '/input-sessions',
    payload,
  );

  return response.data.data;
}

// 입력 방식 측정 이력 조회
export async function getInputSessions(
  sessionType: InputSessionType = 'CALIBRATION_TEST',
  size = 30,
): Promise<InputSessionLogDto[]> {
  const response = await apiClient.get<ApiResponse<InputSessionLogDto[]>>(
    '/input-sessions',
    {
      params: { sessionType, size },
    },
  );

  return response.data.data;
}
