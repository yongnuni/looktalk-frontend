/**
 * PATIENT 회원가입 이메일 인증의 순수 상태 머신. 실제 API 호출(features/auth/api/authApi.ts)과
 * 분리해, 여기 있는 모든 함수는 입출력이 없는 순수 함수다 — 네트워크/타이머는 이 모듈을
 * 사용하는 컴포넌트(SignupPage)가 담당한다.
 */

export type EmailVerificationStatus = 'IDLE' | 'SENDING' | 'CODE_SENT' | 'VERIFYING' | 'VERIFIED' | 'ERROR';

export interface EmailVerificationState {
  status: EmailVerificationStatus;
  /** 마지막으로 인증번호 발송에 성공한 이메일. 아직 발송한 적 없으면 null. */
  requestedEmail: string | null;
  /** 인증이 실제로 완료된 이메일. VERIFIED가 아니면 항상 null. */
  verifiedEmail: string | null;
  code: string;
  expiresInSeconds: number | null;
  errorMessage: string | null;
}

export const INITIAL_EMAIL_VERIFICATION_STATE: EmailVerificationState = {
  status: 'IDLE',
  requestedEmail: null,
  verifiedEmail: null,
  code: '',
  expiresInSeconds: null,
  errorMessage: null,
};

const VERIFICATION_CODE_LENGTH = 6;

/** 숫자만 허용하고 6자리로 자른다 — paste된 값에 공백/구분자가 섞여 있어도 정리한다. */
export function sanitizeVerificationCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH);
}

export function startSendingVerification(state: EmailVerificationState): EmailVerificationState {
  return { ...state, status: 'SENDING', errorMessage: null };
}

/** 인증번호 발송 성공(재전송 포함) — 항상 이전 code/verified 상태를 초기화한다(§10). */
export function sendVerificationSucceeded(
  _state: EmailVerificationState,
  email: string,
  expiresInSeconds: number,
): EmailVerificationState {
  return {
    status: 'CODE_SENT',
    requestedEmail: email,
    verifiedEmail: null,
    code: '',
    expiresInSeconds,
    errorMessage: null,
  };
}

export function sendVerificationFailed(
  _state: EmailVerificationState,
  errorMessage: string,
): EmailVerificationState {
  return {
    status: 'ERROR',
    requestedEmail: null,
    verifiedEmail: null,
    code: '',
    expiresInSeconds: null,
    errorMessage,
  };
}

export function startVerifyingCode(state: EmailVerificationState): EmailVerificationState {
  return { ...state, status: 'VERIFYING', errorMessage: null };
}

export function confirmVerificationSucceeded(state: EmailVerificationState, email: string): EmailVerificationState {
  return { ...state, status: 'VERIFIED', verifiedEmail: email, errorMessage: null };
}

export function confirmVerificationFailed(
  state: EmailVerificationState,
  errorMessage: string,
): EmailVerificationState {
  return { ...state, status: 'ERROR', verifiedEmail: null, errorMessage };
}

export function verificationExpired(state: EmailVerificationState): EmailVerificationState {
  return {
    ...state,
    status: 'ERROR',
    verifiedEmail: null,
    errorMessage: '인증번호가 만료되었습니다. 다시 발급해주세요.',
  };
}

/**
 * 인증번호 입력 변경. 이미 VERIFIED/ERROR였다면 CODE_SENT로 되돌려 재시도할 수 있게 한다
 * (requestedEmail이 있을 때만 — 즉 애초에 발송된 코드가 있을 때만).
 */
export function changeVerificationCode(state: EmailVerificationState, rawCode: string): EmailVerificationState {
  const code = sanitizeVerificationCode(rawCode);

  if ((state.status === 'VERIFIED' || state.status === 'ERROR') && state.requestedEmail !== null) {
    return { ...state, code, status: 'CODE_SENT', verifiedEmail: null, errorMessage: null };
  }

  return { ...state, code };
}

/**
 * §5 — 이메일이 마지막으로 인증번호를 발송한 이메일과 달라지는 순간 전체를 IDLE로 되돌린다.
 * 아직 발송한 적이 없다면(requestedEmail === null) 상태를 건드리지 않는다.
 */
export function changeVerificationEmail(
  state: EmailVerificationState,
  newEmail: string,
): EmailVerificationState {
  if (state.requestedEmail !== null && newEmail.trim() !== state.requestedEmail) {
    return INITIAL_EMAIL_VERIFICATION_STATE;
  }

  return state;
}

/** confirm 요청을 실제로 보내도 되는지 — 6자리 숫자를 다 채웠고 CODE_SENT 상태일 때만. */
export function canConfirmVerification(state: EmailVerificationState): boolean {
  return state.status === 'CODE_SENT' && /^\d{6}$/.test(state.code);
}

/** §8 — PATIENT signup 제출 허용 조건. */
export function canSubmitSignup(state: EmailVerificationState, currentEmail: string): boolean {
  return (
    state.status === 'VERIFIED' &&
    state.verifiedEmail !== null &&
    state.verifiedEmail === currentEmail.trim()
  );
}
