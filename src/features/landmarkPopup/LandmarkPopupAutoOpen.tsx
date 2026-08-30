import type { LandmarkPopupVariant } from './LandmarkPopupContext';
import { useLandmarkAutoOpen } from './useLandmarkAutoOpen';

interface LandmarkPopupAutoOpenProps {
  requestKey: string;
  variant: LandmarkPopupVariant;
  enabled?: boolean;
}

export default function LandmarkPopupAutoOpen({
  requestKey,
  variant,
  enabled = true,
}: LandmarkPopupAutoOpenProps) {
  useLandmarkAutoOpen(variant, requestKey, undefined, enabled);
  return null;
}
