import { describe, expect, it } from 'vitest';
import {
  INITIAL_EMAIL_VERIFICATION_STATE,
  canConfirmVerification,
  canSubmitSignup,
  changeVerificationCode,
  changeVerificationEmail,
  confirmVerificationFailed,
  confirmVerificationSucceeded,
  sendVerificationFailed,
  sendVerificationSucceeded,
  startSendingVerification,
  startVerifyingCode,
} from './emailVerification';

const EMAIL = 'patient@example.com';
const OTHER_EMAIL = 'other@example.com';

function codeSentState(code = '') {
  return { ...sendVerificationSucceeded(INITIAL_EMAIL_VERIFICATION_STATE, EMAIL, 300), code };
}

describe('emailVerification state machine', () => {
  it('1. send 성공 → CODE_SENT', () => {
    const sending = startSendingVerification(INITIAL_EMAIL_VERIFICATION_STATE);
    expect(sending.status).toBe('SENDING');

    const sent = sendVerificationSucceeded(sending, EMAIL, 300);
    expect(sent.status).toBe('CODE_SENT');
    expect(sent.requestedEmail).toBe(EMAIL);
    expect(sent.expiresInSeconds).toBe(300);
  });

  it('2. confirm verified=true → VERIFIED', () => {
    const sent = codeSentState('123456');
    const verifying = startVerifyingCode(sent);
    expect(verifying.status).toBe('VERIFYING');

    const verified = confirmVerificationSucceeded(verifying, EMAIL);
    expect(verified.status).toBe('VERIFIED');
    expect(verified.verifiedEmail).toBe(EMAIL);
  });

  it('3. 인증된 뒤 이메일 변경 → IDLE', () => {
    const verified = confirmVerificationSucceeded(codeSentState('123456'), EMAIL);
    const afterEmailChange = changeVerificationEmail(verified, OTHER_EMAIL);
    expect(afterEmailChange).toEqual(INITIAL_EMAIL_VERIFICATION_STATE);
  });

  it('4. 6자리 미만 code → confirm 요청 안 함(canConfirmVerification false)', () => {
    const partial = changeVerificationCode(codeSentState(), '123');
    expect(canConfirmVerification(partial)).toBe(false);

    const full = changeVerificationCode(codeSentState(), '123456');
    expect(canConfirmVerification(full)).toBe(true);
  });

  it('5. send 실패 → VERIFIED가 되지 않는다', () => {
    const failed = sendVerificationFailed(startSendingVerification(INITIAL_EMAIL_VERIFICATION_STATE), '이메일 발송 실패');
    expect(failed.status).not.toBe('VERIFIED');
    expect(failed.status).toBe('ERROR');
    expect(failed.requestedEmail).toBeNull();
  });

  it('6. confirm 실패 → VERIFIED가 되지 않는다', () => {
    const failed = confirmVerificationFailed(startVerifyingCode(codeSentState('999999')), '인증번호가 올바르지 않습니다.');
    expect(failed.status).not.toBe('VERIFIED');
    expect(failed.verifiedEmail).toBeNull();
    // 발송된 이메일 자체는 유지되어야 재시도 시 재발송 없이 코드만 다시 입력할 수 있다.
    expect(failed.requestedEmail).toBe(EMAIL);
  });

  it('7. verifiedEmail !== currentEmail → signup 불가', () => {
    const verified = confirmVerificationSucceeded(codeSentState('123456'), EMAIL);
    expect(canSubmitSignup(verified, EMAIL)).toBe(true);
    expect(canSubmitSignup(verified, OTHER_EMAIL)).toBe(false);
  });

  it('8. 재전송 → 기존 code/verified state 초기화', () => {
    const verified = confirmVerificationSucceeded(codeSentState('123456'), EMAIL);
    const resent = sendVerificationSucceeded(startSendingVerification(verified), EMAIL, 300);

    expect(resent.status).toBe('CODE_SENT');
    expect(resent.code).toBe('');
    expect(resent.verifiedEmail).toBeNull();
  });

  it('이메일이 발송한 적 없는 상태에서 바뀌어도 상태는 그대로다', () => {
    const idle = changeVerificationEmail(INITIAL_EMAIL_VERIFICATION_STATE, 'anything@example.com');
    expect(idle).toEqual(INITIAL_EMAIL_VERIFICATION_STATE);
  });

  it('같은 이메일로 되돌리면(공백 트림 포함) 상태를 초기화하지 않는다', () => {
    const sent = codeSentState();
    const unchanged = changeVerificationEmail(sent, `${EMAIL} `);
    expect(unchanged).toBe(sent);
  });

  it('sanitizeVerificationCode: 숫자 외 문자를 제거하고 6자리로 자른다', () => {
    const sanitized = changeVerificationCode(codeSentState(), ' 12-34a5678');
    expect(sanitized.code).toBe('123456');
  });
});
