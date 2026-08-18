import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../../features/camera/hooks/useCamera';
import { useFaceTracking } from '../../features/faceTracking/hooks/useFaceTracking';
import {
  MIRROR_STRATEGIES,
  MIRROR_STRATEGY_LABELS,
  DEFAULT_MIRROR_STRATEGY,
} from '../../features/faceTracking/mediapipe/mirrorStrategy';
import type { MirrorStrategy } from '../../features/faceTracking/mediapipe/mirrorStrategy';
import { LEFT_IRIS_LANDMARK_INDICES, RIGHT_IRIS_LANDMARK_INDICES } from '../../features/faceTracking/gaze/iris';
import { EAR_LANDMARK_INDICES } from '../../features/faceTracking/gaze/ear';
import { MAR_LANDMARK_INDICES } from '../../features/faceTracking/gaze/mar';
import './FaceTrackingDebugPage.css';

const IRIS_INDEX_SET = new Set<number>([...LEFT_IRIS_LANDMARK_INDICES, ...RIGHT_IRIS_LANDMARK_INDICES]);
const EAR_INDEX_SET = new Set<number>(Object.values(EAR_LANDMARK_INDICES));
const MAR_INDEX_SET = new Set<number>(Object.values(MAR_LANDMARK_INDICES));

function formatNumber(value: number, digits = 3): string {
  return value.toFixed(digits);
}

export default function FaceTrackingDebugPage() {
  const { permission, videoRef, errorMessage: cameraError, start, stop } = useCamera();
  const [mirrorStrategy, setMirrorStrategy] = useState<MirrorStrategy>(DEFAULT_MIRROR_STRATEGY);

  const { loadState, loadError, snapshot } = useFaceTracking({
    videoRef,
    active: permission === 'granted',
    mirrorStrategy,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // canonicalLandmarks(canonical=mirrored 좌표)를 CSS로 이미 좌우 반전된 video 위에
  // 그대로 겹쳐 그린다 — 좌표계가 이미 canonical(mirrored)이므로 추가 반전이 필요 없다.
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) {
      return;
    }

    const width = video.clientWidth;
    const height = video.clientHeight;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const landmarks = snapshot.canonicalLandmarks;
    if (!landmarks || width === 0 || height === 0) {
      return;
    }

    landmarks.forEach((point, index) => {
      const px = point.x * width;
      const py = point.y * height;

      let radius = 1;
      let color = 'rgba(255, 255, 255, 0.25)';

      if (IRIS_INDEX_SET.has(index)) {
        radius = 2.5;
        color = '#22d3ee';
      } else if (EAR_INDEX_SET.has(index)) {
        radius = 3;
        color = '#f97316';
      } else if (MAR_INDEX_SET.has(index)) {
        radius = 3;
        color = '#e879f9';
      }

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    if (snapshot.signal) {
      // 최종 합성 iris 중심(좌우 평균의 평균)을 크게 강조 표시
      ctx.beginPath();
      ctx.arc(snapshot.signal.irisX * width, snapshot.signal.irisY * height, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    }
  }, [snapshot, videoRef]);

  const handleStart = () => {
    void start();
  };

  return (
    <main className="page">
      <section className="card wide facetracking-debug">
        <h1>Face Tracking Debug (Front Step 0)</h1>
        <p>
          제품 UI가 아니라 카메라 → FaceLandmarker → iris/EAR/MAR 파이프라인과 Mirror 전략 A/B를
          검증하기 위한 개발용 화면입니다.
        </p>

        <div className="button-group">
          <button type="button" onClick={handleStart} disabled={permission === 'granted' || permission === 'requesting'}>
            카메라 시작
          </button>
          <button type="button" onClick={stop} disabled={permission !== 'granted'}>
            카메라 정지
          </button>
        </div>

        <p>카메라 권한 상태: <strong>{permission}</strong></p>
        {cameraError && <p className="facetracking-debug-error">카메라 오류: {cameraError}</p>}

        <fieldset className="facetracking-debug-mirror">
          <legend>Mirror 전략 (§5.3 A/B 비교)</legend>
          {MIRROR_STRATEGIES.map((strategy) => (
            <label key={strategy}>
              <input
                type="radio"
                name="mirror-strategy"
                value={strategy}
                checked={mirrorStrategy === strategy}
                onChange={() => setMirrorStrategy(strategy)}
              />
              {MIRROR_STRATEGY_LABELS[strategy]}
            </label>
          ))}
        </fieldset>

        <div className="facetracking-debug-video-wrap">
          <video ref={videoRef} className="facetracking-debug-video" playsInline muted />
          <canvas ref={canvasRef} className="facetracking-debug-overlay" />
        </div>

        <p>FaceLandmarker 상태: <strong>{loadState}</strong>{loadError && ` — ${loadError}`}</p>

        <dl className="facetracking-debug-readout">
          <div>
            <dt>FPS</dt>
            <dd>{formatNumber(snapshot.fps, 1)}</dd>
          </div>
          <div>
            <dt>delegate</dt>
            <dd>{snapshot.delegate ?? '-'}</dd>
          </div>
          <div>
            <dt>landmark count</dt>
            <dd>{snapshot.landmarkCount || '-'}</dd>
          </div>
          <div>
            <dt>mirror strategy</dt>
            <dd>{MIRROR_STRATEGY_LABELS[mirrorStrategy]}</dd>
          </div>
          <div>
            <dt>irisX</dt>
            <dd>{snapshot.signal ? formatNumber(snapshot.signal.irisX) : '-'}</dd>
          </div>
          <div>
            <dt>irisY</dt>
            <dd>{snapshot.signal ? formatNumber(snapshot.signal.irisY) : '-'}</dd>
          </div>
          <div>
            <dt>EAR</dt>
            <dd>{snapshot.signal ? formatNumber(snapshot.signal.ear) : '-'}</dd>
          </div>
          <div>
            <dt>MAR</dt>
            <dd>{snapshot.signal ? formatNumber(snapshot.signal.mar) : '-'}</dd>
          </div>
          <div>
            <dt>eyeClosed</dt>
            <dd>{snapshot.signal ? String(snapshot.signal.eyeClosed) : '-'}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
