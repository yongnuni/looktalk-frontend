export const PIP_MIN_WIDTH = 360;
export const PIP_MAX_WIDTH = 720;
export const PIP_DEFAULT_VIEWPORT_RATIO = 0.25;
export const PIP_VIEWPORT_MARGIN = 24;
export const PIP_HEADER_HEIGHT = 41;
export const PIP_CAMERA_ASPECT_RATIO = 16 / 9;

export interface PipWidthBounds {
  min: number;
  max: number;
}

export function getPipWidthBounds(
  viewportWidth: number,
  viewportHeight: number,
): PipWidthBounds {
  const maxByWidth = Math.max(1, viewportWidth - PIP_VIEWPORT_MARGIN);
  const cameraHeightBudget = Math.max(
    1,
    viewportHeight - PIP_VIEWPORT_MARGIN - PIP_HEADER_HEIGHT,
  );
  const maxByHeight = cameraHeightBudget * PIP_CAMERA_ASPECT_RATIO;
  const max = Math.max(1, Math.min(PIP_MAX_WIDTH, maxByWidth, maxByHeight));

  return {
    min: Math.min(PIP_MIN_WIDTH, max),
    max,
  };
}

export function clampPipWidth(
  requestedWidth: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const bounds = getPipWidthBounds(viewportWidth, viewportHeight);
  const finiteWidth = Number.isFinite(requestedWidth) ? requestedWidth : bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, finiteWidth));
}

export function getDefaultPipWidth(
  viewportWidth: number,
  viewportHeight: number,
): number {
  return clampPipWidth(
    viewportWidth * PIP_DEFAULT_VIEWPORT_RATIO,
    viewportWidth,
    viewportHeight,
  );
}

export function getPipCameraHeight(width: number): number {
  return width / PIP_CAMERA_ASPECT_RATIO;
}

/** 우측 상단을 고정하므로 좌측 핸들을 왼쪽으로 끌수록 폭이 커진다. */
export function getPointerResizedWidth(
  startWidth: number,
  startPointerX: number,
  currentPointerX: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  return clampPipWidth(
    startWidth + startPointerX - currentPointerX,
    viewportWidth,
    viewportHeight,
  );
}
