import axios from 'axios';
import type {
  ApiResponse,
  CurrentUserDto,
  E2eeKeyRegisterDto,
  E2eeKeyStatusDto,
} from '../types/backend';
import {
  generateKeyPair,
  hasMatchingStoredKeyPair,
  migrateLegacyKeyPair,
  saveKeyPair,
} from '../utils/e2ee';
import { apiClient } from './apiClient';
import { getCurrentUser } from './currentUser';

export interface PreparedE2eeKey {
  userId: string;
  keyVersion: number;
  publicKey: string;
}

export function isE2eeUnauthorizedError(error: unknown): boolean {
  let currentError = error;

  for (let depth = 0; depth < 3 && currentError; depth += 1) {
    if (axios.isAxiosError(currentError) && currentError.response?.status === 401) {
      return true;
    }

    currentError = currentError instanceof Error ? currentError.cause : undefined;
  }

  return false;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const response = error.response?.data as { message?: unknown } | undefined;
    if (typeof response?.message === 'string' && response.message.trim()) {
      return response.message;
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

async function prepareE2eeKeyForUser(user: CurrentUserDto): Promise<PreparedE2eeKey> {
  let status: E2eeKeyStatusDto;

  try {
    const response = await apiClient.get<ApiResponse<E2eeKeyStatusDto>>('/e2ee/keys/me');
    status = response.data.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'E2EE 키 정보를 가져오지 못했습니다.'), {
      cause: error,
    });
  }

  if (status.registered && status.keyVersion !== null && status.publicKey) {
    await migrateLegacyKeyPair(user.userId, status.keyVersion, status.publicKey);

    if (
      !(await hasMatchingStoredKeyPair(
        user.userId,
        status.keyVersion,
        status.publicKey,
      ))
    ) {
      throw new Error(
        '서버에 등록된 암호화 키의 개인키가 이 브라우저에 없거나 일치하지 않습니다. ' +
          '기존 키를 복구한 뒤 다시 시도해주세요.',
      );
    }

    return {
      userId: user.userId,
      keyVersion: status.keyVersion,
      publicKey: status.publicKey,
    };
  }

  if (status.registered) {
    throw new Error('서버의 E2EE 키 상태가 올바르지 않습니다.');
  }

  const keyPair = await generateKeyPair();

  try {
    const response = await apiClient.post<ApiResponse<E2eeKeyRegisterDto>>('/e2ee/keys', {
      publicKey: keyPair.publicKey,
    });
    const keyVersion = response.data.data.keyVersion;

    saveKeyPair(user.userId, keyVersion, keyPair);

    return {
      userId: user.userId,
      keyVersion,
      publicKey: keyPair.publicKey,
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'E2EE 공개키 등록에 실패했습니다.'), {
      cause: error,
    });
  }
}

const preparationByUserId = new Map<string, Promise<PreparedE2eeKey>>();

export async function prepareCurrentUserE2eeKey(
  currentUser?: CurrentUserDto,
): Promise<PreparedE2eeKey> {
  const user = currentUser ?? (await getCurrentUser());
  const existingPreparation = preparationByUserId.get(user.userId);

  if (existingPreparation) return existingPreparation;

  const preparation = prepareE2eeKeyForUser(user).catch((error) => {
    preparationByUserId.delete(user.userId);
    throw error;
  });
  preparationByUserId.set(user.userId, preparation);

  return preparation;
}
