/**
 * Front Step 14 §22 — Keyboard Confirm에서 공백만 있는 메시지는 보내지 않는다. Backend도
 * SMS 경로에서 동일 정책을 갖고 있지만(COMMON_VALIDATION_ERROR), Front에서 먼저 걸러
 * 불필요한 요청/E2EE 암호화를 만들지 않는다.
 *
 * 실제 전송(sendHospitalChatMessage/sendSmsChatMessage)은 origin/develop의 websocket
 * 통합(Front Step 17 merge)이 features/chat/api/chatMessages.ts로 일원화했으므로
 * PatientChatView.tsx는 그쪽을 재사용한다 — 이 파일은 두 소비처(Memo/Chat)가 공유하는
 * 순수 guard만 남긴다.
 */
export function isSendableMessage(text: string): boolean {
  return text.trim().length > 0;
}
