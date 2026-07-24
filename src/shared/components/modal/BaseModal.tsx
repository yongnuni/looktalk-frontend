import type { PropsWithChildren } from 'react';

interface BaseModalProps extends PropsWithChildren {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
}

export default function BaseModal({ isOpen, title, children, onClose }: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <header className="modal-header">
          {title && <h2>{title}</h2>}
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </header>

        <div>{children}</div>
      </section>
    </div>
  );
}