import { useEffect, useMemo, useState } from 'react';
import { getSmsFriends } from '../api/friends';
import {
  FRIENDS_PER_PAGE,
  useFriendStore,
} from '../../../shared/stores/friendStore';
import type { Friend } from '../../../shared/types/mypage';

/**
 * 친구 목록 조회 + 페이지네이션.
 * "페이지"라고 부르지만 실제로는 한 화면에 보이는 8명 앞/뒤 구간을 잘라 보여주는 것.
 */
export function useFriendList() {
  const friends = useFriendStore((state) => state.friends);
  const setFriends = useFriendStore((state) => state.setFriends);

  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadFriends = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const data = await getSmsFriends();

        if (isMounted) {
          setFriends(
            data.map((friend) => ({
              id: friend.friendshipId,
              name: friend.name,
              phone: friend.phone,
            })),
          );
        }
      } catch {
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadFriends();

    return () => {
      isMounted = false;
    };
  }, [setFriends]);

  const totalPages = Math.max(1, Math.ceil(friends.length / FRIENDS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const visibleFriends = useMemo<Friend[]>(() => {
    const start = (safePage - 1) * FRIENDS_PER_PAGE;

    return friends.slice(start, start + FRIENDS_PER_PAGE);
  }, [friends, safePage]);

  return {
    friends,
    visibleFriends,
    page: safePage,
    totalPages,
    isLoading,
    hasError,
    goPrev: () => setPage((prev) => Math.max(1, prev - 1)),
    goNext: () => setPage((prev) => Math.min(totalPages, prev + 1)),
  };
}
