import { useEffect, useState } from 'react';
import { getEmergencyCalls } from '../api/emergencyCalls';
import type { EmergencyCallListItemDto } from '../../../shared/types/backend';

const PAGE_SIZE = 20;

/** 비상호출 전체 내역 조회 (페이지네이션, EMERGENCY-002) */
export function useEmergencyLog() {
  const [items, setItems] = useState<EmergencyCallListItemDto[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const data = await getEmergencyCalls({ page: pageIndex, size: PAGE_SIZE });

        if (isMounted) {
          setItems(data.items);
          setTotalPages(Math.max(1, Math.ceil(data.totalElements / data.size)));
        }
      } catch {
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [pageIndex]);

  return {
    items,
    isLoading,
    hasError,
    /** ArrowPagination은 1-base 페이지를 사용한다 */
    page: pageIndex + 1,
    totalPages,
    goPrev: () => setPageIndex((prev) => Math.max(0, prev - 1)),
    goNext: () => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1)),
  };
}
