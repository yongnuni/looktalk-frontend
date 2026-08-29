export const PIP_MIN_WIDTH = 320;
export const PIP_DEFAULT_VIEWPORT_RATIO = 0.25;
export const PIP_VIEWPORT_MARGIN = 12;
export const PIP_HEADER_HEIGHT = 41;
export const PIP_CAMERA_ASPECT_RATIO = 16 / 9;

export interface PipGeometry {
  x: number;
  y: number;
  width: number;
}

export interface PipPoint {
  x: number;
  y: number;
}

export type PipResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export interface PipWidthBounds {
  min: number;
  max: number;
}

export function getPipCameraHeight(width: number): number {
  return width / PIP_CAMERA_ASPECT_RATIO;
}

export function getPipHeight(width: number): number {
  return PIP_HEADER_HEIGHT + getPipCameraHeight(width);
}

export function getPipWidthBounds(
  viewportWidth: number,
  viewportHeight: number,
): PipWidthBounds {
  const maxByWidth = Math.max(1, viewportWidth - PIP_VIEWPORT_MARGIN * 2);
  const cameraHeightBudget = Math.max(
    1,
    viewportHeight - PIP_VIEWPORT_MARGIN * 2 - PIP_HEADER_HEIGHT,
  );
  const maxByHeight = cameraHeightBudget * PIP_CAMERA_ASPECT_RATIO;
  const max = Math.max(1, Math.min(maxByWidth, maxByHeight));

  return { min: Math.min(PIP_MIN_WIDTH, max), max };
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

function clampCoordinate(value: number, min: number, max: number): number {
  const finiteValue = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, finiteValue));
}

export function clampPipGeometry(
  geometry: PipGeometry,
  viewportWidth: number,
  viewportHeight: number,
): PipGeometry {
  const width = clampPipWidth(geometry.width, viewportWidth, viewportHeight);
  const maxX = Math.max(PIP_VIEWPORT_MARGIN, viewportWidth - PIP_VIEWPORT_MARGIN - width);
  const maxY = Math.max(
    PIP_VIEWPORT_MARGIN,
    viewportHeight - PIP_VIEWPORT_MARGIN - getPipHeight(width),
  );

  return {
    x: clampCoordinate(geometry.x, PIP_VIEWPORT_MARGIN, maxX),
    y: clampCoordinate(geometry.y, PIP_VIEWPORT_MARGIN, maxY),
    width,
  };
}

export function getDefaultPipGeometry(
  viewportWidth: number,
  viewportHeight: number,
): PipGeometry {
  const width = getDefaultPipWidth(viewportWidth, viewportHeight);
  return clampPipGeometry(
    { x: viewportWidth - PIP_VIEWPORT_MARGIN - width, y: PIP_VIEWPORT_MARGIN, width },
    viewportWidth,
    viewportHeight,
  );
}

export function getDraggedPipGeometry(
  startGeometry: PipGeometry,
  startPointer: PipPoint,
  currentPointer: PipPoint,
  viewportWidth: number,
  viewportHeight: number,
): PipGeometry {
  return clampPipGeometry(
    {
      ...startGeometry,
      x: startGeometry.x + currentPointer.x - startPointer.x,
      y: startGeometry.y + currentPointer.y - startPointer.y,
    },
    viewportWidth,
    viewportHeight,
  );
}

export function getPointerResizedGeometry(
  startGeometry: PipGeometry,
  corner: PipResizeCorner,
  startPointer: PipPoint,
  currentPointer: PipPoint,
  viewportWidth: number,
  viewportHeight: number,
): PipGeometry {
  const horizontalDelta = corner.endsWith('e')
    ? currentPointer.x - startPointer.x
    : startPointer.x - currentPointer.x;
  const verticalDelta = (corner.startsWith('s')
    ? currentPointer.y - startPointer.y
    : startPointer.y - currentPointer.y) * PIP_CAMERA_ASPECT_RATIO;
  const widthDelta = Math.abs(horizontalDelta) >= Math.abs(verticalDelta)
    ? horizontalDelta
    : verticalDelta;
  const globalBounds = getPipWidthBounds(viewportWidth, viewportHeight);
  const horizontalBudget = corner.endsWith('e')
    ? viewportWidth - PIP_VIEWPORT_MARGIN - startGeometry.x
    : startGeometry.x + startGeometry.width - PIP_VIEWPORT_MARGIN;
  const verticalBudget = corner.startsWith('s')
    ? (
        viewportHeight - PIP_VIEWPORT_MARGIN - startGeometry.y - PIP_HEADER_HEIGHT
      ) * PIP_CAMERA_ASPECT_RATIO
    : (
        startGeometry.y + getPipHeight(startGeometry.width)
        - PIP_VIEWPORT_MARGIN - PIP_HEADER_HEIGHT
      ) * PIP_CAMERA_ASPECT_RATIO;
  const anchoredMax = Math.max(
    globalBounds.min,
    Math.min(globalBounds.max, horizontalBudget, verticalBudget),
  );
  const requestedWidth = Number.isFinite(startGeometry.width + widthDelta)
    ? startGeometry.width + widthDelta
    : globalBounds.min;
  const width = Math.min(anchoredMax, Math.max(globalBounds.min, requestedWidth));
  const geometry = {
    x: corner.endsWith('w')
      ? startGeometry.x + startGeometry.width - width
      : startGeometry.x,
    y: corner.startsWith('n')
      ? startGeometry.y + getPipHeight(startGeometry.width) - getPipHeight(width)
      : startGeometry.y,
    width,
  };

  return clampPipGeometry(geometry, viewportWidth, viewportHeight);
}

export function shouldStartPipDrag(mouseButton: number, closeButtonHit: boolean): boolean {
  return mouseButton === 0 && !closeButtonHit;
}
