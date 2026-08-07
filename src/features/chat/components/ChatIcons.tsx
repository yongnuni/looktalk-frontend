export interface ChatIconProps {
  size?: number;
}

function IconFrame({ size = 32, children }: ChatIconProps & { children: React.ReactNode }) {
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

export function PersonIcon({ size = 64 }: ChatIconProps) {
  return (
    <IconFrame size={size}>
      <circle cx="24" cy="17" fill="currentColor" r="8" />
      <path d="M9 42c1.3-9.4 6.4-14 15-14s13.7 4.6 15 14H9Z" fill="currentColor" />
    </IconFrame>
  );
}

export function RequestIcon({ size = 64 }: ChatIconProps) {
  return (
    <IconFrame size={size}>
      <circle cx="24" cy="24" fill="none" r="18" stroke="currentColor" strokeWidth="4" />
      <path d="M24 13v22M13 24h22" stroke="currentColor" strokeLinecap="round" strokeWidth="5" />
    </IconFrame>
  );
}

export function EmergencyIcon({ size = 38 }: ChatIconProps) {
  return (
    <IconFrame size={size}>
      <path d="M24 8v5M10 16l4 4M38 16l-4 4M7 29h5M36 29h5" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      <path d="M15 34c0-7.2 3-11 9-11s9 3.8 9 11H15Z" fill="currentColor" />
      <path d="M12 39h24" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
    </IconFrame>
  );
}

export function SearchIcon({ size = 34 }: ChatIconProps) {
  return (
    <IconFrame size={size}>
      <circle cx="21" cy="21" fill="none" r="12" stroke="currentColor" strokeWidth="4" />
      <path d="m30 30 10 10" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
    </IconFrame>
  );
}

export function SettingsIcon({ size = 38 }: ChatIconProps) {
  return (
    <IconFrame size={size}>
      <path d="m24 6 2.3 3.9 4.4 1.1 3.8-2.3 4.8 4.8-2.3 3.8 1.1 4.4L42 24l-3.9 2.3-1.1 4.4 2.3 3.8-4.8 4.8-3.8-2.3-4.4 1.1L24 42l-2.3-3.9-4.4-1.1-3.8 2.3-4.8-4.8 2.3-3.8-1.1-4.4L6 24l3.9-2.3 1.1-4.4-2.3-3.8 4.8-4.8 3.8 2.3 4.4-1.1L24 6Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="3" />
      <circle cx="24" cy="24" fill="none" r="6" stroke="currentColor" strokeWidth="3" />
    </IconFrame>
  );
}

export function ArrowUpIcon({ size = 34 }: ChatIconProps) {
  return (
    <IconFrame size={size}>
      <path d="m24 8 15 25H9L24 8Z" fill="currentColor" />
    </IconFrame>
  );
}

export function ArrowDownIcon({ size = 34 }: ChatIconProps) {
  return (
    <IconFrame size={size}>
      <path d="m24 40-15-25h30L24 40Z" fill="currentColor" />
    </IconFrame>
  );
}
