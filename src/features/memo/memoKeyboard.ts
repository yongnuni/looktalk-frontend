export interface MemoKeyboardGuardState {
  isLoading: boolean;
  isAdding: boolean;
  hasEncryptionKey: boolean;
}

/**
 * MEM-01-01 회귀 수정 — "[가상키보드로 입력하기]"는 "입력 시작"이지 "작성 완료"가
 * 아니다. 아직 아무 문장도 입력하지 않았다는 이유로 이 버튼/target이 disabled되면
 * 안 된다 — keyboard를 열 수 있는 정상 상태(로딩/저장 중이 아니고 E2EE 키가 준비됨)인지
 * 만 본다.
 */
export function canOpenMemoKeyboard(state: MemoKeyboardGuardState): boolean {
  return !state.isLoading && !state.isAdding && state.hasEncryptionKey;
}

/** Chat의 isSendableMessage(chatSend.ts)와 동일한 정책 — 공백만 있는 문장은 저장하지 않는다. */
export function isSavableMemoText(text: string): boolean {
  return text.trim().length > 0;
}
