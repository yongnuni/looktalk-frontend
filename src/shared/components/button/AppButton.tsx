import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {}

export default function AppButton({ children, type = 'button', ...props }: AppButtonProps) {
  return (
    <button type={type} {...props}>
      {children}
    </button>
  );
}