import type { ReactNode } from 'react';
import settingImage from '../../../assets/setting.png';
import sosImage from '../../../assets/sos.png';

interface AnalysisIconProps {
  size?: number;
}

function IconFrame({ size = 32, children }: AnalysisIconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="analysis-icon"
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

export function SettingsIcon({ size = 40 }: AnalysisIconProps) {
  return <img alt="" aria-hidden="true" height={size} src={settingImage} width={size} />;
}

export function EmergencyIcon({ size = 42 }: AnalysisIconProps) {
  return <img alt="" aria-hidden="true" height={size} src={sosImage} width={size} />;
}

export function ArrowLeftIcon({ size = 48 }: AnalysisIconProps) {
  return (
    <IconFrame size={size}>
      <path d="M31 8 15 24l16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
    </IconFrame>
  );
}

export function ArrowRightIcon({ size = 48 }: AnalysisIconProps) {
  return (
    <IconFrame size={size}>
      <path d="m17 8 16 16-16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
    </IconFrame>
  );
}

export function KeyboardIcon({ size = 52 }: AnalysisIconProps) {
  return (
    <IconFrame size={size}>
      <rect height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="3" width="36" x="6" y="14" />
      <path d="M12 21h2M18 21h2M24 21h2M30 21h2M12 28h2M18 28h2M24 28h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      <circle cx="38" cy="10" fill="currentColor" r="6" />
      <path d="m42 14 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </IconFrame>
  );
}

export function RecommendationIcon({ size = 42 }: AnalysisIconProps) {
  return (
    <IconFrame size={size}>
      <rect height="26" rx="8" fill="none" stroke="currentColor" strokeWidth="3" width="32" x="8" y="14" />
      <path d="M24 8v6M18 26h.1M30 26h.1M18 33c3 2 9 2 12 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      <circle cx="24" cy="6" fill="currentColor" r="2.5" />
    </IconFrame>
  );
}
