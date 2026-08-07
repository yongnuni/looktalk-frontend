import { create } from 'zustand';
import type { Friend } from '../types/mypage';

/** 한 화면에 보이는 최대 친구 수 */
export const FRIENDS_PER_PAGE = 8;

interface FriendState {
  friends: Friend[];
  addFriend: (name: string, phone: string) => void;
  updateFriend: (id: number, name: string) => void;
  removeFriend: (id: number) => void;
}

// TODO : 서버 친구 목록 API 연동 시 초기값 제거
const MOCK_FRIENDS: Friend[] = [
  { id: 1, name: '엄마', phone: '010-1111-1111' },
  { id: 2, name: '아빠', phone: '010-2222-2222' },
  { id: 3, name: '할머니', phone: '010-3333-3333' },
  { id: 4, name: '동생', phone: '010-4444-4444' },
  { id: 5, name: '친구1', phone: '010-5555-5555' },
  { id: 6, name: '친구2', phone: '010-6666-6666' },
  { id: 7, name: '친구3', phone: '010-7777-7777' },
  { id: 8, name: '선생님', phone: '010-8888-8888' },
];

export const useFriendStore = create<FriendState>((set) => ({
  friends: MOCK_FRIENDS,

  addFriend: (name, phone) =>
    set((state) => ({
      friends: [...state.friends, { id: Date.now(), name, phone }],
    })),

  updateFriend: (id, name) =>
    set((state) => ({
      friends: state.friends.map((friend) =>
        friend.id === id ? { ...friend, name } : friend,
      ),
    })),

  removeFriend: (id) =>
    set((state) => ({
      friends: state.friends.filter((friend) => friend.id !== id),
    })),
}));
