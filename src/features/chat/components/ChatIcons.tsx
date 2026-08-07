import downArrowImage from '../../../assets/down_arrow.png';
import settingImage from '../../../assets/setting.png';
import sosImage from '../../../assets/sos.png';
import upArrowImage from '../../../assets/up_arrow.png';

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
  return <img alt="" aria-hidden="true" height={size} src={sosImage} width={size} />;
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
  return <img alt="" aria-hidden="true" height={size} src={settingImage} width={size} />;
}

export function ArrowUpIcon({ size = 34 }: ChatIconProps) {
  return <img alt="" aria-hidden="true" height={size} src={upArrowImage} width={size} />;
}

export function ArrowDownIcon({ size = 34 }: ChatIconProps) {
  return <img alt="" aria-hidden="true" height={size} src={downArrowImage} width={size} />;
}
