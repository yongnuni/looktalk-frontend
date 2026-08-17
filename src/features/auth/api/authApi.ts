import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApiResponse,
  EmailVerificationConfirmRequestDto,
  EmailVerificationPurpose,
  EmailVerificationRequestDto,
  EmailVerificationResponseDto,
  PatientSignupRequestDto,
  PatientSignupResponseDto,
  SignupVerificationResultDto,
} from '../../../shared/types/backend';

// AuthController(AUTH-001/002/004)와 일치. apiClient의 baseURL이 이미 '/api'를 포함하므로
// 여기서는 '/auth/...'만 사용한다. /api/auth/**는 SecurityConfig에서 permitAll이라
// Authorization 헤더가 붙어도(비로그인 상태면 안 붙음) 무해하다.
export async function sendEmailVerification(
  email: string,
  purpose: EmailVerificationPurpose,
): Promise<EmailVerificationResponseDto> {
  const payload: EmailVerificationRequestDto = { email, purpose };
  const response = await apiClient.post<ApiResponse<EmailVerificationResponseDto>>(
    '/auth/email-verifications',
    payload,
  );

  return response.data.data;
}

// purpose="SIGNUP"의 confirm 응답(SignupVerificationResult: { verified: boolean })만 다룬다.
// PASSWORD_RESET의 confirm은 응답 구조가 달라(resetToken) PasswordResetPage.tsx의 기존
// 구현을 그대로 둔다 — 이번 작업 범위(PATIENT 회원가입) 밖이다.
export async function confirmSignupEmailVerification(
  email: string,
  code: string,
): Promise<SignupVerificationResultDto> {
  const payload: EmailVerificationConfirmRequestDto = { email, purpose: 'SIGNUP', code };
  const response = await apiClient.post<ApiResponse<SignupVerificationResultDto>>(
    '/auth/email-verifications/confirm',
    payload,
  );

  return response.data.data;
}

export async function signupPatient(request: PatientSignupRequestDto): Promise<PatientSignupResponseDto> {
  const response = await apiClient.post<ApiResponse<PatientSignupResponseDto>>('/auth/patients/signup', request);
  return response.data.data;
}
