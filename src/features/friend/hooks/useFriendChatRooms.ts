import { useCallback, useEffect, useRef, useState } from 'react';
import { createOrGetSmsChatRoom } from '../../chat/api/chatRooms';
import type { ChatRoom } from '../../chat/types/chat';
import { mapSmsFriendshipDtoToChatRoom } from '../../chat/utils/chatMappers';
import { getSmsFriends } from '../api/friends';

interface UseFriendChatRoomsResult {
  rooms: ChatRoom[];
  ensureSmsChatRoom: (friendshipId: number) => Promise<void>;
  /** Front Step 17 §30 — 친구 목록 조회/채팅방 find-or-create 실패를 조용히 무시하지
   * 않고 화면에 알리기 위한 추가 전용 필드(기존 rooms/ensureSmsChatRoom 동작은 그대로). */
  error: string | null;
}

export function useFriendChatRooms(): UseFriendChatRoomsResult {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestedFriendshipIdsRef = useRef(new Set<number>());
  const chatRoomIdsRef = useRef(new Map<number, number>());

  useEffect(() => {
    let isMounted = true;

    const loadFriends = async () => {
      try {
        const friendships = await getSmsFriends();

        if (isMounted) {
          setRooms(friendships.map(mapSmsFriendshipDtoToChatRoom));
          setError(null);
        }
      } catch {
        // 401 등 조회 실패 시에도 친구 채팅 화면은 빈 목록으로 유지하되, 원인을 화면에 알린다.
        if (isMounted) {
          setRooms([]);
          setError('친구 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
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
      setError(null);
    } catch {
      // 생성/조회 실패 시 기존 친구 목록과 선택 상태를 그대로 유지하되, 원인을 화면에 알린다.
      setError('채팅방을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      requestedFriendshipIdsRef.current.delete(friendshipId);
    }
  }, []);

  return { rooms, ensureSmsChatRoom, error };
}
