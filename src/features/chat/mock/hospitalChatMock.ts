import type { ChatRoom } from '../types/chat';

export const hospitalChatRooms: ChatRoom[] = [
  {
    id: 'request',
    name: '요청',
    icon: 'request',
    messages: [
      { id: 'request-1', direction: 'sent', text: '몸이 불편해요', createdAt: '2026-08-05T09:42:00+09:00' },
      { id: 'request-2', direction: 'received', text: '네 지금 갈게요', createdAt: '2026-08-05T09:44:00+09:00' },
    ],
  },
  {
    id: 'room-203',
    name: '203호',
    icon: 'person',
    messages: [
      { id: '203-1', direction: 'received', text: '오늘 재활 운동은 어땠어?', createdAt: '2026-08-05T10:06:00+09:00' },
      { id: '203-2', direction: 'sent', text: '조금 힘들었지만 끝까지 해냈어.', createdAt: '2026-08-05T10:09:00+09:00' },
    ],
  },
  {
    id: 'room-301',
    name: '301호',
    icon: 'person',
    messages: [
      { id: '301-1', direction: 'received', text: '병원 생활은 좀 익숙해졌어?', createdAt: '2026-08-05T11:18:00+09:00' },
      { id: '301-2', direction: 'sent', text: '응, 저녁에 같이 산책하면 좋겠다.', createdAt: '2026-08-05T11:22:00+09:00' },
    ],
  },
  {
    id: 'room-504',
    name: '504호',
    icon: 'person',
    messages: [
      { id: '504-1', direction: 'received', text: '내일 재활 일정이 오전이라던데 맞아?', createdAt: '2026-08-05T13:02:00+09:00' },
      { id: '504-2', direction: 'sent', text: '응, 끝나고 병동 휴게실에서 만나자.', createdAt: '2026-08-05T13:05:00+09:00' },
    ],
  },
];
