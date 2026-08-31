import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { LandmarkPopupVariant } from './LandmarkPopupContext';
import {
  FULL_FACE_CONTOUR_INDICES,
  LOOKTALK_IRIS_INDEX_GROUPS,
  LOOKTALK_LEFT_EYE_INDICES,
  LOOKTALK_MOUTH_INDICES,
  LOOKTALK_MOUTH_VERTICAL_CONNECTION,
  LOOKTALK_RIGHT_EYE_INDICES,
} from './landmarkGroups';

export type DrawableLandmarkGroup = 'full' | 'mouth';

export interface LandmarkPointStyle {
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export const LANDMARK_POINT_STYLES: Record<DrawableLandmarkGroup, LandmarkPointStyle> = {
  full: {
    radius: 2.8,
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 1,
  },
  mouth: {
    radius: 6,
    fill: '#00ff00',
    stroke: '#00ff00',
    strokeWidth: 0,
  },
};

export const EYE_CONTOUR_STYLE = {
  color: '#db7093',
  width: 1,
} as const;

export const IRIS_RING_STYLE = {
  color: '#ffc800',
  width: 1,
  minimumRadius: 3,
  centerRadius: 2,
} as const;

export const MOUTH_VERTICAL_LINE_STYLE = {
  color: '#ffff00',
  width: 2,
} as const;

export const LANDMARK_VISUAL_SCALE_REFERENCE_WIDTH = 480;
export const LANDMARK_VISUAL_SCALE_MIN = 0.9;
export const LANDMARK_VISUAL_SCALE_MAX = 1.35;

export interface ScaledEyeContourStyle {
  color: string;
  width: number;
}

export interface ScaledIrisRingStyle {
  color: string;
  width: number;
  minimumRadius: number;
  centerRadius: number;
}

export interface ScaledLineStyle {
  color: string;
  width: number;
}

export interface LandmarkVisualMetrics {
  visualScale: number;
  pointStyles: Record<DrawableLandmarkGroup, LandmarkPointStyle>;
  eyeContourStyle: ScaledEyeContourStyle;
  irisRingStyle: ScaledIrisRingStyle;
  mouthVerticalLineStyle: ScaledLineStyle;
}

/** CSS 표시 너비만 사용한다. Canvas backing size와 DPR은 이 배율에 관여하지 않는다. */
export function calculateLandmarkVisualScale(cssWidth: number): number {
  if (!Number.isFinite(cssWidth)) {
    return LANDMARK_VISUAL_SCALE_MIN;
  }

  return Math.min(
    LANDMARK_VISUAL_SCALE_MAX,
    Math.max(
      LANDMARK_VISUAL_SCALE_MIN,
      cssWidth / LANDMARK_VISUAL_SCALE_REFERENCE_WIDTH,
    ),
  );
}

function scalePointStyle(
  style: LandmarkPointStyle,
  visualScale: number,
): LandmarkPointStyle {
  return {
    ...style,
    radius: style.radius * visualScale,
    strokeWidth: style.strokeWidth * visualScale,
  };
}

export function calculateLandmarkVisualMetrics(cssWidth: number): LandmarkVisualMetrics {
  const visualScale = calculateLandmarkVisualScale(cssWidth);

  return {
    visualScale,
    pointStyles: {
      full: scalePointStyle(LANDMARK_POINT_STYLES.full, visualScale),
      mouth: scalePointStyle(LANDMARK_POINT_STYLES.mouth, visualScale),
    },
    eyeContourStyle: {
      ...EYE_CONTOUR_STYLE,
      width: EYE_CONTOUR_STYLE.width * visualScale,
    },
    irisRingStyle: {
      ...IRIS_RING_STYLE,
      width: IRIS_RING_STYLE.width * visualScale,
      minimumRadius: IRIS_RING_STYLE.minimumRadius * visualScale,
      centerRadius: IRIS_RING_STYLE.centerRadius * visualScale,
    },
    mouthVerticalLineStyle: {
      ...MOUTH_VERTICAL_LINE_STYLE,
      width: MOUTH_VERTICAL_LINE_STYLE.width * visualScale,
    },
  };
}

export interface CoverRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasBackingSize {
  width: number;
  height: number;
  dpr: number;
}

export function calculateCoverRect(
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
): CoverRect | null {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    destinationWidth <= 0 ||
    destinationHeight <= 0
  ) {
    return null;
  }

  const scale = Math.max(
    destinationWidth / sourceWidth,
    destinationHeight / sourceHeight,
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    x: (destinationWidth - width) / 2,
    y: (destinationHeight - height) / 2,
    width,
    height,
  };
}

export function calculateCanvasBackingSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): CanvasBackingSize {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;

  return {
    width: Math.max(0, Math.round(cssWidth * dpr)),
    height: Math.max(0, Math.round(cssHeight * dpr)),
    dpr,
  };
}

export function projectCanonicalLandmark(
  point: Pick<NormalizedLandmark, 'x' | 'y'>,
  coverRect: CoverRect,
): { x: number; y: number } {
  return {
    x: coverRect.x + point.x * coverRect.width,
    y: coverRect.y + point.y * coverRect.height,
  };
}

export type LandmarkVisitor = (
  point: NormalizedLandmark,
  index: number,
  group: DrawableLandmarkGroup,
) => void;

/** 점으로 표시하는 항목만 순회한다. 눈 윤곽선과 홍채 중심점은 별도로 그린다. */
export function visitLandmarks(
  landmarks: ReadonlyArray<NormalizedLandmark>,
  variant: LandmarkPopupVariant,
  visitor: LandmarkVisitor,
): void {
  const indices = variant === 'full'
    ? FULL_FACE_CONTOUR_INDICES
    : LOOKTALK_MOUTH_INDICES;
  const group: DrawableLandmarkGroup = variant === 'full' ? 'full' : 'mouth';

  for (const index of indices) {
    const point = landmarks[index];
    if (point) {
      visitor(point, index, group);
    }
  }
}

/** raw video만 한 번 좌우 반전한다. canonical landmark에는 추가 반전을 적용하지 않는다. */
export function drawMirroredCoverVideo(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  coverRect: CoverRect,
  destinationWidth: number,
): void {
  context.save();
  context.translate(destinationWidth, 0);
  context.scale(-1, 1);
  context.drawImage(
    video,
    coverRect.x,
    coverRect.y,
    coverRect.width,
    coverRect.height,
  );
  context.restore();
}

function drawPoint(
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  style: LandmarkPointStyle,
): void {
  context.beginPath();
  context.arc(point.x, point.y, style.radius, 0, Math.PI * 2);
  context.fillStyle = style.fill;
  context.fill();
  if (style.strokeWidth > 0) {
    context.lineWidth = style.strokeWidth;
    context.strokeStyle = style.stroke;
    context.stroke();
  }
}

function drawClosedPolyline(
  context: CanvasRenderingContext2D,
  landmarks: ReadonlyArray<NormalizedLandmark>,
  indices: ReadonlyArray<number>,
  coverRect: CoverRect,
  style: ScaledLineStyle,
): void {
  const points: NormalizedLandmark[] = [];
  for (const index of indices) {
    const point = landmarks[index];
    if (!point) {
      return;
    }
    points.push(point);
  }

  context.beginPath();
  points.forEach((point, index) => {
    const projected = projectCanonicalLandmark(point, coverRect);
    if (index === 0) {
      context.moveTo(projected.x, projected.y);
    } else {
      context.lineTo(projected.x, projected.y);
    }
  });
  context.closePath();
  context.strokeStyle = style.color;
  context.lineWidth = style.width;
  context.stroke();
}

function drawConnection(
  context: CanvasRenderingContext2D,
  landmarks: ReadonlyArray<NormalizedLandmark>,
  startIndex: number,
  endIndex: number,
  coverRect: CoverRect,
  style: ScaledLineStyle,
): void {
  const start = landmarks[startIndex];
  const end = landmarks[endIndex];
  if (!start || !end) {
    return;
  }

  const projectedStart = projectCanonicalLandmark(start, coverRect);
  const projectedEnd = projectCanonicalLandmark(end, coverRect);
  context.beginPath();
  context.moveTo(projectedStart.x, projectedStart.y);
  context.lineTo(projectedEnd.x, projectedEnd.y);
  context.strokeStyle = style.color;
  context.lineWidth = style.width;
  context.stroke();
}

function drawEyeContours(
  context: CanvasRenderingContext2D,
  landmarks: ReadonlyArray<NormalizedLandmark>,
  coverRect: CoverRect,
  style: ScaledEyeContourStyle,
): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  drawClosedPolyline(
    context,
    landmarks,
    LOOKTALK_LEFT_EYE_INDICES,
    coverRect,
    style,
  );
  drawClosedPolyline(
    context,
    landmarks,
    LOOKTALK_RIGHT_EYE_INDICES,
    coverRect,
    style,
  );
}

function drawIrisRing(
  context: CanvasRenderingContext2D,
  landmarks: ReadonlyArray<NormalizedLandmark>,
  group: (typeof LOOKTALK_IRIS_INDEX_GROUPS)[number],
  coverRect: CoverRect,
  style: ScaledIrisRingStyle,
): void {
  const center = landmarks[group.center];
  if (!center) {
    return;
  }

  const ring: NormalizedLandmark[] = [];
  for (const index of group.ring) {
    const point = landmarks[index];
    if (!point) {
      return;
    }
    ring.push(point);
  }

  const projectedCenter = projectCanonicalLandmark(center, coverRect);
  const radii = ring.map((point) => {
    const projected = projectCanonicalLandmark(point, coverRect);
    return Math.hypot(
      projected.x - projectedCenter.x,
      projected.y - projectedCenter.y,
    );
  });
  const meanRadius = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  const radius = Math.max(style.minimumRadius, meanRadius);

  context.beginPath();
  context.arc(projectedCenter.x, projectedCenter.y, radius, 0, Math.PI * 2);
  context.strokeStyle = style.color;
  context.lineWidth = style.width;
  context.stroke();

  context.beginPath();
  context.arc(
    projectedCenter.x,
    projectedCenter.y,
    style.centerRadius,
    0,
    Math.PI * 2,
  );
  context.fillStyle = style.color;
  context.fill();
}

interface DrawLandmarkFrameOptions {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  landmarks: ReadonlyArray<NormalizedLandmark> | null;
  variant: LandmarkPopupVariant;
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
}

export function drawLandmarkFrame({
  canvas,
  video,
  landmarks,
  variant,
  cssWidth,
  cssHeight,
  devicePixelRatio,
}: DrawLandmarkFrameOptions): void {
  const context = canvas.getContext('2d');
  if (!context || cssWidth <= 0 || cssHeight <= 0) {
    return;
  }

  const backing = calculateCanvasBackingSize(cssWidth, cssHeight, devicePixelRatio);
  if (canvas.width !== backing.width || canvas.height !== backing.height) {
    canvas.width = backing.width;
    canvas.height = backing.height;
  }

  context.setTransform(backing.dpr, 0, 0, backing.dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = '#050505';
  context.fillRect(0, 0, cssWidth, cssHeight);

  const coverRect = calculateCoverRect(
    video.videoWidth,
    video.videoHeight,
    cssWidth,
    cssHeight,
  );

  if (!coverRect) {
    return;
  }

  drawMirroredCoverVideo(context, video, coverRect, cssWidth);

  if (!landmarks) {
    return;
  }

  const visualMetrics = calculateLandmarkVisualMetrics(cssWidth);

  if (variant === 'looktalk') {
    drawEyeContours(
      context,
      landmarks,
      coverRect,
      visualMetrics.eyeContourStyle,
    );

    for (const irisGroup of LOOKTALK_IRIS_INDEX_GROUPS) {
      drawIrisRing(
        context,
        landmarks,
        irisGroup,
        coverRect,
        visualMetrics.irisRingStyle,
      );
    }
  }

  visitLandmarks(landmarks, variant, (point, _index, group) => {
    drawPoint(
      context,
      projectCanonicalLandmark(point, coverRect),
      visualMetrics.pointStyles[group],
    );
  });

  if (variant === 'looktalk') {
    drawConnection(
      context,
      landmarks,
      LOOKTALK_MOUTH_VERTICAL_CONNECTION.start,
      LOOKTALK_MOUTH_VERTICAL_CONNECTION.end,
      coverRect,
      visualMetrics.mouthVerticalLineStyle,
    );
  }
}
