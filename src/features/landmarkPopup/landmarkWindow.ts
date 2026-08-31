export const LANDMARK_WINDOW_NAME = 'looktalk-landmark-camera';
export const LANDMARK_WINDOW_TITLE = 'Look-Talk 랜드마크 카메라';
export const LANDMARK_WINDOW_INITIAL_WIDTH = 520;
export const LANDMARK_WINDOW_INITIAL_HEIGHT = 340;
export const LANDMARK_WINDOW_EDGE_GAP = 24;
export const LANDMARK_WINDOW_MIN_INNER_WIDTH = 320;
export const LANDMARK_WINDOW_MIN_INNER_HEIGHT = 230;

export interface AvailableScreenRect {
  availLeft?: number;
  availTop?: number;
  availWidth: number;
  availHeight: number;
}

export interface LandmarkWindowGeometry {
  width: number;
  height: number;
  left: number;
  top: number;
}

/** 현재 모니터의 우측 상단을 우선하되 브라우저가 보정할 수 있는 안전한 초기 위치. */
export function calculateLandmarkWindowGeometry(
  screen: AvailableScreenRect,
): LandmarkWindowGeometry {
  const screenLeft = Number.isFinite(screen.availLeft) ? (screen.availLeft ?? 0) : 0;
  const screenTop = Number.isFinite(screen.availTop) ? (screen.availTop ?? 0) : 0;
  const availableWidth = Number.isFinite(screen.availWidth)
    ? Math.max(0, screen.availWidth)
    : LANDMARK_WINDOW_INITIAL_WIDTH;
  const availableHeight = Number.isFinite(screen.availHeight)
    ? Math.max(0, screen.availHeight)
    : LANDMARK_WINDOW_INITIAL_HEIGHT;

  return {
    width: LANDMARK_WINDOW_INITIAL_WIDTH,
    height: LANDMARK_WINDOW_INITIAL_HEIGHT,
    left: Math.round(
      Math.max(screenLeft, screenLeft + availableWidth - LANDMARK_WINDOW_INITIAL_WIDTH - LANDMARK_WINDOW_EDGE_GAP),
    ),
    top: Math.round(
      Math.max(screenTop, Math.min(screenTop + LANDMARK_WINDOW_EDGE_GAP, screenTop + availableHeight)),
    ),
  };
}

export function buildLandmarkWindowFeatures(
  screen: AvailableScreenRect,
): string {
  const geometry = calculateLandmarkWindowGeometry(screen);
  return [
    `width=${geometry.width}`,
    `height=${geometry.height}`,
    `left=${geometry.left}`,
    `top=${geometry.top}`,
    'resizable=yes',
    'scrollbars=no',
  ].join(',');
}

export function openLandmarkWindow(ownerWindow: Window): Window | null {
  return ownerWindow.open(
    '',
    LANDMARK_WINDOW_NAME,
    buildLandmarkWindowFeatures(ownerWindow.screen),
  );
}

/** 외부 document 안에서 React portal이 소유할 유일한 host를 만든다. */
export function initializeLandmarkWindowDocument(
  externalWindow: Window,
  stylesheet: string,
): HTMLElement {
  const externalDocument = externalWindow.document;
  externalDocument.documentElement.lang = 'ko';
  externalDocument.title = LANDMARK_WINDOW_TITLE;

  const charset = externalDocument.createElement('meta');
  charset.setAttribute('charset', 'UTF-8');
  const viewport = externalDocument.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1';
  const style = externalDocument.createElement('style');
  style.dataset.looktalkLandmarkWindow = 'true';
  style.textContent = stylesheet;
  externalDocument.head.replaceChildren(charset, viewport, style);

  const portalHost = externalDocument.createElement('div');
  portalHost.id = 'looktalk-landmark-window-root';
  externalDocument.body.replaceChildren(portalHost);
  return portalHost;
}

export interface ContainedVideoSize {
  width: number;
  height: number;
}

export interface OuterWindowSize {
  width: number;
  height: number;
}

/** 브라우저가 resizeTo를 허용할 때 적용할 콘텐츠 기준 최소 창 크기. */
export function calculateMinimumOuterWindowSize(
  innerWidth: number,
  innerHeight: number,
  outerWidth: number,
  outerHeight: number,
): OuterWindowSize | null {
  const missingWidth = Math.max(0, LANDMARK_WINDOW_MIN_INNER_WIDTH - innerWidth);
  const missingHeight = Math.max(0, LANDMARK_WINDOW_MIN_INNER_HEIGHT - innerHeight);
  if (missingWidth === 0 && missingHeight === 0) {
    return null;
  }

  return {
    width: outerWidth + missingWidth,
    height: outerHeight + missingHeight,
  };
}

/** 제목을 제외한 stage 안에 16:9 영상을 contain으로 맞춘다. */
export function calculateContainedVideoSize(
  availableWidth: number,
  availableHeight: number,
): ContainedVideoSize {
  if (availableWidth <= 0 || availableHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const widthFromHeight = availableHeight * (16 / 9);
  if (widthFromHeight <= availableWidth) {
    return {
      width: widthFromHeight,
      height: availableHeight,
    };
  }

  return {
    width: availableWidth,
    height: availableWidth * (9 / 16),
  };
}
