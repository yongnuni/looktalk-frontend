import { describe, expect, it } from 'vitest';
import { isSendableMessage } from './chatSend';

describe('isSendableMessage', () => {
  it('공백만 있는 문장은 보낼 수 없다', () => {
    expect(isSendableMessage('   ')).toBe(false);
    expect(isSendableMessage('')).toBe(false);
  });

  it('trim 후 내용이 남으면 보낼 수 있다', () => {
    expect(isSendableMessage('  안녕하세요  ')).toBe(true);
  });
});
