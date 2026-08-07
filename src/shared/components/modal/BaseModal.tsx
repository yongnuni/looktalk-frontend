import type { PropsWithChildren, ReactNode } from 'react';
import './BaseModal.css';

interface BaseModalProps extends PropsWithChildren {
  isOpen: boolean;
  /** 상단 제목. Figma 팝업 대부분은 제목 없이 본문만 사용 */
  title?: string;
  /** 하단 액션 영역. ModalAction 들을 넣어 사용 */
  footer?: ReactNode;
  /** 우상단 닫기 버튼 노출 여부 (Figma 팝업엔 없음 → 기본 false) */
  showCloseButton?: boolean;
  /** 배경 클릭으로 닫히게 할지 (확인 강제 팝업은 false) */
  closeOnBackdrop?: boolean;
  /** 팝업 폭 프리셋. Figma 기준 871px 고정 = 'wide' */
  size?: 'wide' | 'narrow';
  className?: string;
  onClose: () => void;
}

export default function BaseModal({
  isOpen,
  title,
  footer,
  children,
  showCloseButton = false,
  closeOnBackdrop = false,
  size = 'wide',
  className = '',
  onClose,
}: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <section
        className={`modal modal-${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <header className="modal-header">
            {title && <h2 className="modal-title">{title}</h2>}
            {showCloseButton && (
              <button type="button" className="modal-close" onClick={onClose}>
                닫기
              </button>
            )}
          </header>
        )}

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </section>
    </div>
  );
}

/* ---------------------------------------------
   팝업 하단 액션 버튼
   Figma: 세로 구분선으로 좌/우 분할된 텍스트 버튼
--------------------------------------------- */

interface ModalActionProps extends PropsWithChildren {
  /** primary = 확정 동작(설정하기/삭제하기/로그아웃 등), muted = 취소 */
  tone?: 'primary' | 'muted' | 'danger';
  onClick: () => void;
}

export function ModalAction({
  children,
  tone = 'primary',
  onClick,
}: ModalActionProps) {
  return (
    <button
      type="button"
      className={`modal-action modal-action-${tone}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
