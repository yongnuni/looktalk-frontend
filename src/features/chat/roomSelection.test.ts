import { describe, expect, it } from 'vitest';
import { isMessageEntryEnabled, needsChatRoomCreation, resolveSelectedRoom } from './roomSelection';
import type { ChatRoom } from './types/chat';

function makeRoom(overrides: Partial<ChatRoom>): ChatRoom {
  return {
    id: 'room-1',
    name: '테스트',
    icon: 'person',
    messages: [],
    ...overrides,
  };
}

describe('resolveSelectedRoom', () => {
  it('selectedRoomId와 일치하는 room을 찾는다', () => {
    const rooms = [makeRoom({ id: 'a' }), makeRoom({ id: 'b' })];
    expect(resolveSelectedRoom(rooms, 'b')?.id).toBe('b');
  });

  it('일치하는 room이 없으면 첫 번째 room으로 fallback한다', () => {
    const rooms = [makeRoom({ id: 'a' }), makeRoom({ id: 'b' })];
    expect(resolveSelectedRoom(rooms, 'missing')?.id).toBe('a');
  });

  it('room이 없으면 undefined를 반환한다', () => {
    expect(resolveSelectedRoom([], '')).toBeUndefined();
  });
});

describe('isMessageEntryEnabled', () => {
  it('chatRoomId가 있는 room은 메시지 보내기가 활성화된다', () => {
    expect(isMessageEntryEnabled(makeRoom({ chatRoomId: 1 }))).toBe(true);
  });

  it('chatRoomId가 없는 room(§8/§9 BUG A/B 재현 조건)은 비활성 상태다', () => {
    expect(isMessageEntryEnabled(makeRoom({}))).toBe(false);
  });

  it('room 자체가 없으면 비활성 상태다', () => {
    expect(isMessageEntryEnabled(undefined)).toBe(false);
  });
});

describe('needsChatRoomCreation', () => {
  it('chatRoomId가 없는 room은 find-or-create가 필요하다', () => {
    expect(needsChatRoomCreation(makeRoom({}))).toBe(true);
  });

  it('chatRoomId가 이미 있으면 find-or-create가 필요 없다', () => {
    expect(needsChatRoomCreation(makeRoom({ chatRoomId: 5 }))).toBe(false);
  });

  it('room이 없으면 find-or-create가 필요 없다', () => {
    expect(needsChatRoomCreation(undefined)).toBe(false);
  });
});
