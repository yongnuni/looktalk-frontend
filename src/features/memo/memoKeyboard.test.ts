import { describe, expect, it } from 'vitest';
import { canOpenMemoKeyboard, isSavableMemoText } from './memoKeyboard';

describe('canOpenMemoKeyboard (MEM-01-01 회귀 수정)', () => {
  it('1. 정상 상태(로딩/저장 중 아님, E2EE 키 준비됨)면 keyboard를 열 수 있다', () => {
    expect(canOpenMemoKeyboard({ isLoading: false, isAdding: false, hasEncryptionKey: true })).toBe(true);
  });

  it('2. 아직 아무 문장도 입력하지 않은 상태(= 이 함수에 text 파라미터 자체가 없음)와 무관하게 열 수 있다', () => {
    // canOpenMemoKeyboard의 시그니처 자체가 text를 받지 않는다 — "작성 완료" 조건과
    // "입력 시작" 조건이 애초에 섞일 수 없는 구조라는 것을 타입 수준에서 보장한다.
    expect(canOpenMemoKeyboard({ isLoading: false, isAdding: false, hasEncryptionKey: true })).toBe(true);
  });

  it('로딩 중에는 열 수 없다', () => {
    expect(canOpenMemoKeyboard({ isLoading: true, isAdding: false, hasEncryptionKey: true })).toBe(false);
  });

  it('저장 중에는 열 수 없다(중복 진입 방지)', () => {
    expect(canOpenMemoKeyboard({ isLoading: false, isAdding: true, hasEncryptionKey: true })).toBe(false);
  });

  it('E2EE 키가 준비되지 않았으면 열 수 없다', () => {
    expect(canOpenMemoKeyboard({ isLoading: false, isAdding: false, hasEncryptionKey: false })).toBe(false);
  });
});

describe('isSavableMemoText', () => {
  it('4. 빈 문자열은 저장 대상이 아니다', () => {
    expect(isSavableMemoText('')).toBe(false);
  });

  it('공백만 있는 문자열도 저장 대상이 아니다', () => {
    expect(isSavableMemoText('   ')).toBe(false);
  });

  it('3. 실제 텍스트가 있으면 저장 대상이다', () => {
    expect(isSavableMemoText('안녕하세요')).toBe(true);
  });
});
