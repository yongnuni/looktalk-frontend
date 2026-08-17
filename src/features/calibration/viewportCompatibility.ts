import type { GazeCalibrationResult } from './types';

// Integration Plan §8.5 — 구체적인 임계값은 "QA로 정확도 저하를 관찰한 뒤 확정"하도록
// 명시적으로 유보되어 있다. 여기서는 그 1차 기본값(비침습적 배너 트리거용)만 provisional로
// 정의한다 — 실제 기기 QA 결과로 뒤집힐 수 있는 값이며 하드 블로킹에는 쓰지 않는다.
const ASPECT_RATIO_DELTA_UNCERTAIN = 0.15;
const ASPECT_RATIO_DELTA_INCOMPATIBLE = 0.4;

export interface CalibrationCompatibility {
  status: 'compatible' | 'uncertain' | 'incompatible';
  orientationChanged: boolean;
  aspectRatioDelta: number;
}

export interface ViewportSnapshot {
  widthPx: number;
  heightPx: number;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape';
}

export function getCurrentViewportSnapshot(): ViewportSnapshot {
  const widthPx = window.innerWidth;
  const heightPx = window.innerHeight;

  return {
    widthPx,
    heightPx,
    aspectRatio: widthPx / heightPx,
    orientation: widthPx >= heightPx ? 'landscape' : 'portrait',
  };
}

export function checkViewportCompatibility(
  stored: GazeCalibrationResult['calibratedViewport'],
  current: ViewportSnapshot,
): CalibrationCompatibility {
  const orientationChanged = stored.orientation !== current.orientation;
  const aspectRatioDelta = Math.abs(current.aspectRatio - stored.aspectRatio) / stored.aspectRatio;

  let status: CalibrationCompatibility['status'] = 'compatible';

  if (aspectRatioDelta >= ASPECT_RATIO_DELTA_INCOMPATIBLE) {
    status = 'incompatible';
  } else if (orientationChanged || aspectRatioDelta >= ASPECT_RATIO_DELTA_UNCERTAIN) {
    status = 'uncertain';
  }

  return { status, orientationChanged, aspectRatioDelta };
}
