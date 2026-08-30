import { isAxiosError } from 'axios';
import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  CalibrationCreateRequestDto,
  CalibrationResponseDto,
} from '../../../shared/types/backend';
import type { GazeCalibrationResult } from '../types';

// Backend CalibrationDataValidator(TOP_LEVEL_FIELDS)가 허용하지 않는 필드가 하나라도
// 있으면 CALIBRATION_INVALID_PAYLOAD(400)로 전체 거부한다. GazeCalibrationResult의
// createdAtLocal은 frontend candidate 관리 전용 필드(§7.7 comment)라 Backend 계약에
// 없으므로 payload에서 제외해야 한다.
const ALGORITHM_VERSION = 'raw-homography-v1';

export interface PersistedCalibration {
  calibrationId: string;
  result: GazeCalibrationResult;
}

function toCalibrationData(candidate: GazeCalibrationResult): Omit<GazeCalibrationResult, 'createdAtLocal'> {
  // Backend TOP_LEVEL_FIELDS 허용 목록과 정확히 일치시키기 위해 필드를 명시적으로 나열한다
  // (createdAtLocal은 제외 — 허용 목록에 없어 포함 시 CALIBRATION_INVALID_PAYLOAD가 발생한다).
  return {
    schemaVersion: candidate.schemaVersion,
    mappingType: candidate.mappingType,
    coordinateSpace: candidate.coordinateSpace,
    homography: candidate.homography,
    mirrorX: candidate.mirrorX,
    mirrorStrategy: candidate.mirrorStrategy,
    grid: candidate.grid,
    calibratedViewport: candidate.calibratedViewport,
    reprojectionRmseNormalized: candidate.reprojectionRmseNormalized,
  };
}

function fromResponse(response: CalibrationResponseDto): PersistedCalibration {
  const data = response.calibrationData as Omit<GazeCalibrationResult, 'createdAtLocal'>;

  return {
    calibrationId: response.calibrationId,
    result: { ...data, createdAtLocal: response.createdAt },
  };
}

// CAL-001 — 사용자가 측정 결과 모달에서 입력 방식을 선택해 candidate를 적용할 때만 호출한다.
export async function createCalibration(candidate: GazeCalibrationResult): Promise<PersistedCalibration> {
  const payload: CalibrationCreateRequestDto = {
    algorithmVersion: ALGORITHM_VERSION,
    calibrationData: toCalibrationData(candidate),
  };

  const response = await apiClient.post<ApiResponse<CalibrationResponseDto>>('/calibrations', payload);
  return fromResponse(response.data.data);
}

// CAL-002 — active calibration이 없으면(CALIBRATION_NOT_FOUND, 404) null을 반환한다.
// 이는 "최초 사용자"를 나타내는 정상 상태이지 예외적 실패가 아니다. 그 외 오류(401/403/5xx)는
// 그대로 throw해 임의로 기본값 성공으로 치환하지 않는다.
export async function getActiveCalibration(): Promise<PersistedCalibration | null> {
  try {
    const response = await apiClient.get<ApiResponse<CalibrationResponseDto>>('/calibrations/active');
    if (response.status === 204) {
      return null;
    }
    return fromResponse(response.data.data);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}
