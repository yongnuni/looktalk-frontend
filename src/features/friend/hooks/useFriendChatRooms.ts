import { useEffect, useState } from 'react';
import type { ChatRoom } from '../../chat/types/chat';
import { mapSmsFriendshipDtoToChatRoom } from '../../chat/utils/chatMappers';
import { getSmsFriends } from '../api/friends';

export function useFriendChatRooms(): ChatRoom[] {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadFriends = async () => {
      try {
        const friendships = await getSmsFriends();

        if (isMounted) {
          setRooms(friendships.map(mapSmsFriendshipDtoToChatRoom));
        }
      } catch {
        // 401 등 조회 실패 시에도 친구 채팅 화면은 빈 목록으로 유지한다.
        if (isMounted) {
          setRooms([]);
        }
      }
    };

    void loadFriends();

    return () => {
      isMounted = false;
    };
  }, []);

  return rooms;
}
