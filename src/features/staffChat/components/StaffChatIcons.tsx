import type { ReactNode } from 'react';

interface StaffChatIconProps {
  size?: number;
}

function IconFrame({ size = 32, children }: StaffChatIconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox="0 0 48 48"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

export function SettingsIcon({ size = 34 }: StaffChatIconProps) {
  return (
    <IconFrame size={size}>
      <path d="m24 6 2.3 3.9 4.4 1.1 3.8-2.3 4.8 4.8-2.3 3.8 1.1 4.4L42 24l-3.9 2.3-1.1 4.4 2.3 3.8-4.8 4.8-3.8-2.3-4.4 1.1L24 42l-2.3-3.9-4.4-1.1-3.8 2.3-4.8-4.8 2.3-3.8-1.1-4.4L6 24l3.9-2.3 1.1-4.4-2.3-3.8 4.8-4.8 3.8 2.3 4.4-1.1L24 6Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="3" />
      <circle cx="24" cy="24" fill="none" r="6" stroke="currentColor" strokeWidth="3" />
    </IconFrame>
  );
}

export function SendIcon({ size = 28 }: StaffChatIconProps) {
  return (
    <IconFrame size={size}>
      <path d="m6 23 35-15-10 32-8-14L6 23Z" fill="currentColor" />
      <path d="m23 26 18-18" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="2.5" />
    </IconFrame>
  );
}
