import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerOptions } from '@mediapipe/tasks-vision';

// WASM 런타임: CDN (jsdelivr, 패키지 버전 고정) — 공식 MediaPipe 예제와 동일한 표준 경로.
// 모델: public/models/에 로컬 배치 (Integration Plan §5.2 권장).
// 두 경로를 섞지 않는 게 원칙이지만, 이번 Step 0에서는 "WASM=CDN / model=로컬"을
// 리포지토리 크기(WASM 약 33MB vs 모델 3.6MB)를 고려해 의도적으로 채택했다(사용자 확인 완료).
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_ASSET_PATH = '/models/face_landmarker.task';

export interface FaceLandmarkerHandle {
  landmarker: FaceLandmarker;
  delegate: 'GPU' | 'CPU';
}

async function createWithDelegate(
  wasmFileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  delegate: 'GPU' | 'CPU',
): Promise<FaceLandmarker> {
  const options: FaceLandmarkerOptions = {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    // Look-Talk main.py:852-857의 mp_face_mesh.FaceMesh(min_detection_confidence=0.7,
    // min_tracking_confidence=0.7)와 대응. minFacePresenceConfidence는 Python에 대응값이
    // 없으므로 API 기본값(0.5)을 그대로 두고 임의로 지정하지 않는다.
    minFaceDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  };

  return FaceLandmarker.createFromOptions(wasmFileset, options);
}

/**
 * FaceLandmarker(Tasks Vision)는 legacy `mediapipe.solutions.face_mesh`의
 * `refine_landmarks` 옵션에 대응하는 설정이 없다 — FaceLandmarkerOptions 타입 정의
 * (node_modules/@mediapipe/tasks-vision/vision.d.ts:655-688)에 해당 필드 자체가 없으며,
 * 홍채(468~477)를 포함한 478포인트 토폴로지가 항상 고정 출력이다. 즉 Python의
 * refine_landmarks=True를 별도로 켤 필요가 없다(끌 수도 없다).
 */
export async function createFaceLandmarker(): Promise<FaceLandmarkerHandle> {
  const wasmFileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

  try {
    const landmarker = await createWithDelegate(wasmFileset, 'GPU');
    return { landmarker, delegate: 'GPU' };
  } catch (gpuError) {
    console.warn('[faceTracking] GPU delegate 초기화 실패 — CPU로 재시도합니다.', gpuError);
    const landmarker = await createWithDelegate(wasmFileset, 'CPU');
    return { landmarker, delegate: 'CPU' };
  }
}
