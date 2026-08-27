import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { LandmarkPopupVariant } from './LandmarkPopupContext';
import {
  FULL_FACE_CONTOUR_INDICES,
  LOOKTALK_IRIS_INDEX_GROUPS,
  LOOKTALK_LEFT_EYE_CONNECTIONS,
  LOOKTALK_MOUTH_INDICES,
  LOOKTALK_RIGHT_EYE_CONNECTIONS,
  type LandmarkConnection,
} from './landmarkGroups';

export type DrawableLandmarkGroup = 'full' | 'iris' | 'mouth';

export interface LandmarkPointStyle {
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export const LANDMARK_POINT_STYLES: Record<DrawableLandmarkGroup, LandmarkPointStyle> = {
  full: {
    radius: 2.75,
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 1.25,
  },
  iris: {
    radius: 5.5,
    fill: '#ff2020',
    stroke: '#ffffff',
    strokeWidth: 1.5,
  },
  mouth: {
    radius: 5,
    fill: '#33e06f',
    stroke: '#111111',
    strokeWidth: 1.5,
  },
};

export const EYE_CONTOUR_STYLE = {
  haloColor: '#111111',
  haloWidth: 3.5,
  color: '#ffe000',
  width: 1.5,
} as const;

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

export function averageLandmarkPoint(
  landmarks: ReadonlyArray<NormalizedLandmark>,
  indices: ReadonlyArray<number>,
): Pick<NormalizedLandmark, 'x' | 'y' | 'z'> | null {
  if (indices.length === 0) {
    return null;
  }

  let x = 0;
  let y = 0;
  let z = 0;

  for (const index of indices) {
    const point = landmarks[index];
    if (!point) {
      return null;
    }
    x += point.x;
    y += point.y;
    z += point.z ?? 0;
  }

  return {
    x: x / indices.length,
    y: y / indices.length,
    z: z / indices.length,
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
  context.lineWidth = style.strokeWidth;
  context.strokeStyle = style.stroke;
  context.stroke();
}

function traceConnections(
  context: CanvasRenderingContext2D,
  landmarks: ReadonlyArray<NormalizedLandmark>,
  connections: ReadonlyArray<LandmarkConnection>,
  coverRect: CoverRect,
): void {
  context.beginPath();
  for (const { start, end } of connections) {
    const startPoint = landmarks[start];
    const endPoint = landmarks[end];
    if (!startPoint || !endPoint) {
      continue;
    }

    const projectedStart = projectCanonicalLandmark(startPoint, coverRect);
    const projectedEnd = projectCanonicalLandmark(endPoint, coverRect);
    context.moveTo(projectedStart.x, projectedStart.y);
    context.lineTo(projectedEnd.x, projectedEnd.y);
  }
  context.stroke();
}

function drawEyeContours(
  context: CanvasRenderingContext2D,
  landmarks: ReadonlyArray<NormalizedLandmark>,
  coverRect: CoverRect,
): void {
  const eyeConnections = [
    ...LOOKTALK_LEFT_EYE_CONNECTIONS,
    ...LOOKTALK_RIGHT_EYE_CONNECTIONS,
  ];

  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = EYE_CONTOUR_STYLE.haloColor;
  context.lineWidth = EYE_CONTOUR_STYLE.haloWidth;
  traceConnections(context, landmarks, eyeConnections, coverRect);
  context.strokeStyle = EYE_CONTOUR_STYLE.color;
  context.lineWidth = EYE_CONTOUR_STYLE.width;
  traceConnections(context, landmarks, eyeConnections, coverRect);
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

  if (variant === 'looktalk') {
    drawEyeContours(context, landmarks, coverRect);

    for (const irisIndices of LOOKTALK_IRIS_INDEX_GROUPS) {
      const center = averageLandmarkPoint(landmarks, irisIndices);
      if (center) {
        drawPoint(
          context,
          projectCanonicalLandmark(center, coverRect),
          LANDMARK_POINT_STYLES.iris,
        );
      }
    }
  }

  visitLandmarks(landmarks, variant, (point, _index, group) => {
    drawPoint(
      context,
      projectCanonicalLandmark(point, coverRect),
      LANDMARK_POINT_STYLES[group],
    );
  });
}
