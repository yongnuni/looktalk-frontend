import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, authRefreshClient } from '../../../shared/api/apiClient';
import { createCalibration, getActiveCalibration } from './calibrationApi';
import type { GazeCalibrationResult } from '../types';

const storage = new Map<string, string>();

function response(config: Parameters<AxiosAdapter>[0], status: number, data: unknown): AxiosResponse {
  return { config, status, statusText: String(status), headers: {}, data };
}

describe('getActiveCalibration authentication retry', () => {
  const originalApiAdapter = apiClient.defaults.adapter;
  const originalRefreshAdapter = authRefreshClient.defaults.adapter;

  beforeEach(() => {
    storage.clear();
    storage.set('accessToken', 'expired-access-token');
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalApiAdapter;
    authRefreshClient.defaults.adapter = originalRefreshAdapter;
    vi.unstubAllGlobals();
  });

  it('401 COMMON_TOKEN_EXPIRED이면 한 번 refresh한 뒤 active 요청을 한 번 재시도한다', async () => {
    let activeRequestCount = 0;
    let refreshRequestCount = 0;

    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      activeRequestCount += 1;

      if (activeRequestCount === 1) {
        const expiredResponse = response(config, 401, {
          success: false,
          code: 'COMMON_TOKEN_EXPIRED',
          message: 'Access Token이 만료된다',
        });
        throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined, expiredResponse);
      }

      expect(axios.AxiosHeaders.from(config.headers).get('Authorization')).toBe(
        'Bearer refreshed-access-token',
      );
      return response(config, 200, {
        success: true,
        data: {
          calibrationId: 'calibration-1',
          createdAt: '2026-08-28T00:00:00Z',
          calibrationData: {
            schemaVersion: 1,
            mappingType: 'RAW_HOMOGRAPHY',
            coordinateSpace: 'NORMALIZED_VIEWPORT',
          },
        },
      });
    });

    authRefreshClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      refreshRequestCount += 1;
      expect(config.url).toBe('/auth/token/refresh');
      expect(config.withCredentials).toBe(true);
      return response(config, 200, {
        success: true,
        data: {
          accessToken: 'refreshed-access-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
      });
    });

    const result = await getActiveCalibration();

    expect(result?.calibrationId).toBe('calibration-1');
    expect(storage.get('accessToken')).toBe('refreshed-access-token');
    expect(refreshRequestCount).toBe(1);
    expect(activeRequestCount).toBe(2);
  });

  it('동시에 만료된 active 요청도 refresh 하나를 공유하고 각각 한 번만 재시도한다', async () => {
    let initialRequestCount = 0;
    let retryRequestCount = 0;
    let refreshRequestCount = 0;
    let releaseRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });

    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      const retried = Boolean((config as typeof config & { _authRetry?: boolean })._authRetry);
      if (!retried) {
        initialRequestCount += 1;
        const expiredResponse = response(config, 401, {
          success: false,
          code: 'COMMON_TOKEN_EXPIRED',
          message: 'Access Token이 만료된다',
        });
        throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined, expiredResponse);
      }

      retryRequestCount += 1;
      return response(config, 200, {
        success: true,
        data: {
          calibrationId: `calibration-${retryRequestCount}`,
          createdAt: '2026-08-28T00:00:00Z',
          calibrationData: {
            schemaVersion: 1,
            mappingType: 'RAW_HOMOGRAPHY',
            coordinateSpace: 'NORMALIZED_VIEWPORT',
          },
        },
      });
    });

    authRefreshClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      refreshRequestCount += 1;
      await refreshGate;
      return response(config, 200, {
        success: true,
        data: {
          accessToken: 'single-flight-access-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
      });
    });

    const resultsPromise = Promise.all([getActiveCalibration(), getActiveCalibration()]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(initialRequestCount).toBe(2);
    expect(refreshRequestCount).toBe(1);

    releaseRefresh?.();
    const results = await resultsPromise;

    expect(results).toHaveLength(2);
    expect(retryRequestCount).toBe(2);
    expect(refreshRequestCount).toBe(1);
  });

  it('active calibration이 없는 204 응답은 인증 오류와 구분해 null로 처리한다', async () => {
    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) =>
      response(config, 204, undefined),
    );

    await expect(getActiveCalibration()).resolves.toBeNull();
  });

  it('저장 payload는 기존 gaze 필드만 포함하고 blink/mouth 세션 값을 추가하지 않는다', async () => {
    const candidate: GazeCalibrationResult = {
      schemaVersion: 1,
      mappingType: 'RAW_HOMOGRAPHY',
      coordinateSpace: 'NORMALIZED_VIEWPORT',
      homography: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      mirrorX: true,
      mirrorStrategy: 'PRE_INFERENCE_FRAME_FLIP',
      grid: { rows: 4, cols: 4, margin: 0.08 },
      calibratedViewport: {
        widthPx: 1920,
        heightPx: 1080,
        aspectRatio: 1920 / 1080,
        orientation: 'landscape',
      },
      reprojectionRmseNormalized: 0.01,
      createdAtLocal: '2026-08-29T00:00:00.000Z',
    };

    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      const payload = JSON.parse(String(config.data)) as {
        calibrationData: Record<string, unknown>;
      };
      expect(payload.calibrationData).not.toHaveProperty('blink');
      expect(payload.calibrationData).not.toHaveProperty('mouth');
      expect(payload.calibrationData).not.toHaveProperty('inputTests');
      expect(payload.calibrationData).not.toHaveProperty('inputTestResults');
      expect(payload.calibrationData).not.toHaveProperty('targetWord');
      expect(payload.calibrationData).not.toHaveProperty('createdAtLocal');

      return response(config, 200, {
        success: true,
        data: {
          calibrationId: 'calibration-new',
          createdAt: '2026-08-29T00:00:00.000Z',
          calibrationData: payload.calibrationData,
        },
      });
    });

    await expect(createCalibration(candidate)).resolves.toMatchObject({
      calibrationId: 'calibration-new',
    });
  });
});
