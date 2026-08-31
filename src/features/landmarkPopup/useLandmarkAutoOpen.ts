import { useEffect, useState } from 'react';
import type { LandmarkPopupVariant } from './LandmarkPopupContext';
import { useOptionalLandmarkPopup } from './LandmarkPopupContext';

let nextSessionId = 1;

export function useLandmarkAutoOpen(
  variant: LandmarkPopupVariant,
  keyPrefix: string,
  explicitKey?: string,
  enabled = true,
): void {
  const popup = useOptionalLandmarkPopup();
  const requestAutoOpen = popup?.requestAutoOpen;
  const releaseAutoOpen = popup?.releaseAutoOpen;
  const [generatedKey] = useState(() => `${keyPrefix}-${nextSessionId++}`);
  const requestKey = explicitKey ?? generatedKey;

  useEffect(() => {
    if (!requestAutoOpen || !releaseAutoOpen || !enabled) {
      return undefined;
    }

    requestAutoOpen(requestKey, variant);
    return () => {
      releaseAutoOpen(requestKey);
    };
  }, [enabled, releaseAutoOpen, requestAutoOpen, requestKey, variant]);
}
