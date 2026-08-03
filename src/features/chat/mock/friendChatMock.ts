import type { ChatRoom } from '../types/chat';

export const friendChatRooms: ChatRoom[] = [
  {
    id: 'friend-mom',
    name: '엄마',
    icon: 'person',
    messages: [
      { id: 'mom-1', direction: 'received', text: '보고 싶어~ 아들' },
      { id: 'mom-2', direction: 'sent', text: '저도 많이 보고 싶어요' },
      { id: 'mom-3', direction: 'received', text: '엄마가 주말에 보러 갈게~' },
    ],
  },
  {
    id: 'friend-dad',
    name: '아빠',
    icon: 'person',
    messages: [
      { id: 'dad-1', direction: 'received', text: '오늘은 몸 좀 괜찮니?' },
      { id: 'dad-2', direction: 'sent', text: '네, 오늘은 괜찮아요' },
    ],
  },
  {
    id: 'friend-1',
    name: '친구1',
    icon: 'person',
    messages: [
      { id: 'friend-1-1', direction: 'received', text: '이번 주말에 통화할래?' },
      { id: 'friend-1-2', direction: 'sent', text: '좋아, 기다리고 있을게' },
    ],
  },
  {
    id: 'friend-2',
    name: '친구2',
    icon: 'person',
    messages: [
      { id: 'friend-2-1', direction: 'received', text: '필요한 거 있으면 말해줘' },
      { id: 'friend-2-2', direction: 'sent', text: '고마워' },
    ],
  },
];
