import { isAxiosError } from 'axios';
import type { ApiResponse } from '../../shared/types/backend';

// 실제 Backend ErrorCode(ErrorCode.java) 중 이메일 인증/PATIENT 회원가입에서 실제로
// 발생할 수 있는 코드만 다룬다 — 이름/의미를 추측하지 않고 Backend 코드를 직접 읽어 확정했다.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  AUTH_DUPLICATE_EMAIL: '이미 가입된 이메일입니다.',
  AUTH_DUPLICATE_LOGIN_ID: '이미 사용 중인 아이디입니다.',
  AUTH_INVALID_VERIFICATION_CODE: '인증번호가 올바르지 않습니다.',
  AUTH_VERIFICATION_EXPIRED: '인증번호가 만료되었습니다. 다시 발급해주세요.',
  AUTH_EMAIL_NOT_VERIFIED: '이메일 인증을 먼저 완료해주세요.',
  EMAIL_SEND_FAILED: '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.',
  COMMON_VALIDATION_ERROR: '입력값을 다시 확인해주세요.',
};

/**
 * AuthController 관련 API 오류를 사용자 메시지로 변환한다. HTTP status만 보고 전부
 * "오류가 발생했습니다"로 뭉개지 않고, 실제 ErrorCode(§ErrorCode.java)를 우선 사용한다.
 * 네트워크 자체가 끊긴 경우(응답 없음)에는 fallback을 사용한다.
 */
export function mapAuthErrorToMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiResponse<unknown>>(error)) {
    const code = error.response?.data?.code;
    const backendMessage = error.response?.data?.message;

    if (code && AUTH_ERROR_MESSAGES[code]) {
      return AUTH_ERROR_MESSAGES[code];
    }

    if (backendMessage) {
      return backendMessage;
    }
  }

  return fallback;
}
