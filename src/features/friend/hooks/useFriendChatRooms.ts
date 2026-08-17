import { useCallback, useEffect, useRef, useState } from 'react';
import { createOrGetSmsChatRoom } from '../../chat/api/chatRooms';
import type { ChatRoom } from '../../chat/types/chat';
import { mapSmsFriendshipDtoToChatRoom } from '../../chat/utils/chatMappers';
import { getSmsFriends } from '../api/friends';

interface UseFriendChatRoomsResult {
  rooms: ChatRoom[];
  ensureSmsChatRoom: (friendshipId: number) => Promise<number>;
}

export function useFriendChatRooms(): UseFriendChatRoomsResult {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const roomRequestsRef = useRef(new Map<number, Promise<number>>());
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

  const ensureSmsChatRoom = useCallback((friendshipId: number): Promise<number> => {
    const existingRoomId = chatRoomIdsRef.current.get(friendshipId);
    if (existingRoomId !== undefined) return Promise.resolve(existingRoomId);

    const existingRequest = roomRequestsRef.current.get(friendshipId);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const { roomId } = await createOrGetSmsChatRoom(friendshipId);
      chatRoomIdsRef.current.set(friendshipId, roomId);
      setRooms((currentRooms) =>
        currentRooms.map((room) =>
          room.friendshipId === friendshipId ? { ...room, chatRoomId: roomId } : room,
        ),
      );
      return roomId;
    })().finally(() => {
      roomRequestsRef.current.delete(friendshipId);
    });

    roomRequestsRef.current.set(friendshipId, request);
    return request;
  }, []);

  return { rooms, ensureSmsChatRoom };
}
