import { useMemo, useState } from 'react';
import {
  FRIENDS_PER_PAGE,
  useFriendStore,
} from '../../../shared/stores/friendStore';
import type { Friend } from '../../../shared/types/mypage';

/**
 * 친구 목록 페이지네이션.
 * "페이지"라고 부르지만 실제로는 한 화면에 보이는 8명 앞/뒤 구간을 잘라 보여주는 것.
 */
export function useFriendList() {
  const friends = useFriendStore((state) => state.friends);
  const [page, setPage] = useState(1);

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
    goPrev: () => setPage((prev) => Math.max(1, prev - 1)),
    goNext: () => setPage((prev) => Math.min(totalPages, prev + 1)),
  };
}
