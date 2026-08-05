import type { FriendshipDto, UserDto } from '../../../shared/types/backend';
import { mapFriendshipDtoToChatRoom } from '../utils/chatMappers';
import type { ChatMessage } from '../types/chat';

export const mockCurrentPatientUser: UserDto = {
  user_id: 'patient-test-user',
  user_name: '환자 테스트',
  user_email: 'patient@example.com',
  user_phone: null,
  profile_image: null,
  is_email_verified: true,
  is_sms_verified: true,
  login_id: 'patient-test',
  role: 'PATIENT',
  created_at: null,
};

export const friendChatFriendships: FriendshipDto[] = [
  {
    friendship_id: 1,
    user_id: mockCurrentPatientUser.user_id,
    friend_user_id: null,
    status: 'ACCEPTED',
    friend_name: '엄마',
    friend_phone: '010-0000-0001',
    created_at: null,
  },
  {
    friendship_id: 2,
    user_id: mockCurrentPatientUser.user_id,
    friend_user_id: null,
    status: 'ACCEPTED',
    friend_name: '아빠',
    friend_phone: '010-0000-0002',
    created_at: null,
  },
  {
    friendship_id: 3,
    user_id: mockCurrentPatientUser.user_id,
    friend_user_id: 'friend-user-001',
    status: 'ACCEPTED',
    friend_name: '친구1',
    friend_phone: null,
    created_at: null,
  },
  {
    friendship_id: 4,
    user_id: mockCurrentPatientUser.user_id,
    friend_user_id: 'friend-user-002',
    status: 'ACCEPTED',
    friend_name: '친구2',
    friend_phone: null,
    created_at: null,
  },
];

const friendMessages: Record<number, ChatMessage[]> = {
  1: [
    { id: 'mom-1', direction: 'received', text: '보고 싶어~ 아들', createdAt: '2026-08-05T10:15:00+09:00' },
    { id: 'mom-2', direction: 'sent', text: '저도 많이 보고 싶어요', createdAt: '2026-08-05T10:17:00+09:00' },
    { id: 'mom-3', direction: 'received', text: '엄마가 주말에 보러 갈게~', createdAt: '2026-08-05T10:18:00+09:00' },
  ],
  2: [
    { id: 'dad-1', direction: 'received', text: '오늘은 몸 좀 괜찮니?', createdAt: '2026-08-05T09:20:00+09:00' },
    { id: 'dad-2', direction: 'sent', text: '네, 오늘은 괜찮아요', createdAt: '2026-08-05T09:23:00+09:00' },
  ],
  3: [
    { id: 'friend-1-1', direction: 'received', text: '이번 주말에 통화할래?', createdAt: '2026-08-05T14:10:00+09:00' },
    { id: 'friend-1-2', direction: 'sent', text: '좋아, 기다리고 있을게', createdAt: '2026-08-05T14:12:00+09:00' },
  ],
  4: [
    { id: 'friend-2-1', direction: 'received', text: '필요한 거 있으면 말해줘', createdAt: '2026-08-05T15:04:00+09:00' },
    { id: 'friend-2-2', direction: 'sent', text: '고마워', createdAt: '2026-08-05T15:05:00+09:00' },
  ],
};

export const friendChatRooms = friendChatFriendships.map((friendship) => {
  const room = mapFriendshipDtoToChatRoom(friendship);

  return {
    ...room,
    messages: friendMessages[friendship.friendship_id] ?? [],
  };
});
