import { create } from 'zustand';
import type { Friend } from '../types/mypage';

/** 한 화면에 보이는 최대 친구 수 */
export const FRIENDS_PER_PAGE = 8;

interface FriendState {
  friends: Friend[];
  setFriends: (friends: Friend[]) => void;
  addFriend: (friend: Friend) => void;
  updateFriend: (id: number, patch: Partial<Pick<Friend, 'name' | 'phone'>>) => void;
  removeFriend: (id: number) => void;
}

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],

  setFriends: (friends) => set({ friends }),

  addFriend: (friend) =>
    set((state) => ({
      friends: [...state.friends, friend],
    })),

  updateFriend: (id, patch) =>
    set((state) => ({
      friends: state.friends.map((friend) =>
        friend.id === id ? { ...friend, ...patch } : friend,
      ),
    })),

  removeFriend: (id) =>
    set((state) => ({
      friends: state.friends.filter((friend) => friend.id !== id),
    })),
}));
