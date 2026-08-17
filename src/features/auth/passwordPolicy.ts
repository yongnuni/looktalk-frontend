/**
 * Look-Talk Backend 실제 제약: PatientSignupRequest/StaffSignupRequest.password,
 * PasswordResetRequest.newPassword 전부 @Size(min=8, max=64)만 검증한다(문자 구성 규칙은
 * 없음 — DTO에 @Pattern 없음, docs/LookTalk_Backend_API_Spec_v2.1.md 554행 "필수, 8~64자").
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export const PASSWORD_LENGTH_ERROR_MESSAGE = `비밀번호 형식이 다릅니다. (${PASSWORD_MIN_LENGTH}자 이상 ${PASSWORD_MAX_LENGTH}자 이하)`;

export function isPasswordLengthValid(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}
