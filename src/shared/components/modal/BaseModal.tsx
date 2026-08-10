import { useEffect, useId, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './BaseModal.css';

export interface ModalAction {
  label: string;
  onClick: () => void;
  tone?: 'positive' | 'negative' | 'neutral';
  disabled?: boolean;
}

export interface BaseModalProps {
  isOpen: boolean;
  /** 상단 제목. Figma 팝업 대부분은 제목 없이 본문만 사용 */
  title?: string;
  children: ReactNode;
  actions?: ModalAction[];
  variant?: 'default' | 'emergency';
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export default function BaseModal({
  isOpen,
  title,
  children,
  actions = [],
  variant = 'default',
  onClose,
  closeOnBackdrop = false,
  closeOnEscape = false,
}: BaseModalProps) {
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const visibleActions = actions.slice(0, 3);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    firstActionRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !closeOnEscape || !onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeOnEscape, isOpen, onClose]);

  if (!isOpen) return null;

  const actionCountClass = `base-modal-actions--${visibleActions.length}`;
  const modalStyle = {
    '--base-modal-action-count': visibleActions.length,
  } as CSSProperties;

  return createPortal(
    <div
      className="base-modal-backdrop"
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section
        className={`base-modal base-modal--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? '팝업'}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={bodyId}
      >
        {title && (
          <header className="base-modal-header">
            <h2 id={titleId}>{title}</h2>
          </header>
        )}

        <div id={bodyId} className="base-modal-body">
          {children}
        </div>

        {visibleActions.length > 0 && (
          <footer
            className={`base-modal-actions ${actionCountClass}`}
            style={modalStyle}
          >
            {visibleActions.map((action, index) => (
              <button
                key={`${action.label}-${index}`}
                ref={index === 0 ? firstActionRef : undefined}
                type="button"
                className={`base-modal-action base-modal-action--${action.tone ?? 'neutral'}`}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            ))}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
