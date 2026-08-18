import type { RefCallback } from 'react';
import './ArrowPagination.css';

interface ArrowPaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  /**
   * 이미지 에셋을 쓰고 싶을 때만 전달.
   * 미전달 시 CSS 삼각형으로 렌더 (Figma image 18 / image 19 대체).
   */
  prevIcon?: string;
  nextIcon?: string;
  /** 현재 페이지 / 전체 페이지 표기 노출 여부 */
  showCounter?: boolean;
  /** Front Step 15 §29/§34 — gaze target으로 등록하려는 호출부만 채운다(추가 전용 확장). */
  prevGazeTargetRef?: RefCallback<HTMLButtonElement>;
  nextGazeTargetRef?: RefCallback<HTMLButtonElement>;
}

export default function ArrowPagination({
  page,
  totalPages,
  onPrev,
  onNext,
  prevIcon,
  nextIcon,
  showCounter = false,
  prevGazeTargetRef,
  nextGazeTargetRef,
}: ArrowPaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav className="arrow-pagination" aria-label="페이지 이동">
      <button
        ref={prevGazeTargetRef}
        type="button"
        className="arrow-pagination-button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="이전 페이지"
      >
        {prevIcon ? (
          <img src={prevIcon} alt="" className="arrow-pagination-icon" />
        ) : (
          <span className="arrow-pagination-triangle prev" />
        )}
      </button>

      {showCounter && (
        <span className="arrow-pagination-counter">
          {page} / {totalPages}
        </span>
      )}

      <button
        ref={nextGazeTargetRef}
        type="button"
        className="arrow-pagination-button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="다음 페이지"
      >
        {nextIcon ? (
          <img src={nextIcon} alt="" className="arrow-pagination-icon" />
        ) : (
          <span className="arrow-pagination-triangle next" />
        )}
      </button>
    </nav>
  );
}
