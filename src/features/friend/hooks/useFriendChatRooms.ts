import { useCallback, useEffect, useRef, useState } from 'react';
import { createOrGetSmsChatRoom } from '../../chat/api/chatRooms';
import type { ChatRoom } from '../../chat/types/chat';
import { mapSmsFriendshipDtoToChatRoom } from '../../chat/utils/chatMappers';
import { getSmsFriends } from '../api/friends';

interface UseFriendChatRoomsResult {
  rooms: ChatRoom[];
  ensureSmsChatRoom: (friendshipId: number) => Promise<void>;
}

export function useFriendChatRooms(): UseFriendChatRoomsResult {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const requestedFriendshipIdsRef = useRef(new Set<number>());
  const chatRoomIdsRef = useRef(new Map<number, number>());

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

  const ensureSmsChatRoom = useCallback(async (friendshipId: number) => {
    if (
      chatRoomIdsRef.current.has(friendshipId) ||
      requestedFriendshipIdsRef.current.has(friendshipId)
    ) {
      return;
    }

    requestedFriendshipIdsRef.current.add(friendshipId);

    try {
      const { roomId } = await createOrGetSmsChatRoom(friendshipId);
      chatRoomIdsRef.current.set(friendshipId, roomId);
      setRooms((currentRooms) =>
        currentRooms.map((room) =>
          room.friendshipId === friendshipId ? { ...room, chatRoomId: roomId } : room,
        ),
      );
    } catch {
      // 생성/조회 실패 시 기존 친구 목록과 선택 상태를 그대로 유지한다.
    } finally {
      requestedFriendshipIdsRef.current.delete(friendshipId);
    }
  }, []);

  return { rooms, ensureSmsChatRoom };
}
