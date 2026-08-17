import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  E2eeKeyRegisterResponseDto,
  E2eeKeyStatusResponseDto,
  E2eeUserPublicKeyResponseDto,
} from '../../../shared/types/backend';
import {
  generateKeyPair,
  getStoredPrivateKey,
  getStoredPublicKey,
  saveKeyPair,
} from '../../../shared/utils/e2ee';

export interface CurrentE2eeKey {
  keyVersion: number;
  publicKey: string;
}

/**
 * Front Step 14 §17/§20 — HOSPITAL chat 발송(E2EE-001/002)에 필요한 "내 활성 키 준비"를
 * 담당한다. MemoPage.tsx의 `prepareE2eeKey`와 정책은 동일하다(등록되어 있으면 로컬
 * 개인키와 서버 공개키 일치를 확인하고, 없으면 새로 생성해 등록한다) — 다만 MemoPage는
 * 자체 `fetch()`/token 처리를 쓰고, Chat 쪽 API 파일들은 이미 `apiClient`(인증 헤더
 * interceptor 포함)를 쓰는 관례라 그 관례를 그대로 따른다. 새 인증 체계를 만들지 않는다.
 */
export async function ensureE2eeKey(): Promise<CurrentE2eeKey> {
  const statusResponse = await apiClient.get<ApiResponse<E2eeKeyStatusResponseDto>>('/e2ee/keys/me');
  const status = statusResponse.data.data;

  if (status.registered && status.keyVersion !== null && status.publicKey) {
    const localPublicKey = getStoredPublicKey(status.keyVersion);
    const localPrivateKey = getStoredPrivateKey(status.keyVersion);

    if (!localPublicKey || !localPrivateKey) {
      throw new Error('암호화 개인키가 현재 브라우저에 없습니다. 채팅을 암호화할 수 없습니다.');
    }

    if (localPublicKey !== status.publicKey) {
      throw new Error('서버의 공개키와 현재 브라우저의 공개키가 일치하지 않습니다.');
    }

    return { keyVersion: status.keyVersion, publicKey: status.publicKey };
  }

  const keyPair = await generateKeyPair();
  const registerResponse = await apiClient.post<ApiResponse<E2eeKeyRegisterResponseDto>>('/e2ee/keys', {
    publicKey: keyPair.publicKey,
  });

  const keyVersion = registerResponse.data.data.keyVersion;
  saveKeyPair(keyVersion, keyPair);

  return { keyVersion, publicKey: keyPair.publicKey };
}

/** E2EE-003 — HOSPITAL room 상대방의 활성 공개키를 조회한다(암호화 대상 결정에 필요). */
export async function getUserPublicKey(userId: string): Promise<E2eeUserPublicKeyResponseDto> {
  const response = await apiClient.get<ApiResponse<E2eeUserPublicKeyResponseDto>>(
    `/e2ee/users/${userId}/public-key`,
  );
  return response.data.data;
}
